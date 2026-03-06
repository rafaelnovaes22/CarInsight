import { createClient, type RedisClientType } from 'redis';
import { logger } from './logger';
import { redisMetrics } from '../services/metrics.service';

// In-memory fallback with TTL support
const memoryCache = new Map<string, { value: string; expiry?: number }>();

let redisClient: RedisClientType | null = null;
let useRedis = false;

function memoryCacheGet(key: string): string | null {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (item.expiry && Date.now() > item.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
}

export const cache = {
  async get(key: string): Promise<string | null> {
    if (useRedis && redisClient) {
      try {
        return await redisClient.get(key);
      } catch (error) {
        logger.warn({ error: (error as Error).message, key }, 'Redis GET failed, using memory');
        return memoryCacheGet(key);
      }
    }
    return memoryCacheGet(key);
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (useRedis && redisClient) {
      try {
        if (ttlSeconds) {
          await redisClient.set(key, value, { EX: ttlSeconds });
        } else {
          await redisClient.set(key, value);
        }
        return;
      } catch (error) {
        logger.warn({ error: (error as Error).message, key }, 'Redis SET failed, using memory');
      }
    }
    memoryCache.set(key, {
      value,
      expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  },

  async del(key: string): Promise<void> {
    if (useRedis && redisClient) {
      try {
        await redisClient.del(key);
        return;
      } catch (error) {
        logger.warn({ error: (error as Error).message, key }, 'Redis DEL failed, using memory');
      }
    }
    memoryCache.delete(key);
  },

  async exists(key: string): Promise<boolean> {
    if (useRedis && redisClient) {
      try {
        return (await redisClient.exists(key)) === 1;
      } catch (error) {
        logger.warn({ error: (error as Error).message, key }, 'Redis EXISTS failed, using memory');
        return memoryCache.has(key);
      }
    }
    return memoryCache.has(key);
  },

  async keys(pattern: string): Promise<string[]> {
    if (useRedis && redisClient) {
      try {
        return await redisClient.keys(pattern);
      } catch (error) {
        logger.warn(
          { error: (error as Error).message, pattern },
          'Redis KEYS failed, using memory'
        );
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

export function isRedisConnected(): boolean {
  return useRedis && redisClient?.isOpen === true;
}

export async function initializeRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.info('REDIS_URL not configured, using in-memory cache');
    return;
  }

  try {
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            logger.error('Redis: max reconnection attempts reached, falling back to memory');
            useRedis = false;
            redisMetrics.connected.set(0);
            return new Error('Max reconnection attempts');
          }
          return Math.min(retries * 200, 5000);
        },
        connectTimeout: 5000,
      },
    });

    redisClient.on('error', (err: Error) => {
      logger.warn({ error: err.message }, 'Redis client error');
      useRedis = false;
      redisMetrics.connected.set(0);
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis: reconnecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis: connection ready');
      useRedis = true;
      redisMetrics.connected.set(1);
    });

    await redisClient.connect();
    useRedis = true;
    redisMetrics.connected.set(1);
    logger.info('Redis: connected successfully');
  } catch (error) {
    logger.warn({ error: (error as Error).message }, 'Redis: connection failed, using in-memory');
    useRedis = false;
    redisClient = null;
    redisMetrics.connected.set(0);
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis: connection closed');
    } catch {
      // Already disconnected
    }
    redisClient = null;
    useRedis = false;
  }
}

export default cache;
