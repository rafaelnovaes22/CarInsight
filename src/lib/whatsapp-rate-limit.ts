/**
 * WhatsApp Rate Limiter
 * 
 * Controla taxa de envio de mensagens para evitar:
 * - Rate limiting da Meta API
 * - Bloqueio do número
 * - Erros 429 (Too Many Requests)
 * 
 * Limites Meta WhatsApp Business API:
 * - Tier 1: 80 msgs/segundo
 * - Tier 2: 200 msgs/segundo
 * - Tier 3: 1000 msgs/segundo
 * 
 * Usamos limites conservadores (10 msgs/seg) para segurança.
 */

import { logger } from './logger';

interface RateLimitConfig {
  /** Máximo de mensagens por janela */
  maxPerWindow: number;
  /** Duração da janela em ms */
  windowMs: number;
  /** Backoff exponencial em ms */
  baseDelayMs: number;
  /** Máximo de retries */
  maxRetries: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxPerWindow: 10,      // 10 mensagens
  windowMs: 1000,        // por segundo
  baseDelayMs: 1000,     // 1s de delay inicial
  maxRetries: 3,         // máximo 3 retries
};

/**
 * Rate limiter para WhatsApp
 */
export class WhatsAppRateLimiter {
  private sentTimestamps: number[] = [];
  private config: RateLimitConfig;
  private consecutiveErrors = 0;
  private lastErrorTime = 0;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Adquire um "slot" para enviar mensagem
   * Aguarda se necessário para respeitar rate limit
   */
  async acquireSlot(): Promise<void> {
    const now = Date.now();
    
    // Limpar timestamps antigos
    this.sentTimestamps = this.sentTimestamps.filter(
      t => now - t < this.config.windowMs
    );

    // Se atingiu limite, aguardar
    if (this.sentTimestamps.length >= this.config.maxPerWindow) {
      const oldest = this.sentTimestamps[0];
      const waitTime = this.config.windowMs - (now - oldest);
      
      if (waitTime > 0) {
        logger.debug(
          { waitTime, queueSize: this.sentTimestamps.length },
          'WhatsApp rate limit: waiting for slot'
        );
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Registrar timestamp
    this.sentTimestamps.push(Date.now());
  }

  /**
   * Calcula delay para retry com backoff exponencial
   */
  getRetryDelay(attempt: number): number {
    // Backoff: 1s, 2s, 4s...
    const delay = this.config.baseDelayMs * Math.pow(2, attempt - 1);
    // Jitter: adiciona aleatoriedade de ±25%
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    return Math.min(delay + jitter, 30000); // Max 30s
  }

  /**
   * Executa função com rate limiting e retry
   */
  async executeWithLimit<T>(
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    // Adquirir slot
    await this.acquireSlot();

    // Tentar executar
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();
        
        // Resetar contador de erros em caso de sucesso
        if (this.consecutiveErrors > 0) {
          logger.info(
            { previousErrors: this.consecutiveErrors },
            'WhatsApp API recovered'
          );
          this.consecutiveErrors = 0;
        }
        
        return result;
      } catch (error: any) {
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || attempt === this.config.maxRetries) {
          throw error;
        }

        // Registrar erro
        this.consecutiveErrors++;
        this.lastErrorTime = Date.now();

        const delay = this.getRetryDelay(attempt);
        logger.warn(
          {
            attempt,
            maxRetries: this.config.maxRetries,
            delay,
            error: error.message,
            ...context,
          },
          'WhatsApp API error, retrying...'
        );

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Verifica se erro é retryable
   */
  private isRetryableError(error: any): boolean {
    const status = error.response?.status;
    const code = error.code;

    // Retryable: 5xx, timeout, rate limit
    if (status >= 500 || status === 429) return true;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;
    if (code === 'ECONNRESET' || code === 'ENOTFOUND') return true;

    // Não retryable: 4xx (exceto 429)
    if (status >= 400 && status < 500) return false;

    return true;
  }

  /**
   * Retorna estatísticas do rate limiter
   */
  getStats(): {
    queueSize: number;
    consecutiveErrors: number;
    lastErrorTime: number | null;
    isHealthy: boolean;
  } {
    const now = Date.now();
    const recentErrors = this.consecutiveErrors;
    const timeSinceLastError = this.lastErrorTime ? now - this.lastErrorTime : null;
    
    // Considera saudável se não há erros recentes (< 5 min)
    const isHealthy = recentErrors === 0 || (timeSinceLastError !== null && timeSinceLastError > 300000);

    return {
      queueSize: this.sentTimestamps.length,
      consecutiveErrors: recentErrors,
      lastErrorTime: this.lastErrorTime || null,
      isHealthy,
    };
  }

  /**
   * Reseta estado (útil para testes)
   */
  reset(): void {
    this.sentTimestamps = [];
    this.consecutiveErrors = 0;
    this.lastErrorTime = 0;
  }
}

// Singleton para uso global
export const whatsAppRateLimiter = new WhatsAppRateLimiter();

/**
 * Decorator para métodos que chamam WhatsApp API
 */
export function withRateLimit(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    return whatsAppRateLimiter.executeWithLimit(
      () => originalMethod.apply(this, args),
      { method: propertyKey }
    );
  };

  return descriptor;
}
