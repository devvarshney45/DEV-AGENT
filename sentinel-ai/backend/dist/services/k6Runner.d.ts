export interface K6Config {
    target: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: unknown;
    headers?: Record<string, string>;
    vus: number;
    durationSeconds: number;
    rampUp?: boolean;
}
export interface K6Result {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    errorRate: number;
    avgLatencyMs: number;
    p90LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    throughputRps: number;
    statusDistrib: Record<string, number>;
    rawSummary: string;
    k6Available: boolean;
}
export declare function generateK6Script(cfg: K6Config): string;
export declare function runK6LoadTest(rawCfg: K6Config): Promise<K6Result>;
//# sourceMappingURL=k6Runner.d.ts.map