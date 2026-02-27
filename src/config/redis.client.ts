import { Redis } from 'ioredis';
import { logger } from '../lib/logger';

class RedisClientService {
  private client: Redis | null = null;
  private isConnected = false;

  constructor() {
    this.init();
  }

  private init() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      logger.warn('REDIS_URL não está configurada. Operações de Redis não estarão disponíveis.');
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) {
            logger.warn('Redis: Limite máximo de tentativas de reconexão atingido.');
            return null; // Parar de tentar
          }
          const delay = Math.min(times * 200, 2000);
          return delay;
        },
      });

      this.client.on('connect', () => {
        logger.info('🔌 Redis conectado com sucesso');
        this.isConnected = true;
      });

      this.client.on('error', err => {
        logger.warn({ err: err.message }, 'Erro na conexão com Redis');
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'Falha fatal ao inicializar o Redis');
    }
  }

  public getClient(): Redis | null {
    return this.isConnected ? this.client : null;
  }

  public isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }
}

// Export a singleton instance
export const redisService = new RedisClientService();
