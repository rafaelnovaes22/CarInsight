import { logger } from './logger';

// Redis desabilitado - usando apenas in-memory cache
logger.info('ℹ️  Using in-memory cache (Redis disabled)');

// In-memory fallback
const memoryCache = new Map<string, { value: string; expiry?: number }>();

export const cache = {
  async get(key: string): Promise<string | null> {
    const item = memoryCache.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      memoryCache.delete(key);
      return null;
    }
    return item.value;
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    memoryCache.set(key, {
      value,
      expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  },

  async del(key: string): Promise<void> {
    memoryCache.delete(key);
  },

  async exists(key: string): Promise<boolean> {
    return memoryCache.has(key);
  },

  async keys(pattern: string): Promise<string[]> {
    // Convert Redis pattern to regex
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

export default cache;
