// src/lib/api.ts — Typed API client for SentinelAI backend
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sentinel_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  signup: (data: { email: string; username: string; password: string }) =>
    request<{ token: string; user: User }>('/api/auth/signup', {
      method: 'POST', body: JSON.stringify(data),
    }),
  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify(data),
    }),
  me: () => request<{ user: User }>('/api/auth/me'),

  // Projects
  getProjects: () => request<{ projects: Project[] }>('/api/projects'),
  createProject: (data: { name: string; description?: string; githubUrl?: string; localPath?: string }) =>
    request<{ project: Project }>('/api/projects', {
      method: 'POST', body: JSON.stringify(data),
    }),
  uploadFolder: (data: { name: string; files: Array<{ path: string; content: string }> }) =>
    request<{ project: Project; localPath: string }>('/api/projects/upload-folder', {
      method: 'POST', body: JSON.stringify(data),
    }),
  getProject: (id: string) => request<{ project: Project }>(`/api/projects/${id}`),
  deleteProject: (id: string) =>
    request<{ message: string }>(`/api/projects/${id}`, { method: 'DELETE' }),

  // Scans
  startScan: (projectId: string, data: {
    mode: 'custom' | 'full_scan';
    instruction?: string;
    targetUrl?: string;
    githubUrl?: string;
    localRepoPath?: string;
    loadTestApproved?: boolean;
  }) => request<{ agentRunId: string; jobId: string }>(`/api/projects/${projectId}/scan`, {
    method: 'POST', body: JSON.stringify(data),
  }),
  getRuns: (projectId: string) =>
    request<{ runs: AgentRun[] }>(`/api/projects/${projectId}/runs`),
  getRun: (projectId: string, runId: string) =>
    request<{ run: AgentRun }>(`/api/projects/${projectId}/runs/${runId}`),

  // Results
  getFindings: (projectId: string) =>
    request<{ findings: Finding[] }>(`/api/projects/${projectId}/findings`),
  getApis: (projectId: string) =>
    request<{ endpoints: ApiEndpoint[] }>(`/api/projects/${projectId}/apis`),

  // Testing & Stress Testing
  testEndpoint: (projectId: string, data: { method: string; url: string; headers?: Record<string, string>; body?: unknown }) =>
    request<EndpointTestResult>(`/api/projects/${projectId}/test-endpoint`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  stressTest: (projectId: string, data: { method: string; url: string; requests?: number; concurrency?: number; headers?: Record<string, string>; body?: unknown }) =>
    request<StressTestResult>(`/api/projects/${projectId}/stress-test`, {
      method: 'POST', body: JSON.stringify(data),
    }),
};

// Types
export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  repository?: {
    localPath?: string;
    githubUrl?: string;
    framework?: string;
    language?: string;
    analysisStatus: string;
    _count?: { endpoints: number };
  };
  _count?: { agentRuns: number };
  agentRuns?: AgentRun[];
}

export interface AgentRun {
  id: string;
  mode: string;
  instruction: string;
  status: string;
  progress: number;
  currentStep?: string;
  iterations: number;
  toolCalls: number;
  error?: string;
  createdAt: string;
  _count?: { findings: number; testRuns: number };
  findings?: Finding[];
}

export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  evidence?: unknown;
  recommendation?: string;
  owaspRef?: string;
  createdAt: string;
}

export interface ApiEndpoint {
  id: string;
  method: string;
  path: string;
  sourceFile?: string;
  sourceLine?: number;
  authRequired: boolean;
  roles: string[];
  middleware: string[];
  requestBodySchema?: Record<string, unknown>;
  description?: string;
}

export interface EndpointTestResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  error?: string;
}

export interface StressTestResult {
  url: string;
  method: string;
  totalRequests: number;
  durationMs: number;
  reqPerSec: number;
  rateLimited: boolean;
  firstRateLimitAt?: number;
  statusCounts: Record<number, number>;
  verdict: string;
}
