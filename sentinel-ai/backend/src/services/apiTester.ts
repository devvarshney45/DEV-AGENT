// ============================================================
// src/services/apiTester.ts
// Controlled HTTP testing tools.
// These are called by the agent — NOT by the LLM directly.
// Each function: validates inputs, applies limits, returns
// structured results for the agent to reason about.
// ============================================================

import axios, { AxiosResponse } from 'axios';

export interface ApiRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  timeoutMs?: number;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  error?: string;
}

// Only allow requests to localhost/private IP ranges unless explicitly authorized
const ALLOWED_HOSTS = [
  '127.0.0.1', 'localhost', '::1',
  '0.0.0.0',
];

function isAllowedTarget(url: string): { allowed: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Allow localhost
    if (ALLOWED_HOSTS.includes(hostname)) return { allowed: true };

    // Allow private IP ranges (RFC 1918)
    const parts = hostname.split('.').map(Number);
    if (parts[0] === 10) return { allowed: true };
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return { allowed: true };
    if (parts[0] === 192 && parts[1] === 168) return { allowed: true };

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
  } catch {
    return { allowed: false, reason: 'Invalid URL' };
  }
}

// Core HTTP request tool
export async function sendApiRequest(cfg: ApiRequestConfig): Promise<ApiResponse> {
  const check = isAllowedTarget(cfg.url);
  if (!check.allowed) {
    throw new Error(`SSRF/Target guard blocked request: ${check.reason}`);
  }

  const start = Date.now();
  try {
    const resp: AxiosResponse = await axios({
      method: cfg.method,
      url: cfg.url,
      headers: cfg.headers ?? {},
      data: cfg.body,
      params: cfg.params,
      timeout: cfg.timeoutMs ?? 10_000,
      validateStatus: () => true, // Don't throw on 4xx/5xx
      maxRedirects: 3,
    });

    const durationMs = Date.now() - start;
    return {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers as Record<string, string>,
      body: resp.data,
      durationMs,
    };
  } catch (err: unknown) {
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
export async function createTestUser(
  baseUrl: string,
  signupPath: string,
  credentials: { username: string; password: string; email?: string; role?: string }
): Promise<{ userId?: string; username: string; token?: string; error?: string }> {
  const url = `${baseUrl}${signupPath}`;
  const resp = await sendApiRequest({
    method: 'POST',
    url,
    body: credentials,
  });

  if (resp.status >= 200 && resp.status < 300) {
    const data = resp.body as Record<string, unknown>;
    return {
      userId: (data.id ?? data.userId ?? data._id) as string | undefined,
      username: credentials.username,
      token: (data.token ?? data.accessToken) as string | undefined,
    };
  }

  return { username: credentials.username, error: `Signup returned ${resp.status}: ${JSON.stringify(resp.body)}` };
}

// Login and retrieve a token
export async function loginTestUser(
  baseUrl: string,
  loginPath: string,
  credentials: { email?: string; username?: string; password: string }
): Promise<{ token?: string; userId?: string; role?: string; error?: string }> {
  const resp = await sendApiRequest({
    method: 'POST',
    url: `${baseUrl}${loginPath}`,
    body: credentials,
  });

  if (resp.status >= 200 && resp.status < 300) {
    const data = resp.body as Record<string, unknown>;
    const token =
      (data.token ?? data.accessToken ?? data.access_token) as string | undefined;
    const user = (data.user ?? data.data) as Record<string, unknown> | undefined;
    return {
      token,
      userId: (user?.id ?? user?.userId ?? user?._id) as string | undefined,
      role: (user?.role) as string | undefined,
    };
  }

  return { error: `Login returned ${resp.status}: ${JSON.stringify(resp.body)}` };
}

// Test authentication — checks what happens without / with invalid tokens
export async function testAuthentication(
  baseUrl: string,
  endpoint: { method: string; path: string }
): Promise<{
  withoutToken: ApiResponse;
  withInvalidToken: ApiResponse;
  assessment: string;
}> {
  const url = `${baseUrl}${endpoint.path}`;

  const withoutToken = await sendApiRequest({
    method: endpoint.method as ApiRequestConfig['method'],
    url,
  });

  const withInvalidToken = await sendApiRequest({
    method: endpoint.method as ApiRequestConfig['method'],
    url,
    headers: { Authorization: 'Bearer invalid.token.here' },
  });

  let assessment = '';
  if (withoutToken.status === 401 || withoutToken.status === 403) {
    assessment = 'PASS: Endpoint correctly rejects unauthenticated requests.';
  } else if (withoutToken.status < 400) {
    assessment = 'POTENTIAL_ISSUE: Endpoint returns 2xx without authentication. Verify if this is intentional.';
  } else {
    assessment = `INFO: Endpoint returned ${withoutToken.status} without auth.`;
  }

  return { withoutToken, withInvalidToken, assessment };
}

// Test authorization — normal user trying to access admin/other-user resource
export async function testAuthorization(
  baseUrl: string,
  endpoint: { method: string; path: string },
  normalUserToken: string,
  expectedStatus: number[]
): Promise<{ response: ApiResponse; passed: boolean; assessment: string }> {
  const url = `${baseUrl}${endpoint.path}`;
  const response = await sendApiRequest({
    method: endpoint.method as ApiRequestConfig['method'],
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
export async function testRateLimit(
  baseUrl: string,
  endpoint: { method: string; path: string },
  config: { requests: number; concurrency: number; body?: unknown; headers?: Record<string, string> }
): Promise<{
  totalSent: number;
  rateLimitHit: boolean;
  firstRateLimitAt?: number;
  statusCounts: Record<number, number>;
  assessment: string;
}> {
  const url = `${baseUrl}${endpoint.path}`;
  const { requests, concurrency, body, headers } = config;
  const statusCounts: Record<number, number> = {};
  let firstRateLimitAt: number | undefined;
  let rateLimitHit = false;

  // Send in batches of concurrency
  let sent = 0;
  for (let i = 0; i < Math.ceil(requests / concurrency); i++) {
    const batch = Math.min(concurrency, requests - sent);
    const promises = Array.from({ length: batch }, (_, idx) =>
      sendApiRequest({
        method: endpoint.method as ApiRequestConfig['method'],
        url,
        headers: headers ?? {},
        body,
        timeoutMs: 8_000,
      }).then((resp) => {
        const reqNum = sent + idx + 1;
        statusCounts[resp.status] = (statusCounts[resp.status] ?? 0) + 1;
        if (resp.status === 429 && !rateLimitHit) {
          rateLimitHit = true;
          firstRateLimitAt = reqNum;
        }
      })
    );

    await Promise.all(promises);
    sent += batch;
  }

  const assessment = rateLimitHit
    ? `Rate limit triggered at request #${firstRateLimitAt} (${requests} total sent). Status distribution: ${JSON.stringify(statusCounts)}.`
    : `Rate limit NOT triggered after ${requests} requests. Status distribution: ${JSON.stringify(statusCounts)}. Possible misconfiguration.`;

  return { totalSent: requests, rateLimitHit, firstRateLimitAt, statusCounts, assessment };
}

// Test input validation — send bad payloads, check responses
export async function testInputValidation(
  baseUrl: string,
  endpoint: { method: string; path: string },
  testCases: Array<{ label: string; body: unknown; expectedStatus: number[] }>
): Promise<Array<{ label: string; status: number; passed: boolean; body: unknown }>> {
  const results = [];
  for (const tc of testCases) {
    const resp = await sendApiRequest({
      method: endpoint.method as ApiRequestConfig['method'],
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
export async function testObjectAuthorization(
  baseUrl: string,
  endpoint: { method: string; path: string },
  attackerToken: string,
  victimResourceId: string
): Promise<{ response: ApiResponse; potentialIDOR: boolean; assessment: string }> {
  const urlWithId = `${baseUrl}${endpoint.path.replace(':id', victimResourceId).replace('{id}', victimResourceId)}`;
  const response = await sendApiRequest({
    method: endpoint.method as ApiRequestConfig['method'],
    url: urlWithId,
    headers: { Authorization: `Bearer ${attackerToken}` },
  });

  const potentialIDOR = response.status >= 200 && response.status < 300;
  const assessment = potentialIDOR
    ? `POTENTIAL_IDOR: Attacker received ${response.status} when accessing victim resource at ${urlWithId}. Confirm this is unauthorized access.`
    : `PASS: Access denied with status ${response.status} — ownership check appears enforced.`;

  return { response, potentialIDOR, assessment };
}
