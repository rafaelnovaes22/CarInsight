/**
 * Rate Limiting Module
 * 
 * Exporta todos os tipos e implementações de rate limiting.
 * 
 * @example
 * ```typescript
 * import { 
 *   RateLimitService,
 *   createRedisStore,
 *   createMemoryStore 
 * } from './lib/rate-limit';
 * 
 * // Usar serviço singleton
 * const rateLimit = await getRateLimitService();
 * const status = await rateLimit.checkWhatsAppLimit('5511999999999');
 * 
 * if (!status.allowed) {
 *   return { error: `Aguarde ${status.retryAfterMs}ms` };
 * }
 * ```
 */

// Types
export type {
  RateLimitConfig,
  RateLimitStatus,
  RateLimitStore,
  RateLimitMetrics,
  RateLimitEvent,
  RateLimitServiceOptions,
  RateLimitRules,
} from './types';

export { RateLimitStrategy } from './types';

// Stores
export { RedisRateLimitStore, createRedisStore } from './redis-store';
export { MemoryRateLimitStore, createMemoryStore } from './memory-store';

// Service
export {
  RateLimitService,
  getRateLimitService,
  resetRateLimitService,
  createRateLimitService,
} from '../../services/rate-limit.service';
