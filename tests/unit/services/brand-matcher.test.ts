/**
 * Brand Matcher Service Tests
 * 
 * Tests fuzzy matching functionality for brand and model names
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { brandMatcher } from '../../../src/services/brand-matcher.service';
import { prisma } from '../../../src/lib/prisma';

// Mock Prisma
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe('BrandMatcherService', () => {
  beforeEach(() => {
    // Clear cache before each test
    brandMatcher.clearCache();
    vi.clearAllMocks();

    // Setup default mock responses
    (prisma.$queryRaw as any).mockImplementation((query: any) => {
      // Check query string to return correct data
      const queryString = query.strings ? query.strings.join('') : query.toString();

      if (queryString.includes('SELECT DISTINCT marca')) {
        return Promise.resolve([
          { marca: 'TOYOTA' },
          { marca: 'HONDA' },
          { marca: 'VOLKSWAGEN' },
          { marca: 'CHEVROLET' },
          { marca: 'FIAT' },
        ]);
      }

      if (queryString.includes('SELECT DISTINCT modelo')) {
        return Promise.resolve([
          { modelo: 'COROLLA' },
          { modelo: 'CIVIC' },
          { modelo: 'GOL' },
          { modelo: 'ONIX' },
          { modelo: 'UNO' },
        ]);
      }

      return Promise.resolve([]);
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('matchBrand', () => {
    it('should match exact brand names', async () => {
      const result = await brandMatcher.matchBrand('Toyota');

      expect(result.matched).toBe(true);
      expect(result.suggestion).toBe('TOYOTA');
      expect(result.confidence).toBe(1.0);
    });

    it('should handle typos with fuzzy matching', async () => {
      const result = await brandMatcher.matchBrand('Toiota');

      expect(result.matched).toBe(true);
      expect(result.suggestion).toBe('TOYOTA');
      // "Toiota" vs "Toyota" has exactly 0.6 similarity
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should handle case insensitivity', async () => {
      const result = await brandMatcher.matchBrand('toyota');

      expect(result.matched).toBe(true);
      expect(result.suggestion).toBe('TOYOTA');
      expect(result.confidence).toBe(1.0);
    });

    it('should return no match for very different strings', async () => {
      const result = await brandMatcher.matchBrand('asdfghjkl');

      expect(result.matched).toBe(false);
      expect(result.suggestion).toBeUndefined();
    });

    it('should handle common misspellings', async () => {
      const testCases = [
        { input: 'Volksvagen', expected: 'VOLKSWAGEN' },
        { input: 'Chevrolet', expected: 'CHEVROLET' }, // exact match
      ];

      for (const testCase of testCases) {
        const result = await brandMatcher.matchBrand(testCase.input);
        expect(result.matched).toBe(true);
        expect(result.suggestion).toBe(testCase.expected);
      }
    });

    it('should fail gracefully if database error', async () => {
      // Mock failure once
      (prisma.$queryRaw as any).mockRejectedValueOnce(new Error('DB Error'));

      // Should handle error and return no match
      const result = await brandMatcher.matchBrand('Toyota');
      expect(result.matched).toBe(false);
    });
  });

  describe('matchModel', () => {
    it('should match exact model names', async () => {
      const result = await brandMatcher.matchModel('Corolla');

      expect(result.matched).toBe(true);
      expect(result.suggestion).toBe('COROLLA');
      expect(result.confidence).toBe(1.0);
    });

    it('should handle typos in model names', async () => {
      const result = await brandMatcher.matchModel('Corola');

      expect(result.matched).toBe(true);
      expect(result.suggestion).toBe('COROLLA');
      // Allowing either 'COROLLA' or a close match depending on what's in DB
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should be case insensitive', async () => {
      const result = await brandMatcher.matchModel('civic');

      expect(result.matched).toBe(true);
      expect(result.suggestion).toBe('CIVIC');
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('matchBrandAndModel', () => {
    it('should match both brand and model from a query', async () => {
      const result = await brandMatcher.matchBrandAndModel('Toyota Corolla');

      expect(result.brand?.matched).toBe(true);
      expect(result.brand?.suggestion).toBe('TOYOTA');
      expect(result.model?.matched).toBe(true);
      expect(result.model?.suggestion).toBe('COROLLA');
    });

    it('should handle typos in both brand and model', async () => {
      const result = await brandMatcher.matchBrandAndModel('Toiota Corola');

      expect(result.brand?.matched).toBe(true);
      expect(result.brand?.suggestion).toBe('TOYOTA');
      expect(result.model?.matched).toBe(true);
      expect(result.model?.suggestion).toBe('COROLLA');
    });

    it('should handle single word queries', async () => {
      const result = await brandMatcher.matchBrandAndModel('Toyota');

      expect(result.brand?.matched).toBe(true);
      expect(result.brand?.suggestion).toBe('TOYOTA');
      expect(result.model).toBeUndefined();
    });
  });

  describe('generateConfirmationMessage', () => {
    it('should generate confirmation message for typos', () => {
      const brandMatch = {
        matched: true,
        original: 'Toiota',
        suggestion: 'Toyota',
        confidence: 0.85,
      };

      const message = brandMatcher.generateConfirmationMessage(brandMatch);

      expect(message).toBe('Você quis dizer **Toyota**?');
    });

    it('should generate confirmation for both brand and model', () => {
      const brandMatch = {
        matched: true,
        original: 'Toiota',
        suggestion: 'Toyota',
        confidence: 0.85,
      };

      const modelMatch = {
        matched: true,
        original: 'Corola',
        suggestion: 'Corolla',
        confidence: 0.8,
      };

      const message = brandMatcher.generateConfirmationMessage(brandMatch, modelMatch);

      expect(message).toBe('Você quis dizer **Toyota** **Corolla**?');
    });

    it('should return null for exact matches', () => {
      const brandMatch = {
        matched: true,
        original: 'Toyota',
        suggestion: 'Toyota',
        confidence: 1.0,
      };

      const message = brandMatcher.generateConfirmationMessage(brandMatch);

      expect(message).toBeNull();
    });

    it('should return null when no matches', () => {
      const message = brandMatcher.generateConfirmationMessage();

      expect(message).toBeNull();
    });
  });
});
