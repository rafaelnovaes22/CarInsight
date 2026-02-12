import { Router } from 'express';
import { logger } from '../lib/logger';
import { MessageHandlerV2 } from '../services/message-handler-v2.service';
import { WhatsAppEvolutionService } from '../services/whatsapp-evolution.service';
import { env } from '../config/env';

const router = Router();
const messageHandler = new MessageHandlerV2();
const evolutionService = new WhatsAppEvolutionService();

function isAuthorized(req: any): boolean {
  if (!env.EVOLUTION_API_KEY) {
    return true;
  }

  const incomingKey = (req.headers.apikey as string) || (req.headers['x-api-key'] as string);
  return incomingKey === env.EVOLUTION_API_KEY;
}

router.post('/evolution', async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      logger.warn('Evolution webhook unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { event, data } = req.body || {};

    if (event !== 'messages.upsert') {
      return res.status(200).send('OK');
    }

    const { key, message, messageType } = data || {};

    if (!key || key.fromMe) {
      return res.status(200).send('OK');
    }

    const phoneNumber = key.remoteJid?.replace('@s.whatsapp.net', '');
    if (!phoneNumber) {
      return res.status(200).send('OK');
    }

    let content = '';

    if (messageType === 'conversation') {
      content = message?.conversation || '';
    } else if (messageType === 'extendedTextMessage') {
      content = message?.extendedTextMessage?.text || '';
    } else if (messageType === 'audioMessage') {
      logger.info(
        { from: `${phoneNumber.slice(0, 6)}****` },
        'Audio received via Evolution but not implemented in this route yet'
      );
      return res.status(200).send('OK');
    }

    if (!content) {
      logger.debug({ messageType }, 'Ignoring unsupported/empty Evolution message');
      return res.status(200).send('OK');
    }

    logger.info({ from: `${phoneNumber.slice(0, 6)}****` }, 'Received message via Evolution');

    const response = await messageHandler.handleMessage(phoneNumber, content);
    await evolutionService.sendMessage(phoneNumber, response);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error handling Evolution webhook');
    return res.status(500).json({ error: 'Internal Error' });
  }
});

export default router;
