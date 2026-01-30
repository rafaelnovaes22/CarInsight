import { Router } from 'express';
import { logger } from '../lib/logger';
import { MessageHandlerV2 } from '../services/message-handler-v2.service';
import { AudioTranscriptionService } from '../services/audio-transcription.service';
import { env } from '../config/env';

const router = Router();
const messageHandler = new MessageHandlerV2();
const audioService = new AudioTranscriptionService(); // Pode precisar de adaptação para Base64

router.post('/evolution', async (req, res) => {
  try {
    const { event, instance, data } = req.body;

    // Validar token de segurança (se configurado webhook global)
    // if (req.headers.apikey !== env.EVOLUTION_API_KEY) ...

    if (event !== 'messages.upsert') {
      // Ignorar outros eventos por enquanto
      return res.status(200).send('OK');
    }

    const { key, message, messageType } = data;

    if (!key || key.fromMe) {
      // Ignorar mensagens enviadas por mim
      return res.status(200).send('OK');
    }

    const phoneNumber = key.remoteJid?.replace('@s.whatsapp.net', '');

    if (!phoneNumber) {
      return res.status(200).send('OK');
    }

    // Extrair texto
    let content = '';
    let isAudio = false;
    let mediaData = null;

    if (messageType === 'conversation') {
      content = message.conversation;
    } else if (messageType === 'extendedTextMessage') {
      content = message.extendedTextMessage?.text || '';
    } else if (messageType === 'audioMessage') {
      isAudio = true;
      // Evolution pode enviar base64 no campo media (depende da config 'EVENTS_DATA_MESSAGE_MEDIA_ENABLED')
      // Se não vier, precisamos baixar.
      // Assumindo MVP: vamos tratar apenas texto por hora, e logar aviso se for áudio.
      logger.info(
        '🎤 Audio received via Evolution (Not implemented explicitly in this handler yet)'
      );
    }

    if (!content && !isAudio) {
      logger.debug('⚠️ Ignoring unsupported message type', { messageType });
      return res.status(200).send('OK');
    }

    logger.info('📱 Received via Evolution', { from: phoneNumber, content });

    // Processar
    if (content) {
      // Enviar para bot
      // Nota: Precisamos injetar o EvolutionService no MessageHandler se quisermos responder!
      // No momento o MessageHandler instancia o MetaService internamente.
      // Isso será resolvido na Fase 6 (Dependency Injection).

      // Por enquanto, vamos instanciar o handler mas a resposta vai falhar
      // se o MessageHandler ainda usar o MetaService internamente hardcoded.
      // Mas a rota existe.
      await messageHandler.handleMessage(phoneNumber, content);
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error handling Evolution webhook');
    res.status(500).json({ error: 'Internal Error' });
  }
});

export default router;
