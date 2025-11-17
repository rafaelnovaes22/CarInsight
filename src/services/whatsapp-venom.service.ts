import { create, Whatsapp, Message } from 'venom-bot';
import { logger } from '../lib/logger';
import { MessageHandler } from './message-handler.service';

export class WhatsAppVenomService {
  private client: Whatsapp | null = null;
  private messageHandler: MessageHandler;

  constructor() {
    this.messageHandler = new MessageHandler();
  }

  async initialize() {
    try {
      logger.info('🔄 Initializing WhatsApp with Venom-Bot...');

      this.client = await create(
        'faciliauto-session',
        (base64Qr, asciiQR, attempts, urlCode) => {
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📱 ESCANEIE O QR CODE ABAIXO:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          console.log(asciiQR);
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📱 INSTRUÇÕES:');
          console.log('1. Abra WhatsApp no celular');
          console.log('2. Menu → Aparelhos conectados');
          console.log('3. Conectar aparelho');
          console.log('4. Escaneie o código acima');
          console.log(`\nTentativa ${attempts} - Tempo restante: 60s`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        },
        (statusSession) => {
          console.log('\n📊 Status da sessão:', statusSession);
        },
        {
          headless: 'new' as any, // Use new headless mode
          useChrome: true, // Use system Chrome/Chromium
          executablePath: '/usr/bin/chromium-browser',
          logQR: false,
          browserArgs: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ],
          autoClose: 60000,
          disableWelcome: true,
          puppeteerOptions: {
            executablePath: '/usr/bin/chromium-browser',
            headless: 'new' as any,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu'
            ]
          }
        }
      );

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ WHATSAPP CONECTADO COM SUCESSO!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📱 Bot está pronto para receber mensagens!');
      console.log('🧪 Envie "Olá, quero comprar um carro" para testar');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      logger.info('✅ WhatsApp connected successfully with Venom-Bot!');

      // Listen for incoming messages
      this.client.onMessage(async (message: Message) => {
        await this.handleIncomingMessage(message);
      });

      // Listen for connection status
      this.client.onStateChange((state) => {
        logger.info('WhatsApp state changed:', state);
        if (state === 'CONFLICT' || state === 'UNLAUNCHED') {
          logger.warn('Connection conflict detected. Bot may need restart.');
        }
      });

    } catch (error) {
      logger.error({ error }, '❌ Failed to initialize WhatsApp with Venom-Bot');
      throw error;
    }
  }

  private async handleIncomingMessage(message: Message) {
    try {
      // Ignore messages from self
      if (message.isGroupMsg) return; // Ignore group messages
      if (message.fromMe) return; // Ignore own messages
      if (message.type !== 'chat') return; // Only text messages

      const phoneNumber = message.from.replace('@c.us', '');
      const messageText = message.body || '';

      if (!messageText) return;

      logger.info({ phoneNumber, message: messageText }, 'Incoming message');

      // Process message
      const response = await this.messageHandler.handleMessage(phoneNumber, messageText);

      // Send response
      if (response) {
        await this.sendMessage(phoneNumber, response);
      }
    } catch (error) {
      logger.error({ error }, 'Error handling message');
    }
  }

  async sendMessage(phoneNumber: string, message: string) {
    if (!this.client) {
      throw new Error('WhatsApp not initialized');
    }

    try {
      const chatId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
      await this.client.sendText(chatId, message);
      logger.info({ phoneNumber, message }, 'Message sent');
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Error sending message');
      throw error;
    }
  }

  async sendImage(phoneNumber: string, imageUrl: string, caption?: string) {
    if (!this.client) {
      throw new Error('WhatsApp not initialized');
    }

    try {
      const chatId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
      await this.client.sendImage(chatId, imageUrl, 'vehicle', caption || '');
      logger.info({ phoneNumber, imageUrl }, 'Image sent');
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Error sending image');
      throw error;
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      logger.info('WhatsApp connection closed');
    }
  }
}

export default WhatsAppVenomService;
