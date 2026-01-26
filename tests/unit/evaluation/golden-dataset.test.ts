/**
 * Unit tests for Golden Dataset and Benchmark Runner
 */

import { describe, it, expect } from 'vitest';
import {
  GOLDEN_DATASET,
  getTestCasesByCategory,
  getTestCaseById,
  getDatasetSummary,
  GoldenTestCase,
} from '../../../src/evaluation/golden-dataset';

describe('Golden Dataset', () => {
  describe('GOLDEN_DATASET', () => {
    it('should have at least 10 test cases', () => {
      expect(GOLDEN_DATASET.length).toBeGreaterThanOrEqual(10);
    });

    it('should have valid structure for all test cases', () => {
      for (const tc of GOLDEN_DATASET) {
        // Required fields
        expect(tc.id).toBeDefined();
        expect(tc.description).toBeDefined();
        expect(tc.category).toBeDefined();
        expect(tc.userProfile).toBeDefined();
        expect(tc.userProfile.useCase).toBeDefined();
        expect(tc.userMessages).toBeDefined();
        expect(tc.userMessages.length).toBeGreaterThan(0);
        expect(tc.expectedScores).toBeDefined();
        expect(tc.idealVehiclePatterns).toBeDefined();
        expect(tc.antiPatterns).toBeDefined();
      }
    });

    it('should have unique IDs', () => {
      const ids = GOLDEN_DATASET.map(tc => tc.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid categories', () => {
      const validCategories = ['familia', 'uber', 'viagem', 'trabalho', 'geral'];
      for (const tc of GOLDEN_DATASET) {
        expect(validCategories).toContain(tc.category);
      }
    });

    it('should have reasonable expected scores', () => {
      for (const tc of GOLDEN_DATASET) {
        expect(tc.expectedScores.minTopScore).toBeGreaterThanOrEqual(50);
        expect(tc.expectedScores.minTopScore).toBeLessThanOrEqual(100);
        expect(tc.expectedScores.minPrecisionAt3).toBeGreaterThanOrEqual(0);
        expect(tc.expectedScores.minPrecisionAt3).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('getTestCasesByCategory', () => {
    it('should return test cases for familia category', () => {
      const familyCases = getTestCasesByCategory('familia');
      expect(familyCases.length).toBeGreaterThanOrEqual(2);
      expect(familyCases.every(tc => tc.category === 'familia')).toBe(true);
    });

    it('should return test cases for uber category', () => {
      const uberCases = getTestCasesByCategory('uber');
      expect(uberCases.length).toBeGreaterThanOrEqual(2);
      expect(uberCases.every(tc => tc.category === 'uber')).toBe(true);
    });

    it('should return empty array for non-existent category', () => {
      const cases = getTestCasesByCategory('nonexistent' as any);
      expect(cases).toEqual([]);
    });
  });

  describe('getTestCaseById', () => {
    it('should return test case by valid ID', () => {
      const tc = getTestCaseById('familia-2-cadeirinhas');
      expect(tc).toBeDefined();
      expect(tc?.id).toBe('familia-2-cadeirinhas');
    });

    it('should return undefined for invalid ID', () => {
      const tc = getTestCaseById('invalid-id');
      expect(tc).toBeUndefined();
    });
  });

  describe('getDatasetSummary', () => {
    it('should return correct total count', () => {
      const summary = getDatasetSummary();
      expect(summary.total).toBe(GOLDEN_DATASET.length);
    });

    it('should have all categories in summary', () => {
      const summary = getDatasetSummary();
      expect(summary.byCategory).toBeDefined();
      expect(Object.keys(summary.byCategory).length).toBeGreaterThan(0);
    });

    it('should sum categories to total', () => {
      const summary = getDatasetSummary();
      const categorySum = Object.values(summary.byCategory).reduce((a, b) => a + b, 0);
      expect(categorySum).toBe(summary.total);
    });
  });
});

describe('Test Case Validation', () => {
  describe('Familia test cases', () => {
    it('should have anti-patterns for small cars', () => {
      const familyCase = getTestCaseById('familia-2-cadeirinhas');
      expect(familyCase).toBeDefined();
      expect(familyCase?.antiPatterns.some(ap => ap.model === 'Mobi')).toBe(true);
      expect(familyCase?.antiPatterns.some(ap => ap.model === 'Kwid')).toBe(true);
    });

    it('should prioritize SUVs and Sedans', () => {
      const familyCase = getTestCaseById('familia-2-cadeirinhas');
      expect(familyCase?.expectedCriteria.bodyTypes).toContain('SUV');
      expect(familyCase?.expectedCriteria.bodyTypes).toContain('Sedan');
    });
  });

  describe('Uber test cases', () => {
    it('should require minimum year for Uber 2026 rules', () => {
      const uberCase = getTestCaseById('uber-iniciante-2026');
      expect(uberCase?.expectedCriteria.minYear).toBeGreaterThanOrEqual(2016);
    });

    it('should exclude basic hatches from Uber', () => {
      const uberCase = getTestCaseById('uber-iniciante-2026');
      expect(uberCase?.expectedCriteria.mustNotHave).toContain('Kwid');
      expect(uberCase?.expectedCriteria.mustNotHave).toContain('Mobi');
    });

    it('should have Comfort-specific exclusions', () => {
      const comfortCase = getTestCaseById('uber-comfort-2026');
      expect(comfortCase?.expectedCriteria.mustNotHave).toContain('Kardian');
      expect(comfortCase?.expectedCriteria.mustNotHave).toContain('Logan');
    });
  });

  describe('Specific model test cases', () => {
    it('should have high expected score for specific model search', () => {
      const civicCase = getTestCaseById('modelo-especifico-civic');
      expect(civicCase?.expectedScores.minTopScore).toBeGreaterThanOrEqual(95);
      expect(civicCase?.idealVehiclePatterns[0]?.minScore).toBe(100);
    });
  });
});
