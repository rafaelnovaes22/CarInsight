/**
 * Unit tests for RecommendationFeedbackService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RecommendationFeedbackService,
  FeedbackSignal,
} from '../../../src/lib/recommendation-feedback';

// Mock prisma
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    recommendation: {
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock llm-router
vi.mock('../../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn().mockResolvedValue('{"isRejection": false}'),
}));

describe('RecommendationFeedbackService', () => {
  let service: RecommendationFeedbackService;

  beforeEach(() => {
    service = new RecommendationFeedbackService();
    vi.clearAllMocks();
  });

  describe('detectRejectionPatterns', () => {
    it('should detect price rejection', () => {
      const result = service.detectRejectionPatterns('Esse carro é muito caro para mim');
      expect(result.isRejection).toBe(true);
      expect(result.category).toBe('price');
    });

    it('should detect age rejection', () => {
      const result = service.detectRejectionPatterns('Esse carro é muito antigo');
      expect(result.isRejection).toBe(true);
      expect(result.category).toBe('age');
    });

    it('should detect mileage rejection', () => {
      const result = service.detectRejectionPatterns('Muita quilometragem, não quero');
      expect(result.isRejection).toBe(true);
      expect(result.category).toBe('condition');
    });

    it('should detect general rejection', () => {
      const result = service.detectRejectionPatterns('Não gostei, mostra outro');
      expect(result.isRejection).toBe(true);
      expect(result.category).toBe('general');
    });

    it('should not detect rejection in positive message', () => {
      const result = service.detectRejectionPatterns('Gostei muito! Quero saber mais');
      expect(result.isRejection).toBe(false);
    });

    it('should not detect rejection in neutral message', () => {
      const result = service.detectRejectionPatterns('Qual a cor disponível?');
      expect(result.isRejection).toBe(false);
    });

    it('should detect "fora do orçamento"', () => {
      const result = service.detectRejectionPatterns('Está fora do meu orçamento');
      expect(result.isRejection).toBe(true);
      expect(result.category).toBe('price');
    });

    it('should detect "quero mais novo"', () => {
      const result = service.detectRejectionPatterns('Quero um carro mais novo');
      expect(result.isRejection).toBe(true);
      expect(result.category).toBe('age');
    });

    it('should detect type preferences', () => {
      const result = service.detectRejectionPatterns('Não quero hatch, prefiro SUV');
      expect(result.isRejection).toBe(true);
      expect(result.category).toBe('type');
    });
  });

  describe('calculateEngagement', () => {
    it('should calculate base score for no interaction', () => {
      const result = service.calculateEngagement({
        clicked: false,
        viewedAt: null,
        viewDurationSec: null,
        askedQuestions: false,
        requestedContact: false,
        wasSkipped: false,
        rejectionReason: null,
        userRating: null,
        interested: false,
      });

      expect(result.score).toBe(50); // Base score
    });

    it('should increase score for positive signals', () => {
      const result = service.calculateEngagement({
        clicked: true, // +10
        viewedAt: new Date(), // +5
        viewDurationSec: 60, // +10 (>30s)
        askedQuestions: true, // +15
        requestedContact: false,
        wasSkipped: false,
        rejectionReason: null,
        userRating: null,
        interested: false,
      });

      // 50 + 10 + 5 + 10 + 15 = 90
      expect(result.score).toBe(90);
    });

    it('should give maximum score for high engagement', () => {
      const result = service.calculateEngagement({
        clicked: true, // +10
        viewedAt: new Date(), // +5
        viewDurationSec: 120, // +10
        askedQuestions: true, // +15
        requestedContact: true, // +25
        wasSkipped: false,
        rejectionReason: null,
        userRating: 5, // +20
        interested: true, // +20
      });

      // Should be capped at 100
      expect(result.score).toBe(100);
    });

    it('should decrease score for rejection', () => {
      const result = service.calculateEngagement({
        clicked: false,
        viewedAt: null,
        viewDurationSec: null,
        askedQuestions: false,
        requestedContact: false,
        wasSkipped: false,
        rejectionReason: 'muito caro',
        userRating: null,
        interested: false,
      });

      // 50 - 30 = 20
      expect(result.score).toBe(20);
    });

    it('should decrease score for skip', () => {
      const result = service.calculateEngagement({
        clicked: false,
        viewedAt: null,
        viewDurationSec: null,
        askedQuestions: false,
        requestedContact: false,
        wasSkipped: true, // -20
        rejectionReason: null,
        userRating: null,
        interested: false,
      });

      // 50 - 20 = 30
      expect(result.score).toBe(30);
    });

    it('should handle low ratings negatively', () => {
      const result = service.calculateEngagement({
        clicked: true,
        viewedAt: null,
        viewDurationSec: null,
        askedQuestions: false,
        requestedContact: false,
        wasSkipped: false,
        rejectionReason: null,
        userRating: 1, // -20 (1-3=-2, *10=-20)
        interested: false,
      });

      // 50 + 10 - 20 = 40
      expect(result.score).toBe(40);
    });

    it('should never go below 0', () => {
      const result = service.calculateEngagement({
        clicked: false,
        viewedAt: null,
        viewDurationSec: null,
        askedQuestions: false,
        requestedContact: false,
        wasSkipped: true, // -20
        rejectionReason: 'muito caro', // -30
        userRating: 1, // -20
        interested: false,
      });

      // 50 - 20 - 30 - 20 = -20, capped to 0
      expect(result.score).toBe(0);
    });
  });
});
