"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
// ============================================================
// src/lib/prisma.ts — Singleton Prisma client.
// Using a singleton prevents multiple connections in
// development hot-reload scenarios.
// ============================================================
const client_1 = require("@prisma/client");
exports.prisma = global.__prisma ??
    new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
if (process.env.NODE_ENV !== 'production') {
    global.__prisma = exports.prisma;
}
//# sourceMappingURL=prisma.js.map