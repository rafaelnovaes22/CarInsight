import express from 'express';
import path from 'path';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { inMemoryVectorStore } from './services/in-memory-vector.service';
import webhookRoutes from './routes/webhook.routes';
import adminRoutes from './routes/admin.routes';
import debugRoutes from './routes/debug.routes';

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Webhook routes for Meta Cloud API
app.use('/webhooks', webhookRoutes);

// Admin routes (seed, management)
app.use('/admin', adminRoutes);

// Debug routes (feature flags, config)
app.use('/debug', debugRoutes);

// Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Health check with database validation
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(503).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Privacy Policy (required by Meta)
app.get('/privacy-policy', (req, res) => {
  const filePath = path.join(__dirname, '..', 'public', 'privacy-policy.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      logger.error({ error: err }, 'Failed to send privacy policy');
      res.status(404).send('Privacy policy not found');
    }
  });
});

// Reset conversation endpoint (for testing)
app.post('/api/reset-conversation', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber required' });
    }

    const result = await prisma.conversation.deleteMany({
      where: { phoneNumber },
    });

    logger.info('🗑️ Conversation reset', { phoneNumber, count: result.count });

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
app.get('/stats', async (req, res) => {
  try {
    const { prisma } = await import('./lib/prisma');

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
    // Push database schema
    logger.info('📦 Setting up database schema...');
    try {
      const { execSync } = require('child_process');
      execSync('npx prisma db push --accept-data-loss', {
        stdio: 'inherit',
        env: { ...process.env, FORCE_COLOR: '0' },
      });
      logger.info('✅ Database schema ready');
    } catch (error) {
      logger.error({ error }, '⚠️  Database push failed, continuing...');
    }

    // Check database and seed if needed
    logger.info('🔍 Checking database...');
    const vehicleCount = await prisma.vehicle.count();

    if (vehicleCount === 0) {
      logger.info('🌱 Database empty, running seed...');
      const { execSync } = require('child_process');
      execSync('npm run db:seed:complete', { stdio: 'inherit' });
      logger.info('✅ Seed completed');
    } else {
      logger.info(`✅ Database has ${vehicleCount} vehicles`);
    }

    // Initialize vector store in background (non-blocking)
    logger.info('🧠 Starting vector store initialization in background...');
    inMemoryVectorStore
      .initialize()
      .then(() => {
        logger.info(`✅ Vector store ready with ${inMemoryVectorStore.getCount()} embeddings`);
      })
      .catch(error => {
        logger.error({ error }, '⚠️  Vector store failed, will use SQL fallback');
      });

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Dashboard: http://localhost:${PORT}`);
      logger.info(`📊 Stats: http://localhost:${PORT}/stats`);
      logger.info(`📊 Health: http://localhost:${PORT}/health`);
      logger.info(`📱 Webhook: http://localhost:${PORT}/webhooks/whatsapp`);
      logger.info(`🔧 Admin: http://localhost:${PORT}/admin/health`);

      // Check if Meta Cloud API is configured
      if (env.META_WHATSAPP_TOKEN && env.META_WHATSAPP_PHONE_NUMBER_ID) {
        logger.info('✅ Meta Cloud API configured');
        logger.info(`📱 Phone Number ID: ${env.META_WHATSAPP_PHONE_NUMBER_ID.substring(0, 10)}...`);
      } else {
        logger.warn('⚠️  Meta Cloud API not configured');
        logger.warn('Set META_WHATSAPP_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID in .env');
        logger.warn('See META_CLOUD_API_SETUP.md for instructions');
      }
    });
  } catch (error) {
    logger.error({ error }, '❌ Failed to start application');
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  try {
    await prisma.$disconnect();
    logger.info('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, '❌ Error during shutdown');
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  try {
    await prisma.$disconnect();
    logger.info('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, '❌ Error during shutdown');
    process.exit(1);
  }
});

start();
