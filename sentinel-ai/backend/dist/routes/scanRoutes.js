"use strict";
// ============================================================
// src/routes/scanRoutes.ts
// Endpoints for triggering scans, polling progress via SSE,
// and retrieving results.
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bullmq_1 = require("bullmq");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const redis_1 = require("../lib/redis");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const scanWorker_1 = require("../workers/scanWorker");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
// Lazy-init BullMQ queue (so Redis failure doesn't crash startup)
let _queue = null;
function getQueue() {
    if (!_queue) {
        _queue = new bullmq_1.Queue(scanWorker_1.SCAN_QUEUE_NAME, {
            connection: (0, redis_1.getRedis)(),
            defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
        });
    }
    return _queue;
}
const startScanSchema = zod_1.z.object({
    mode: zod_1.z.enum(['custom', 'full_scan']),
    instruction: zod_1.z.string().min(1).max(2000).optional(),
    targetUrl: zod_1.z.string().url().optional(),
    githubUrl: zod_1.z.string().url().optional(),
    localRepoPath: zod_1.z.string().optional(),
    loadTestApproved: zod_1.z.boolean().optional().default(false),
});
// POST /api/projects/:id/scan — start a scan
router.post('/:id/scan', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const project = await prisma_1.prisma.project.findFirst({
        where: { id: req.params.id, userId: req.user.id },
        include: { repository: true },
    });
    if (!project)
        throw (0, errorHandler_1.createError)('Project not found', 404);
    const body = startScanSchema.safeParse(req.body);
    if (!body.success) {
        throw (0, errorHandler_1.createError)(body.error.errors.map((e) => e.message).join('; '), 400);
    }
    const { mode, instruction, targetUrl, githubUrl, localRepoPath, loadTestApproved } = body.data;
    if (mode === 'custom' && !instruction) {
        throw (0, errorHandler_1.createError)('Custom mode requires an instruction', 400);
    }
    // Determine effective target
    const effectiveTargetUrl = targetUrl ?? undefined;
    const effectiveGithubUrl = githubUrl ?? project.repository?.githubUrl ?? undefined;
    const effectiveLocalRepoPath = localRepoPath ?? project.repository?.localPath ?? undefined;
    // Check load test approval requirement
    if (env_1.config.requireLoadTestApproval &&
        instruction?.toLowerCase().includes('load') &&
        !loadTestApproved) {
        return res.status(202).json({
            requiresApproval: true,
            message: 'This test may involve a load test. Please confirm you own or are authorized to test this target, then re-submit with loadTestApproved: true.',
        });
    }
    // Create agent run record
    const agentRun = await prisma_1.prisma.agentRun.create({
        data: {
            projectId: project.id,
            instruction: instruction ?? 'Full security scan',
            mode,
            status: 'pending',
            progress: 0,
        },
    });
    // Enqueue job
    const jobData = {
        agentRunId: agentRun.id,
        projectId: project.id,
        instruction: instruction ?? 'Full security scan',
        mode,
        targetUrl: effectiveTargetUrl,
        githubUrl: effectiveGithubUrl,
        localRepoPath: effectiveLocalRepoPath,
        loadTestApproved,
    };
    try {
        const job = await getQueue().add('scan', jobData);
        res.status(202).json({
            agentRunId: agentRun.id,
            jobId: job.id,
            message: 'Scan started. Poll /api/projects/:id/runs/:runId/progress for updates.',
        });
    }
    catch (err) {
        // Redis unavailable — run synchronously with timeout
        await prisma_1.prisma.agentRun.update({
            where: { id: agentRun.id },
            data: { status: 'failed', error: 'Redis unavailable — cannot queue job' },
        });
        throw (0, errorHandler_1.createError)('Queue unavailable. Ensure Redis is running.', 503);
    }
}));
// GET /api/projects/:id/runs — list agent runs
router.get('/:id/runs', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const project = await prisma_1.prisma.project.findFirst({
        where: { id: req.params.id, userId: req.user.id },
    });
    if (!project)
        throw (0, errorHandler_1.createError)('Project not found', 404);
    const runs = await prisma_1.prisma.agentRun.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
            _count: { select: { findings: true, testRuns: true } },
        },
    });
    res.json({ runs });
}));
// GET /api/projects/:id/runs/:runId — single run details
router.get('/:id/runs/:runId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const project = await prisma_1.prisma.project.findFirst({
        where: { id: req.params.id, userId: req.user.id },
    });
    if (!project)
        throw (0, errorHandler_1.createError)('Project not found', 404);
    const run = await prisma_1.prisma.agentRun.findFirst({
        where: { id: req.params.runId, projectId: project.id },
        include: {
            findings: { orderBy: { severity: 'asc' } },
            testRuns: { include: { results: true } },
        },
    });
    if (!run)
        throw (0, errorHandler_1.createError)('Run not found', 404);
    res.json({ run });
}));
// GET /api/projects/:id/runs/:runId/stream & /progress — SSE progress stream
router.get(['/:id/runs/:runId/stream', '/:id/runs/:runId/progress'], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const project = await prisma_1.prisma.project.findFirst({
        where: { id: req.params.id, userId: req.user.id },
    });
    if (!project)
        throw (0, errorHandler_1.createError)('Project not found', 404);
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const send = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    // Poll DB every 2 seconds
    const interval = setInterval(async () => {
        try {
            const run = await prisma_1.prisma.agentRun.findFirst({
                where: { id: req.params.runId, projectId: project.id },
                select: {
                    status: true,
                    progress: true,
                    currentStep: true,
                    error: true,
                    _count: { select: { findings: true } },
                },
            });
            if (!run) {
                send({ error: 'Run not found' });
                clearInterval(interval);
                res.end();
                return;
            }
            send(run);
            if (run.status === 'done' || run.status === 'failed' || run.status === 'cancelled') {
                clearInterval(interval);
                res.end();
            }
        }
        catch {
            clearInterval(interval);
            res.end();
        }
    }, 2000);
    req.on('close', () => clearInterval(interval));
}));
// GET /api/projects/:id/findings — all findings for a project
router.get('/:id/findings', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const project = await prisma_1.prisma.project.findFirst({
        where: { id: req.params.id, userId: req.user.id },
    });
    if (!project)
        throw (0, errorHandler_1.createError)('Project not found', 404);
    const findings = await prisma_1.prisma.finding.findMany({
        where: { agentRun: { projectId: project.id } },
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ findings });
}));
// GET /api/projects/:id/apis — discovered endpoints
router.get('/:id/apis', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const project = await prisma_1.prisma.project.findFirst({
        where: { id: req.params.id, userId: req.user.id },
        include: {
            repository: {
                include: { endpoints: { orderBy: [{ method: 'asc' }, { path: 'asc' }] } },
            },
        },
    });
    if (!project)
        throw (0, errorHandler_1.createError)('Project not found', 404);
    res.json({ endpoints: project.repository?.endpoints ?? [] });
}));
router.post('/:id/test-endpoint', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { method, url, headers, body } = req.body;
    if (!method || !url)
        throw (0, errorHandler_1.createError)('method and url are required', 400);
    const { sendApiRequest } = await Promise.resolve().then(() => __importStar(require('../services/apiTester')));
    const result = await sendApiRequest({
        method,
        url,
        headers: headers ?? {},
        body,
        timeoutMs: 10000,
    });
    res.json(result);
}));
// POST /api/projects/:id/stress-test — send 200-300 requests in 1 second to verify rate limiters
router.post('/:id/stress-test', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { method = 'GET', url, requests = 200, concurrency = 50, headers, body } = req.body;
    if (!url)
        throw (0, errorHandler_1.createError)('url is required', 400);
    const { sendApiRequest } = await Promise.resolve().then(() => __importStar(require('../services/apiTester')));
    const startTime = Date.now();
    const count = Math.min(Math.max(Number(requests) || 200, 10), 500);
    const conc = Math.min(Math.max(Number(concurrency) || 50, 1), 100);
    const statusCounts = {};
    let rateLimited = false;
    let firstRateLimitAt;
    // Dispatch requests concurrently
    let sent = 0;
    for (let i = 0; i < Math.ceil(count / conc); i++) {
        const batchSize = Math.min(conc, count - sent);
        const batchPromises = Array.from({ length: batchSize }, async (_, idx) => {
            const reqIndex = sent + idx + 1;
            try {
                const resp = await sendApiRequest({
                    method: method,
                    url,
                    headers: headers ?? {},
                    body,
                    timeoutMs: 6000,
                });
                statusCounts[resp.status] = (statusCounts[resp.status] ?? 0) + 1;
                if (resp.status === 429 && !rateLimited) {
                    rateLimited = true;
                    firstRateLimitAt = reqIndex;
                }
            }
            catch (err) {
                statusCounts[500] = (statusCounts[500] ?? 0) + 1;
            }
        });
        await Promise.all(batchPromises);
        sent += batchSize;
    }
    const durationMs = Date.now() - startTime;
    const reqPerSec = Math.round((count / (durationMs / 1000)) * 10) / 10;
    res.json({
        url,
        method,
        totalRequests: count,
        durationMs,
        reqPerSec,
        rateLimited,
        firstRateLimitAt,
        statusCounts,
        verdict: rateLimited
            ? `Rate limiter active: Throttled with HTTP 429 starting at request #${firstRateLimitAt}`
            : `Vulnerable: Server processed all ${count} requests without triggering rate limits (No 429)`,
    });
}));
exports.default = router;
//# sourceMappingURL=scanRoutes.js.map