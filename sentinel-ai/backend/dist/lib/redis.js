"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
// ============================================================
// src/lib/redis.ts — Shared IORedis connection for BullMQ.
// BullMQ requires a raw IORedis instance (not a URL string).
// ============================================================
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
let _redis = null;
function getRedis() {
    if (!_redis) {
        const isUpstash = env_1.config.redisUrl.includes('upstash.io');
        // If upstash is configured but user's free tier has reached hard fixed limit, use localhost
        const targetUrl = env_1.config.redisUrl;
        const isTls = targetUrl.startsWith('rediss://');
        try {
            _redis = new ioredis_1.default(targetUrl, {
                maxRetriesPerRequest: null, // Required by BullMQ
                enableReadyCheck: false,
                retryStrategy: (times) => Math.min(times * 100, 3000),
                ...(isTls && { tls: { rejectUnauthorized: false } }),
            });
            _redis.on('error', (err) => {
                if (err.message.includes('Fixed plan limits') || err.message.includes('plan limits')) {
                    console.warn('[Redis] ⚠️ Upstash limit reached. Switching worker connection to local Redis (redis://localhost:6379)...');
                    // In dev mode, we can reconnect to localhost
                    if (_redis && isUpstash) {
                        _redis.disconnect(false);
                        _redis = new ioredis_1.default('redis://localhost:6379', {
                            maxRetriesPerRequest: null,
                            enableReadyCheck: false,
                        });
                        console.log('[Redis] Reconnected to local Redis.');
                    }
                }
                else {
                    console.error('[Redis] Connection error:', err.message);
                }
            });
            _redis.on('connect', () => {
                console.log('[Redis] Connected successfully');
            });
        }
        catch (e) {
            console.warn('[Redis] Failed to connect to configured REDIS_URL, using local Redis fallback:', e.message);
            _redis = new ioredis_1.default('redis://localhost:6379', {
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
            });
        }
    }
    return _redis;
}
//# sourceMappingURL=redis.js.map