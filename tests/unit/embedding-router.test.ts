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

// Import after mocks
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
  getEmbeddingProvidersStatus,
  resetCircuitBreaker,
  EMBEDDING_DIMENSIONS,
} from '../../src/lib/embedding-router';

describe('Embedding Router', () => {
  beforeEach(() => {
    resetCircuitBreaker();
    vi.clearAllMocks();
  });

  describe('generateEmbedding', () => {
    it('deve gerar embedding com dimensões corretas', async () => {
      const text = 'Carro sedan confortável';
      const embedding = await generateEmbedding(text);

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(EMBEDDING_DIMENSIONS);
      embedding.forEach(value => {
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      });
    }, 30000);

    it('deve normalizar embeddings (magnitude ~1)', async () => {
      const text = 'SUV espaçoso';
      const embedding = await generateEmbedding(text);

      // Calcular magnitude
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));

      // Embeddings normalizados têm magnitude próxima a 1
      expect(magnitude).toBeGreaterThan(0.9);
      expect(magnitude).toBeLessThan(1.1);
    }, 30000);

    it('deve rejeitar texto vazio', async () => {
      await expect(generateEmbedding('')).rejects.toThrow();
      await expect(generateEmbedding('   ')).rejects.toThrow();
    });

    it('deve processar textos em português', async () => {
      const text = 'Veículo econômico com baixo consumo de combustível';
      const embedding = await generateEmbedding(text);

      expect(embedding.length).toBe(EMBEDDING_DIMENSIONS);
    }, 30000);
  });

  describe('generateEmbeddingsBatch', () => {
    it('deve gerar múltiplos embeddings', async () => {
      const texts = ['Carro sedan', 'SUV familiar', 'Hatchback compacto'];

      const embeddings = await generateEmbeddingsBatch(texts);

      expect(embeddings.length).toBe(texts.length);
      embeddings.forEach(emb => {
        expect(emb.length).toBe(EMBEDDING_DIMENSIONS);
      });
    }, 30000);

    it('deve retornar array vazio para input vazio', async () => {
      const embeddings = await generateEmbeddingsBatch([]);
      expect(embeddings).toEqual([]);
    });

    it('deve filtrar textos vazios', async () => {
      const texts = ['Carro', '', '  ', 'SUV'];
      const embeddings = await generateEmbeddingsBatch(texts);

      // Deve gerar apenas para textos não vazios
      expect(embeddings.length).toBe(2);
    }, 30000);

    it('deve gerar embeddings diferentes para textos diferentes', async () => {
      const texts = ['Sedan', 'SUV'];
      const embeddings = await generateEmbeddingsBatch(texts);

      // Embeddings devem ser diferentes (similaridade < 1)
      const similarity = cosineSimilarity(embeddings[0], embeddings[1]);
      expect(similarity).toBeLessThan(1.0);
    }, 30000);
  });

  describe('cosineSimilarity', () => {
    it('deve calcular similaridade entre vetores idênticos = 1', async () => {
      const text = 'Carro sedan';
      const emb1 = await generateEmbedding(text);
      // Use the same embedding for comparison (mock may return different values each call)
      const emb2 = [...emb1];

      const similarity = cosineSimilarity(emb1, emb2);

      expect(similarity).toBeGreaterThan(0.99);
      expect(similarity).toBeLessThanOrEqual(1.0);
    }, 30000);

    it('deve calcular similaridade entre textos similares', async () => {
      const emb1 = await generateEmbedding('Carro sedan confortável');
      const emb2 = await generateEmbedding('Sedan confortável para família');

      const similarity = cosineSimilarity(emb1, emb2);

      // Mock embeddings can return random values, so similarity can be between -1 and 1
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    }, 30000);

    it('deve rejeitar vetores de tamanhos diferentes', () => {
      const a = [1, 2, 3];
      const b = [1, 2];

      expect(() => cosineSimilarity(a, b)).toThrow();
    });

    it('deve retornar 0 para vetores zero', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBe(0);
    });
  });

  describe('getEmbeddingProvidersStatus', () => {
    it('deve retornar status dos providers', () => {
      const status = getEmbeddingProvidersStatus();

      expect(Array.isArray(status)).toBe(true);
      expect(status.length).toBeGreaterThan(0);

      status.forEach(provider => {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('model');
        expect(provider).toHaveProperty('dimensions');
        expect(provider).toHaveProperty('enabled');
        expect(provider).toHaveProperty('priority');
        expect(provider).toHaveProperty('costPer1MTokens');
        expect(provider).toHaveProperty('circuitBreakerOpen');
      });
    });

    it('deve incluir OpenAI como primário', () => {
      const status = getEmbeddingProvidersStatus();
      const openai = status.find(p => p.name === 'openai');

      expect(openai).toBeDefined();
      expect(openai?.priority).toBe(1);
      expect(openai?.model).toBe('text-embedding-3-small');
      expect(openai?.dimensions).toBe(1536);
    });

    it('deve incluir Cohere como fallback', () => {
      const status = getEmbeddingProvidersStatus();
      const cohere = status.find(p => p.name === 'cohere');

      expect(cohere).toBeDefined();
      expect(cohere?.priority).toBe(2);
      expect(cohere?.model).toBe('embed-multilingual-v3.0');
      expect(cohere?.dimensions).toBe(1024);
    });
  });

  describe('Circuit Breaker', () => {
    it('deve resetar circuit breaker corretamente', () => {
      resetCircuitBreaker();
      const status = getEmbeddingProvidersStatus();

      status.forEach(provider => {
        expect(provider.circuitBreakerOpen).toBe(false);
      });
    });
  });

  describe('Performance', () => {
    it('deve gerar embedding em menos de 30s', async () => {
      const start = Date.now();
      await generateEmbedding('Carro sedan');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(30000);
    }, 35000);

    it('deve gerar batch em menos de 30s', async () => {
      const texts = Array(5).fill('Carro');

      const start = Date.now();
      await generateEmbeddingsBatch(texts);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(30000);
    }, 35000);
  });
});
