export interface ScanJobData {
    agentRunId: string;
    projectId: string;
    instruction: string;
    mode: 'custom' | 'full_scan';
    targetUrl?: string;
    githubUrl?: string;
    localRepoPath?: string;
    loadTestApproved?: boolean;
}
export declare const SCAN_QUEUE_NAME = "sentinel-scans";
export declare function startWorker(): void;
//# sourceMappingURL=scanWorker.d.ts.map