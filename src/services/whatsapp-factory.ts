import { IWhatsAppService } from '../interfaces/whatsapp-service.interface';
import { WhatsAppMetaService } from './whatsapp-meta.service';
import { WhatsAppEvolutionService } from './whatsapp-evolution.service';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export class WhatsAppServiceFactory {
  private static instance: IWhatsAppService;

  static getInstance(): IWhatsAppService {
    if (this.instance) {
      return this.instance;
    }

    if (env.EVOLUTION_API_KEY && env.EVOLUTION_API_URL) {
      logger.info('🔌 Using WhatsApp Provider: Evolution API');
      this.instance = new WhatsAppEvolutionService();
    } else {
      logger.info('🔌 Using WhatsApp Provider: Meta Cloud API');
      this.instance = new WhatsAppMetaService();
    }

    return this.instance;
  }
}
