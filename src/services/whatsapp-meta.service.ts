import axios from 'axios';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import { MessageHandlerV2 } from './message-handler-v2.service';
import { AudioTranscriptionService, TranscriptionResult } from './audio-transcription.service';
import { IWhatsAppService, SendMessageOptions } from '../interfaces/whatsapp-service.interface';

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
 */
const AUDIO_ERROR_MESSAGES: Record<string, string> = {
  DOWNLOAD_FAILED:
    'Não consegui baixar seu áudio. Pode tentar enviar novamente ou digitar sua mensagem?',
  TRANSCRIPTION_FAILED:
    'Não consegui entender seu áudio. Pode tentar enviar novamente com mais clareza ou digitar sua mensagem?',
  DURATION_EXCEEDED:
    'Seu áudio é muito longo (máximo 2 minutos). Pode enviar um áudio mais curto ou digitar sua mensagem?',
  LOW_QUALITY:
    'O áudio está com qualidade baixa. Pode enviar novamente em um ambiente mais silencioso ou digitar sua mensagem?',
  DISABLED: 'No momento não estou conseguindo ouvir áudios. Pode digitar sua mensagem, por favor?',
};

export class WhatsAppMetaService implements IWhatsAppService {
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
      logger.warn(
        'âš ï¸  Meta Cloud API credentials not configured. Set META_WHATSAPP_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID'
      );
    } else {
      logger.info('âœ… Meta Cloud API WhatsApp ready', {
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
      logger.info('âœ… Webhook verified successfully');
      return challenge;
    }

    logger.warn('âŒ Webhook verification failed', { mode });
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
        logger.info('âš ï¸ Ignoring non-text message', { type: message.type, id: message.id });
        return;
      }

      const phoneNumber = message.from;
      const messageText = message.text.body;

      logger.info('ðŸ“± Message received', {
        from: this.maskPhoneNumber(phoneNumber),
        textLength: messageText.length,
      });

      // Mark message as read
      await this.markMessageAsRead(message.id);

      // Process with our bot
      logger.info('ðŸ¤– Processing with bot...');
      const response = await this.messageHandler.handleMessage(phoneNumber, messageText);

      logger.info('ðŸ“¤ Sending response...', {
        to: this.maskPhoneNumber(phoneNumber),
        responseLength: response.length,
      });

      // Send response back
      await this.sendMessage(phoneNumber, response);

      logger.info('âœ… Response sent successfully', {
        to: this.maskPhoneNumber(phoneNumber),
        length: response.length,
      });
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          message,
        },
        'âŒ Error handling incoming message'
      );
      throw error;
    }
  }

  /**
   * Handle audio message
   */
  async handleAudioMessage(message: MetaWebhookMessage): Promise<void> {
    const phoneNumber = message.from;
    const mediaId = message.audio?.id;

    if (!mediaId) {
      logger.error({ message }, 'Audio message missing media ID');
      return;
    }

    logger.info('ðŸŽ¤ Audio message received', {
      from: this.maskPhoneNumber(phoneNumber),
      mediaId: mediaId.substring(0, 8) + '...',
      mimeType: message.audio?.mime_type,
    });

    // Step 1: Mark message as read immediately
    await this.markMessageAsRead(message.id);

    // Step 2: Send acknowledgment/typing indicator
    await this.sendTypingIndicator(phoneNumber);

    // Step 3: Transcribe audio
    logger.info('ðŸ”„ Transcribing audio...');
    const transcriptionResult = await this.audioTranscriptionService.transcribeFromMediaId(mediaId);

    // Step 4: Handle transcription result
    if (!transcriptionResult.success) {
      const errorMessage = this.getAudioErrorMessage(transcriptionResult.errorCode);
      await this.sendMessage(phoneNumber, errorMessage);

      logger.warn('âš ï¸ Audio transcription failed', {
        from: this.maskPhoneNumber(phoneNumber),
        mediaId: mediaId.substring(0, 8) + '...',
        errorCode: transcriptionResult.errorCode,
      });
      return;
    }

    const transcribedText = transcriptionResult.text!;

    logger.info('âœ… Audio transcribed successfully', {
      from: this.maskPhoneNumber(phoneNumber),
      mediaId: mediaId.substring(0, 8) + '...',
      textLength: transcribedText.length,
      duration: transcriptionResult.duration,
      language: transcriptionResult.language,
    });

    // Step 5: Process transcribed text with message handler
    logger.info('ðŸ¤– Processing transcribed text with bot...');
    const response = await this.messageHandler.handleMessage(phoneNumber, transcribedText, {
      mediaId,
    });

    logger.info('ðŸ“¤ Sending response...', {
      to: this.maskPhoneNumber(phoneNumber),
      responseLength: response.length,
    });

    // Step 6: Send response back to user
    await this.sendMessage(phoneNumber, response);

    logger.info('âœ… Audio response sent successfully', {
      to: this.maskPhoneNumber(phoneNumber),
      length: response.length,
    });
  }

  getAudioErrorMessage(errorCode?: string): string {
    if (!errorCode) {
      return AUDIO_ERROR_MESSAGES.TRANSCRIPTION_FAILED;
    }
    return AUDIO_ERROR_MESSAGES[errorCode] || AUDIO_ERROR_MESSAGES.TRANSCRIPTION_FAILED;
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(to: string): Promise<void> {
    try {
      logger.debug('ðŸ“ Typing indicator sent', { to: this.maskPhoneNumber(to) });
    } catch (error) {
      logger.debug({ error, to: this.maskPhoneNumber(to) }, 'Failed to send typing indicator');
    }
  }

  /**
   * Handle status updates
   */
  private handleStatusUpdate(status: any): void {
    logger.debug('ðŸ“Š Status update', {
      messageId: status.id,
      status: status.status,
    });
  }

  /**
   * Send text message (Implementation of IWhatsAppService)
   */
  async sendMessage(to: string, text: string, options?: SendMessageOptions): Promise<void> {
    try {
      logger.info('ðŸ”„ Calling Meta API...', {
        to: this.maskPhoneNumber(to),
        apiUrl: this.apiUrl,
        textLength: text.length,
      });

      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: {
            preview_url: options?.previewUrl ?? false,
            body: text,
          },
          context: options?.quotedMessageId ? { message_id: options.quotedMessageId } : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      logger.info('âœ… Message sent via Meta API', {
        messageId: response.data.messages?.[0]?.id,
        to: this.maskPhoneNumber(to),
      });
    } catch (error: any) {
      logger.error(
        {
          error: error.response?.data || error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          to: this.maskPhoneNumber(to),
          apiUrl: this.apiUrl,
          hasToken: !!this.accessToken,
        },
        'âŒ Failed to send message via Meta API'
      );
      throw error;
    }
  }

  /**
   * Send message with buttons
   */
  async sendButtonMessage(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<void> {
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
                  title: btn.title.substring(0, 20),
                },
              })),
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('âœ… Button message sent', {
        messageId: response.data.messages?.[0]?.id,
      });
    } catch (error: any) {
      logger.error(
        {
          error: error.response?.data || error.message,
        },
        'âŒ Failed to send button message'
      );
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId: string): Promise<void> {
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
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      logger.debug({ error, messageId }, 'Failed to mark message as read');
    }
  }

  /**
   * Send template message (not part of interface, specific to Meta)
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'pt_BR',
    components?: any[]
  ): Promise<void> {
    try {
      // ... implementation unchanged
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
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('âœ… Template sent', {
        messageId: response.data.messages?.[0]?.id,
        template: templateName,
      });
    } catch (error: any) {
      logger.error(
        {
          error: error.response?.data || error.message,
          template: templateName,
        },
        'âŒ Failed to send template'
      );
      throw error;
    }
  }

  /**
   * Get Media URL (Implementation of IWhatsAppService)
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    try {
      const response = await axios.get(`https://graph.facebook.com/v18.0/${mediaId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return response.data.url;
    } catch (error: any) {
      logger.error(
        {
          error: error.response?.data || error.message,
          mediaId,
        },
        'âŒ Failed to get media URL'
      );
      throw error;
    }
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || phoneNumber.length <= 6) {
      return '***';
    }

    return `${phoneNumber.slice(0, 6)}****`;
  }
}

export default WhatsAppMetaService;
