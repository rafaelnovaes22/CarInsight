/**
 * Rate Limit Service
 * 
 * Serviço unificado de rate limiting com suporte a:
 * - Múltiplas stores (Redis primária, Memory fallback)
 * - Auto-fallback quando primária falha
 * - Métricas e logging estruturado
 * - Múltiplas configurações por recurso
 */

import { logger } from '../lib/logger';
import { maskPhoneNumber } from '../lib/privacy';
import {
  createMemoryStore,
  MemoryRateLimitStore,
} from '../lib/rate-limit/memory-store';
import { createRedisStore, RedisRateLimitStore } from '../lib/rate-limit/redis-store';
import type {
  RateLimitConfig,
  RateLimitEvent,
  RateLimitServiceOptions,
  RateLimitStatus,
  RateLimitStore,
} from '../lib/rate-limit/types';
import { env } from '../config/env';
import { rateLimitMetrics } from './metrics.service';

// Configurações padrão
const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: env.RATE_LIMIT_MAX_REQUESTS ?? 10,
  windowMs: env.RATE_LIMIT_WINDOW_MS ?? 60000,
  name: 'default',
};

// Configurações específicas por recurso
const RESOURCE_CONFIGS: Map<string, RateLimitConfig> = new Map([
  [
    'whatsapp:message',
    {
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS ?? 10,
      windowMs: env.RATE_LIMIT_WINDOW_MS ?? 60000,
      name: 'whatsapp:message',
    },
  ],
  [
    'api:admin',
    {
      maxRequests: 100,
      windowMs: 60000,
      name: 'api:admin',
    },
  ],
  [
    'api:webhook',
    {
      maxRequests: 1000,
      windowMs: 60000,
      name: 'api:webhook',
    },
  ],
]);

/**
 * Serviço de Rate Limiting
 * 
 * Gerencia rate limiting com suporte a múltiplas stores e fallback automático.
 */
export class RateLimitService {
  private primaryStore: RateLimitStore | null = null;
  private fallbackStore: RateLimitStore;
  private autoFallback: boolean;
  private enableLogging: boolean;
  private enableMetrics: boolean;
  private onEvent?: (event: RateLimitEvent) => void;
  private primaryFailed = false;
  private lastPrimaryCheck = 0;
  private readonly PRIMARY_CHECK_INTERVAL = 30000; // 30s

  constructor(options: RateLimitServiceOptions = {}) {
    this.fallbackStore = options.fallbackStore ?? createMemoryStore({ name: 'fallback' });
    this.autoFallback = options.autoFallback ?? true;
    this.enableLogging = options.enableLogging ?? true;
    this.enableMetrics = options.enableMetrics ?? true;
    this.onEvent = options.onEvent;

    // Inicializar store primária se fornecida
    if (options.primaryStore) {
      this.primaryStore = options.primaryStore;
    }
  }

  /**
   * Inicializa o serviço com Redis se disponível
   */
  async initialize(): Promise<void> {
    // Se já tem store primária configurada manualmente
    if (this.primaryStore) {
      logger.info('Rate limit service using provided primary store');
      return;
    }

    // Tentar conectar ao Redis se URL configurada
    if (env.REDIS_URL) {
      try {
        const redisStore = await createRedisStore({
          url: env.REDIS_URL,
          useSlidingWindow: true,
          keyPrefix: 'ratelimit',
        });
        
        this.primaryStore = redisStore;
        logger.info('Rate limit service initialized with Redis');
        
        // Métrica: Redis conectado
        if (this.enableMetrics) {
          const { redisMetrics } = await import('./metrics.service');
          redisMetrics.connected.set(1);
        }
        
        return;
      } catch (error) {
        logger.warn(
          { error: (error as Error).message },
          'Failed to connect to Redis, using memory fallback'
        );
        
        // Métrica: Redis desconectado
        if (this.enableMetrics) {
          const { redisMetrics } = await import('./metrics.service');
          redisMetrics.connected.set(0);
        }
      }
    } else {
      logger.info('REDIS_URL not configured, using memory store for rate limiting');
    }

    // Sem Redis - usar apenas memory store
    this.primaryStore = null;
  }

  /**
   * Verifica rate limit para uma chave
   * 
   * @param key - Identificador único (ex: phone number)
   * @param resource - Tipo de recurso (ex: 'whatsapp:message')
   * @returns Status do rate limiting
   */
  async checkLimit(key: string, resource?: string): Promise<RateLimitStatus> {
    const config = resource 
      ? (RESOURCE_CONFIGS.get(resource) ?? DEFAULT_CONFIG)
      : DEFAULT_CONFIG;

    const store = await this.getStore();
    const storeType = store === this.primaryStore ? 'redis' : 'memory';
    const startTime = Date.now();

    try {
      const status = await store.checkLimit(key, config);
      const duration = (Date.now() - startTime) / 1000;

      // Métricas
      if (this.enableMetrics) {
        rateLimitMetrics.requestsTotal.inc({
          resource: resource ?? 'default',
          status: status.allowed ? 'allowed' : 'blocked',
        });

        if (!status.allowed) {
          rateLimitMetrics.blockedTotal.inc({
            resource: resource ?? 'default',
            reason: 'rate_limit_exceeded',
          });
        }

        rateLimitMetrics.duration.observe(
          { resource: resource ?? 'default', store_type: storeType },
          duration
        );
      }

      // Log event
      if (this.enableLogging) {
        const event: RateLimitEvent = {
          event: status.allowed ? 'rate_limit_checked' : 'rate_limit_exceeded',
          key: this.maskKey(key),
          allowed: status.allowed,
          limit: status.limit,
          remaining: status.remaining,
          currentWindowCount: status.currentWindowCount,
          resetAt: status.resetAt,
          retryAfterMs: status.retryAfterMs,
          timestamp: new Date(),
          storeType,
        };

        if (status.allowed) {
          logger.debug(event, 'Rate limit check');
        } else {
          logger.warn(event, 'Rate limit exceeded');
        }

        this.onEvent?.(event);
      }

      return status;
    } catch (error) {
      logger.error({ error, key, resource }, 'Rate limit check failed');
      
      // Métrica de erro
      if (this.enableMetrics) {
        rateLimitMetrics.errorsTotal.inc({ error_type: 'check_failed' });
      }
      
      // Em caso de erro, permitir a requisição (fail open) ou usar fallback
      if (this.autoFallback && store === this.primaryStore) {
        this.primaryFailed = true;
        logger.warn('Primary store failed, switching to fallback');
        return this.fallbackStore.checkLimit(key, config);
      }

      // Se fallback também falhar, permitir (fail open para não bloquear usuários)
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        currentWindowCount: 0,
        resetAt: new Date(Date.now() + config.windowMs),
        retryAfterMs: undefined,
      };
    }
  }

  /**
   * Verifica especificamente para WhatsApp messages
   * Helper method para uso no GuardrailsService
   */
  async checkWhatsAppLimit(phoneNumber: string): Promise<RateLimitStatus> {
    const key = `whatsapp:${phoneNumber}`;
    return this.checkLimit(key, 'whatsapp:message');
  }

  /**
   * Verifica para API endpoints
   */
  async checkApiLimit(
    identifier: string,
    endpoint: 'admin' | 'webhook' | 'public'
  ): Promise<RateLimitStatus> {
    const key = `api:${endpoint}:${identifier}`;
    return this.checkLimit(key, `api:${endpoint}`);
  }

  /**
   * Incrementa contador sem verificar limite (para tracking)
   */
  async increment(key: string, resource?: string): Promise<void> {
    const config = resource 
      ? (RESOURCE_CONFIGS.get(resource) ?? DEFAULT_CONFIG)
      : DEFAULT_CONFIG;

    const store = await this.getStore();
    
    try {
      await store.increment(key, config);
    } catch (error) {
      logger.error({ error, key }, 'Failed to increment rate limit');
      
      if (this.enableMetrics) {
        rateLimitMetrics.errorsTotal.inc({ error_type: 'increment_failed' });
      }
    }
  }

  /**
   * Reseta contador para uma chave
   */
  async reset(key: string): Promise<void> {
    const stores: RateLimitStore[] = [this.fallbackStore];
    if (this.primaryStore) {
      stores.push(this.primaryStore);
    }

    for (const store of stores) {
      try {
        await store.reset(key);
      } catch (error) {
        logger.error({ error, key, store: store.constructor.name }, 'Failed to reset rate limit');
      }
    }

    if (this.enableLogging) {
      const event: RateLimitEvent = {
        event: 'rate_limit_reset',
        key: this.maskKey(key),
        allowed: true,
        limit: 0,
        remaining: 0,
        currentWindowCount: 0,
        resetAt: new Date(),
        timestamp: new Date(),
        storeType: this.primaryStore ? 'redis' : 'memory',
      };

      logger.info(event, 'Rate limit reset');
      this.onEvent?.(event);
    }
  }

  /**
   * Obtém estatísticas de uma chave
   */
  async getStats(
    key: string,
    resource?: string
  ): Promise<{ current: number; resetAt: Date; limit: number }> {
    const config = resource 
      ? (RESOURCE_CONFIGS.get(resource) ?? DEFAULT_CONFIG)
      : DEFAULT_CONFIG;

    const store = await this.getStore();
    
    try {
      const stats = await store.getStats(key, config);
      return {
        current: stats.current,
        resetAt: new Date(stats.resetAt),
        limit: config.maxRequests,
      };
    } catch (error) {
      logger.error({ error, key }, 'Failed to get rate limit stats');
      return {
        current: 0,
        resetAt: new Date(Date.now() + config.windowMs),
        limit: config.maxRequests,
      };
    }
  }

  /**
   * Verifica saúde do serviço
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    primary: boolean;
    fallback: boolean;
    usingFallback: boolean;
  }> {
    const primaryHealth = this.primaryStore ? await this.primaryStore.isHealthy() : false;
    const fallbackHealth = await this.fallbackStore.isHealthy();

    // Reset flag se primária voltou
    if (primaryHealth && this.primaryFailed) {
      this.primaryFailed = false;
      logger.info('Primary store recovered');
    }

    return {
      healthy: primaryHealth || fallbackHealth,
      primary: primaryHealth,
      fallback: fallbackHealth,
      usingFallback: this.primaryFailed || !primaryHealth,
    };
  }

  /**
   * Retorna configuração de um recurso
   */
  getResourceConfig(resource: string): RateLimitConfig | undefined {
    return RESOURCE_CONFIGS.get(resource);
  }

  /**
   * Registra uma nova configuração de recurso
   */
  registerResourceConfig(resource: string, config: RateLimitConfig): void {
    RESOURCE_CONFIGS.set(resource, config);
    logger.info({ resource, config }, 'Registered rate limit config');
  }

  /**
   * Fecha o serviço e libera recursos
   */
  async close(): Promise<void> {
    if (this.primaryStore) {
      await this.primaryStore.close?.();
    }
    await this.fallbackStore.close?.();
    logger.info('Rate limit service closed');
  }

  /**
   * Obtém a store apropriada (primária ou fallback)
   */
  private async getStore(): Promise<RateLimitStore> {
    // Se não tem primária, usar fallback
    if (!this.primaryStore) {
      return this.fallbackStore;
    }

    // Se fallback forçado, verificar periodicamente se primária voltou
    if (this.primaryFailed) {
      const now = Date.now();
      if (now - this.lastPrimaryCheck > this.PRIMARY_CHECK_INTERVAL) {
        this.lastPrimaryCheck = now;
        const isHealthy = await this.primaryStore.isHealthy();
        if (isHealthy) {
          this.primaryFailed = false;
          logger.info('Primary store recovered, resuming normal operation');
          return this.primaryStore;
        }
      }
      return this.fallbackStore;
    }

    return this.primaryStore;
  }

  /**
   * Mascara chave para logging (privacy)
   */
  private maskKey(key: string): string {
    // Se contém phone number, mascarar
    if (key.includes('whatsapp:')) {
      const phone = key.replace('whatsapp:', '');
      return `whatsapp:${maskPhoneNumber(phone)}`;
    }
    return key;
  }

  /**
   * Retorna estatísticas do serviço (para debugging)
   */
  getServiceStats(): {
    hasPrimaryStore: boolean;
    hasFallbackStore: boolean;
    usingFallback: boolean;
    autoFallback: boolean;
    registeredResources: string[];
  } {
    return {
      hasPrimaryStore: !!this.primaryStore,
      hasFallbackStore: true,
      usingFallback: this.primaryFailed,
      autoFallback: this.autoFallback,
      registeredResources: Array.from(RESOURCE_CONFIGS.keys()),
    };
  }
}

/**
 * Singleton instance
 */
let rateLimitServiceInstance: RateLimitService | null = null;

/**
 * Obtém ou cria instância singleton do RateLimitService
 */
export async function getRateLimitService(): Promise<RateLimitService> {
  if (!rateLimitServiceInstance) {
    rateLimitServiceInstance = new RateLimitService();
    await rateLimitServiceInstance.initialize();
  }
  return rateLimitServiceInstance;
}

/**
 * Reseta a instância singleton (para testes)
 */
export function resetRateLimitService(): void {
  rateLimitServiceInstance?.close().catch(() => {});
  rateLimitServiceInstance = null;
}

/**
 * Cria nova instância (para testes ou configuração customizada)
 */
export function createRateLimitService(
  options: RateLimitServiceOptions
): RateLimitService {
  return new RateLimitService(options);
}
