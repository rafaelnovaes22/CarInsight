/**
 * Property-Based Tests for SearchResultSerializer
 *
 * **Feature: exact-vehicle-search**
 * Tests Property 9 from the design document
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SearchResultSerializer } from '../../src/services/search-result-serializer.service';
import {
  ExactSearchResult,
  ExactSearchResultType,
  Vehicle,
  VehicleMatch,
} from '../../src/services/exact-search.service';
import { KNOWN_MODELS } from '../../src/services/exact-search-parser.service';

const serializer = new SearchResultSerializer();

// ============================================================================
// Generators for property-based testing
// ============================================================================

/**
 * Generator for valid vehicle model names
 */
const modelGenerator = fc.constantFrom(...KNOWN_MODELS.slice(0, 20));

/**
 * Generator for valid years (1990-2025)
 */
const yearGenerator = fc.integer({ min: 1990, max: 2025 });

/**
 * Generator for vehicle prices (reasonable range in BRL)
 */
const priceGenerator = fc.integer({ min: 20000, max: 300000 });

/**
 * Generator for vehicle mileage
 */
const mileageGenerator = fc.integer({ min: 0, max: 200000 });

/**
 * Generator for vehicle versions
 */
const versionGenerator = fc.constantFrom(
  'LT',
  'LTZ',
  'Premier',
  'Sport',
  'Comfort',
  'EX',
  'EXL',
  'Touring',
  null
);

/**
 * Generator for search result types
 */
const resultTypeGenerator = fc.constantFrom<ExactSearchResultType>(
  'exact',
  'year_alternatives',
  'suggestions',
  'unavailable'
);

/**
 * Generator for match types
 */
const matchTypeGenerator = fc.constantFrom<'exact' | 'year_alternative' | 'suggestion'>(
  'exact',
  'year_alternative',
  'suggestion'
);

/**
 * Generator for a single vehicle
 */
const vehicleGenerator: fc.Arbitrary<Vehicle> = fc.record({
  id: fc.uuid(),
  marca: fc.constantFrom('Chevrolet', 'Honda', 'Toyota', 'Volkswagen', 'Fiat'),
  modelo: modelGenerator,
  versao: versionGenerator,
  ano: yearGenerator,
  km: mileageGenerator,
  preco: priceGenerator,
  cor: fc.constantFrom('Branco', 'Preto', 'Prata', 'Vermelho', 'Azul'),
  carroceria: fc.constantFrom('Hatch', 'Sedan', 'SUV', 'Pickup'),
  combustivel: fc.constantFrom('Flex', 'Gasolina', 'Diesel'),
  cambio: fc.constantFrom('Manual', 'Automático'),
  disponivel: fc.boolean(),
  fotoUrl: fc.option(fc.webUrl(), { nil: null }),
  url: fc.option(fc.webUrl(), { nil: null }),
});

/**
 * Generator for a vehicle match
 */
const vehicleMatchGenerator: fc.Arbitrary<VehicleMatch> = fc.record({
  vehicle: vehicleGenerator,
  matchScore: fc.integer({ min: 0, max: 100 }),
  reasoning: fc.string({ minLength: 1, maxLength: 200 }),
  matchType: matchTypeGenerator,
});

/**
 * Generator for available years array
 */
const availableYearsGenerator = fc
  .array(yearGenerator, { minLength: 0, maxLength: 10 })
  .map(years => [...new Set(years)].sort((a, b) => a - b));

/**
 * Generator for ExactSearchResult
 */
const exactSearchResultGenerator: fc.Arbitrary<ExactSearchResult> = fc.record({
  type: resultTypeGenerator,
  vehicles: fc.array(vehicleMatchGenerator, { minLength: 0, maxLength: 5 }),
  message: fc.string({ minLength: 1, maxLength: 500 }),
  availableYears: fc.option(availableYearsGenerator, { nil: undefined }),
  requestedModel: modelGenerator,
  requestedYear: yearGenerator,
});

// ============================================================================
// Property 9: Serialization round-trip preserves data integrity
// ============================================================================

describe('SearchResultSerializer Property Tests', () => {
  /**
   * **Feature: exact-vehicle-search, Property 9: Serialization round-trip preserves data integrity**
   * **Validates: Requirements 6.1, 6.2, 6.3**
   */
  describe('Property 9: Serialization round-trip preserves data integrity', () => {
    it('serialize then deserialize produces equivalent ExactSearchResult', () => {
      fc.assert(
        fc.property(exactSearchResultGenerator, originalResult => {
          // Serialize
          const json = serializer.serialize(originalResult);

          // Deserialize
          const deserializedResult = serializer.deserialize(json);

          // Verify type is preserved
          expect(deserializedResult.type).toBe(originalResult.type);

          // Verify message is preserved
          expect(deserializedResult.message).toBe(originalResult.message);

          // Verify requestedModel is preserved
          expect(deserializedResult.requestedModel).toBe(originalResult.requestedModel);

          // Verify requestedYear is preserved
          expect(deserializedResult.requestedYear).toBe(originalResult.requestedYear);

          // Verify availableYears is preserved
          if (originalResult.availableYears !== undefined) {
            expect(deserializedResult.availableYears).toEqual(originalResult.availableYears);
          } else {
            expect(deserializedResult.availableYears).toBeUndefined();
          }

          // Verify vehicles array length is preserved
          expect(deserializedResult.vehicles.length).toBe(originalResult.vehicles.length);

          // Verify each vehicle match is preserved
          for (let i = 0; i < originalResult.vehicles.length; i++) {
            const original = originalResult.vehicles[i];
            const deserialized = deserializedResult.vehicles[i];

            expect(deserialized.matchScore).toBe(original.matchScore);
            expect(deserialized.reasoning).toBe(original.reasoning);
            expect(deserialized.matchType).toBe(original.matchType);

            // Verify vehicle data is preserved
            expect(deserialized.vehicle.id).toBe(original.vehicle.id);
            expect(deserialized.vehicle.marca).toBe(original.vehicle.marca);
            expect(deserialized.vehicle.modelo).toBe(original.vehicle.modelo);
            expect(deserialized.vehicle.versao).toBe(original.vehicle.versao);
            expect(deserialized.vehicle.ano).toBe(original.vehicle.ano);
            expect(deserialized.vehicle.km).toBe(original.vehicle.km);
            expect(deserialized.vehicle.preco).toBe(original.vehicle.preco);
            expect(deserialized.vehicle.cor).toBe(original.vehicle.cor);
            expect(deserialized.vehicle.carroceria).toBe(original.vehicle.carroceria);
            expect(deserialized.vehicle.combustivel).toBe(original.vehicle.combustivel);
            expect(deserialized.vehicle.cambio).toBe(original.vehicle.cambio);
            expect(deserialized.vehicle.disponivel).toBe(original.vehicle.disponivel);
            expect(deserialized.vehicle.fotoUrl).toBe(original.vehicle.fotoUrl);
            expect(deserialized.vehicle.url).toBe(original.vehicle.url);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('serialized output includes search type indicator', () => {
      fc.assert(
        fc.property(exactSearchResultGenerator, result => {
          const json = serializer.serialize(result);
          const parsed = JSON.parse(json);

          // Verify type is included in serialized output
          expect(parsed.type).toBe(result.type);
          expect(['exact', 'year_alternatives', 'suggestions', 'unavailable']).toContain(
            parsed.type
          );
        }),
        { numRuns: 100 }
      );
    });

    it('serialized output includes all metadata', () => {
      fc.assert(
        fc.property(exactSearchResultGenerator, result => {
          const json = serializer.serialize(result);
          const parsed = JSON.parse(json);

          // Verify metadata is present
          expect(parsed.metadata).toBeDefined();
          expect(parsed.metadata.requestedModel).toBe(result.requestedModel);
          expect(parsed.metadata.requestedYear).toBe(result.requestedYear);
          expect(parsed.metadata.timestamp).toBeDefined();

          // Verify timestamp is valid ISO string
          expect(() => new Date(parsed.metadata.timestamp)).not.toThrow();

          // Verify availableYears if present
          if (result.availableYears !== undefined) {
            expect(parsed.metadata.availableYears).toEqual(result.availableYears);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('serialized output is valid JSON', () => {
      fc.assert(
        fc.property(exactSearchResultGenerator, result => {
          const json = serializer.serialize(result);

          // Should not throw when parsing
          expect(() => JSON.parse(json)).not.toThrow();

          // Should be a string
          expect(typeof json).toBe('string');
        }),
        { numRuns: 100 }
      );
    });

    it('deserialize throws on invalid JSON', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => {
            try {
              JSON.parse(s);
              return false; // Valid JSON, skip
            } catch {
              return true; // Invalid JSON, keep
            }
          }),
          invalidJson => {
            expect(() => serializer.deserialize(invalidJson)).toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('deserialize throws on missing required fields', () => {
      // Test missing type
      expect(() =>
        serializer.deserialize(
          JSON.stringify({
            vehicles: [],
            message: 'test',
            metadata: { requestedModel: 'Onix', requestedYear: 2020 },
          })
        )
      ).toThrow();

      // Test missing vehicles
      expect(() =>
        serializer.deserialize(
          JSON.stringify({
            type: 'exact',
            message: 'test',
            metadata: { requestedModel: 'Onix', requestedYear: 2020 },
          })
        )
      ).toThrow();

      // Test missing message
      expect(() =>
        serializer.deserialize(
          JSON.stringify({
            type: 'exact',
            vehicles: [],
            metadata: { requestedModel: 'Onix', requestedYear: 2020 },
          })
        )
      ).toThrow();

      // Test missing metadata
      expect(() =>
        serializer.deserialize(
          JSON.stringify({
            type: 'exact',
            vehicles: [],
            message: 'test',
          })
        )
      ).toThrow();

      // Test missing requestedModel in metadata
      expect(() =>
        serializer.deserialize(
          JSON.stringify({
            type: 'exact',
            vehicles: [],
            message: 'test',
            metadata: { requestedYear: 2020 },
          })
        )
      ).toThrow();

      // Test missing requestedYear in metadata
      expect(() =>
        serializer.deserialize(
          JSON.stringify({
            type: 'exact',
            vehicles: [],
            message: 'test',
            metadata: { requestedModel: 'Onix' },
          })
        )
      ).toThrow();
    });

    it('deserialize throws on invalid type value', () => {
      expect(() =>
        serializer.deserialize(
          JSON.stringify({
            type: 'invalid_type',
            vehicles: [],
            message: 'test',
            metadata: {
              requestedModel: 'Onix',
              requestedYear: 2020,
              timestamp: new Date().toISOString(),
            },
          })
        )
      ).toThrow();
    });

    it('round-trip preserves empty vehicles array', () => {
      fc.assert(
        fc.property(resultTypeGenerator, modelGenerator, yearGenerator, (type, model, year) => {
          const result: ExactSearchResult = {
            type,
            vehicles: [],
            message: 'No vehicles found',
            requestedModel: model,
            requestedYear: year,
          };

          const json = serializer.serialize(result);
          const deserialized = serializer.deserialize(json);

          expect(deserialized.vehicles).toEqual([]);
          expect(deserialized.type).toBe(type);
        }),
        { numRuns: 100 }
      );
    });

    it('round-trip preserves null values in vehicle fields', () => {
      const result: ExactSearchResult = {
        type: 'exact',
        vehicles: [
          {
            vehicle: {
              id: 'test-id',
              marca: 'Chevrolet',
              modelo: 'Onix',
              versao: null,
              ano: 2020,
              km: 50000,
              preco: 80000,
              cor: 'Branco',
              carroceria: 'Hatch',
              combustivel: 'Flex',
              cambio: 'Manual',
              disponivel: true,
              fotoUrl: null,
              url: null,
            },
            matchScore: 100,
            reasoning: 'Exact match',
            matchType: 'exact',
          },
        ],
        message: 'Found 1 vehicle',
        requestedModel: 'Onix',
        requestedYear: 2020,
      };

      const json = serializer.serialize(result);
      const deserialized = serializer.deserialize(json);

      expect(deserialized.vehicles[0].vehicle.versao).toBeNull();
      expect(deserialized.vehicles[0].vehicle.fotoUrl).toBeNull();
      expect(deserialized.vehicles[0].vehicle.url).toBeNull();
    });
  });
});
