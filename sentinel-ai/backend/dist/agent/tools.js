"use strict";
// ============================================================
// src/agent/tools.ts
// LangChain-compatible tool definitions that the Groq LLM
// can call via function calling.
//
// IMPORTANT DESIGN PRINCIPLE:
//   The LLM decides WHAT tool to call and with WHAT arguments.
//   The actual execution happens here in TypeScript — not in
//   the LLM. The LLM cannot run arbitrary code.
//
// Each tool:
//   - has a typed Zod schema (sent to Groq as tool spec)
//   - validates incoming arguments
//   - calls the appropriate service function
//   - returns a JSON-serializable result
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
exports.allTools = exports.generateK6ScriptTool = exports.runK6LoadTestTool = exports.testObjectAuthorizationTool = exports.testInputValidationTool = exports.testRateLimitTool = exports.testAuthorizationTool = exports.testAuthenticationTool = exports.loginTestUserTool = exports.createTestUserTool = exports.sendRequestTool = exports.readFileTool = void 0;
const zod_1 = require("zod");
const tools_1 = require("@langchain/core/tools");
const apiTester_1 = require("../services/apiTester");
const k6Runner_1 = require("../services/k6Runner");
// ── Repository Tools ──────────────────────────────────────
exports.readFileTool = new tools_1.DynamicStructuredTool({
    name: 'readRepositoryFile',
    description: 'Read the content of a specific file in an already-cloned repository. Use the absolute path returned by listRepositoryFiles.',
    schema: zod_1.z.object({
        filePath: zod_1.z.string().describe('Absolute path to the file to read'),
    }),
    func: async ({ filePath }) => {
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        // Path traversal guard: must be under workspace
        const workspaceDir = process.env.WORKSPACE_DIR ?? '/tmp/sentinel-workspaces';
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(workspaceDir)) {
            return JSON.stringify({ error: 'Path traversal blocked: file is outside workspace' });
        }
        // Block .env files
        if (/^\.env/.test(path.basename(resolved))) {
            return JSON.stringify({ error: 'Blocked: .env files are never exposed' });
        }
        try {
            const content = fs.readFileSync(resolved, 'utf-8').slice(0, 20000);
            return JSON.stringify({ content, truncated: content.length === 20000 });
        }
        catch (err) {
            return JSON.stringify({ error: `Cannot read file: ${err}` });
        }
    },
});
// ── API Testing Tools ─────────────────────────────────────
exports.sendRequestTool = new tools_1.DynamicStructuredTool({
    name: 'sendApiRequest',
    description: 'Send a single HTTP request to the target API. Use for functional testing and verification. Target must be localhost or an authorized host.',
    schema: zod_1.z.object({
        method: zod_1.z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
        url: zod_1.z.string().describe('Full URL e.g. http://localhost:4000/products'),
        headers: zod_1.z.record(zod_1.z.string()).optional(),
        body: zod_1.z.unknown().optional(),
        timeoutMs: zod_1.z.number().optional().default(8000),
    }),
    func: async ({ method, url, headers, body, timeoutMs }) => {
        const result = await (0, apiTester_1.sendApiRequest)({ method, url, headers, body, timeoutMs });
        return JSON.stringify(result);
    },
});
exports.createTestUserTool = new tools_1.DynamicStructuredTool({
    name: 'createTestUser',
    description: 'Register a test user on the target application. Used to set up test identities for auth/authz testing.',
    schema: zod_1.z.object({
        baseUrl: zod_1.z.string(),
        signupPath: zod_1.z.string().describe('e.g. /auth/signup'),
        username: zod_1.z.string(),
        password: zod_1.z.string(),
        email: zod_1.z.string().optional(),
        role: zod_1.z.string().optional().describe('Set only to test mass-assignment vulnerability'),
    }),
    func: async ({ baseUrl, signupPath, username, password, email, role }) => {
        const result = await (0, apiTester_1.createTestUser)(baseUrl, signupPath, { username, password, email, role });
        return JSON.stringify(result);
    },
});
exports.loginTestUserTool = new tools_1.DynamicStructuredTool({
    name: 'loginTestUser',
    description: 'Login with credentials and retrieve an auth token for subsequent requests.',
    schema: zod_1.z.object({
        baseUrl: zod_1.z.string(),
        loginPath: zod_1.z.string().describe('e.g. /auth/login'),
        email: zod_1.z.string().optional(),
        username: zod_1.z.string().optional(),
        password: zod_1.z.string(),
    }),
    func: async ({ baseUrl, loginPath, email, username, password }) => {
        const result = await (0, apiTester_1.loginTestUser)(baseUrl, loginPath, { email, username, password });
        return JSON.stringify(result);
    },
});
// ── Security Testing Tools ────────────────────────────────
exports.testAuthenticationTool = new tools_1.DynamicStructuredTool({
    name: 'testAuthentication',
    description: 'Test whether an endpoint correctly rejects unauthenticated requests (missing token, invalid token). Returns assessment.',
    schema: zod_1.z.object({
        baseUrl: zod_1.z.string(),
        method: zod_1.z.string(),
        path: zod_1.z.string(),
    }),
    func: async ({ baseUrl, method, path }) => {
        const result = await (0, apiTester_1.testAuthentication)(baseUrl, { method, path });
        return JSON.stringify(result);
    },
});
exports.testAuthorizationTool = new tools_1.DynamicStructuredTool({
    name: 'testAuthorization',
    description: 'Test whether a normal user can access an endpoint that should be restricted (e.g. admin-only routes). Provide the normal user token.',
    schema: zod_1.z.object({
        baseUrl: zod_1.z.string(),
        method: zod_1.z.string(),
        path: zod_1.z.string(),
        normalUserToken: zod_1.z.string(),
        expectedStatus: zod_1.z.array(zod_1.z.number()).describe('e.g. [401, 403] for restricted endpoints'),
    }),
    func: async ({ baseUrl, method, path, normalUserToken, expectedStatus }) => {
        const result = await (0, apiTester_1.testAuthorization)(baseUrl, { method, path }, normalUserToken, expectedStatus);
        return JSON.stringify(result);
    },
});
exports.testRateLimitTool = new tools_1.DynamicStructuredTool({
    name: 'testRateLimit',
    description: 'Send N requests to an endpoint (in controlled batches) to determine if rate limiting is enforced. Returns status distribution and whether 429 was triggered.',
    schema: zod_1.z.object({
        baseUrl: zod_1.z.string(),
        method: zod_1.z.string(),
        path: zod_1.z.string(),
        requests: zod_1.z.number().min(1).max(200).describe('Total number of requests to send'),
        concurrency: zod_1.z.number().min(1).max(20).describe('Parallel requests per batch'),
        body: zod_1.z.unknown().optional(),
        headers: zod_1.z.record(zod_1.z.string()).optional(),
    }),
    func: async ({ baseUrl, method, path, requests, concurrency, body, headers }) => {
        const result = await (0, apiTester_1.testRateLimit)(baseUrl, { method, path }, { requests, concurrency, body, headers });
        return JSON.stringify(result);
    },
});
exports.testInputValidationTool = new tools_1.DynamicStructuredTool({
    name: 'testInputValidation',
    description: 'Send multiple malformed/boundary payloads to an endpoint and verify validation is enforced (expect 400/422 for bad inputs).',
    schema: zod_1.z.object({
        baseUrl: zod_1.z.string(),
        method: zod_1.z.string(),
        path: zod_1.z.string(),
        testCases: zod_1.z.array(zod_1.z.object({
            label: zod_1.z.string(),
            body: zod_1.z.unknown(),
            expectedStatus: zod_1.z.array(zod_1.z.number()),
        })),
    }),
    func: async ({ baseUrl, method, path, testCases }) => {
        const result = await (0, apiTester_1.testInputValidation)(baseUrl, { method, path }, testCases);
        return JSON.stringify(result);
    },
});
exports.testObjectAuthorizationTool = new tools_1.DynamicStructuredTool({
    name: 'testObjectAuthorization',
    description: 'Test IDOR (Insecure Direct Object Reference): try to access a resource belonging to another user using an attacker token.',
    schema: zod_1.z.object({
        baseUrl: zod_1.z.string(),
        method: zod_1.z.string(),
        path: zod_1.z.string().describe('Path with :id placeholder e.g. /users/:id'),
        attackerToken: zod_1.z.string(),
        victimResourceId: zod_1.z.string().describe('The ID of the resource owned by the victim user'),
    }),
    func: async ({ baseUrl, method, path, attackerToken, victimResourceId }) => {
        const result = await (0, apiTester_1.testObjectAuthorization)(baseUrl, { method, path }, attackerToken, victimResourceId);
        return JSON.stringify(result);
    },
});
// ── Load Testing Tool ─────────────────────────────────────
exports.runK6LoadTestTool = new tools_1.DynamicStructuredTool({
    name: 'runK6LoadTest',
    description: 'Run a controlled k6 load test. REQUIRES prior human approval for high-VU tests. Caps are enforced server-side. Returns real metrics only.',
    schema: zod_1.z.object({
        target: zod_1.z.string().describe('Full URL to load test'),
        method: zod_1.z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
        vus: zod_1.z.number().min(1).max(100).describe('Virtual users (concurrent connections)'),
        durationSeconds: zod_1.z.number().min(5).max(60).describe('Test duration in seconds'),
        body: zod_1.z.unknown().optional(),
        headers: zod_1.z.record(zod_1.z.string()).optional(),
        rampUp: zod_1.z.boolean().optional().default(false),
        approved: zod_1.z.boolean().describe('Must be true — confirms user has explicitly authorized this load test'),
    }),
    func: async ({ target, method, vus, durationSeconds, body, headers, rampUp, approved }) => {
        if (!approved) {
            return JSON.stringify({
                error: 'Load test requires explicit user approval. Set approved=true only after user confirms authorization.',
            });
        }
        const result = await (0, k6Runner_1.runK6LoadTest)({ target, method, vus, durationSeconds, body, headers, rampUp });
        return JSON.stringify(result);
    },
});
exports.generateK6ScriptTool = new tools_1.DynamicStructuredTool({
    name: 'generateK6Script',
    description: 'Generate (but not execute) a k6 test script. Use this to show the user what would be run before requesting approval.',
    schema: zod_1.z.object({
        target: zod_1.z.string(),
        method: zod_1.z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
        vus: zod_1.z.number().min(1).max(100),
        durationSeconds: zod_1.z.number().min(5).max(60),
        body: zod_1.z.unknown().optional(),
        headers: zod_1.z.record(zod_1.z.string()).optional(),
    }),
    func: async ({ target, method, vus, durationSeconds, body, headers }) => {
        const script = (0, k6Runner_1.generateK6Script)({ target, method, vus, durationSeconds, body, headers });
        return JSON.stringify({ script });
    },
});
// ── All tools exported as array ───────────────────────────
exports.allTools = [
    exports.readFileTool,
    exports.sendRequestTool,
    exports.createTestUserTool,
    exports.loginTestUserTool,
    exports.testAuthenticationTool,
    exports.testAuthorizationTool,
    exports.testRateLimitTool,
    exports.testInputValidationTool,
    exports.testObjectAuthorizationTool,
    exports.runK6LoadTestTool,
    exports.generateK6ScriptTool,
];
//# sourceMappingURL=tools.js.map