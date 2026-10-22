// ============================================================
// src/index.ts — Application entry point.
// Sets up Express with security middleware, mounts routes,
// connects to the database, and starts listening.
// ============================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { prisma } from './lib/prisma';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import scanRoutes from './routes/scanRoutes';

const app = express();

// ── Security middleware ────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// Rate limiting for the SentinelAI API itself
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 30,
  message: { error: 'Too many auth requests' },
}));

// ── Parsing ────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Logging ────────────────────────────────────────────────
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// ── Health check ───────────────────────────────────────────
app.get('/health', async (_req, res) => {
  let dbStatus = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'unavailable';
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    db: dbStatus,
    groq: config.groqApiKey ? 'configured' : 'not_configured',
    env: config.nodeEnv,
  });
});

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', scanRoutes);

// ── 404 handler ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ───────────────────────────────────
app.use(errorHandler);

// ── Start server ───────────────────────────────────────────
async function main() {
  try {
    // Verify DB connection
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL');
  } catch (err) {
    console.warn('[DB] PostgreSQL not available:', err instanceof Error ? err.message : err);
    console.warn('[DB] Some features will be unavailable. Run: prisma migrate dev');
  }

  app.listen(config.port, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║         SentinelAI Backend v2.0           ║
╠═══════════════════════════════════════════╣
║  Port:     ${config.port}                          ║
║  Env:      ${config.nodeEnv.padEnd(16)}             ║
║  Groq:     ${config.groqApiKey ? '✓ configured   ' : '✗ not set     '}             ║
╚═══════════════════════════════════════════╝
    `);
  });
}

main().catch(console.error);

export default app;
