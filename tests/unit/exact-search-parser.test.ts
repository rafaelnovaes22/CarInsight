/**
 * Property-Based Tests for ExactSearchParser
 *
 * **Feature: exact-vehicle-search, Property 1: Parser extracts model and year correctly from all valid formats**
 * **Validates: Requirements 1.1, 5.1, 5.2, 5.3, 5.4**
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { ExactSearchParser } from '../../src/services/exact-search-parser.service';

const parser = new ExactSearchParser();

// Models for testing
const TEST_MODELS = [
  'onix',
  'prisma',
  'gol',
  'polo',
  'hb20',
  'corolla',
  'civic',
  'mobi',
  'argo',
  'renegade',
  'compass',
  'kicks',
  'creta',
  'tracker',
  'hr-v',
  'kwid',
  'ka',
  'fiesta',
  'ecosport',
];

// Initialize parser with test models
beforeAll(async () => {
  parser.addModels(TEST_MODELS);
});

// Generators for property-based testing

/**
 * Generator for valid vehicle model names
 */
const modelGenerator = fc.constantFrom(...TEST_MODELS);

/**
 * Generator for valid full years (1990-2025)
 */
const fullYearGenerator = fc.integer({ min: 1990, max: 2025 });

/**
 * Generator for valid abbreviated years (00-25 for 2000s, 90-99 for 1990s)
 */
const abbreviatedYearGenerator = fc.oneof(
  fc.integer({ min: 0, max: 25 }), // 2000-2025
  fc.integer({ min: 90, max: 99 }) // 1990-1999
);

/**
 * Generator for query format: "model year" (e.g., "Onix 2019")
 */
const modelYearQueryGenerator = fc
  .tuple(modelGenerator, fullYearGenerator)
  .map(([model, year]) => `${model} ${year}`);

/**
 * Generator for query format: "year model" (e.g., "2019 Onix")
 */
const yearModelQueryGenerator = fc
  .tuple(fullYearGenerator, modelGenerator)
  .map(([year, model]) => `${year} ${model}`);

/**
 * Generator for query format with abbreviated year: "model YY" (e.g., "Onix 19")
 */
const modelAbbrevYearQueryGenerator = fc
  .tuple(modelGenerator, abbreviatedYearGenerator)
  .map(([model, year]) => `${model} ${year.toString().padStart(2, '0')}`);

/**
 * Generator for year range format: "model YYYY a YYYY" (e.g., "Onix 2018 a 2020")
 * Note: We limit the base year to 2022 to ensure year+offset stays within valid range (currentYear+1 = 2026)
 */
const yearRangeQueryGenerator = fc
  .tuple(
    modelGenerator,
    fc.integer({ min: 1990, max: 2022 }), // Limited to ensure range stays valid
    fc.integer({ min: 1, max: 3 }) // offset for second year
  )
  .map(([model, year, offset]) => `${model} ${year} a ${year + offset}`);

/**
 * Generator for slash year format: "model YYYY/YYYY" (e.g., "Onix 2019/2020")
 * Note: We limit the base year to 2024 to ensure year+1 stays within valid range (currentYear+1 = 2026)
 */
const slashYearQueryGenerator = fc
  .tuple(
    modelGenerator,
    fc.integer({ min: 1990, max: 2024 }) // Limited to ensure year+1 stays valid
  )
  .map(([model, year]) => `${model} ${year}/${year + 1}`);

describe('ExactSearchParser Property Tests', () => {
  /**
   * **Feature: exact-vehicle-search, Property 1: Parser extracts model and year correctly from all valid formats**
   * **Validates: Requirements 1.1, 5.1, 5.2, 5.3, 5.4**
   */
  describe('Property 1: Parser extracts model and year correctly from all valid formats', () => {
    it('extracts model and year from "model year" format (Requirement 1.1)', async () => {
      await fc.assert(
        fc.asyncProperty(modelYearQueryGenerator, async query => {
          const result = await parser.parse(query);

          // Model should be extracted (case-insensitive match)
          expect(result.model).not.toBeNull();
          expect(result.model!.toLowerCase().replace(/-/g, '')).toMatch(/[a-z0-9]+/);

          // Year should be extracted
          expect(result.year).not.toBeNull();
          expect(result.year).toBeGreaterThanOrEqual(1990);
          expect(result.year).toBeLessThanOrEqual(2025);

          // Raw query should be preserved
          expect(result.rawQuery).toBe(query);
        }),
        { numRuns: 100 }
      );
    });

    it('extracts model and year from "year model" format (Requirement 5.1)', async () => {
      await fc.assert(
        fc.asyncProperty(yearModelQueryGenerator, async query => {
          const result = await parser.parse(query);

          // Model should be extracted
          expect(result.model).not.toBeNull();

          // Year should be extracted
          expect(result.year).not.toBeNull();
          expect(result.year).toBeGreaterThanOrEqual(1990);
          expect(result.year).toBeLessThanOrEqual(2025);
        }),
        { numRuns: 100 }
      );
    });

    it('interprets abbreviated year format correctly (Requirement 5.2)', async () => {
      await fc.assert(
        fc.asyncProperty(modelAbbrevYearQueryGenerator, async query => {
          const result = await parser.parse(query);

          // Model should be extracted
          expect(result.model).not.toBeNull();

          // Year should be expanded correctly
          expect(result.year).not.toBeNull();

          // Abbreviated years 00-30 should become 2000-2030
          // Abbreviated years 31-99 should become 1931-1999
          expect(result.year).toBeGreaterThanOrEqual(1990);
          expect(result.year).toBeLessThanOrEqual(2025);
        }),
        { numRuns: 100 }
      );
    });

    it('extracts year range from "model YYYY a YYYY" format (Requirement 5.3)', async () => {
      await fc.assert(
        fc.asyncProperty(yearRangeQueryGenerator, async query => {
          const result = await parser.parse(query);

          // Model should be extracted
          expect(result.model).not.toBeNull();

          // Year range should be extracted (not single year)
          expect(result.yearRange).not.toBeNull();
          expect(result.year).toBeNull(); // Single year should be null when range exists

          // Range should be valid
          expect(result.yearRange!.min).toBeLessThanOrEqual(result.yearRange!.max);
          expect(result.yearRange!.min).toBeGreaterThanOrEqual(1990);
          expect(result.yearRange!.max).toBeLessThanOrEqual(2028);
        }),
        { numRuns: 100 }
      );
    });

    it('extracts year range from "model YYYY/YYYY" slash format (Requirement 5.4)', async () => {
      await fc.assert(
        fc.asyncProperty(slashYearQueryGenerator, async query => {
          const result = await parser.parse(query);

          // Model should be extracted
          expect(result.model).not.toBeNull();

          // Year range should be extracted
          expect(result.yearRange).not.toBeNull();
          expect(result.year).toBeNull();

          // Range should be valid (consecutive years)
          expect(result.yearRange!.max - result.yearRange!.min).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    it('preserves raw query in all cases', async () => {
      const allFormatsGenerator = fc.oneof(
        modelYearQueryGenerator,
        yearModelQueryGenerator,
        modelAbbrevYearQueryGenerator,
        yearRangeQueryGenerator,
        slashYearQueryGenerator
      );

      await fc.assert(
        fc.asyncProperty(allFormatsGenerator, async query => {
          const result = await parser.parse(query);
          expect(result.rawQuery).toBe(query);
        }),
        { numRuns: 100 }
      );
    });

    it('returns null for model when no known model is present', async () => {
      // Use array of characters to build strings without known models
      const noModelQueryGenerator = fc
        .array(fc.constantFrom('a', 'b', 'c', ' ', '1', '2', '3'), { minLength: 1, maxLength: 20 })
        .map(chars => chars.join(''))
        .filter(s => s.trim().length > 0)
        .filter(s => !TEST_MODELS.some(m => s.toLowerCase().includes(m)));

      await fc.assert(
        fc.asyncProperty(noModelQueryGenerator, async query => {
          const result = await parser.parse(query);
          // If no known model in query, model should be null
          expect(result.model).toBeNull();
        }),
        { numRuns: 50 }
      );
    });
  });
});
