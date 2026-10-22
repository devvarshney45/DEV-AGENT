// ============================================================
// src/routes/projectRoutes.ts — CRUD for projects.
// Each project ties to one repository and many agent runs.
// ============================================================
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { config } from '../config/env';

const router = Router();
router.use(requireAuth);

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  githubUrl: z.string().url().optional(),
  localPath: z.string().min(1).optional(),
});

// GET /api/projects
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const projects = await prisma.project.findMany({
      where: { userId: req.user!.id },
      include: {
        repository: {
          select: {
            localPath: true,
            githubUrl: true,
            framework: true,
            language: true,
            analysisStatus: true,
            _count: { select: { endpoints: true } },
          },
        },
        _count: { select: { agentRuns: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ projects });
  })
);

// POST /api/projects
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const body = createProjectSchema.safeParse(req.body);
    if (!body.success) {
      throw createError(body.error.errors.map((e) => e.message).join('; '), 400);
    }

    const { name, description, githubUrl, localPath } = body.data;

    const project = await prisma.project.create({
      data: {
        name,
        description,
        userId: req.user!.id,
        ...((githubUrl || localPath) && {
          repository: {
            create: {
              githubUrl,
              localPath,
            },
          },
        }),
      },
      include: { repository: true },
    });

    res.status(201).json({ project });
  })
);

// POST /api/projects/upload-folder — direct memory folder upload from browser
router.post(
  '/upload-folder',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, files } = req.body;
    if (!name || !Array.isArray(files) || files.length === 0) {
      throw createError('name and files array are required', 400);
    }

    const fs = await import('fs');
    const path = await import('path');

    const workspaceDir = config.workspaceDir || '/tmp/sentinel-workspaces';
    const folderName = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
    const targetFolder = path.join(workspaceDir, folderName);

    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    // Write all uploaded files to disk
    for (const file of files) {
      if (!file.path || typeof file.content !== 'string') continue;
      const safeRelPath = file.path.replace(/\.\./g, '');
      const fullDest = path.join(targetFolder, safeRelPath);
      const destDir = path.dirname(fullDest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.writeFileSync(fullDest, file.content, 'utf-8');
    }

    // Create project tied to this local directory
    const project = await prisma.project.create({
      data: {
        name,
        description: `Imported directly from local computer folder (${files.length} files)`,
        userId: req.user!.id,
        repository: {
          create: {
            localPath: targetFolder,
            analysisStatus: 'pending',
          },
        },
      },
      include: { repository: true },
    });

    res.status(201).json({ project, localPath: targetFolder });
  })
);

// GET /api/projects/:id
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        repository: {
          include: {
            endpoints: { orderBy: [{ method: 'asc' }, { path: 'asc' }] },
          },
        },
        agentRuns: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            _count: { select: { findings: true, testRuns: true } },
          },
        },
      },
    });

    if (!project) throw createError('Project not found', 404);
    res.json({ project });
  })
);

// DELETE /api/projects/:id
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!project) throw createError('Project not found', 404);

    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Project deleted' });
  })
);

export default router;
