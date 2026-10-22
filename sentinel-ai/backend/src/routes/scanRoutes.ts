// ============================================================
// src/routes/scanRoutes.ts
// Endpoints for triggering scans, polling progress via SSE,
// and retrieving results.
// ============================================================

import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getRedis } from '../lib/redis';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { SCAN_QUEUE_NAME, ScanJobData } from '../workers/scanWorker';
import { config } from '../config/env';

const router = Router();
router.use(requireAuth);

// Lazy-init BullMQ queue (so Redis failure doesn't crash startup)
let _queue: Queue<ScanJobData> | null = null;
function getQueue(): Queue<ScanJobData> {
  if (!_queue) {
    _queue = new Queue<ScanJobData>(SCAN_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
    });
  }
  return _queue;
}

const startScanSchema = z.object({
  mode: z.enum(['custom', 'full_scan']),
  instruction: z.string().min(1).max(2000).optional(),
  targetUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional(),
  localRepoPath: z.string().optional(),
  loadTestApproved: z.boolean().optional().default(false),
});

// POST /api/projects/:id/scan — start a scan
router.post(
  '/:id/scan',
  asyncHandler(async (req: Request, res: Response) => {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { repository: true },
    });
    if (!project) throw createError('Project not found', 404);

    const body = startScanSchema.safeParse(req.body);
    if (!body.success) {
      throw createError(body.error.errors.map((e) => e.message).join('; '), 400);
    }

    const { mode, instruction, targetUrl, githubUrl, localRepoPath, loadTestApproved } = body.data;

    if (mode === 'custom' && !instruction) {
      throw createError('Custom mode requires an instruction', 400);
    }

    // Determine effective target
    const effectiveTargetUrl = targetUrl ?? undefined;
    const effectiveGithubUrl = githubUrl ?? project.repository?.githubUrl ?? undefined;
    const effectiveLocalRepoPath = localRepoPath ?? project.repository?.localPath ?? undefined;

    // Check load test approval requirement
    if (
      config.requireLoadTestApproval &&
      instruction?.toLowerCase().includes('load') &&
      !loadTestApproved
    ) {
      return res.status(202).json({
        requiresApproval: true,
        message:
          'This test may involve a load test. Please confirm you own or are authorized to test this target, then re-submit with loadTestApproved: true.',
      });
    }

    // Create agent run record
    const agentRun = await prisma.agentRun.create({
      data: {
        projectId: project.id,
        instruction: instruction ?? 'Full security scan',
        mode,
        status: 'pending',
        progress: 0,
      },
    });

    // Enqueue job
    const jobData: ScanJobData = {
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
    } catch (err) {
      // Redis unavailable — run synchronously with timeout
      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { status: 'failed', error: 'Redis unavailable — cannot queue job' },
      });
      throw createError('Queue unavailable. Ensure Redis is running.', 503);
    }
  })
);

// GET /api/projects/:id/runs — list agent runs
router.get(
  '/:id/runs',
  asyncHandler(async (req: Request, res: Response) => {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!project) throw createError('Project not found', 404);

    const runs = await prisma.agentRun.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        _count: { select: { findings: true, testRuns: true } },
      },
    });

    res.json({ runs });
  })
);

// GET /api/projects/:id/runs/:runId — single run details
router.get(
  '/:id/runs/:runId',
  asyncHandler(async (req: Request, res: Response) => {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!project) throw createError('Project not found', 404);

    const run = await prisma.agentRun.findFirst({
      where: { id: req.params.runId, projectId: project.id },
      include: {
        findings: { orderBy: { severity: 'asc' } },
        testRuns: { include: { results: true } },
      },
    });
    if (!run) throw createError('Run not found', 404);

    res.json({ run });
  })
);

// GET /api/projects/:id/runs/:runId/stream & /progress — SSE progress stream
router.get(
  ['/:id/runs/:runId/stream', '/:id/runs/:runId/progress'],
  asyncHandler(async (req: Request, res: Response) => {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!project) throw createError('Project not found', 404);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Poll DB every 2 seconds
    const interval = setInterval(async () => {
      try {
        const run = await prisma.agentRun.findFirst({
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
      } catch {
        clearInterval(interval);
        res.end();
      }
    }, 2000);

    req.on('close', () => clearInterval(interval));
  })
);

// GET /api/projects/:id/findings — all findings for a project
router.get(
  '/:id/findings',
  asyncHandler(async (req: Request, res: Response) => {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!project) throw createError('Project not found', 404);

    const findings = await prisma.finding.findMany({
      where: { agentRun: { projectId: project.id } },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ findings });
  })
);

// GET /api/projects/:id/apis — discovered endpoints
router.get(
  '/:id/apis',
  asyncHandler(async (req: Request, res: Response) => {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        repository: {
          include: { endpoints: { orderBy: [{ method: 'asc' }, { path: 'asc' }] } },
        },
      },
    });
    if (!project) throw createError('Project not found', 404);
    res.json({ endpoints: project.repository?.endpoints ?? [] });
  })
);
router.post(
  '/:id/test-endpoint',
  asyncHandler(async (req: Request, res: Response) => {
    const { method, url, headers, body } = req.body;
    if (!method || !url) throw createError('method and url are required', 400);

    const { sendApiRequest } = await import('../services/apiTester');
    const result = await sendApiRequest({
      method,
      url,
      headers: headers ?? {},
      body,
      timeoutMs: 10_000,
    });

    res.json(result);
  })
);

// POST /api/projects/:id/stress-test — send 200-300 requests in 1 second to verify rate limiters
router.post(
  '/:id/stress-test',
  asyncHandler(async (req: Request, res: Response) => {
    const { method = 'GET', url, requests = 200, concurrency = 50, headers, body } = req.body;
    if (!url) throw createError('url is required', 400);

    const { sendApiRequest } = await import('../services/apiTester');
    const startTime = Date.now();
    const count = Math.min(Math.max(Number(requests) || 200, 10), 500);
    const conc = Math.min(Math.max(Number(concurrency) || 50, 1), 100);

    const statusCounts: Record<number, number> = {};
    let rateLimited = false;
    let firstRateLimitAt: number | undefined;

    // Dispatch requests concurrently
    let sent = 0;
    for (let i = 0; i < Math.ceil(count / conc); i++) {
      const batchSize = Math.min(conc, count - sent);
      const batchPromises = Array.from({ length: batchSize }, async (_, idx) => {
        const reqIndex = sent + idx + 1;
        try {
          const resp = await sendApiRequest({
            method: method as any,
            url,
            headers: headers ?? {},
            body,
            timeoutMs: 6_000,
          });
          statusCounts[resp.status] = (statusCounts[resp.status] ?? 0) + 1;
          if (resp.status === 429 && !rateLimited) {
            rateLimited = true;
            firstRateLimitAt = reqIndex;
          }
        } catch (err: any) {
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
  })
);

export default router;
