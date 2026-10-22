"use strict";
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
// ============================================================
// src/routes/projectRoutes.ts — CRUD for projects.
// Each project ties to one repository and many agent runs.
// ============================================================
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const createProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional(),
    githubUrl: zod_1.z.string().url().optional(),
    localPath: zod_1.z.string().min(1).optional(),
});
// GET /api/projects
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const projects = await prisma_1.prisma.project.findMany({
        where: { userId: req.user.id },
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
}));
// POST /api/projects
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const body = createProjectSchema.safeParse(req.body);
    if (!body.success) {
        throw (0, errorHandler_1.createError)(body.error.errors.map((e) => e.message).join('; '), 400);
    }
    const { name, description, githubUrl, localPath } = body.data;
    const project = await prisma_1.prisma.project.create({
        data: {
            name,
            description,
            userId: req.user.id,
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
}));
// POST /api/projects/upload-folder — direct memory folder upload from browser
router.post('/upload-folder', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, files } = req.body;
    if (!name || !Array.isArray(files) || files.length === 0) {
        throw (0, errorHandler_1.createError)('name and files array are required', 400);
    }
    const fs = await Promise.resolve().then(() => __importStar(require('fs')));
    const path = await Promise.resolve().then(() => __importStar(require('path')));
    const workspaceDir = env_1.config.workspaceDir || '/tmp/sentinel-workspaces';
    const folderName = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
    const targetFolder = path.join(workspaceDir, folderName);
    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder, { recursive: true });
    }
    // Write all uploaded files to disk
    for (const file of files) {
        if (!file.path || typeof file.content !== 'string')
            continue;
        const safeRelPath = file.path.replace(/\.\./g, '');
        const fullDest = path.join(targetFolder, safeRelPath);
        const destDir = path.dirname(fullDest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        fs.writeFileSync(fullDest, file.content, 'utf-8');
    }
    // Create project tied to this local directory
    const project = await prisma_1.prisma.project.create({
        data: {
            name,
            description: `Imported directly from local computer folder (${files.length} files)`,
            userId: req.user.id,
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
}));
// GET /api/projects/:id
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const project = await prisma_1.prisma.project.findFirst({
        where: { id: req.params.id, userId: req.user.id },
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
    if (!project)
        throw (0, errorHandler_1.createError)('Project not found', 404);
    res.json({ project });
}));
// DELETE /api/projects/:id
router.delete('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const project = await prisma_1.prisma.project.findFirst({
        where: { id: req.params.id, userId: req.user.id },
    });
    if (!project)
        throw (0, errorHandler_1.createError)('Project not found', 404);
    await prisma_1.prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Project deleted' });
}));
exports.default = router;
//# sourceMappingURL=projectRoutes.js.map