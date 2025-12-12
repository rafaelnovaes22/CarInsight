import express from 'express';
import path from 'path';
import { env } from './config/env';
import { logger } from './lib/logger';
import { MessageHandlerV2 } from './services/message-handler-v2.service';
import { inMemoryVectorStore } from './services/in-memory-vector.service';

const app = express();
const messageHandler = new MessageHandlerV2();

let vectorStoreReady = false;

async function initializeVectorStore() {
  try {
    logger.info('🧠 Inicializando vector store...');
    await inMemoryVectorStore.initialize();
    vectorStoreReady = true;
    logger.info('✅ Vector store pronto!');
  } catch (error) {
    logger.error({ error }, '❌ Erro ao inicializar vector store');
    logger.warn('⚠️  Continuando sem vector search (usará SQL fallback)');
    vectorStoreReady = false;
  }
}

initializeVectorStore().catch(err => {
  logger.error({ error: err }, 'Fatal error initializing vector store');
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Stats endpoint
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

// Simulate WhatsApp message
app.post('/message', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'phone and message are required' });
    }

    logger.info({ phone, message }, '📱 Incoming message via API');

    // Process message
    const response = await messageHandler.handleMessage(phone, message);

    logger.info({ phone, response }, '🤖 Bot response');

    res.json({
      success: true,
      phone,
      userMessage: message,
      botResponse: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Error processing message');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = env.PORT || 3000;

async function start() {
  try {
    // Test database connection
    const { prisma } = await import('./lib/prisma');
    await prisma.$connect();
    logger.info('✅ Database connected');

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`🚀 API Test Server running on port ${PORT}`);
      logger.info(`📊 Dashboard: http://localhost:${PORT}/`);
      logger.info(`📊 Stats: http://localhost:${PORT}/stats`);
      logger.info(`💬 Send message: POST http://localhost:${PORT}/message`);
      logger.info('');
      logger.info('📱 Example curl command:');
      logger.info(
        `curl -X POST http://localhost:${PORT}/message -H "Content-Type: application/json" -d '{"phone":"5511999999999","message":"Olá, quero comprar um carro"}'`
      );
    });
  } catch (error) {
    logger.error({ error }, '❌ Failed to start server');
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

start();
