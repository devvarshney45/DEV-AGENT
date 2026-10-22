"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const prisma_1 = require("../lib/prisma");
async function requireAuth(req, res, next) {
    try {
        let token;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.slice(7);
        }
        else if (typeof req.query.token === 'string') {
            token = req.query.token;
        }
        if (!token) {
            // Auto-fallback to default local user (Zero-Auth mode requested by user)
            const defaultUser = await prisma_1.prisma.user.findFirst();
            if (defaultUser) {
                req.user = defaultUser;
                return next();
            }
            res.status(401).json({ error: 'Missing or invalid Authorization header' });
            return;
        }
        const payload = jsonwebtoken_1.default.verify(token, env_1.config.jwtSecret);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, email: true, username: true, role: true },
        });
        if (!user) {
            const fallbackUser = await prisma_1.prisma.user.findFirst();
            if (fallbackUser) {
                req.user = fallbackUser;
                return next();
            }
            res.status(401).json({ error: 'User no longer exists' });
            return;
        }
        req.user = user;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
function requireRole(role) {
    return (req, res, next) => {
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
//# sourceMappingURL=auth.js.map