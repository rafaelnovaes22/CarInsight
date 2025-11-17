import axios from 'axios';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import { MessageHandler } from './message-handler.service';

interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: {
    body: string;
  };
  type: string;
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

export class WhatsAppMetaService {
  private messageHandler: MessageHandler;
  private apiUrl: string;
  private phoneNumberId: string;
  private accessToken: string;

  constructor() {
    this.messageHandler = new MessageHandler();
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
   */
  private async handleIncomingMessage(message: MetaWebhookMessage): Promise<void> {
    try {
      // Only process text messages
      if (message.type !== 'text' || !message.text) {
        logger.debug('Ignoring non-text message', { type: message.type });
        return;
      }

      const phoneNumber = message.from;
      const messageText = message.text.body;

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
      logger.info('🔄 Calling Meta API...', {
        to,
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
