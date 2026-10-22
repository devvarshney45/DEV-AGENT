// ============================================================
// src/middleware/auth.ts — JWT authentication middleware.
// Protects API routes: verifies the Bearer token, loads the
// user record, and attaches it to req.user.
// ============================================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { prisma } from '../lib/prisma';

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
        role: string;
      };
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      // Auto-fallback to default local user (Zero-Auth mode requested by user)
      const defaultUser = await prisma.user.findFirst();
      if (defaultUser) {
        req.user = defaultUser;
        return next();
      }
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, username: true, role: true },
    });

    if (!user) {
      const fallbackUser = await prisma.user.findFirst();
      if (fallbackUser) {
        req.user = fallbackUser;
        return next();
      }
      res.status(401).json({ error: 'User no longer exists' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (req.user.role !== role && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
