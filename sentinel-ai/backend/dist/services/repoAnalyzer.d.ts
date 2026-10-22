export interface DiscoveredEndpoint {
    method: string;
    path: string;
    controller?: string;
    sourceFile?: string;
    sourceLine?: number;
    authRequired: boolean;
    roles: string[];
    middleware: string[];
    requestBodySchema?: Record<string, unknown>;
    description?: string;
}
export interface AnalysisResult {
    framework: string;
    language: string;
    packageManager: string;
    endpoints: DiscoveredEndpoint[];
    authMechanism: string[];
    rateLimitDetected: boolean;
    rateLimitConfig?: Record<string, unknown>;
    validationLibrary?: string;
    dbLibraries: string[];
    totalFilesScanned: number;
    warnings: string[];
}
export declare function cloneRepository(githubUrl: string): Promise<string>;
export declare function listRepoFiles(repoPath: string): string[];
export declare function safeReadFile(filePath: string): string | null;
export declare function analyzeRepository(repoPath: string): Promise<AnalysisResult>;
//# sourceMappingURL=repoAnalyzer.d.ts.map