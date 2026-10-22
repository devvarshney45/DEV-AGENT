// ============================================================
// src/lib/redis.ts — Shared IORedis connection for BullMQ.
// BullMQ requires a raw IORedis instance (not a URL string).
// ============================================================
import IORedis from 'ioredis';
import { config } from '../config/env';

let _redis: IORedis | null = null;

export function getRedis(): IORedis {
  if (!_redis) {
    const isUpstash = config.redisUrl.includes('upstash.io');
    // If upstash is configured but user's free tier has reached hard fixed limit, use localhost
    const targetUrl = config.redisUrl;
    const isTls = targetUrl.startsWith('rediss://');

    try {
      _redis = new IORedis(targetUrl, {
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
            _redis = new IORedis('redis://localhost:6379', {
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
            });
            console.log('[Redis] Reconnected to local Redis.');
          }
        } else {
          console.error('[Redis] Connection error:', err.message);
        }
      });

      _redis.on('connect', () => {
        console.log('[Redis] Connected successfully');
      });
    } catch (e: any) {
      console.warn('[Redis] Failed to connect to configured REDIS_URL, using local Redis fallback:', e.message);
      _redis = new IORedis('redis://localhost:6379', {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    }
  }
  return _redis;
}
