/**
 * System Prompt Service
 *
 * Fetches prompts from the system_prompts DB table with in-memory caching.
 * Falls back to hardcoded defaults if DB is unavailable.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  value: string;
  expiresAt: number;
}

class SystemPromptService {
  private cache = new Map<string, CacheEntry>();

  /**
   * Get a prompt by key. Returns DB value if available, otherwise fallback.
   */
  async getPrompt(key: string, fallback: string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    try {
      const row = await prisma.system_prompts.findUnique({ where: { key } });
      if (row) {
        this.cache.set(key, {
          value: row.content,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return row.content;
      }
    } catch (err) {
      logger.warn({ key, err }, 'Failed to fetch system prompt from DB, using fallback');
    }

    // Cache the fallback too to avoid repeated DB errors
    this.cache.set(key, {
      value: fallback,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return fallback;
  }

  /**
   * Invalidate all cached prompts.
   */
  refreshCache(): void {
    this.cache.clear();
  }
}

export const systemPromptService = new SystemPromptService();
