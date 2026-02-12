/**
 * Debug Routes
 * Para verificar configuração em produção
 */

import { Router } from 'express';
import { env } from '../config/env';
import { featureFlags } from '../lib/feature-flags';
import { cache } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { maskPhoneNumber } from '../lib/privacy';

const router = Router();

function requireDebugSecret(req: any, res: any, next: () => void) {
  if (!env.SEED_SECRET) {
    return res.status(503).json({ error: 'Debug routes are disabled' });
  }

  const secret = req.query.secret || req.headers['x-admin-secret'];
  if (secret !== env.SEED_SECRET) {
    return res.status(403).json({ error: 'Unauthorized - Invalid secret' });
  }

  next();
}

router.use(requireDebugSecret);

/**
 * GET /debug/config
 * Mostra configuração de feature flags (sem expor secrets)
 */
router.get('/config', (req, res) => {
  const testPhone = (req.query.phone as string) || '5511999999999';

  res.json({
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    featureFlags: {
      conversationalMode: {
        enabled: env.ENABLE_CONVERSATIONAL_MODE,
        rolloutPercentage: env.CONVERSATIONAL_ROLLOUT_PERCENTAGE,
      },
      testResult: {
        phone: testPhone,
        shouldUseConversational: featureFlags.shouldUseConversationalMode(testPhone),
      },
    },
    rawEnvVars: {
      ENABLE_CONVERSATIONAL_MODE: process.env.ENABLE_CONVERSATIONAL_MODE,
      CONVERSATIONAL_ROLLOUT_PERCENTAGE: process.env.CONVERSATIONAL_ROLLOUT_PERCENTAGE,
    },
  });
});

/**
 * POST /debug/reset-full
 * GET /debug/reset-full?phoneNumber=XXX
 * Reset completo: DB + Cache
 */
router.all('/reset-full', async (req, res) => {
  try {
    const phoneNumber = req.body.phoneNumber || (req.query.phoneNumber as string);

    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber required' });
    }

    // 1. Delete conversations from DB
    const conversations = await prisma.conversation.findMany({
      where: { phoneNumber },
      select: { id: true },
    });

    const conversationIds = conversations.map(c => c.id);

    // 2. Clear Redis cache for each conversation
    const cacheKeysCleared: string[] = [];
    for (const id of conversationIds) {
      const stateKey = `conversation:${id}:state`;
      await cache.del(stateKey);
      cacheKeysCleared.push(stateKey);
    }

    // 3. Delete from database
    const result = await prisma.conversation.deleteMany({
      where: { phoneNumber },
    });

    logger.info(
      {
        phoneNumber: maskPhoneNumber(phoneNumber),
        conversationsDeleted: result.count,
        cacheKeysCleared: cacheKeysCleared.length,
      },
      '🗑️ Full reset completed'
    );

    res.json({
      success: true,
      message: 'Full reset completed',
      details: {
        conversationsDeleted: result.count,
        cacheKeysCleared: cacheKeysCleared.length,
        conversationIds,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error in full reset');
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * POST /debug/clear-all-cache
 * GET /debug/clear-all-cache
 * Limpa TODO o cache Redis (usar com cuidado!)
 */
router.all('/clear-all-cache', async (req, res) => {
  try {
    // Get all keys matching conversation pattern
    const keys = await cache.keys('conversation:*');

    if (keys.length > 0) {
      await Promise.all(keys.map(key => cache.del(key)));
    }

    logger.warn({ keysDeleted: keys.length }, '🗑️ All cache cleared');

    res.json({
      success: true,
      message: `Cleared ${keys.length} cache keys`,
      keys: keys.slice(0, 10), // Show first 10
    });
  } catch (error: any) {
    logger.error({ error }, 'Error clearing cache');
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

export default router;
