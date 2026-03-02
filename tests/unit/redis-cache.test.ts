import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted so they're available when vi.mock factories run
const { mockRedisClient, redisState } = vi.hoisted(() => ({
  mockRedisClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    keys: vi.fn(),
  },
  redisState: { available: false },
}));

// Mock logger
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock redis client service
vi.mock('../../src/config/redis.client', () => ({
  redisService: {
    getClient: () => (redisState.available ? mockRedisClient : null),
    isAvailable: () => redisState.available,
  },
}));

import { cache } from '../../src/lib/redis';

describe('Redis Cache with fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisState.available = false;
  });

  describe('when Redis is not available (in-memory fallback)', () => {
    it('should set and get a value', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');
      expect(result).toBe('value1');
    });

    it('should return null for missing key', async () => {
      const result = await cache.get('missing');
      expect(result).toBeNull();
    });

    it('should delete a key', async () => {
      await cache.set('key2', 'value2');
      await cache.del('key2');
      const result = await cache.get('key2');
      expect(result).toBeNull();
    });

    it('should check key existence', async () => {
      await cache.set('key3', 'value3');
      expect(await cache.exists('key3')).toBe(true);
      expect(await cache.exists('nonexistent')).toBe(false);
    });

    it('should match keys by pattern', async () => {
      await cache.set('prefix:a', '1');
      await cache.set('prefix:b', '2');
      await cache.set('other:c', '3');
      const keys = await cache.keys('prefix:*');
      expect(keys).toContain('prefix:a');
      expect(keys).toContain('prefix:b');
      expect(keys).not.toContain('other:c');
    });

    it('should expire keys after TTL', async () => {
      vi.useFakeTimers();
      await cache.set('ttl-key', 'value', 1);
      expect(await cache.get('ttl-key')).toBe('value');
      vi.advanceTimersByTime(1500);
      expect(await cache.get('ttl-key')).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('when Redis is available', () => {
    beforeEach(() => {
      redisState.available = true;
    });

    it('should delegate GET to Redis client', async () => {
      mockRedisClient.get.mockResolvedValue('redis-value');
      const result = await cache.get('key');
      expect(result).toBe('redis-value');
      expect(mockRedisClient.get).toHaveBeenCalledWith('key');
    });

    it('should delegate SET to Redis client', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      await cache.set('key', 'value');
      expect(mockRedisClient.set).toHaveBeenCalledWith('key', 'value');
    });

    it('should delegate SET with TTL to Redis client', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      await cache.set('key', 'value', 60);
      expect(mockRedisClient.set).toHaveBeenCalledWith('key', 'value', 'EX', 60);
    });

    it('should delegate DEL to Redis client', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      await cache.del('key');
      expect(mockRedisClient.del).toHaveBeenCalledWith('key');
    });

    it('should delegate EXISTS to Redis client', async () => {
      mockRedisClient.exists.mockResolvedValue(1);
      expect(await cache.exists('key')).toBe(true);
      mockRedisClient.exists.mockResolvedValue(0);
      expect(await cache.exists('key')).toBe(false);
    });

    it('should delegate KEYS to Redis client', async () => {
      mockRedisClient.keys.mockResolvedValue(['a', 'b']);
      const result = await cache.keys('*');
      expect(result).toEqual(['a', 'b']);
    });

    it('should fall back to memory on Redis error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Connection lost'));
      // Should not throw, falls back to memory
      const result = await cache.get('key');
      expect(result).toBeNull();
    });
  });
});
