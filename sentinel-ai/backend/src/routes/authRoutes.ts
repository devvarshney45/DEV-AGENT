// ============================================================
// src/routes/authRoutes.ts — Signup, Login, Me endpoints.
// Passwords are bcrypt-hashed. JWT issued on login.
// ============================================================
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/signup
router.post(
  '/signup',
  asyncHandler(async (req: Request, res: Response) => {
    const body = signupSchema.safeParse(req.body);
    if (!body.success) {
      throw createError(body.error.errors.map((e) => e.message).join('; '), 400);
    }

    const { email, username, password } = body.data;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      throw createError('Email or username already taken', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role } as object,
      config.jwtSecret as string,
      { expiresIn: 604800 } // 7 days
    );

    res.status(201).json({ user, token });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const body = loginSchema.safeParse(req.body);
    if (!body.success) {
      throw createError('Invalid credentials', 400);
    }

    const { email, password } = body.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw createError('Invalid credentials', 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw createError('Invalid credentials', 401);
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role } as object,
      config.jwtSecret as string,
      { expiresIn: 604800 } // 7 days
    );

    res.json({
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      token,
    });
  })
);

// GET /api/auth/me — current user
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ user: req.user });
  })
);

export default router;
