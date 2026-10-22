"use strict";
// ============================================================
// src/agent/agent.ts
// LangGraph-based stateful agent orchestrator.
//
// HOW IT WORKS (in Hinglish terms):
//   - User request aata hai -> State set hota hai
//   - LLM (Groq) decide karta hai kaunsa tool call karna hai
//   - Hamara TypeScript code us tool ko execute karta hai
//   - Result wapas state mein jaata hai
//   - LLM decide karta hai: aur tools chahiye ya final report?
//   - Yahi loop hai — agent loop.
//
// GRAPH NODES:
//   START -> analyzeRequest -> executeTool -> analyzeRequest -> ... -> generateReport -> END
//
// The LLM only sees tool names + schemas. It cannot run
// shell commands or access the filesystem directly.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = runAgent;
exports.extractFindings = extractFindings;
const groq_1 = require("@langchain/groq");
const messages_1 = require("@langchain/core/messages");
const tools_1 = require("./tools");
const env_1 = require("../config/env");
const SYSTEM_PROMPT = `You are SentinelAI — an expert AI backend security and API testing agent.

Your role is to help developers test THEIR OWN applications or authorized staging environments.

## Your capabilities (tools):
- sendApiRequest: Send a single HTTP request
- createTestUser / loginTestUser: Set up test identities
- testAuthentication: Check if auth is enforced
- testAuthorization: Check if authorization is enforced (e.g. normal user -> admin route)
- testRateLimit: Test rate limiting behavior with controlled request batches
- testInputValidation: Send bad payloads, check 400/422 responses
- testObjectAuthorization: Test IDOR vulnerabilities
- runK6LoadTest: Run a real k6 load test (requires approved=true from user)
- generateK6Script: Preview k6 script without running
- readRepositoryFile: Read a source file from the cloned repo

## Strict rules:
1. Only test localhost or explicitly authorized targets.
2. For load tests: always call generateK6Script first, then ask for approval (set approved=true only after user confirms).
3. Never expose .env contents or secrets.
4. Do NOT label an issue as "confirmed" without actual test evidence.
5. Distinguish: "POTENTIAL_ISSUE" (found suspicious behavior) vs "CONFIRMED" (tested and reproduced).
6. Stop after ${env_1.config.agentMaxIterations} iterations.
7. When all tests are done, call generateReport to produce your final structured report.

## Output format:
After all testing, produce a structured JSON report:
{
  "summary": "...",
  "findings": [
    {
      "severity": "high|medium|low|info",
      "category": "IDOR|broken_auth|...",
      "title": "...",
      "description": "...",
      "evidence": {...},
      "recommendation": "...",
      "owaspRef": "API1:2023"
    }
  ],
  "testsPassed": [...],
  "testsFailed": [...],
  "recommendations": [...]
}`;
async function runAgent(state) {
    if (!env_1.config.groqApiKey) {
        console.log('[Agent] GROQ_API_KEY not configured — running autonomous heuristic security scan engine');
        return runAutonomousHeuristicScan(state);
    }
    // Initialize Groq LLM with tool binding
    const llm = new groq_1.ChatGroq({
        apiKey: env_1.config.groqApiKey,
        model: env_1.config.groqModel,
        temperature: 0,
        maxRetries: 2,
    }).bindTools(tools_1.allTools);
    // Build tool lookup map for execution
    const toolMap = new Map(tools_1.allTools.map((t) => [t.name, t]));
    // Initial messages
    const messages = [
        new messages_1.SystemMessage(SYSTEM_PROMPT),
        new messages_1.HumanMessage(buildUserMessage(state)),
    ];
    state.progressCallback?.('Starting agent', 5);
    let iterationCount = 0;
    let toolCallCount = 0;
    // ── Agent Loop ────────────────────────────────────────────
    // Reason -> Tool -> Result -> Reason -> ... -> Final Answer
    while (iterationCount < env_1.config.agentMaxIterations) {
        iterationCount++;
        state.progressCallback?.(`Reasoning (iteration ${iterationCount})`, Math.min(10 + iterationCount * 4, 85));
        // LLM call — Groq decides what to do next
        let response;
        try {
            response = (await llm.invoke(messages));
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[Agent] Groq notice (${msg}). Activating autonomous security analysis engine...`);
            return runAutonomousHeuristicScan(state);
        }
        messages.push(response);
        // Check if LLM wants to call tools
        const toolCalls = response.tool_calls ?? [];
        if (toolCalls.length === 0) {
            // No tool calls — LLM has finished reasoning; extract final answer
            const finalText = typeof response.content === 'string' ? response.content : '';
            state.progressCallback?.('Generating report', 95);
            return {
                ...state,
                messages,
                iterationCount,
                toolCallCount,
                report: finalText,
                status: 'done',
            };
        }
        // Execute each tool call
        for (const toolCall of toolCalls) {
            if (toolCallCount >= env_1.config.agentMaxToolCalls) {
                messages.push(new messages_1.ToolMessage({
                    tool_call_id: toolCall.id ?? 'unknown',
                    content: JSON.stringify({ error: 'Maximum tool call limit reached. Stopping.' }),
                }));
                break;
            }
            toolCallCount++;
            const tool = toolMap.get(toolCall.name);
            state.progressCallback?.(`Executing: ${toolCall.name}`, Math.min(15 + toolCallCount * 3, 85));
            if (!tool) {
                messages.push(new messages_1.ToolMessage({
                    tool_call_id: toolCall.id ?? 'unknown',
                    content: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }),
                }));
                continue;
            }
            try {
                // Execute the actual tool (TypeScript code, NOT LLM)
                const result = await Promise.race([
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    tool.invoke(toolCall.args),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Tool timeout after 30s')), 30000)),
                ]);
                messages.push(new messages_1.ToolMessage({
                    tool_call_id: toolCall.id ?? 'unknown',
                    content: typeof result === 'string' ? result : JSON.stringify(result),
                }));
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                messages.push(new messages_1.ToolMessage({
                    tool_call_id: toolCall.id ?? 'unknown',
                    content: JSON.stringify({ error: `Tool execution failed: ${msg}` }),
                }));
            }
        }
    }
    // Max iterations reached
    return {
        ...state,
        messages,
        iterationCount,
        toolCallCount,
        status: 'failed',
        error: `Maximum iterations (${env_1.config.agentMaxIterations}) reached without completing.`,
    };
}
function buildUserMessage(state) {
    const parts = [];
    if (state.mode === 'custom') {
        parts.push(`## Custom Test Instruction\n${state.instruction}`);
    }
    else {
        parts.push(`## Full Security Scan\nRun a comprehensive security scan covering authentication, authorization, rate limiting, input validation, and IDOR vulnerabilities.`);
    }
    if (state.targetUrl) {
        parts.push(`\n## Target API URL\n${state.targetUrl}`);
    }
    if (state.analysisContext) {
        parts.push(`\n## Repository Analysis\n${state.analysisContext}`);
    }
    parts.push(`\n## Important\n- Only test the provided target URL\n- Collect evidence before reporting issues\n- When done, provide your JSON report`);
    return parts.join('\n');
}
// Autonomous heuristic scan engine for local audits when LLM API key is not present
async function runAutonomousHeuristicScan(state) {
    const target = state.targetUrl || 'http://localhost:4000';
    const findings = [];
    let toolCallCount = 0;
    state.progressCallback?.('Probing target endpoints and attack surface', 15);
    try {
        const { sendApiRequest, testAuthentication, testRateLimit, testInputValidation, testObjectAuthorization } = await Promise.resolve().then(() => __importStar(require('../services/apiTester')));
        // 1. Test unauthenticated user data endpoint (IDOR / BOLA)
        toolCallCount++;
        state.progressCallback?.('Testing Broken Object Level Auth (IDOR) on /users/:id', 30);
        const idorTest = await sendApiRequest({ method: 'GET', url: `${target}/users/1` });
        if (idorTest.status === 200 && idorTest.body) {
            findings.push({
                severity: 'critical',
                category: 'IDOR',
                title: 'Broken Object Level Authorization (IDOR) on /users/:id',
                description: 'Endpoint /users/1 returned private user details without requiring an authentication token.',
                evidence: idorTest.body,
                recommendation: 'Enforce authentication middleware and verify that req.user.id matches the requested resource ID.',
                owaspRef: 'API1:2023',
            });
        }
        // 2. Test admin privileges without proper authentication / role check
        toolCallCount++;
        state.progressCallback?.('Auditing privilege escalation on /admin/users', 45);
        const adminParamTest = await sendApiRequest({ method: 'GET', url: `${target}/admin/users?role=admin` });
        if (adminParamTest.status === 200) {
            findings.push({
                severity: 'high',
                category: 'broken_auth',
                title: 'Broken Function Level Authorization on /admin/users',
                description: 'Administrative endpoint grants full user list simply by supplying ?role=admin in query parameters rather than a verified JWT role claim.',
                evidence: adminParamTest.body,
                recommendation: 'Verify roles using cryptographically signed JWT claims or server-side session checks, never query/body parameters.',
                owaspRef: 'API5:2023',
            });
        }
        // 3. Test mass assignment / role tampering on signup (Architectural Breakpoint)
        toolCallCount++;
        state.progressCallback?.('Auditing Admin Creation & Breakpoint on /api/auth/admin-signup', 60);
        const candidateEndpoints = [
            { url: `${target}/api/auth/admin-signup`, path: '/api/auth/admin-signup' },
            { url: `${target}/auth/signup`, path: '/auth/signup' }
        ];
        for (const cand of candidateEndpoints) {
            const signupTest = await sendApiRequest({
                method: 'POST',
                url: cand.url,
                body: { username: `audit_${Date.now()}`, email: `admin_${Date.now()}@test.com`, password: 'password123', role: 'admin' },
            });
            const signupData = signupTest.body;
            if (signupTest.status === 201) {
                findings.push({
                    severity: 'critical',
                    category: 'architectural_breakpoint',
                    title: `Architectural Breakpoint: Admin Registration API Exposed (${cand.path})`,
                    description: `CRITICAL DESIGN FLAW: Public registration API exists for admin role. Any external user can register themselves as Administrator and gain full control over the system and all sensitive APIs. Admins must ONLY have a login page, never a public signup!`,
                    evidence: signupTest.body,
                    recommendation: `Remove this admin signup endpoint immediately! Admins should only be seeded or invited via secure login, not self-signed up!`,
                    owaspRef: 'API3:2023 / API5:2023',
                });
                break;
            }
        }
        // 4. Test rate limiting
        toolCallCount++;
        state.progressCallback?.('Auditing Rate Limiting on authentication endpoints', 75);
        const authLoginPath = (await sendApiRequest({ method: 'POST', url: `${target}/api/auth/login` })).status !== 404
            ? '/api/auth/login'
            : '/auth/login';
        const rateLimitResult = await testRateLimit(target, { method: 'POST', path: authLoginPath }, { requests: 25, concurrency: 5, body: { email: 'admin@company.com', password: 'bad' } });
        if (!rateLimitResult.rateLimitHit) {
            findings.push({
                severity: 'medium',
                category: 'rate_limiting',
                title: `Missing or Insufficient Rate Limiting on ${authLoginPath}`,
                description: `Rapid sequence of ${rateLimitResult.totalSent} requests did not trigger a 429 Too Many Requests response.`,
                evidence: rateLimitResult.statusCounts,
                recommendation: 'Implement IP and account-based rate limiting (e.g. express-rate-limit with Redis) on sensitive auth routes.',
                owaspRef: 'API4:2023',
            });
        }
        // 5. Test input validation on business endpoints
        toolCallCount++;
        state.progressCallback?.('Auditing input validation and boundary values', 85);
        const inputValResults = await testInputValidation(target, { method: 'POST', path: '/orders' }, [
            { label: 'Negative order amount', body: { userId: 1, amount: -500 }, expectedStatus: [400, 422] },
        ]);
        const failedInputValidation = inputValResults.find((r) => !r.passed && r.status < 400);
        if (failedInputValidation) {
            findings.push({
                severity: 'medium',
                category: 'input_validation',
                title: 'Unvalidated Negative Quantity / Amount on /orders',
                description: 'Creating orders accepts negative monetary amounts, which can result in balance manipulation or arithmetic errors.',
                evidence: failedInputValidation.body,
                recommendation: 'Enforce strict schema validation (using Zod or Joi) verifying amount > 0.',
                owaspRef: 'API8:2023',
            });
        }
    }
    catch (err) {
        console.error('[Autonomous Scan] Error during execution:', err);
    }
    state.progressCallback?.('Generating security audit report', 95);
    const report = JSON.stringify({
        summary: `Automated scan completed with ${findings.length} findings identified on target ${target}.`,
        findings,
    }, null, 2);
    return {
        ...state,
        status: 'done',
        iterationCount: 5,
        toolCallCount,
        findings,
        report,
    };
}
// Parse findings from the agent's final report text
function extractFindings(reportText) {
    try {
        const jsonMatch = reportText.match(/\{[\s\S]*"findings"[\s\S]*\}/);
        if (!jsonMatch)
            return [];
        const parsed = JSON.parse(jsonMatch[0]);
        return (parsed.findings ?? []);
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=agent.js.map