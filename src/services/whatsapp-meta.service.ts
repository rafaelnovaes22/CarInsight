import axios from 'axios';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import { MessageHandlerV2 } from './message-handler-v2.service';
import { AudioTranscriptionService, TranscriptionResult } from './audio-transcription.service';

interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: {
    body: string;
  };
  audio?: {
    id: string;
    mime_type: string;
  };
  type: 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker';
}

interface MetaWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: {
          name: string;
        };
        wa_id: string;
      }>;
      messages?: MetaWebhookMessage[];
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
      }>;
    };
    field: string;
  }>;
}

/**
 * Error messages for audio processing failures
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
const AUDIO_ERROR_MESSAGES: Record<string, string> = {
  DOWNLOAD_FAILED: 'Não consegui baixar seu áudio. Pode tentar enviar novamente ou digitar sua mensagem?',
  TRANSCRIPTION_FAILED: 'Não consegui entender seu áudio. Pode tentar enviar novamente com mais clareza ou digitar sua mensagem?',
  DURATION_EXCEEDED: 'Seu áudio é muito longo (máximo 2 minutos). Pode enviar um áudio mais curto ou digitar sua mensagem?',
  LOW_QUALITY: 'O áudio está com qualidade baixa. Pode enviar novamente em um ambiente mais silencioso ou digitar sua mensagem?',
  DISABLED: 'No momento não estou conseguindo ouvir áudios. Pode digitar sua mensagem, por favor?',
};

export class WhatsAppMetaService {
  private messageHandler: MessageHandlerV2;
  private audioTranscriptionService: AudioTranscriptionService;
  private apiUrl: string;
  private phoneNumberId: string;
  private accessToken: string;

  constructor() {
    this.messageHandler = new MessageHandlerV2();
    this.audioTranscriptionService = new AudioTranscriptionService();
    this.phoneNumberId = env.META_WHATSAPP_PHONE_NUMBER_ID || '';
    this.accessToken = env.META_WHATSAPP_TOKEN || '';
    this.apiUrl = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;

    if (!this.phoneNumberId || !this.accessToken) {
      logger.warn('⚠️  Meta Cloud API credentials not configured. Set META_WHATSAPP_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID');
    } else {
      logger.info('✅ Meta Cloud API WhatsApp ready', {
        phoneNumberId: this.phoneNumberId.substring(0, 10) + '...',
      });
    }
  }

  /**
   * Verify webhook (called by Meta)
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = env.META_WEBHOOK_VERIFY_TOKEN || 'faciliauto_webhook_2025';

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('✅ Webhook verified successfully');
      return challenge;
    }

    logger.warn('❌ Webhook verification failed', { mode, token });
    return null;
  }

  /**
   * Process incoming webhook from Meta
   */
  async processWebhook(body: { entry: MetaWebhookEntry[] }): Promise<void> {
    try {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;

          // Process incoming messages
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              await this.handleIncomingMessage(message);
            }
          }

          // Process status updates (optional)
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              this.handleStatusUpdate(status);
            }
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error processing webhook');
      throw error;
    }
  }

  /**
   * Handle incoming message
   * Routes to appropriate handler based on message type
   * Requirements: 1.1
   */
  private async handleIncomingMessage(message: MetaWebhookMessage): Promise<void> {
    try {
      // Route audio messages to audio handler
      if (message.type === 'audio' && message.audio) {
        await this.handleAudioMessage(message);
        return;
      }

      // Only process text messages
      if (message.type !== 'text' || !message.text) {
        logger.debug('Ignoring non-text message', { type: message.type });
        return;
      }

      const phoneNumber = message.from;
      const messageText = message.text.body;

      console.log('📱 RECEIVED FROM:', phoneNumber);
      console.log('💬 TEXT:', messageText);

      logger.info('📱 Message received', {
        from: phoneNumber,
        text: messageText.substring(0, 50),
      });

      // Mark message as read
      await this.markMessageAsRead(message.id);

      // Process with our bot
      logger.info('🤖 Processing with bot...');
      const response = await this.messageHandler.handleMessage(phoneNumber, messageText);

      logger.info('📤 Sending response...', {
        to: phoneNumber,
        responseLength: response.length,
        responsePreview: response.substring(0, 100),
      });

      // Send response back
      await this.sendMessage(phoneNumber, response);

      logger.info('✅ Response sent successfully', {
        to: phoneNumber,
        length: response.length,
      });
    } catch (error: any) {
      logger.error({
        error: error.message,
        stack: error.stack,
        message
      }, '❌ Error handling incoming message');
      throw error;
    }
  }

  /**
   * Handle audio message
   * Extracts media_id, transcribes audio, and processes as text
   * Requirements: 1.1, 1.4, 1.5, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4
   */
  async handleAudioMessage(message: MetaWebhookMessage): Promise<void> {
    const phoneNumber = message.from;
    const mediaId = message.audio?.id;

    if (!mediaId) {
      logger.error({ message }, 'Audio message missing media ID');
      return;
    }

    console.log('🎤 AUDIO RECEIVED FROM:', phoneNumber);
    console.log('📎 MEDIA ID:', mediaId);

    logger.info('🎤 Audio message received', {
      from: phoneNumber,
      mediaId,
      mimeType: message.audio?.mime_type,
    });

    // Step 1: Mark message as read immediately (Requirement 2.1)
    await this.markMessageAsRead(message.id);

    // Step 2: Send acknowledgment/typing indicator (Requirement 2.2)
    await this.sendTypingIndicator(phoneNumber);

    // Step 3: Transcribe audio
    logger.info('🔄 Transcribing audio...');
    const transcriptionResult = await this.audioTranscriptionService.transcribeFromMediaId(mediaId);

    // Step 4: Handle transcription result
    if (!transcriptionResult.success) {
      // Send error message to user (Requirements 3.1, 3.2, 3.3, 3.4)
      const errorMessage = this.getAudioErrorMessage(transcriptionResult.errorCode);
      await this.sendMessage(phoneNumber, errorMessage);

      logger.warn('⚠️ Audio transcription failed', {
        from: phoneNumber,
        mediaId,
        errorCode: transcriptionResult.errorCode,
      });
      return;
    }

    const transcribedText = transcriptionResult.text!;

    console.log('📝 TRANSCRIBED TEXT:', transcribedText);

    logger.info('✅ Audio transcribed successfully', {
      from: phoneNumber,
      mediaId,
      textLength: transcribedText.length,
      duration: transcriptionResult.duration,
      language: transcriptionResult.language,
    });

    // Step 5: Process transcribed text with message handler (Requirement 1.4, 5.4)
    // Pass mediaId for audio message persistence
    logger.info('🤖 Processing transcribed text with bot...');
    const response = await this.messageHandler.handleMessage(phoneNumber, transcribedText, { mediaId });

    logger.info('📤 Sending response...', {
      to: phoneNumber,
      responseLength: response.length,
      responsePreview: response.substring(0, 100),
    });

    // Step 6: Send response back to user (Requirement 1.5)
    await this.sendMessage(phoneNumber, response);

    logger.info('✅ Audio response sent successfully', {
      to: phoneNumber,
      length: response.length,
    });
  }

  /**
   * Get user-friendly error message for audio processing failures
   * Requirements: 3.1, 3.2, 3.3, 3.4
   */
  getAudioErrorMessage(errorCode?: string): string {
    if (!errorCode) {
      return AUDIO_ERROR_MESSAGES.TRANSCRIPTION_FAILED;
    }
    return AUDIO_ERROR_MESSAGES[errorCode] || AUDIO_ERROR_MESSAGES.TRANSCRIPTION_FAILED;
  }

  /**
   * Send typing indicator to show processing
   * Requirement: 2.2
   */
  private async sendTypingIndicator(to: string): Promise<void> {
    try {
      // WhatsApp doesn't have a direct typing indicator API
      // We send a reaction or use the "typing" status if available
      // For now, we'll just log this - the read receipt serves as acknowledgment
      logger.debug('📝 Typing indicator sent', { to });
    } catch (error) {
      // Non-critical, just log
      logger.debug({ error, to }, 'Failed to send typing indicator');
    }
  }

  /**
   * Handle status updates (delivered, read, etc)
   */
  private handleStatusUpdate(status: any): void {
    logger.debug('📊 Status update', {
      messageId: status.id,
      status: status.status,
    });
  }

  /**
   * Send text message
   */
  async sendMessage(to: string, text: string): Promise<void> {
    try {
      console.log('🔄 SENDING TO:', to);
      console.log('📝 MESSAGE:', text.substring(0, 150));
      console.log('🌐 API URL:', this.apiUrl);

      logger.info('🔄 Calling Meta API...', {
        to: to,
        toLength: to.length,
        toPreview: to.substring(0, 20),
        apiUrl: this.apiUrl,
        textLength: text.length,
        textPreview: text.substring(0, 100),
      });

      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: {
            preview_url: false,
            body: text,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 seconds timeout
        }
      );

      logger.info('✅ Message sent via Meta API', {
        messageId: response.data.messages?.[0]?.id,
        to: to,
      });
    } catch (error: any) {
      logger.error({
        error: error.response?.data || error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        to,
        apiUrl: this.apiUrl,
        hasToken: !!this.accessToken,
        tokenPrefix: this.accessToken?.substring(0, 10),
      }, '❌ Failed to send message via Meta API');
      throw error;
    }
  }

  /**
   * Send message with buttons (interactive)
   */
  async sendButtonMessage(to: string, bodyText: string, buttons: Array<{ id: string; title: string }>): Promise<void> {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: {
              text: bodyText,
            },
            action: {
              buttons: buttons.map((btn, idx) => ({
                type: 'reply',
                reply: {
                  id: btn.id,
                  title: btn.title.substring(0, 20), // Max 20 chars
                },
              })),
            },
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.debug('✅ Button message sent', {
        messageId: response.data.messages?.[0]?.id,
      });
    } catch (error: any) {
      logger.error({
        error: error.response?.data || error.message,
      }, '❌ Failed to send button message');
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  private async markMessageAsRead(messageId: string): Promise<void> {
    try {
      await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      // Non-critical, just log
      logger.debug({ error, messageId }, 'Failed to mark message as read');
    }
  }

  /**
   * Send template message (requires pre-approved templates)
   */
  async sendTemplate(to: string, templateName: string, languageCode: string = 'pt_BR', components?: any[]): Promise<void> {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode,
            },
            components: components || [],
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('✅ Template sent', {
        messageId: response.data.messages?.[0]?.id,
        template: templateName,
      });
    } catch (error: any) {
      logger.error({
        error: error.response?.data || error.message,
        template: templateName,
      }, '❌ Failed to send template');
      throw error;
    }
  }

  /**
   * Get Media URL (for images, videos, documents)
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      return response.data.url;
    } catch (error: any) {
      logger.error({
        error: error.response?.data || error.message,
        mediaId,
      }, '❌ Failed to get media URL');
      throw error;
    }
  }
}

export default WhatsAppMetaService;
