export declare const config: {
    nodeEnv: string;
    port: number;
    frontendUrl: string;
    jwtSecret: string;
    jwtExpiresIn: string;
    databaseUrl: string;
    redisUrl: string;
    groqApiKey: string;
    groqModel: string;
    githubToken: string;
    workspaceDir: string;
    agentMaxIterations: number;
    agentMaxToolCalls: number;
    agentTimeoutSeconds: number;
    k6MaxVus: number;
    k6MaxDurationSeconds: number;
    requireLoadTestApproval: boolean;
};
export type Config = typeof config;
//# sourceMappingURL=env.d.ts.map