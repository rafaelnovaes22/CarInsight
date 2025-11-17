import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

let redis: Redis | null = null;

if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redis.on('connect', () => logger.info('✅ Redis connected'));
  redis.on('error', (err) => logger.error('❌ Redis error:', err));
} else {
  logger.warn('⚠️  Redis not configured, using in-memory cache');
}

// In-memory fallback
const memoryCache = new Map<string, { value: string; expiry?: number }>();

export const cache = {
  async get(key: string): Promise<string | null> {
    if (redis) {
      return redis.get(key);
    }
    
    const item = memoryCache.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      memoryCache.delete(key);
      return null;
    }
    return item.value;
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (redis) {
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, value);
      } else {
        await redis.set(key, value);
      }
      return;
    }
    
    memoryCache.set(key, {
      value,
      expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  },

  async del(key: string): Promise<void> {
    if (redis) {
      await redis.del(key);
      return;
    }
    memoryCache.delete(key);
  },

  async exists(key: string): Promise<boolean> {
    if (redis) {
      return (await redis.exists(key)) === 1;
    }
    return memoryCache.has(key);
  },
};

export default cache;
