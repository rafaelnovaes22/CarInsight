import axios from 'axios';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import { IWhatsAppService, SendMessageOptions } from '../interfaces/whatsapp-service.interface';

export class WhatsAppEvolutionService implements IWhatsAppService {
  private apiUrl: string;
  private apiKey: string;
  private instanceName: string;

  constructor() {
    this.apiUrl = env.EVOLUTION_API_URL || 'http://localhost:8080';
    this.apiKey = env.EVOLUTION_API_KEY || '';
    this.instanceName = env.EVOLUTION_INSTANCE_NAME || 'carinsight';

    if (!this.apiKey) {
      logger.warn('⚠️  EVOLUTION_API_KEY not configured.');
    } else {
      logger.info(`✅ Evolution API Adapter ready for instance: ${this.instanceName}`);
    }
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      apikey: this.apiKey,
    };
  }

  /**
   * Envia mensagem de texto
   */
  async sendMessage(to: string, content: string, options?: SendMessageOptions): Promise<void> {
    const url = `${this.apiUrl}/message/sendText/${this.instanceName}`;

    // Evolution espera número com DDI (ex: 5511999999999)
    // Se o número vier com @s.whatsapp.net, removemos
    const number = to.replace('@s.whatsapp.net', '');

    try {
      const payload = {
        number,
        text: content,
        delay: 500,
        linkPreview: options?.previewUrl ?? false,
        quoted: options?.quotedMessageId ? { key: { id: options.quotedMessageId } } : undefined,
      };

      await axios.post(url, payload, { headers: this.getHeaders() });

      logger.info('✅ Message sent via Evolution API', { to });
    } catch (error: any) {
      this.logError('sendText', error, { to });
      throw error;
    }
  }

  /**
   * Marca mensagem como lida
   */
  async markMessageAsRead(messageId: string): Promise<void> {
    // Evolution v2 endpoint
    // POST /chat/markMessageAsRead/{instance}
    // Body: { read: true, realLeads: []... } - A documentação varia
    // Assumindo endpoint padrão v2

    // Nota: Em algumas versões da Evolution, isso pode ser diferente.
    // Vamos implementar um best-effort
    const url = `${this.apiUrl}/chat/markMessageAsRead/${this.instanceName}`;

    try {
      // Simplificação: Evolution geralmente aceita array de mensagens
      await axios.post(
        url,
        {
          read: true,
          messageId: [messageId], // Pode ser que exija estrutura diferente dependendo da versão
        },
        { headers: this.getHeaders() }
      );
    } catch (error) {
      logger.debug('Failed to mark message as read on Evolution', {
        error: (error as any).message,
      });
    }
  }

  /**
   * Envia indicador de digitando
   */
  async sendTypingIndicator(to: string): Promise<void> {
    const url = `${this.apiUrl}/chat/sendPresence/${this.instanceName}`;
    const number = to.replace('@s.whatsapp.net', '');

    try {
      await axios.post(
        url,
        {
          number,
          presence: 'composing',
          delay: 1200,
        },
        { headers: this.getHeaders() }
      );
    } catch (error) {
      // Ignore errors for typing indicator
    }
  }

  /**
   * Obtém URL de mídia
   * Na Evolution, isso é tricky. Se a mídia já veio no webhook como base64, não precisamos buscar.
   * Se precisamos buscar, usamos /chat/findMessage/{instance} para tentar recuperar.
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    // TODO: Implementar lógica de recuperação de mídia se necessário.
    // Por enquanto, lança erro pois a Evolution envia base64 no webhook geralmente.
    throw new Error(
      'Method not implemented properly for Evolution yet. Webhook provides media data.'
    );
  }

  async sendButtonMessage(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<void> {
    // Implementação de botões na Evolution depende do provider (Baileys suporta, mas com limitações recentes da Meta)
    // Fallback para texto com lista
    const buttonsText = buttons.map(b => `[${b.title}]`).join('\n');
    const text = `${bodyText}\n\n${buttonsText}`;
    await this.sendMessage(to, text);
  }

  private logError(action: string, error: any, context: any = {}) {
    logger.error(
      {
        error: error.response?.data || error.message,
        status: error.response?.status,
        action,
        ...context,
      },
      `❌ Evolution API Error: ${action}`
    );
  }
}
