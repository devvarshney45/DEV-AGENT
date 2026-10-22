"use strict";
// ============================================================
// src/services/apiTester.ts
// Controlled HTTP testing tools.
// These are called by the agent — NOT by the LLM directly.
// Each function: validates inputs, applies limits, returns
// structured results for the agent to reason about.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendApiRequest = sendApiRequest;
exports.createTestUser = createTestUser;
exports.loginTestUser = loginTestUser;
exports.testAuthentication = testAuthentication;
exports.testAuthorization = testAuthorization;
exports.testRateLimit = testRateLimit;
exports.testInputValidation = testInputValidation;
exports.testObjectAuthorization = testObjectAuthorization;
const axios_1 = __importDefault(require("axios"));
// Only allow requests to localhost/private IP ranges unless explicitly authorized
const ALLOWED_HOSTS = [
    '127.0.0.1', 'localhost', '::1',
    '0.0.0.0',
];
function isAllowedTarget(url) {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname;
        // Allow localhost
        if (ALLOWED_HOSTS.includes(hostname))
            return { allowed: true };
        // Allow private IP ranges (RFC 1918)
        const parts = hostname.split('.').map(Number);
        if (parts[0] === 10)
            return { allowed: true };
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
            return { allowed: true };
        if (parts[0] === 192 && parts[1] === 168)
            return { allowed: true };
        // For staging/non-localhost: check env authorization flag
        const authorizedTargets = (process.env.AUTHORIZED_TEST_TARGETS ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
        if (authorizedTargets.some((t) => hostname.endsWith(t))) {
            return { allowed: true };
        }
        return {
            allowed: false,
            reason: `Target "${hostname}" is not in the allowed list. Add it to AUTHORIZED_TEST_TARGETS env var or use localhost.`,
        };
    }
    catch {
        return { allowed: false, reason: 'Invalid URL' };
    }
}
// Core HTTP request tool
async function sendApiRequest(cfg) {
    const check = isAllowedTarget(cfg.url);
    if (!check.allowed) {
        throw new Error(`SSRF/Target guard blocked request: ${check.reason}`);
    }
    const start = Date.now();
    try {
        const resp = await (0, axios_1.default)({
            method: cfg.method,
            url: cfg.url,
            headers: cfg.headers ?? {},
            data: cfg.body,
            params: cfg.params,
            timeout: cfg.timeoutMs ?? 10000,
            validateStatus: () => true, // Don't throw on 4xx/5xx
            maxRedirects: 3,
        });
        const durationMs = Date.now() - start;
        return {
            status: resp.status,
            statusText: resp.statusText,
            headers: resp.headers,
            body: resp.data,
            durationMs,
        };
    }
    catch (err) {
        const durationMs = Date.now() - start;
        const msg = err instanceof Error ? err.message : String(err);
        return {
            status: 0,
            statusText: 'Network Error',
            headers: {},
            body: null,
            durationMs,
            error: msg,
        };
    }
}
// Create a test user on the target
async function createTestUser(baseUrl, signupPath, credentials) {
    const url = `${baseUrl}${signupPath}`;
    const resp = await sendApiRequest({
        method: 'POST',
        url,
        body: credentials,
    });
    if (resp.status >= 200 && resp.status < 300) {
        const data = resp.body;
        return {
            userId: (data.id ?? data.userId ?? data._id),
            username: credentials.username,
            token: (data.token ?? data.accessToken),
        };
    }
    return { username: credentials.username, error: `Signup returned ${resp.status}: ${JSON.stringify(resp.body)}` };
}
// Login and retrieve a token
async function loginTestUser(baseUrl, loginPath, credentials) {
    const resp = await sendApiRequest({
        method: 'POST',
        url: `${baseUrl}${loginPath}`,
        body: credentials,
    });
    if (resp.status >= 200 && resp.status < 300) {
        const data = resp.body;
        const token = (data.token ?? data.accessToken ?? data.access_token);
        const user = (data.user ?? data.data);
        return {
            token,
            userId: (user?.id ?? user?.userId ?? user?._id),
            role: (user?.role),
        };
    }
    return { error: `Login returned ${resp.status}: ${JSON.stringify(resp.body)}` };
}
// Test authentication — checks what happens without / with invalid tokens
async function testAuthentication(baseUrl, endpoint) {
    const url = `${baseUrl}${endpoint.path}`;
    const withoutToken = await sendApiRequest({
        method: endpoint.method,
        url,
    });
    const withInvalidToken = await sendApiRequest({
        method: endpoint.method,
        url,
        headers: { Authorization: 'Bearer invalid.token.here' },
    });
    let assessment = '';
    if (withoutToken.status === 401 || withoutToken.status === 403) {
        assessment = 'PASS: Endpoint correctly rejects unauthenticated requests.';
    }
    else if (withoutToken.status < 400) {
        assessment = 'POTENTIAL_ISSUE: Endpoint returns 2xx without authentication. Verify if this is intentional.';
    }
    else {
        assessment = `INFO: Endpoint returned ${withoutToken.status} without auth.`;
    }
    return { withoutToken, withInvalidToken, assessment };
}
// Test authorization — normal user trying to access admin/other-user resource
async function testAuthorization(baseUrl, endpoint, normalUserToken, expectedStatus) {
    const url = `${baseUrl}${endpoint.path}`;
    const response = await sendApiRequest({
        method: endpoint.method,
        url,
        headers: { Authorization: `Bearer ${normalUserToken}` },
    });
    const passed = expectedStatus.includes(response.status);
    const assessment = passed
        ? `PASS: Got expected status ${response.status}.`
        : `POTENTIAL_ISSUE: Got ${response.status}, expected one of ${expectedStatus.join('/')}. Verify authorization logic.`;
    return { response, passed, assessment };
}
// Test rate limiting — send N requests, track when 429 appears
async function testRateLimit(baseUrl, endpoint, config) {
    const url = `${baseUrl}${endpoint.path}`;
    const { requests, concurrency, body, headers } = config;
    const statusCounts = {};
    let firstRateLimitAt;
    let rateLimitHit = false;
    // Send in batches of concurrency
    let sent = 0;
    for (let i = 0; i < Math.ceil(requests / concurrency); i++) {
        const batch = Math.min(concurrency, requests - sent);
        const promises = Array.from({ length: batch }, (_, idx) => sendApiRequest({
            method: endpoint.method,
            url,
            headers: headers ?? {},
            body,
            timeoutMs: 8000,
        }).then((resp) => {
            const reqNum = sent + idx + 1;
            statusCounts[resp.status] = (statusCounts[resp.status] ?? 0) + 1;
            if (resp.status === 429 && !rateLimitHit) {
                rateLimitHit = true;
                firstRateLimitAt = reqNum;
            }
        }));
        await Promise.all(promises);
        sent += batch;
    }
    const assessment = rateLimitHit
        ? `Rate limit triggered at request #${firstRateLimitAt} (${requests} total sent). Status distribution: ${JSON.stringify(statusCounts)}.`
        : `Rate limit NOT triggered after ${requests} requests. Status distribution: ${JSON.stringify(statusCounts)}. Possible misconfiguration.`;
    return { totalSent: requests, rateLimitHit, firstRateLimitAt, statusCounts, assessment };
}
// Test input validation — send bad payloads, check responses
async function testInputValidation(baseUrl, endpoint, testCases) {
    const results = [];
    for (const tc of testCases) {
        const resp = await sendApiRequest({
            method: endpoint.method,
            url: `${baseUrl}${endpoint.path}`,
            body: tc.body,
        });
        results.push({
            label: tc.label,
            status: resp.status,
            passed: tc.expectedStatus.includes(resp.status),
            body: resp.body,
        });
    }
    return results;
}
// Test IDOR — access resource belonging to another user
async function testObjectAuthorization(baseUrl, endpoint, attackerToken, victimResourceId) {
    const urlWithId = `${baseUrl}${endpoint.path.replace(':id', victimResourceId).replace('{id}', victimResourceId)}`;
    const response = await sendApiRequest({
        method: endpoint.method,
        url: urlWithId,
        headers: { Authorization: `Bearer ${attackerToken}` },
    });
    const potentialIDOR = response.status >= 200 && response.status < 300;
    const assessment = potentialIDOR
        ? `POTENTIAL_IDOR: Attacker received ${response.status} when accessing victim resource at ${urlWithId}. Confirm this is unauthorized access.`
        : `PASS: Access denied with status ${response.status} — ownership check appears enforced.`;
    return { response, potentialIDOR, assessment };
}
//# sourceMappingURL=apiTester.js.map