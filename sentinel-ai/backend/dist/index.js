"use strict";
// ============================================================
// src/index.ts — Application entry point.
// Sets up Express with security middleware, mounts routes,
// connects to the database, and starts listening.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("./config/env");
const prisma_1 = require("./lib/prisma");
const errorHandler_1 = require("./middleware/errorHandler");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const projectRoutes_1 = __importDefault(require("./routes/projectRoutes"));
const scanRoutes_1 = __importDefault(require("./routes/scanRoutes"));
const app = (0, express_1.default)();
// ── Security middleware ────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: env_1.config.frontendUrl,
    credentials: true,
}));
// Rate limiting for the SentinelAI API itself
app.use('/api/auth', (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    message: { error: 'Too many auth requests' },
}));
// ── Parsing ────────────────────────────────────────────────
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// ── Logging ────────────────────────────────────────────────
if (env_1.config.nodeEnv !== 'test') {
    app.use((0, morgan_1.default)('dev'));
}
// ── Health check ───────────────────────────────────────────
app.get('/health', async (_req, res) => {
    let dbStatus = 'ok';
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
    }
    catch {
        dbStatus = 'unavailable';
    }
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        db: dbStatus,
        groq: env_1.config.groqApiKey ? 'configured' : 'not_configured',
        env: env_1.config.nodeEnv,
    });
});
// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes_1.default);
app.use('/api/projects', projectRoutes_1.default);
app.use('/api/projects', scanRoutes_1.default);
// ── 404 handler ────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// ── Global error handler ───────────────────────────────────
app.use(errorHandler_1.errorHandler);
// ── Start server ───────────────────────────────────────────
async function main() {
    try {
        // Verify DB connection
        await prisma_1.prisma.$connect();
        console.log('[DB] Connected to PostgreSQL');
    }
    catch (err) {
        console.warn('[DB] PostgreSQL not available:', err instanceof Error ? err.message : err);
        console.warn('[DB] Some features will be unavailable. Run: prisma migrate dev');
    }
    app.listen(env_1.config.port, () => {
        console.log(`
╔═══════════════════════════════════════════╗
║         SentinelAI Backend v2.0           ║
╠═══════════════════════════════════════════╣
║  Port:     ${env_1.config.port}                          ║
║  Env:      ${env_1.config.nodeEnv.padEnd(16)}             ║
║  Groq:     ${env_1.config.groqApiKey ? '✓ configured   ' : '✗ not set     '}             ║
╚═══════════════════════════════════════════╝
    `);
    });
    // Start embedded BullMQ scan worker for single-container/Render/Railway deployment
    if (process.env.EMBEDDED_WORKER === 'true' || process.env.NODE_ENV === 'production') {
        try {
            const { startWorker } = await Promise.resolve().then(() => __importStar(require('./workers/scanWorker')));
            startWorker();
            console.log('[Worker] Embedded BullMQ scan worker initialized');
        }
        catch (e) {
            console.warn('[Worker] Could not start embedded worker:', e.message);
        }
    }
}
main().catch(console.error);
exports.default = app;
//# sourceMappingURL=index.js.map