import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger first
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks (these tests don't mock the SDK, they test the router logic)
import {
  chatCompletion,
  getLLMProvidersStatus,
  resetCircuitBreaker,
} from '../../src/lib/llm-router';

describe('LLM Router', () => {
  beforeEach(() => {
    resetCircuitBreaker();
    vi.clearAllMocks();
  });

  describe('chatCompletion', () => {
    it('deve retornar resposta vÃ¡lida (mock ou real)', async () => {
      const messages = [
        { role: 'system' as const, content: 'VocÃª Ã© um assistente Ãºtil' },
        { role: 'user' as const, content: 'OlÃ¡' },
      ];

      const response = await chatCompletion(messages);

      expect(response).toBeTruthy();
      expect(response).toHaveProperty('content');
      expect(typeof response.content).toBe('string');
      expect(response).toHaveProperty('model');
    }, 30000);

    it('deve retornar string para qualquer input vÃ¡lido', async () => {
      const messages = [
        { role: 'system' as const, content: 'Seja breve' },
        { role: 'user' as const, content: 'OlÃ¡' },
      ];

      const response = await chatCompletion(messages, {
        maxTokens: 10,
      });

      expect(response).toBeTruthy();
      expect(response).toHaveProperty('content');
      expect(typeof response.content).toBe('string');
      expect(response).toHaveProperty('model');
    }, 30000);
  });

  describe('getLLMProvidersStatus', () => {
    it('deve retornar status dos providers', () => {
      const status = getLLMProvidersStatus();

      expect(Array.isArray(status)).toBe(true);
      expect(status.length).toBeGreaterThan(0);

      status.forEach(provider => {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('model');
        expect(provider).toHaveProperty('enabled');
        expect(provider).toHaveProperty('priority');
        expect(provider).toHaveProperty('costPer1MTokens');
        expect(provider).toHaveProperty('circuitBreakerOpen');
      });
    });

    it('deve incluir OpenAI como primÃ¡rio', () => {
      const status = getLLMProvidersStatus();
      const openai = status.find(p => p.name === 'openai');

      expect(openai).toBeDefined();
      expect(openai?.priority).toBe(1);
      expect(openai?.model).toBe('gpt-4.1-mini');
    });

    it('deve incluir Groq como fallback', () => {
      const status = getLLMProvidersStatus();
      const groq = status.find(p => p.name === 'groq');

      expect(groq).toBeDefined();
      expect(groq?.priority).toBe(2);
      expect(groq?.model).toBe('llama-3.1-8b-instant');
    });
  });

  describe('Circuit Breaker', () => {
    it('deve resetar circuit breaker corretamente', () => {
      resetCircuitBreaker();
      const status = getLLMProvidersStatus();

      status.forEach(provider => {
        expect(provider.circuitBreakerOpen).toBe(false);
      });
    });
  });

  describe('Fallback Behavior', () => {
    it('deve retornar resposta mesmo sem API keys vÃ¡lidas', async () => {
      const messages = [
        { role: 'system' as const, content: 'Teste' },
        { role: 'user' as const, content: 'OlÃ¡' },
      ];

      // NÃ£o deve lanÃ§ar erro - usa mock se APIs falharem
      const response = await chatCompletion(messages);

      expect(response).toBeTruthy();
      expect(response).toHaveProperty('content');
      expect(typeof response.content).toBe('string');
      expect(response).toHaveProperty('model');
    }, 30000);
  });
});

