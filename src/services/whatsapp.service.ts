import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  WAMessage,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import { logger } from '../lib/logger';
import { MessageHandler } from './message-handler.service';

export class WhatsAppService {
  private sock: WASocket | null = null;
  private messageHandler: MessageHandler;

  constructor() {
    this.messageHandler = new MessageHandler();
  }

  async initialize() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');

    this.sock = makeWASocket({
      auth: state,
      logger: logger.child({ module: 'baileys' }),
      browser: ['FaciliAuto', 'Chrome', '1.0.0'],
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      connectTimeoutMs: 60000,
    });

    // Handle connection updates
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📱 ESCANEIE O QR CODE ABAIXO:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        qrcode.generate(qr, { small: false });
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📱 INSTRUÇÕES:');
        console.log('1. Abra WhatsApp no celular');
        console.log('2. Menu → Aparelhos conectados');
        console.log('3. Conectar aparelho');
        console.log('4. Escaneie o código acima');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        logger.info(`❌ Connection closed, status: ${statusCode}, reconnecting: ${shouldReconnect}`);

        if (shouldReconnect) {
          // Wait 3 seconds before reconnecting
          setTimeout(() => {
            logger.info('🔄 Reconnecting...');
            this.initialize();
          }, 3000);
        } else {
          logger.error('❌ Logged out from WhatsApp. Please restart and scan QR code again.');
        }
      } else if (connection === 'open') {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ WHATSAPP CONECTADO COM SUCESSO!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📱 Bot está pronto para receber mensagens!');
        console.log('🧪 Envie "Olá, quero comprar um carro" para testar');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        logger.info('✅ WhatsApp connected successfully!');
      }
    });

    // Save credentials
    this.sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        await this.handleIncomingMessage(msg);
      }
    });
  }

  private async handleIncomingMessage(msg: WAMessage) {
    try {
      // Ignore messages from self
      if (msg.key.fromMe) return;

      // Ignore status updates
      if (msg.key.remoteJid === 'status@broadcast') return;

      const phoneNumber = msg.key.remoteJid?.replace('@s.whatsapp.net', '') || '';
      const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

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
    if (!this.sock) {
      throw new Error('WhatsApp not initialized');
    }

    const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

    try {
      await this.sock.sendMessage(jid, { text: message });
      logger.info({ phoneNumber, message }, 'Message sent');
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Error sending message');
      throw error;
    }
  }

  async sendMessageWithButtons(
    phoneNumber: string,
    message: string,
    buttons: { id: string; text: string }[]
  ) {
    if (!this.sock) {
      throw new Error('WhatsApp not initialized');
    }

    const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

    try {
      // Note: Baileys buttons API changed - falling back to simple text with options
      const buttonText = buttons.map((btn, idx) => `${idx + 1}. ${btn.text}`).join('\n');
      const fullMessage = `${message}\n\n${buttonText}`;
      
      await this.sock.sendMessage(jid, { text: fullMessage });
      logger.info({ phoneNumber, buttons: buttons.length }, 'Message with buttons sent as text');
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Error sending message with buttons');
      // Fallback to simple text message
      await this.sendMessage(phoneNumber, message);
    }
  }

  async sendImage(phoneNumber: string, imageUrl: string, caption?: string) {
    if (!this.sock) {
      throw new Error('WhatsApp not initialized');
    }

    const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

    try {
      await this.sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption,
      });
      logger.info({ phoneNumber, imageUrl }, 'Image sent');
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Error sending image');
      throw error;
    }
  }
}

export default WhatsAppService;
