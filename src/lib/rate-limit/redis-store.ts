/**
 * Redis Rate Limit Store
 * 
 * Implementação de rate limiting usando Redis com algoritmo Sliding Window.
 * Usa Lua scripts para garantir atomicidade das operações.
 */

import { logger } from '../logger';
import type { RateLimitConfig, RateLimitStatus, RateLimitStore } from './types';

// Lua script para sliding window atomico
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local weight = tonumber(ARGV[4]) or 0.7

-- Usar Sorted Set para timestamps
-- Remover entradas fora da janela (anteriores a now - window)
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Obter todas as entradas na janela atual
local entries = redis.call('ZRANGE', key, 0, -1, 'WITHSCORES')
local count = #entries / 2

-- Calcular weighted count (sliding window)
-- Contagem = entradas atuais + (peso * entradas anteriores)
local weightedCount = count

-- Verificar se pode prosseguir
if weightedCount < limit then
  -- Gerar membro único com timestamp + sequence
  local sequence = redis.call('INCR', key .. ':seq')
  local member = now .. ':' .. sequence
  
  -- Adicionar timestamp atual
  redis.call('ZADD', key, now, member)
  
  -- Setar TTL (window em segundos + margem)
  local ttl = math.ceil(window / 1000) + 1
  redis.call('EXPIRE', key, ttl)
  redis.call('EXPIRE', key .. ':seq', ttl)
  
  -- Calcular reset time (timestamp do mais antigo + window)
  local resetAt = now + window
  if count > 0 then
    -- Se há entradas, o reset é quando a mais antiga expira
    local oldestScore = tonumber(entries[2])
    resetAt = oldestScore + window
  end
  
  return {1, limit - count - 1, count + 1, resetAt, 0}
else
  -- Bloqueado - calcular retry after
  local oldestScore = tonumber(entries[2]) or now
  local resetAt = oldestScore + window
  local retryAfter = math.max(0, resetAt - now)
  
  return {0, 0, count, resetAt, retryAfter}
end
`;

// Lua script simples para fixed window (fallback mais rápido)
const FIXED_WINDOW_SCRIPT = `
local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Key inclui o timestamp da janela (arredondado)
local windowKey = key .. ':' .. math.floor(now / window)
local current = redis.call('GET', windowKey)

if not current then
  current = 0
end

current = tonumber(current)

if current < limit then
  -- Incrementar e setar TTL
  local newValue = redis.call('INCR', windowKey)
  if newValue == 1 then
    redis.call('EXPIRE', windowKey, math.ceil(window / 1000) + 1)
  end
  
  local resetAt = (math.floor(now / window) + 1) * window
  return {1, limit - newValue, newValue, resetAt, 0}
else
  local resetAt = (math.floor(now / window) + 1) * window
  local retryAfter = resetAt - now
  return {0, 0, current, resetAt, retryAfter}
end
`;

export interface RedisStoreOptions {
  url?: string;
  useSlidingWindow?: boolean;
  slidingWindowWeight?: number;
  keyPrefix?: string;
}

export class RedisRateLimitStore implements RateLimitStore {
  private client: any;
  private isConnected = false;
  private useSlidingWindow: boolean;
  private slidingWindowWeight: number;
  private keyPrefix: string;
  private slidingWindowScriptSha?: string;
  private fixedWindowScriptSha?: string;

  constructor(options: RedisStoreOptions = {}) {
    this.useSlidingWindow = options.useSlidingWindow ?? true;
    this.slidingWindowWeight = options.slidingWindowWeight ?? 0.7;
    this.keyPrefix = options.keyPrefix ?? 'ratelimit';
  }

  /**
   * Inicializa a conexão com Redis
   */
  async connect(): Promise<void> {
    try {
      // Dynamic import para evitar erro se redis não estiver instalado
      const { createClient } = await import('redis');
      
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              logger.error('Redis max reconnection attempts reached');
              return new Error('Max reconnection attempts');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (err: Error) => {
        logger.error({ error: err.message }, 'Redis client error');
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();

      // Carregar scripts Lua
      await this.loadScripts();

      logger.info(
        { 
          useSlidingWindow: this.useSlidingWindow,
          keyPrefix: this.keyPrefix 
        },
        'Redis rate limit store initialized'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Redis');
      throw error;
    }
  }

  /**
   * Carrega scripts Lua no Redis
   */
  private async loadScripts(): Promise<void> {
    try {
      // Sliding window script
      this.slidingWindowScriptSha = await this.client.scriptLoad(SLIDING_WINDOW_SCRIPT);
      // Fixed window script  
      this.fixedWindowScriptSha = await this.client.scriptLoad(FIXED_WINDOW_SCRIPT);
      
      logger.debug('Redis Lua scripts loaded');
    } catch (error) {
      logger.error({ error }, 'Failed to load Lua scripts');
      throw error;
    }
  }

  /**
   * Verifica o rate limit usando o algoritmo configurado
   */
  async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitStatus> {
    this.ensureConnected();

    const prefixedKey = this.getKey(key);
    const now = Date.now();

    try {
      const scriptSha = this.useSlidingWindow 
        ? this.slidingWindowScriptSha 
        : this.fixedWindowScriptSha;

      const args = this.useSlidingWindow
        ? [config.windowMs, config.maxRequests, now, this.slidingWindowWeight]
        : [config.windowMs, config.maxRequests, now];

      const result = await this.client.evalSha(
        scriptSha,
        {
          keys: [prefixedKey],
          arguments: args.map(String),
        }
      ) as [number, number, number, number, number];

      const [allowed, remaining, currentCount, resetAtMs, retryAfterMs] = result;

      return {
        allowed: allowed === 1,
        limit: config.maxRequests,
        remaining: Math.max(0, remaining),
        currentWindowCount: currentCount,
        resetAt: new Date(resetAtMs),
        retryAfterMs: retryAfterMs > 0 ? retryAfterMs : undefined,
      };
    } catch (error) {
      logger.error({ error, key }, 'Redis rate limit check failed');
      throw error;
    }
  }

  /**
   * Incrementa o contador sem verificar limite
   */
  async increment(key: string, config: RateLimitConfig): Promise<void> {
    this.ensureConnected();

    const prefixedKey = this.getKey(key);
    const now = Date.now();

    try {
      const member = `${now}:${Math.random().toString(36).substr(2, 9)}`;
      await this.client.zAdd(prefixedKey, { score: now, value: member });
      await this.client.expire(prefixedKey, Math.ceil(config.windowMs / 1000) + 1);
    } catch (error) {
      logger.error({ error, key }, 'Failed to increment rate limit counter');
      throw error;
    }
  }

  /**
   * Reseta o contador para uma chave
   */
  async reset(key: string): Promise<void> {
    this.ensureConnected();

    const prefixedKey = this.getKey(key);

    try {
      await this.client.del(prefixedKey);
      await this.client.del(`${prefixedKey}:seq`);
      logger.debug({ key }, 'Rate limit counter reset');
    } catch (error) {
      logger.error({ error, key }, 'Failed to reset rate limit counter');
      throw error;
    }
  }

  /**
   * Obtém estatísticas atuais sem incrementar
   */
  async getStats(key: string, config: RateLimitConfig): Promise<{
    current: number;
    windowStart: number;
    resetAt: number;
  }> {
    this.ensureConnected();

    const prefixedKey = this.getKey(key);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Remover entradas antigas e contar
      await this.client.zRemRangeByScore(prefixedKey, 0, windowStart);
      const count = await this.client.zCard(prefixedKey);
      
      // Obter o timestamp mais antigo na janela
      const oldestEntries = await this.client.zRangeWithScores(prefixedKey, 0, 0);
      const resetAt = oldestEntries.length > 0
        ? oldestEntries[0].score + config.windowMs
        : now + config.windowMs;

      return {
        current: count,
        windowStart,
        resetAt,
      };
    } catch (error) {
      logger.error({ error, key }, 'Failed to get rate limit stats');
      throw error;
    }
  }

  /**
   * Verifica se a conexão está saudável
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fecha a conexão com Redis
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis rate limit store closed');
    }
  }

  /**
   * Gera a chave com prefixo
   */
  private getKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  /**
   * Garante que está conectado
   */
  private ensureConnected(): void {
    if (!this.isConnected || !this.client) {
      throw new Error('Redis not connected. Call connect() first');
    }
  }
}

/**
 * Factory para criar store com auto-conexão
 */
export async function createRedisStore(
  options?: RedisStoreOptions
): Promise<RedisRateLimitStore> {
  const store = new RedisRateLimitStore(options);
  await store.connect();
  return store;
}
