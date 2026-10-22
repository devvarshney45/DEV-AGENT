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
export declare function sendApiRequest(cfg: ApiRequestConfig): Promise<ApiResponse>;
export declare function createTestUser(baseUrl: string, signupPath: string, credentials: {
    username: string;
    password: string;
    email?: string;
    role?: string;
}): Promise<{
    userId?: string;
    username: string;
    token?: string;
    error?: string;
}>;
export declare function loginTestUser(baseUrl: string, loginPath: string, credentials: {
    email?: string;
    username?: string;
    password: string;
}): Promise<{
    token?: string;
    userId?: string;
    role?: string;
    error?: string;
}>;
export declare function testAuthentication(baseUrl: string, endpoint: {
    method: string;
    path: string;
}): Promise<{
    withoutToken: ApiResponse;
    withInvalidToken: ApiResponse;
    assessment: string;
}>;
export declare function testAuthorization(baseUrl: string, endpoint: {
    method: string;
    path: string;
}, normalUserToken: string, expectedStatus: number[]): Promise<{
    response: ApiResponse;
    passed: boolean;
    assessment: string;
}>;
export declare function testRateLimit(baseUrl: string, endpoint: {
    method: string;
    path: string;
}, config: {
    requests: number;
    concurrency: number;
    body?: unknown;
    headers?: Record<string, string>;
}): Promise<{
    totalSent: number;
    rateLimitHit: boolean;
    firstRateLimitAt?: number;
    statusCounts: Record<number, number>;
    assessment: string;
}>;
export declare function testInputValidation(baseUrl: string, endpoint: {
    method: string;
    path: string;
}, testCases: Array<{
    label: string;
    body: unknown;
    expectedStatus: number[];
}>): Promise<Array<{
    label: string;
    status: number;
    passed: boolean;
    body: unknown;
}>>;
export declare function testObjectAuthorization(baseUrl: string, endpoint: {
    method: string;
    path: string;
}, attackerToken: string, victimResourceId: string): Promise<{
    response: ApiResponse;
    potentialIDOR: boolean;
    assessment: string;
}>;
//# sourceMappingURL=apiTester.d.ts.map