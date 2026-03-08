/**
 * Rate Limit Service Tests
 *
 * Testes unitários para o sistema de rate limiting.
 * Cobre MemoryStore, RateLimitService e integração básica.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRateLimitStore } from '../../src/lib/rate-limit/memory-store';
import {
  RateLimitService,
  createRateLimitService,
  resetRateLimitService,
} from '../../src/services/rate-limit.service';
import type { RateLimitConfig } from '../../src/lib/rate-limit/types';

describe('Rate Limiting', () => {
  beforeEach(() => {
    resetRateLimitService();
  });

  describe('MemoryRateLimitStore', () => {
    let store: MemoryRateLimitStore;
    const config: RateLimitConfig = {
      maxRequests: 5,
      windowMs: 1000, // 1 segundo para testes rápidos
    };

    beforeEach(() => {
      store = new MemoryRateLimitStore({ cleanupIntervalMs: 100 });
    });

    afterEach(async () => {
      await store.close();
    });

    it('should allow requests within limit', async () => {
      const key = 'user:123';

      for (let i = 0; i < config.maxRequests; i++) {
        const status = await store.checkLimit(key, config);
        expect(status.allowed).toBe(true);
        expect(status.remaining).toBe(config.maxRequests - i - 1);
      }
    });

    it('should block requests exceeding limit', async () => {
      const key = 'user:456';

      // Exaurir o limite
      for (let i = 0; i < config.maxRequests; i++) {
        await store.checkLimit(key, config);
      }

      // Próxima requisição deve ser bloqueada
      const status = await store.checkLimit(key, config);
      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
      expect(status.retryAfterMs).toBeDefined();
      expect(status.retryAfterMs).toBeGreaterThan(0);
    });

    it('should reset counter after window expires', async () => {
      const key = 'user:789';
      const shortConfig: RateLimitConfig = {
        maxRequests: 2,
        windowMs: 50, // 50ms para teste rápido
      };

      // Exaurir limite
      await store.checkLimit(key, shortConfig);
      await store.checkLimit(key, shortConfig);

      let status = await store.checkLimit(key, shortConfig);
      expect(status.allowed).toBe(false);

      // Aguardar janela expirar
      await new Promise(resolve => setTimeout(resolve, 60));

      // Deve permitir novamente
      status = await store.checkLimit(key, shortConfig);
      expect(status.allowed).toBe(true);
    });

    it('should track multiple keys independently', async () => {
      const key1 = 'user:111';
      const key2 = 'user:222';

      // Exaurir limite do primeiro usuário
      for (let i = 0; i < config.maxRequests; i++) {
        await store.checkLimit(key1, config);
      }

      const status1 = await store.checkLimit(key1, config);
      expect(status1.allowed).toBe(false);

      // Segundo usuário deve ter limite intacto
      const status2 = await store.checkLimit(key2, config);
      expect(status2.allowed).toBe(true);
      expect(status2.remaining).toBe(config.maxRequests - 1);
    });

    it('should reset specific key', async () => {
      const key = 'user:333';

      // Exaurir limite
      for (let i = 0; i < config.maxRequests; i++) {
        await store.checkLimit(key, config);
      }

      let status = await store.checkLimit(key, config);
      expect(status.allowed).toBe(false);

      // Resetar
      await store.reset(key);

      // Deve permitir novamente
      status = await store.checkLimit(key, config);
      expect(status.allowed).toBe(true);
    });

    it('should return correct stats', async () => {
      const key = 'user:444';

      await store.checkLimit(key, config);
      await store.checkLimit(key, config);

      const stats = await store.getStats(key, config);
      expect(stats.current).toBe(2);
      expect(stats.resetAt).toBeGreaterThan(Date.now());
      expect(stats.windowStart).toBeLessThan(Date.now());
    });

    it('should always be healthy', async () => {
      const isHealthy = await store.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should cleanup expired entries', async () => {
      const key = 'user:555';
      const shortConfig: RateLimitConfig = {
        maxRequests: 5,
        windowMs: 50,
      };

      await store.checkLimit(key, shortConfig);

      // Aguardar expiração + cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      // Stats deve mostrar 0 após cleanup
      const stats = await store.getStats(key, shortConfig);
      expect(stats.current).toBe(0);
    });
  });

  describe('RateLimitService', () => {
    let service: RateLimitService;
    const memoryStore = new MemoryRateLimitStore({ name: 'test' });

    beforeEach(() => {
      service = createRateLimitService({
        primaryStore: memoryStore,
        autoFallback: true,
        enableLogging: false,
      });
    });

    afterEach(async () => {
      await memoryStore.close();
    });

    it('should check WhatsApp limit', async () => {
      const phoneNumber = '5511999999999';

      const status = await service.checkWhatsAppLimit(phoneNumber);

      expect(status.allowed).toBe(true);
      expect(status.limit).toBe(10); // default
      expect(status.currentWindowCount).toBe(1);
    });

    it('should block after exceeding WhatsApp limit', async () => {
      const phoneNumber = '5511888888888';

      // Registrando config com limite baixo para teste
      service.registerResourceConfig('whatsapp:message', {
        maxRequests: 3,
        windowMs: 60000,
      });

      // 3 requisições permitidas
      await service.checkWhatsAppLimit(phoneNumber);
      await service.checkWhatsAppLimit(phoneNumber);
      await service.checkWhatsAppLimit(phoneNumber);

      // 4ª deve ser bloqueada
      const status = await service.checkWhatsAppLimit(phoneNumber);
      expect(status.allowed).toBe(false);
    });

    it('should check API limits by endpoint', async () => {
      const identifier = 'admin:123';

      service.registerResourceConfig('api:admin', {
        maxRequests: 5,
        windowMs: 60000,
      });

      const status = await service.checkApiLimit(identifier, 'admin');
      expect(status.allowed).toBe(true);
    });

    it('should reset limit for key', async () => {
      const phoneNumber = '5511777777777';

      service.registerResourceConfig('whatsapp:message', {
        maxRequests: 2,
        windowMs: 60000,
      });

      await service.checkWhatsAppLimit(phoneNumber);
      await service.checkWhatsAppLimit(phoneNumber);

      let status = await service.checkWhatsAppLimit(phoneNumber);
      expect(status.allowed).toBe(false);

      await service.reset(`whatsapp:${phoneNumber}`);

      status = await service.checkWhatsAppLimit(phoneNumber);
      expect(status.allowed).toBe(true);
    });

    it('should return health status', async () => {
      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.primary).toBe(true);
      expect(health.fallback).toBe(true);
    });

    it('should return service stats', () => {
      const stats = service.getServiceStats();

      expect(stats.hasPrimaryStore).toBe(true);
      expect(stats.hasFallbackStore).toBe(true);
      expect(stats.autoFallback).toBe(true);
    });

    it('should handle event callback', async () => {
      const events: any[] = [];
      const serviceWithCallback = createRateLimitService({
        primaryStore: new MemoryRateLimitStore(),
        enableLogging: false,
        onEvent: event => events.push(event),
      });

      await serviceWithCallback.checkLimit('test:key');

      expect(events.length).toBe(1);
      expect(events[0].event).toBe('rate_limit_checked');
      expect(events[0].allowed).toBe(true);

      await serviceWithCallback.close();
    });

    it('should mask phone numbers in events', async () => {
      const events: any[] = [];
      const serviceWithCallback = createRateLimitService({
        primaryStore: new MemoryRateLimitStore(),
        enableLogging: false,
        onEvent: event => events.push(event),
      });

      await serviceWithCallback.checkWhatsAppLimit('5511999999999');

      expect(events[0].key).toContain('****'); // Deve estar mascarado

      await serviceWithCallback.close();
    });

    it('should fail open on store error when autoFallback disabled', async () => {
      const failingStore = {
        checkLimit: vi.fn().mockRejectedValue(new Error('Store error')),
        increment: vi.fn(),
        reset: vi.fn(),
        getStats: vi.fn(),
        isHealthy: vi.fn().mockResolvedValue(false),
      };

      const serviceNoFallback = createRateLimitService({
        primaryStore: failingStore as any,
        fallbackStore: failingStore as any,
        autoFallback: false,
        enableLogging: false,
      });

      const status = await serviceNoFallback.checkLimit('test:key');

      // Deve permitir (fail open) para não bloquear usuários
      expect(status.allowed).toBe(true);
    });
  });

  describe('Integration: Guardrails + RateLimit', () => {
    it('should use distributed rate limiting when available', async () => {
      const { GuardrailsService } = await import('../../src/services/guardrails.service');

      const memoryStore = new MemoryRateLimitStore();
      const rateLimitService = createRateLimitService({
        primaryStore: memoryStore,
        enableLogging: false,
      });

      const guardrails = new GuardrailsService({
        rateLimitService,
      });

      await guardrails.initialize();

      const result = await guardrails.validateInput('5511999999999', 'Hello');
      expect(result.allowed).toBe(true);

      const stats = guardrails.getStats();
      expect(stats.useDistributed).toBe(true);

      await memoryStore.close();
    });

    it('should fallback to legacy when service fails', async () => {
      const { GuardrailsService } = await import('../../src/services/guardrails.service');
      const rateLimitModule = await import('../../src/services/rate-limit.service');
      const getRateLimitSpy = vi
        .spyOn(rateLimitModule, 'getRateLimitService')
        .mockRejectedValueOnce(new Error('service unavailable'));

      const guardrails = new GuardrailsService({
        disableRateLimit: false,
      });

      // Forçar uso de legacy não inicializando
      await guardrails.initialize();

      const result = await guardrails.validateInput('5511999999999', 'Hello');
      expect(result.allowed).toBe(true);
      getRateLimitSpy.mockRestore();
    });
  });
});
