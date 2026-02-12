import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import WhatsAppMetaService from '../services/whatsapp-meta.service';

const router = Router();
const whatsappMeta = new WhatsAppMetaService();

function validateMetaSignature(req: Request): boolean {
  if (!env.META_APP_SECRET) {
    if (env.NODE_ENV === 'production') {
      logger.error('META_APP_SECRET is required in production');
      return false;
    }
    return true;
  }

  const signatureHeader = req.header('x-hub-signature-256');
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', env.META_APP_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex')}`;

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const receivedBuffer = Buffer.from(signatureHeader, 'utf8');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function hasAdminSecret(req: Request): boolean {
  if (!env.SEED_SECRET) {
    return false;
  }

  const providedSecret = (req.headers['x-admin-secret'] as string) || (req.query.secret as string);
  return providedSecret === env.SEED_SECRET;
}

/**
 * GET /webhooks/whatsapp
 * Webhook verification (called by Meta)
 */
router.get('/whatsapp', (req: Request, res: Response) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    logger.info({ mode }, 'Webhook verification request');

    if (!mode || !token) {
      logger.warn('Missing mode or token in verification');
      return res.status(400).send('Missing parameters');
    }

    const result = whatsappMeta.verifyWebhook(mode as string, token as string, challenge as string);

    if (result) {
      logger.info('Webhook verified, sending challenge');
      return res.status(200).send(result);
    }

    logger.warn('Webhook verification failed');
    return res.status(403).send('Forbidden');
  } catch (error) {
    logger.error({ error }, 'Error in webhook verification');
    return res.status(500).send('Internal Server Error');
  }
});

/**
 * POST /webhooks/whatsapp
 * Receive messages from Meta
 */
router.post('/whatsapp', async (req: Request, res: Response) => {
  try {
    if (!validateMetaSignature(req)) {
      logger.warn('Invalid webhook signature');
      return res.status(403).send('Forbidden');
    }

    const body = req.body;

    logger.info(
      {
        object: body?.object,
        entries: body?.entry?.length || 0,
      },
      'Webhook received'
    );

    // Respond immediately (Meta requires quick acknowledgement)
    res.status(200).send('EVENT_RECEIVED');

    // Process webhook asynchronously
    if (body?.object === 'whatsapp_business_account' && body.entry) {
      whatsappMeta.processWebhook(body).catch(error => {
        logger.error({ error }, 'Error processing webhook');
      });
    }
  } catch (error) {
    logger.error({ error }, 'Error receiving webhook');
    // Still return 200 to avoid retries in unexpected parser/runtime issues
    res.status(200).send('ERROR');
  }
});

/**
 * POST /webhooks/whatsapp/test
 * Test endpoint to send messages manually
 */
router.post('/whatsapp/test', async (req: Request, res: Response) => {
  try {
    if (!env.ENABLE_WEBHOOK_TEST_ENDPOINT) {
      return res.status(404).json({ error: 'Endpoint disabled' });
    }

    if (!hasAdminSecret(req)) {
      return res.status(403).json({ error: 'Unauthorized - Invalid secret' });
    }

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
    logger.error({ error }, 'Error sending test message');
    return res.status(500).json({
      error: 'Failed to send message',
      details: error.message,
    });
  }
});

export default router;
