"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
// ============================================================
// src/config/env.ts — Validate all required env vars at boot.
// Crashes fast if a required variable is missing, so the
// developer knows immediately rather than getting cryptic
// runtime errors later.
// ============================================================
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(name, fallback) {
    const val = process.env[name] ?? fallback;
    if (!val) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return val;
}
function optionalEnv(name, fallback) {
    return process.env[name] ?? fallback;
}
exports.config = {
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    port: parseInt(optionalEnv('PORT', '5001'), 10),
    frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:3000'),
    // JWT — required
    jwtSecret: requireEnv('JWT_SECRET', 'dev_jwt_secret_change_in_production_please'),
    jwtExpiresIn: optionalEnv('JWT_EXPIRES_IN', '7d'),
    // Database — required
    databaseUrl: requireEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/sentinelai'),
    // Redis — required for BullMQ worker
    redisUrl: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
    // Groq — optional; features degrade gracefully if missing
    groqApiKey: process.env.GROQ_API_KEY ?? '',
    groqModel: optionalEnv('GROQ_MODEL', 'llama-3.3-70b-versatile'),
    // GitHub — optional
    githubToken: process.env.GITHUB_TOKEN ?? '',
    // Workspace directory for cloned repos
    workspaceDir: optionalEnv('WORKSPACE_DIR', '/tmp/sentinel-workspaces'),
    // Agent limits
    agentMaxIterations: parseInt(optionalEnv('AGENT_MAX_ITERATIONS', '20'), 10),
    agentMaxToolCalls: parseInt(optionalEnv('AGENT_MAX_TOOL_CALLS', '50'), 10),
    agentTimeoutSeconds: parseInt(optionalEnv('AGENT_TIMEOUT_SECONDS', '300'), 10),
    // Load test limits
    k6MaxVus: parseInt(optionalEnv('K6_MAX_VUS', '100'), 10),
    k6MaxDurationSeconds: parseInt(optionalEnv('K6_MAX_DURATION_SECONDS', '60'), 10),
    requireLoadTestApproval: optionalEnv('REQUIRE_LOAD_TEST_APPROVAL', 'true') === 'true',
};
//# sourceMappingURL=env.js.map