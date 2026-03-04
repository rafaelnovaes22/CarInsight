/**
 * Rate Limit Integration Tests
 * 
 * Testes de integração para rate limiting com Redis (se disponível)
 * ou usando testcontainers.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { RateLimitService, createRateLimitService } from '../../src/services/rate-limit.service';
import { MemoryRateLimitStore } from '../../src/lib/rate-limit/memory-store';

describe('Rate Limit Integration', () => {
  let service: RateLimitService;

  beforeEach(() => {
    // Usar memory store para testes de integração consistentes
    service = createRateLimitService({
      enableLogging: false,
    });
  });

  afterAll(async () => {
    await service?.close();
  });

  describe('WhatsApp Rate Limiting', () => {
    it('should enforce 10 messages per minute limit', async () => {
      const phoneNumber = '5511999999001';

      // 10 requisições devem ser permitidas
      for (let i = 0; i < 10; i++) {
        const status = await service.checkWhatsAppLimit(phoneNumber);
        expect(status.allowed).toBe(true);
        expect(status.remaining).toBe(9 - i);
      }

      // 11ª deve ser bloqueada
      const blocked = await service.checkWhatsAppLimit(phoneNumber);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterMs).toBeDefined();
    });

    it('should track different phone numbers independently', async () => {
      const phone1 = '5511999999002';
      const phone2 = '5511999999003';

      // Exaurir limite do primeiro
      for (let i = 0; i < 10; i++) {
        await service.checkWhatsAppLimit(phone1);
      }

      const phone1Blocked = await service.checkWhatsAppLimit(phone1);
      expect(phone1Blocked.allowed).toBe(false);

      // Segundo deve ainda ter limite
      const phone2Status = await service.checkWhatsAppLimit(phone2);
      expect(phone2Status.allowed).toBe(true);
      expect(phone2Status.remaining).toBe(9);
    });

    it('should provide accurate retry after time', async () => {
      const phoneNumber = '5511999999004';

      // Exaurir limite
      for (let i = 0; i < 10; i++) {
        await service.checkWhatsAppLimit(phoneNumber);
      }

      const blocked = await service.checkWhatsAppLimit(phoneNumber);
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
      expect(blocked.retryAfterMs).toBeLessThanOrEqual(60000);

      // Mensagem deve conter tempo de espera
      const retrySeconds = Math.ceil((blocked.retryAfterMs || 0) / 1000);
      expect(retrySeconds).toBeGreaterThan(0);
    });
  });

  describe('API Rate Limiting', () => {
    it('should have different limits for different endpoints', async () => {
      const adminId = 'admin:001';
      const webhookId = 'webhook:001';

      // Configurar limites diferentes
      service.registerResourceConfig('api:admin', {
        maxRequests: 100,
        windowMs: 60000,
      });

      service.registerResourceConfig('api:webhook', {
        maxRequests: 1000,
        windowMs: 60000,
      });

      const adminStatus = await service.checkApiLimit(adminId, 'admin');
      const webhookStatus = await service.checkApiLimit(webhookId, 'webhook');

      expect(adminStatus.limit).toBe(100);
      expect(webhookStatus.limit).toBe(1000);
    });
  });

  describe('Rate Limit Stats', () => {
    it('should provide accurate statistics', async () => {
      const phoneNumber = '5511999999005';

      await service.checkWhatsAppLimit(phoneNumber);
      await service.checkWhatsAppLimit(phoneNumber);
      await service.checkWhatsAppLimit(phoneNumber);

      const stats = await service.getStats(`whatsapp:${phoneNumber}`, 'whatsapp:message');

      expect(stats.current).toBe(3);
      expect(stats.limit).toBe(10);
      expect(stats.resetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Health Check', () => {
    it('should report healthy when store is available', async () => {
      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.fallback).toBe(true);
    });

    it('should indicate when using fallback', async () => {
      const health = await service.healthCheck();

      // Com memory store, sempre usa "fallback"
      expect(health.usingFallback).toBeDefined();
    });
  });

  describe('Reset Functionality', () => {
    it('should immediately reset rate limit counter', async () => {
      const phoneNumber = '5511999999006';

      // Exaurir limite
      for (let i = 0; i < 10; i++) {
        await service.checkWhatsAppLimit(phoneNumber);
      }

      let blocked = await service.checkWhatsAppLimit(phoneNumber);
      expect(blocked.allowed).toBe(false);

      // Resetar
      await service.reset(`whatsapp:${phoneNumber}`);

      // Deve permitir imediatamente
      const reset = await service.checkWhatsAppLimit(phoneNumber);
      expect(reset.allowed).toBe(true);
    });
  });

  describe('Event Tracking', () => {
    it('should emit events for rate limit checks', async () => {
      const events: any[] = [];
      const trackingService = createRateLimitService({
        enableLogging: false,
        onEvent: (event) => events.push(event),
      });

      await trackingService.checkWhatsAppLimit('5511999999007');

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('event');
      expect(events[0]).toHaveProperty('key');
      expect(events[0]).toHaveProperty('allowed');

      await trackingService.close();
    });

    it('should emit blocked event when limit exceeded', async () => {
      const events: any[] = [];
      const trackingService = createRateLimitService({
        enableLogging: false,
        onEvent: (event) => events.push(event),
      });

      const phoneNumber = '5511999999008';

      // Exaurir limite
      for (let i = 0; i < 10; i++) {
        await trackingService.checkWhatsAppLimit(phoneNumber);
      }

      // Limpar eventos anteriores
      events.length = 0;

      // Esta deve ser bloqueada
      await trackingService.checkWhatsAppLimit(phoneNumber);

      const blockedEvent = events.find(e => e.event === 'rate_limit_exceeded');
      expect(blockedEvent).toBeDefined();
      expect(blockedEvent.allowed).toBe(false);

      await trackingService.close();
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent rate limit checks', async () => {
      const phoneNumber = '5511999999009';

      // 20 requisições concorrentes
      const promises = Array(20)
        .fill(null)
        .map(() => service.checkWhatsAppLimit(phoneNumber));

      const results = await Promise.all(promises);

      const allowed = results.filter(r => r.allowed).length;
      const blocked = results.filter(r => !r.allowed).length;

      // Exatamente 10 devem ser permitidas
      expect(allowed).toBe(10);
      expect(blocked).toBe(10);
    });
  });
});

/**
 * Nota: Testes com Redis real são opcionais e requerem:
 * - Redis rodando localmente ou
 * - Testcontainer Redis
 * 
 * Para executar testes com Redis:
 * REDIS_URL=redis://localhost:6379 npm test tests/integration/rate-limit-integration.test.ts
 */
describe.skipIf(!process.env.REDIS_URL)('Rate Limit with Redis', () => {
  it('should connect to Redis when available', async () => {
    const { createRedisStore } = await import('../../src/lib/rate-limit/redis-store');
    
    const store = await createRedisStore({
      url: process.env.REDIS_URL,
    });

    const isHealthy = await store.isHealthy();
    expect(isHealthy).toBe(true);

    await store.close();
  });
});
