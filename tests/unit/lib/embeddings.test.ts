import { describe, it, expect } from 'vitest';
import * as embeddings from '@/lib/embeddings';
import { createMockEmbedding } from '@tests/helpers/test-utils';

describe('Embeddings Library - Unit Tests', () => {
  describe('cosineSimilarity', () => {
    it('deve calcular similaridade corretamente', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];

      const similarity = embeddings.cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('deve retornar 0 para vetores ortogonais', () => {
      const a = [1, 0];
      const b = [0, 1];

      const similarity = embeddings.cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(0, 5);
    });

    it('deve retornar -1 para vetores opostos', () => {
      const a = [1, 0];
      const b = [-1, 0];

      const similarity = embeddings.cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(-1, 5);
    });
  });

  describe('embeddingToString', () => {
    it('deve serializar array para string JSON', () => {
      const embedding = [0.1, 0.2, 0.3];
      const str = embeddings.embeddingToString(embedding);

      expect(typeof str).toBe('string');
      expect(str).toContain('[');
      expect(str).toContain(']');
    });
  });

  describe('stringToEmbedding', () => {
    it('deve deserializar string JSON para array', () => {
      const original = [0.1, 0.2, 0.3];
      const str = JSON.stringify(original);
      const parsed = embeddings.stringToEmbedding(str);

      expect(parsed).toEqual(original);
    });

    it('deve retornar null para string inválida', () => {
      const result = embeddings.stringToEmbedding('invalid json');
      expect(result).toBeNull();
    });
  });

  describe('isValidEmbedding', () => {
    it('deve validar embedding correto', () => {
      const valid = createMockEmbedding(1536);
      expect(embeddings.isValidEmbedding(valid)).toBe(true);
    });

    it('deve rejeitar embedding com dimensões erradas', () => {
      const invalid = createMockEmbedding(512);
      expect(embeddings.isValidEmbedding(invalid)).toBe(false);
    });

    it('deve rejeitar não-array', () => {
      expect(embeddings.isValidEmbedding('not array' as any)).toBe(false);
    });

    it('deve rejeitar array com NaN', () => {
      const invalid = [1, 2, NaN, 4];
      expect(embeddings.isValidEmbedding(invalid)).toBe(false);
    });
  });

  describe('getEmbeddingStats', () => {
    it('deve calcular estatísticas básicas', () => {
      const embedding = [1, 2, 3, 4, 5];
      const stats = embeddings.getEmbeddingStats(embedding);

      expect(stats.dimensions).toBe(5);
      expect(stats.mean).toBe('3.000000'); // Retorna string com toFixed(6)
      expect(stats.min).toBe('1.000000');
      expect(stats.max).toBe('5.000000');
    });

    it('deve calcular magnitude corretamente', () => {
      const embedding = [3, 4]; // magnitude = 5
      const stats = embeddings.getEmbeddingStats(embedding);

      expect(stats.magnitude).toBe('5.000000'); // Retorna string
    });
  });
});
