import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import WhatsAppMetaService from '../services/whatsapp-meta.service';

const router = Router();
const whatsappMeta = new WhatsAppMetaService();

/**
 * GET /webhooks/whatsapp
 * Webhook verification (called by Meta)
 */
router.get('/whatsapp', (req: Request, res: Response) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    logger.info('📥 Webhook verification request', { mode, token });

    if (!mode || !token) {
      logger.warn('❌ Missing mode or token in verification');
      return res.status(400).send('Missing parameters');
    }

    const result = whatsappMeta.verifyWebhook(
      mode as string,
      token as string,
      challenge as string
    );

    if (result) {
      logger.info('✅ Webhook verified, sending challenge');
      return res.status(200).send(result);
    } else {
      logger.warn('❌ Webhook verification failed');
      return res.status(403).send('Forbidden');
    }
  } catch (error) {
    logger.error({ error }, '❌ Error in webhook verification');
    return res.status(500).send('Internal Server Error');
  }
});

/**
 * POST /webhooks/whatsapp
 * Receive messages from Meta
 */
router.post('/whatsapp', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    logger.debug('📩 Webhook received', {
      object: body.object,
      entries: body.entry?.length || 0,
    });

    // Respond immediately (Meta requires response within 20s)
    res.status(200).send('EVENT_RECEIVED');

    // Process webhook asynchronously
    if (body.object === 'whatsapp_business_account' && body.entry) {
      // Don't await - process in background
      whatsappMeta.processWebhook(body).catch((error) => {
        logger.error({ error }, '❌ Error processing webhook');
      });
    } else {
      logger.debug('Ignoring non-whatsapp webhook', { object: body.object });
    }
  } catch (error) {
    logger.error({ error }, '❌ Error receiving webhook');
    // Still return 200 to Meta to avoid retries
    res.status(200).send('ERROR');
  }
});

/**
 * POST /webhooks/whatsapp/test
 * Test endpoint to send messages manually
 */
router.post('/whatsapp/test', async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        error: 'Missing required fields: to, message',
      });
    }

    await whatsappMeta.sendMessage(to, message);

    return res.status(200).json({
      success: true,
      message: 'Message sent successfully',
    });
  } catch (error: any) {
    logger.error({ error }, '❌ Error sending test message');
    return res.status(500).json({
      error: 'Failed to send message',
      details: error.message,
    });
  }
});

export default router;
