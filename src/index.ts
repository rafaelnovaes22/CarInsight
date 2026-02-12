import express from 'express';
import path from 'path';
import { env } from './config/env';
import { logger } from './lib/logger';
import { maskPhoneNumber } from './lib/privacy';
import { prisma } from './lib/prisma';
import { inMemoryVectorStore } from './services/in-memory-vector.service';
import webhookRoutes from './routes/webhook.routes';
import evolutionWebhookRoutes from './routes/webhook-evolution.routes';
import adminRoutes from './routes/admin.routes';
import debugRoutes from './routes/debug.routes';

const app = express();

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);
app.use(express.static(path.join(__dirname, 'public')));

function requireAdminSecret(req: any, res: any, next: () => void) {
  const configuredSecret = env.SEED_SECRET;
  const providedSecret = req.headers['x-admin-secret'] || req.query.secret;

  if (!configuredSecret) {
    logger.error('SEED_SECRET is not configured; admin/debug endpoints are disabled');
    return res.status(503).json({ error: 'Admin endpoints are disabled' });
  }

  if (providedSecret !== configuredSecret) {
    logger.warn('Unauthorized admin access attempt');
    return res.status(403).json({ error: 'Unauthorized - Invalid secret' });
  }

  next();
}

// Webhook routes for Meta Cloud API
app.use('/webhooks', webhookRoutes);

// Webhook routes for Evolution API
app.use('/webhooks', evolutionWebhookRoutes);

// Admin routes (seed, management)
app.use('/admin', requireAdminSecret, adminRoutes);

// Debug routes (feature flags, config)
app.use('/debug', requireAdminSecret, debugRoutes);

// Dashboard
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Privacy Policy (required by Meta)
app.get('/privacy-policy', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'privacy-policy.html'));
});

// Reset conversation endpoint (for testing)
app.post('/api/reset-conversation', requireAdminSecret, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber required' });
    }

    const result = await prisma.conversation.deleteMany({
      where: { phoneNumber },
    });

    logger.info({ phoneNumber: maskPhoneNumber(phoneNumber), count: result.count }, 'Conversation reset');

    res.json({
      success: true,
      message: `${result.count} conversation(s) deleted`,
      phoneNumber,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error resetting conversation');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Basic stats endpoint
app.get('/stats', requireAdminSecret, async (_req, res) => {
  try {
    const [conversations, leads, recommendations] = await Promise.all([
      prisma.conversation.count(),
      prisma.lead.count(),
      prisma.recommendation.count(),
    ]);

    res.json({
      conversations,
      leads,
      recommendations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching stats');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = env.PORT || 3000;

async function start() {
  try {
    logger.info('Checking database connectivity...');
    const vehicleCount = await prisma.vehicle.count();

    if (vehicleCount === 0) {
      logger.warn(
        'Database has no vehicles. Run migrations/seeds explicitly via CI/CD or admin scripts.'
      );
    } else {
      logger.info({ vehicleCount }, 'Database ready');
    }

    // Initialize vector store in background (non-blocking)
    logger.info('Starting vector store initialization in background...');
    inMemoryVectorStore
      .initialize()
      .then(() => {
        logger.info({ embeddings: inMemoryVectorStore.getCount() }, 'Vector store ready');
      })
      .catch(error => {
        logger.error({ error }, 'Vector store failed, SQL fallback will be used');
      });

    // Start Express server
    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Server running');
      logger.info({ dashboard: `http://localhost:${PORT}` }, 'Dashboard');
      logger.info({ health: `http://localhost:${PORT}/health` }, 'Health endpoint');
      logger.info({ webhook: `http://localhost:${PORT}/webhooks/whatsapp` }, 'Webhook endpoint');

      if (env.META_WHATSAPP_TOKEN && env.META_WHATSAPP_PHONE_NUMBER_ID) {
        logger.info('Meta Cloud API configured');
      } else {
        logger.warn(
          'Meta Cloud API not fully configured. Set META_WHATSAPP_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID.'
        );
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start application');
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

start();
