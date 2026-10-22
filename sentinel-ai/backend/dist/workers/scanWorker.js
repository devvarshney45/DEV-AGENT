"use strict";
// ============================================================
// src/workers/scanWorker.ts
// BullMQ worker — picks scan jobs off the queue and runs
// the agent in the background.
//
// Why BullMQ?
//   A security scan can take minutes. We can't hold an HTTP
//   connection open that long. So: the API creates a job,
//   the worker processes it asynchronously, and the frontend
//   polls progress via SSE (Server-Sent Events).
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCAN_QUEUE_NAME = void 0;
exports.startWorker = startWorker;
const bullmq_1 = require("bullmq");
const redis_1 = require("../lib/redis");
const prisma_1 = require("../lib/prisma");
const agent_1 = require("../agent/agent");
const repoAnalyzer_1 = require("../services/repoAnalyzer");
exports.SCAN_QUEUE_NAME = 'sentinel-scans';
async function processScanJob(job) {
    const { agentRunId, projectId, instruction, mode, targetUrl, githubUrl, localRepoPath } = job.data;
    // Update run status to running
    await prisma_1.prisma.agentRun.update({
        where: { id: agentRunId },
        data: { status: 'running', currentStep: 'Starting scan' },
    });
    try {
        // Progress callback — updates DB + job progress for SSE polling
        const progressCallback = async (step, progress) => {
            await job.updateProgress(progress);
            await prisma_1.prisma.agentRun.update({
                where: { id: agentRunId },
                data: { currentStep: step, progress },
            });
        };
        // ── Step 1: Repository Analysis ────────────────────────
        let analysisContext = '';
        let clonedPath;
        if (githubUrl || localRepoPath) {
            await progressCallback('Cloning repository', 10);
            if (githubUrl) {
                try {
                    clonedPath = await (0, repoAnalyzer_1.cloneRepository)(githubUrl);
                    await prisma_1.prisma.repository.update({
                        where: { projectId },
                        data: { clonedPath, analysisStatus: 'running' },
                    });
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    await prisma_1.prisma.repository.updateMany({
                        where: { projectId },
                        data: { analysisStatus: 'failed', analysisError: msg },
                    });
                    // Continue without repo analysis
                    await progressCallback('Repository clone failed — continuing with URL-only tests', 20);
                }
            }
            else if (localRepoPath) {
                clonedPath = localRepoPath;
            }
            if (clonedPath) {
                await progressCallback('Analyzing repository', 20);
                try {
                    const analysis = await (0, repoAnalyzer_1.analyzeRepository)(clonedPath);
                    // Save endpoints to DB — find or create repository record
                    let repo = await prisma_1.prisma.repository.findUnique({ where: { projectId } });
                    if (!repo) {
                        repo = await prisma_1.prisma.repository.create({
                            data: {
                                projectId,
                                localPath: clonedPath,
                                analysisStatus: 'running',
                            },
                        });
                    }
                    if (repo) {
                        // Clear old endpoints
                        await prisma_1.prisma.apiEndpoint.deleteMany({ where: { repositoryId: repo.id } });
                        // Insert discovered endpoints
                        await prisma_1.prisma.apiEndpoint.createMany({
                            data: analysis.endpoints.map((ep) => ({
                                repositoryId: repo.id,
                                method: ep.method,
                                path: ep.path,
                                controller: ep.controller,
                                sourceFile: ep.sourceFile,
                                sourceLine: ep.sourceLine,
                                authRequired: ep.authRequired,
                                roles: ep.roles,
                                middleware: ep.middleware,
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                requestBodySchema: ep.requestBodySchema ? JSON.parse(JSON.stringify(ep.requestBodySchema)) : undefined,
                                description: ep.description,
                            })),
                        });
                        await prisma_1.prisma.repository.update({
                            where: { id: repo.id },
                            data: {
                                framework: analysis.framework,
                                language: analysis.language,
                                packageManager: analysis.packageManager,
                                analysisStatus: 'done',
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                analysisResult: JSON.parse(JSON.stringify(analysis)),
                            },
                        });
                    }
                    // Build context string for the agent
                    analysisContext = JSON.stringify({
                        framework: analysis.framework,
                        language: analysis.language,
                        authMechanism: analysis.authMechanism,
                        rateLimitDetected: analysis.rateLimitDetected,
                        rateLimitConfig: analysis.rateLimitConfig,
                        validationLibrary: analysis.validationLibrary,
                        endpoints: analysis.endpoints.slice(0, 30), // Cap to avoid token overflow
                        warnings: analysis.warnings,
                    }, null, 2);
                }
                catch (err) {
                    analysisContext = `Repository analysis failed: ${err}`;
                }
            }
        }
        // ── Step 2: Run Agent ──────────────────────────────────
        await progressCallback('Running AI agent', 30);
        const initialState = {
            agentRunId,
            projectId,
            instruction,
            mode,
            targetUrl,
            repositoryPath: clonedPath,
            analysisContext,
            messages: [],
            iterationCount: 0,
            toolCallCount: 0,
            findings: [],
            testResults: [],
            status: 'running',
            progressCallback: (step, progress) => {
                // Fire and forget progress updates from within agent
                progressCallback(step, progress).catch(console.error);
            },
        };
        const finalState = await (0, agent_1.runAgent)(initialState);
        // ── Step 3: Save Results ───────────────────────────────
        await progressCallback('Saving results', 90);
        const findings = (finalState.findings && finalState.findings.length > 0)
            ? finalState.findings
            : (finalState.report ? (0, agent_1.extractFindings)(finalState.report) : []);
        if (findings.length > 0) {
            await prisma_1.prisma.finding.createMany({
                data: findings.map((f) => ({
                    agentRunId,
                    severity: f.severity,
                    category: f.category,
                    title: f.title,
                    description: f.description,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    evidence: f.evidence ? JSON.parse(JSON.stringify(f.evidence)) : undefined,
                    recommendation: f.recommendation,
                    owaspRef: f.owaspRef,
                })),
            });
        }
        // Update final status
        await prisma_1.prisma.agentRun.update({
            where: { id: agentRunId },
            data: {
                status: finalState.status === 'done' ? 'done' : 'failed',
                progress: 100,
                currentStep: finalState.status === 'done' ? 'Scan complete' : 'Scan failed',
                iterations: finalState.iterationCount,
                toolCalls: finalState.toolCallCount,
                error: finalState.error,
            },
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await prisma_1.prisma.agentRun.update({
            where: { id: agentRunId },
            data: { status: 'failed', error: msg, progress: 0, currentStep: 'Error' },
        }).catch(console.error);
        throw err; // Re-throw so BullMQ marks the job as failed
    }
}
// Start the worker (called when this file is run directly)
function startWorker() {
    console.log('[Worker] Starting SentinelAI scan worker...');
    const worker = new bullmq_1.Worker(exports.SCAN_QUEUE_NAME, processScanJob, {
        connection: (0, redis_1.getRedis)(),
        concurrency: 2, // Process 2 scans at a time
    });
    worker.on('completed', (job) => {
        console.log(`[Worker] Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed:`, err.message);
    });
    worker.on('error', (err) => {
        console.error('[Worker] Worker error:', err);
    });
    console.log(`[Worker] Listening on queue: ${exports.SCAN_QUEUE_NAME}`);
}
// Run if invoked directly
if (require.main === module) {
    startWorker();
}
//# sourceMappingURL=scanWorker.js.map