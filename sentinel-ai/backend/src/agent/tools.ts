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

import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  sendApiRequest,
  createTestUser,
  loginTestUser,
  testAuthentication,
  testAuthorization,
  testRateLimit,
  testInputValidation,
  testObjectAuthorization,
} from '../services/apiTester';
import { runK6LoadTest, generateK6Script } from '../services/k6Runner';

// ── Repository Tools ──────────────────────────────────────

export const readFileTool = new DynamicStructuredTool({
  name: 'readRepositoryFile',
  description: 'Read the content of a specific file in an already-cloned repository. Use the absolute path returned by listRepositoryFiles.',
  schema: z.object({
    filePath: z.string().describe('Absolute path to the file to read'),
  }),
  func: async ({ filePath }) => {
    const fs = await import('fs');
    const path = await import('path');

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
      const content = fs.readFileSync(resolved, 'utf-8').slice(0, 20_000);
      return JSON.stringify({ content, truncated: content.length === 20_000 });
    } catch (err) {
      return JSON.stringify({ error: `Cannot read file: ${err}` });
    }
  },
});

// ── API Testing Tools ─────────────────────────────────────

export const sendRequestTool = new DynamicStructuredTool({
  name: 'sendApiRequest',
  description: 'Send a single HTTP request to the target API. Use for functional testing and verification. Target must be localhost or an authorized host.',
  schema: z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    url: z.string().describe('Full URL e.g. http://localhost:4000/products'),
    headers: z.record(z.string()).optional(),
    body: z.unknown().optional(),
    timeoutMs: z.number().optional().default(8000),
  }),
  func: async ({ method, url, headers, body, timeoutMs }) => {
    const result = await sendApiRequest({ method, url, headers, body, timeoutMs });
    return JSON.stringify(result);
  },
});

export const createTestUserTool = new DynamicStructuredTool({
  name: 'createTestUser',
  description: 'Register a test user on the target application. Used to set up test identities for auth/authz testing.',
  schema: z.object({
    baseUrl: z.string(),
    signupPath: z.string().describe('e.g. /auth/signup'),
    username: z.string(),
    password: z.string(),
    email: z.string().optional(),
    role: z.string().optional().describe('Set only to test mass-assignment vulnerability'),
  }),
  func: async ({ baseUrl, signupPath, username, password, email, role }) => {
    const result = await createTestUser(baseUrl, signupPath, { username, password, email, role });
    return JSON.stringify(result);
  },
});

export const loginTestUserTool = new DynamicStructuredTool({
  name: 'loginTestUser',
  description: 'Login with credentials and retrieve an auth token for subsequent requests.',
  schema: z.object({
    baseUrl: z.string(),
    loginPath: z.string().describe('e.g. /auth/login'),
    email: z.string().optional(),
    username: z.string().optional(),
    password: z.string(),
  }),
  func: async ({ baseUrl, loginPath, email, username, password }) => {
    const result = await loginTestUser(baseUrl, loginPath, { email, username, password });
    return JSON.stringify(result);
  },
});

// ── Security Testing Tools ────────────────────────────────

export const testAuthenticationTool = new DynamicStructuredTool({
  name: 'testAuthentication',
  description: 'Test whether an endpoint correctly rejects unauthenticated requests (missing token, invalid token). Returns assessment.',
  schema: z.object({
    baseUrl: z.string(),
    method: z.string(),
    path: z.string(),
  }),
  func: async ({ baseUrl, method, path }) => {
    const result = await testAuthentication(baseUrl, { method, path });
    return JSON.stringify(result);
  },
});

export const testAuthorizationTool = new DynamicStructuredTool({
  name: 'testAuthorization',
  description: 'Test whether a normal user can access an endpoint that should be restricted (e.g. admin-only routes). Provide the normal user token.',
  schema: z.object({
    baseUrl: z.string(),
    method: z.string(),
    path: z.string(),
    normalUserToken: z.string(),
    expectedStatus: z.array(z.number()).describe('e.g. [401, 403] for restricted endpoints'),
  }),
  func: async ({ baseUrl, method, path, normalUserToken, expectedStatus }) => {
    const result = await testAuthorization(baseUrl, { method, path }, normalUserToken, expectedStatus);
    return JSON.stringify(result);
  },
});

export const testRateLimitTool = new DynamicStructuredTool({
  name: 'testRateLimit',
  description: 'Send N requests to an endpoint (in controlled batches) to determine if rate limiting is enforced. Returns status distribution and whether 429 was triggered.',
  schema: z.object({
    baseUrl: z.string(),
    method: z.string(),
    path: z.string(),
    requests: z.number().min(1).max(200).describe('Total number of requests to send'),
    concurrency: z.number().min(1).max(20).describe('Parallel requests per batch'),
    body: z.unknown().optional(),
    headers: z.record(z.string()).optional(),
  }),
  func: async ({ baseUrl, method, path, requests, concurrency, body, headers }) => {
    const result = await testRateLimit(
      baseUrl,
      { method, path },
      { requests, concurrency, body, headers }
    );
    return JSON.stringify(result);
  },
});

export const testInputValidationTool = new DynamicStructuredTool({
  name: 'testInputValidation',
  description: 'Send multiple malformed/boundary payloads to an endpoint and verify validation is enforced (expect 400/422 for bad inputs).',
  schema: z.object({
    baseUrl: z.string(),
    method: z.string(),
    path: z.string(),
    testCases: z.array(
      z.object({
        label: z.string(),
        body: z.unknown(),
        expectedStatus: z.array(z.number()),
      })
    ),
  }),
  func: async ({ baseUrl, method, path, testCases }) => {
    const result = await testInputValidation(baseUrl, { method, path }, testCases as Array<{ label: string; body: unknown; expectedStatus: number[] }>);
    return JSON.stringify(result);
  },
});

export const testObjectAuthorizationTool = new DynamicStructuredTool({
  name: 'testObjectAuthorization',
  description: 'Test IDOR (Insecure Direct Object Reference): try to access a resource belonging to another user using an attacker token.',
  schema: z.object({
    baseUrl: z.string(),
    method: z.string(),
    path: z.string().describe('Path with :id placeholder e.g. /users/:id'),
    attackerToken: z.string(),
    victimResourceId: z.string().describe('The ID of the resource owned by the victim user'),
  }),
  func: async ({ baseUrl, method, path, attackerToken, victimResourceId }) => {
    const result = await testObjectAuthorization(baseUrl, { method, path }, attackerToken, victimResourceId);
    return JSON.stringify(result);
  },
});

// ── Load Testing Tool ─────────────────────────────────────

export const runK6LoadTestTool = new DynamicStructuredTool({
  name: 'runK6LoadTest',
  description: 'Run a controlled k6 load test. REQUIRES prior human approval for high-VU tests. Caps are enforced server-side. Returns real metrics only.',
  schema: z.object({
    target: z.string().describe('Full URL to load test'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    vus: z.number().min(1).max(100).describe('Virtual users (concurrent connections)'),
    durationSeconds: z.number().min(5).max(60).describe('Test duration in seconds'),
    body: z.unknown().optional(),
    headers: z.record(z.string()).optional(),
    rampUp: z.boolean().optional().default(false),
    approved: z.boolean().describe('Must be true — confirms user has explicitly authorized this load test'),
  }),
  func: async ({ target, method, vus, durationSeconds, body, headers, rampUp, approved }) => {
    if (!approved) {
      return JSON.stringify({
        error: 'Load test requires explicit user approval. Set approved=true only after user confirms authorization.',
      });
    }

    const result = await runK6LoadTest({ target, method, vus, durationSeconds, body, headers, rampUp });
    return JSON.stringify(result);
  },
});

export const generateK6ScriptTool = new DynamicStructuredTool({
  name: 'generateK6Script',
  description: 'Generate (but not execute) a k6 test script. Use this to show the user what would be run before requesting approval.',
  schema: z.object({
    target: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    vus: z.number().min(1).max(100),
    durationSeconds: z.number().min(5).max(60),
    body: z.unknown().optional(),
    headers: z.record(z.string()).optional(),
  }),
  func: async ({ target, method, vus, durationSeconds, body, headers }) => {
    const script = generateK6Script({ target, method, vus, durationSeconds, body, headers });
    return JSON.stringify({ script });
  },
});

// ── All tools exported as array ───────────────────────────

export const allTools = [
  readFileTool,
  sendRequestTool,
  createTestUserTool,
  loginTestUserTool,
  testAuthenticationTool,
  testAuthorizationTool,
  testRateLimitTool,
  testInputValidationTool,
  testObjectAuthorizationTool,
  runK6LoadTestTool,
  generateK6ScriptTool,
];
