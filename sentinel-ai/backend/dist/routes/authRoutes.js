"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ============================================================
// src/routes/authRoutes.ts — Signup, Login, Me endpoints.
// Passwords are bcrypt-hashed. JWT issued on login.
// ============================================================
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const env_1 = require("../config/env");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const signupSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    username: zod_1.z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
    password: zod_1.z.string().min(8).max(128),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
// POST /api/auth/signup
router.post('/signup', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const body = signupSchema.safeParse(req.body);
    if (!body.success) {
        throw (0, errorHandler_1.createError)(body.error.errors.map((e) => e.message).join('; '), 400);
    }
    const { email, username, password } = body.data;
    const existing = await prisma_1.prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
    });
    if (existing) {
        throw (0, errorHandler_1.createError)('Email or username already taken', 409);
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    const user = await prisma_1.prisma.user.create({
        data: { email, username, passwordHash },
        select: { id: true, email: true, username: true, role: true, createdAt: true },
    });
    const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, env_1.config.jwtSecret, { expiresIn: 604800 } // 7 days
    );
    res.status(201).json({ user, token });
}));
// POST /api/auth/login
router.post('/login', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const body = loginSchema.safeParse(req.body);
    if (!body.success) {
        throw (0, errorHandler_1.createError)('Invalid credentials', 400);
    }
    const { email, password } = body.data;
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw (0, errorHandler_1.createError)('Invalid credentials', 401);
    }
    const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!valid) {
        throw (0, errorHandler_1.createError)('Invalid credentials', 401);
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, env_1.config.jwtSecret, { expiresIn: 604800 } // 7 days
    );
    res.json({
        user: { id: user.id, email: user.email, username: user.username, role: user.role },
        token,
    });
}));
// GET /api/auth/me — current user
router.get('/me', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json({ user: req.user });
}));
exports.default = router;
//# sourceMappingURL=authRoutes.js.map