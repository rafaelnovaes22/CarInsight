/**
 * In-Memory Rate Limit Store
 *
 * Implementação de fallback usando Map em memória.
 * Usa quando Redis não está disponível ou para desenvolvimento/testes.
 */

import { logger } from '../logger';
import type { RateLimitConfig, RateLimitStatus, RateLimitStore } from './types';

interface MemoryEntry {
  count: number;
  resetAt: number;
  timestamps: number[]; // Para sliding window
  windowStart: number;
}

export interface MemoryStoreOptions {
  /** Intervalo de cleanup em ms (default: 60000) */
  cleanupIntervalMs?: number;
  /** Habilitar sliding window (mais preciso mas usa mais memória) */
  useSlidingWindow?: boolean;
  /** Nome para identificação em logs */
  name?: string;
}

/**
 * Store em memória para rate limiting
 *
 * NOTA: Não compartilha estado entre instâncias!
 * Use apenas como fallback ou em ambiente single-instance.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private storage = new Map<string, MemoryEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private useSlidingWindow: boolean;
  private name: string;
  private lastCleanup = Date.now();

  constructor(options: MemoryStoreOptions = {}) {
    this.useSlidingWindow = options.useSlidingWindow ?? true;
    this.name = options.name ?? 'memory';

    // Iniciar cleanup periódico
    const cleanupMs = options.cleanupIntervalMs ?? 60000;
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupMs);

    logger.info(
      { useSlidingWindow: this.useSlidingWindow, name: this.name },
      'Memory rate limit store initialized'
    );
  }

  /**
   * Verifica o rate limit
   */
  async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitStatus> {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Obter ou criar entrada
    let entry = this.storage.get(key);

    if (!entry || now > entry.resetAt) {
      // Nova janela
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
        timestamps: [],
        windowStart: now,
      };
    }

    // Cleanup de timestamps antigos (sliding window)
    if (this.useSlidingWindow && entry.timestamps.length > 0) {
      entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);
      entry.count = entry.timestamps.length;
    }

    // Verificar limite
    const allowed = entry.count < config.maxRequests;

    if (allowed) {
      // Incrementar
      entry.count++;
      entry.timestamps.push(now);

      // Atualizar storage
      this.storage.set(key, entry);
    }

    const remaining = Math.max(0, config.maxRequests - entry.count);
    const retryAfterMs = allowed ? undefined : entry.resetAt - now;

    return {
      allowed,
      limit: config.maxRequests,
      remaining,
      currentWindowCount: entry.count,
      resetAt: new Date(entry.resetAt),
      retryAfterMs,
    };
  }

  /**
   * Incrementa contador sem verificar limite
   */
  async increment(key: string, config: RateLimitConfig): Promise<void> {
    const now = Date.now();

    let entry = this.storage.get(key);

    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
        timestamps: [],
        windowStart: now,
      };
    }

    entry.count++;
    entry.timestamps.push(now);

    this.storage.set(key, entry);
  }

  /**
   * Reseta contador para uma chave
   */
  async reset(key: string): Promise<void> {
    this.storage.delete(key);
    logger.debug({ key, store: this.name }, 'Rate limit counter reset');
  }

  /**
   * Obtém estatísticas
   */
  async getStats(
    key: string,
    config: RateLimitConfig
  ): Promise<{
    current: number;
    windowStart: number;
    resetAt: number;
  }> {
    const now = Date.now();
    const entry = this.storage.get(key);

    if (!entry || now > entry.resetAt) {
      return {
        current: 0,
        windowStart: now - config.windowMs,
        resetAt: now + config.windowMs,
      };
    }

    // Cleanup timestamps antigos
    const windowStart = now - config.windowMs;
    const validTimestamps = entry.timestamps.filter(ts => ts > windowStart);

    return {
      current: validTimestamps.length,
      windowStart,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Sempre retorna true (está disponível se instanciado)
   */
  async isHealthy(): Promise<boolean> {
    return true;
  }

  /**
   * Fecha o store e limpa recursos
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.storage.clear();
    logger.info({ name: this.name }, 'Memory rate limit store closed');
  }

  /**
   * Retorna estatísticas do store
   */
  getStoreStats(): {
    totalKeys: number;
    memoryEstimate: string;
    lastCleanup: Date;
  } {
    // Estimativa simples de memória
    const bytesPerEntry = 200; // Aproximação
    const totalBytes = this.storage.size * bytesPerEntry;
    const memoryEstimate =
      totalBytes > 1024 * 1024
        ? `${(totalBytes / 1024 / 1024).toFixed(2)} MB`
        : `${(totalBytes / 1024).toFixed(2)} KB`;

    return {
      totalKeys: this.storage.size,
      memoryEstimate,
      lastCleanup: new Date(this.lastCleanup),
    };
  }

  /**
   * Limpa entradas expiradas (chamado periodicamente)
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.storage.entries()) {
      if (now > entry.resetAt) {
        this.storage.delete(key);
        cleaned++;
      } else if (this.useSlidingWindow) {
        // Limpar timestamps antigos
        const windowStart = now - (entry.resetAt - entry.windowStart);
        const originalLength = entry.timestamps.length;
        entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);
        entry.count = entry.timestamps.length;

        if (entry.timestamps.length !== originalLength) {
          this.storage.set(key, entry);
        }
      }
    }

    this.lastCleanup = now;

    if (cleaned > 0) {
      logger.debug(
        { cleaned, remaining: this.storage.size, store: this.name },
        'Rate limit store cleanup completed'
      );
    }
  }

  /**
   * Retorna todas as chaves (para debugging)
   */
  getKeys(): string[] {
    return Array.from(this.storage.keys());
  }

  /**
   * Retorna dados de uma chave específica (para debugging)
   */
  getEntry(key: string): MemoryEntry | undefined {
    return this.storage.get(key);
  }
}

/**
 * Cria um memory store com configuração padrão
 */
export function createMemoryStore(options?: MemoryStoreOptions): MemoryRateLimitStore {
  return new MemoryRateLimitStore(options);
}
