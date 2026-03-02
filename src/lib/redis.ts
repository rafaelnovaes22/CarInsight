import { redisService } from '../config/redis.client';
import { logger } from './logger';

// In-memory fallback
const memoryCache = new Map<string, { value: string; expiry?: number }>();

function getRedisClient() {
  return redisService.getClient();
}

export const cache = {
  async get(key: string): Promise<string | null> {
    const client = getRedisClient();
    if (client) {
      try {
        return await client.get(key);
      } catch (err) {
        logger.warn({ err, key }, 'Redis GET failed, falling back to memory');
      }
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
    const client = getRedisClient();
    if (client) {
      try {
        if (ttlSeconds) {
          await client.set(key, value, 'EX', ttlSeconds);
        } else {
          await client.set(key, value);
        }
        return;
      } catch (err) {
        logger.warn({ err, key }, 'Redis SET failed, falling back to memory');
      }
    }
    memoryCache.set(key, {
      value,
      expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  },

  async del(key: string): Promise<void> {
    const client = getRedisClient();
    if (client) {
      try {
        await client.del(key);
        return;
      } catch (err) {
        logger.warn({ err, key }, 'Redis DEL failed, falling back to memory');
      }
    }
    memoryCache.delete(key);
  },

  async exists(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (client) {
      try {
        const result = await client.exists(key);
        return result === 1;
      } catch (err) {
        logger.warn({ err, key }, 'Redis EXISTS failed, falling back to memory');
      }
    }
    return memoryCache.has(key);
  },

  async keys(pattern: string): Promise<string[]> {
    const client = getRedisClient();
    if (client) {
      try {
        return await client.keys(pattern);
      } catch (err) {
        logger.warn({ err, pattern }, 'Redis KEYS failed, falling back to memory');
      }
    }
    const regexPattern = pattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    const matchingKeys: string[] = [];
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    }
    return matchingKeys;
  },
};

if (redisService.isAvailable()) {
  logger.info('Using Redis cache');
} else {
  logger.info('Using in-memory cache (Redis not available, will auto-switch when connected)');
}

export default cache;
