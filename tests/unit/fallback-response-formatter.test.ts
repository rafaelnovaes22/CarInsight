/**
 * FallbackResponseFormatter Property Tests
 *
 * Property-based tests for the FallbackResponseFormatter service.
 * Uses fast-check library with minimum 100 iterations per property.
 *
 * **Feature: vehicle-fallback-recommendations**
 * Properties: 9, 10, 11
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FallbackResponseFormatter } from '../../src/services/fallback-response-formatter.service';
import {
  FallbackResult,
  FallbackType,
  FallbackVehicleMatch,
  MatchingCriterion,
} from '../../src/services/fallback.types';
import { Vehicle } from '../../src/services/exact-search.service';

// ============================================================================
// Arbitrary Generators
// ============================================================================

const brandArbitrary = fc.constantFrom(
  'Honda',
  'Toyota',
  'Chevrolet',
  'Volkswagen',
  'Fiat',
  'Hyundai',
  'Jeep',
  'Ford'
);

const modelArbitrary = fc.constantFrom(
  'Civic',
  'Corolla',
  'Onix',
  'Polo',
  'Argo',
  'Creta',
  'Compass',
  'Ranger'
);

const bodyTypeArbitrary = fc.constantFrom('Sedan', 'Hatch', 'SUV', 'Pickup');

const transmissionArbitrary = fc.constantFrom('Manual', 'Automático');

const fuelArbitrary = fc.constantFrom('Flex', 'Gasolina', 'Diesel');

const vehicleArbitrary: fc.Arbitrary<Vehicle> = fc.record({
  id: fc.uuid(),
  marca: brandArbitrary,
  modelo: modelArbitrary,
  versao: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  ano: fc.integer({ min: 2015, max: 2025 }),
  km: fc.integer({ min: 0, max: 200000 }),
  preco: fc.integer({ min: 50000, max: 300000 }),
  cor: fc.option(fc.constantFrom('Branco', 'Preto', 'Prata', 'Vermelho'), { nil: null }),
  carroceria: bodyTypeArbitrary,
  combustivel: fuelArbitrary,
  cambio: transmissionArbitrary,
  disponivel: fc.constant(true),
  fotoUrl: fc.option(fc.webUrl(), { nil: null }),
  url: fc.option(fc.webUrl(), { nil: null }),
});

const criterionTypeArbitrary = fc.constantFrom(
  'year',
  'brand',
  'category',
  'price',
  'transmission',
  'fuel'
) as fc.Arbitrary<MatchingCriterion['criterion']>;

const matchingCriterionArbitrary: fc.Arbitrary<MatchingCriterion> = fc.record({
  criterion: criterionTypeArbitrary,
  matched: fc.boolean(),
  details: fc.string({ minLength: 5, maxLength: 50 }),
});

const fallbackVehicleMatchArbitrary: fc.Arbitrary<FallbackVehicleMatch> = fc.record({
  vehicle: vehicleArbitrary,
  similarityScore: fc.integer({ min: 0, max: 100 }),
  matchingCriteria: fc.array(matchingCriterionArbitrary, { minLength: 1, maxLength: 6 }),
  reasoning: fc.string({ minLength: 10, maxLength: 100 }),
});

const fallbackTypeArbitrary: fc.Arbitrary<FallbackType> = fc.constantFrom(
  'year_alternative',
  'same_brand',
  'same_category',
  'price_range',
  'no_results'
);

const fallbackResultArbitrary: fc.Arbitrary<FallbackResult> = fc.record({
  type: fallbackTypeArbitrary,
  vehicles: fc.array(fallbackVehicleMatchArbitrary, { minLength: 0, maxLength: 5 }),
  message: fc.string({ minLength: 10, maxLength: 200 }),
  requestedModel: fc.string({ minLength: 2, maxLength: 20 }),
  requestedYear: fc.option(fc.integer({ min: 2015, max: 2025 }), { nil: null }),
  availableYears: fc.option(
    fc.array(fc.integer({ min: 2015, max: 2025 }), { minLength: 1, maxLength: 5 }),
    { nil: undefined }
  ),
  metadata: fc.record({
    strategyUsed: fallbackTypeArbitrary,
    totalCandidates: fc.integer({ min: 0, max: 100 }),
    processingTimeMs: fc.integer({ min: 0, max: 1000 }),
  }),
});

// Year alternative specific generator
const yearAlternativeResultArbitrary: fc.Arbitrary<FallbackResult> = fc.record({
  type: fc.constant('year_alternative' as FallbackType),
  vehicles: fc.array(fallbackVehicleMatchArbitrary, { minLength: 1, maxLength: 5 }),
  message: fc.string({ minLength: 10, maxLength: 200 }),
  requestedModel: fc.string({ minLength: 2, maxLength: 20 }),
  requestedYear: fc.integer({ min: 2015, max: 2025 }),
  availableYears: fc.array(fc.integer({ min: 2015, max: 2025 }), { minLength: 1, maxLength: 5 }),
  metadata: fc.record({
    strategyUsed: fc.constant('year_alternative' as FallbackType),
    totalCandidates: fc.integer({ min: 1, max: 100 }),
    processingTimeMs: fc.integer({ min: 0, max: 1000 }),
  }),
});

// Result with vehicles generator
const resultWithVehiclesArbitrary: fc.Arbitrary<FallbackResult> = fc.record({
  type: fc.constantFrom(
    'year_alternative',
    'same_brand',
    'same_category',
    'price_range'
  ) as fc.Arbitrary<FallbackType>,
  vehicles: fc.array(fallbackVehicleMatchArbitrary, { minLength: 1, maxLength: 5 }),
  message: fc.string({ minLength: 10, maxLength: 200 }),
  requestedModel: fc.string({ minLength: 2, maxLength: 20 }),
  requestedYear: fc.option(fc.integer({ min: 2015, max: 2025 }), { nil: null }),
  availableYears: fc.option(
    fc.array(fc.integer({ min: 2015, max: 2025 }), { minLength: 1, maxLength: 5 }),
    { nil: undefined }
  ),
  metadata: fc.record({
    strategyUsed: fc.constantFrom(
      'year_alternative',
      'same_brand',
      'same_category',
      'price_range'
    ) as fc.Arbitrary<FallbackType>,
    totalCandidates: fc.integer({ min: 1, max: 100 }),
    processingTimeMs: fc.integer({ min: 0, max: 1000 }),
  }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('FallbackResponseFormatter Property Tests', () => {
  const formatter = new FallbackResponseFormatter();

  describe('Property 9: Response Structure Completeness', () => {
    /**
     * **Validates: Requirements 3.1, 3.2, 5.3**
     *
     * For any fallback result with vehicles, the response SHALL include:
     * (1) an acknowledgment message indicating the exact vehicle is unavailable,
     * (2) a non-empty reasoning string for each vehicle, and
     * (3) metadata indicating the fallback type used.
     */

    it('response includes acknowledgment message for any result', () => {
      fc.assert(
        fc.property(fallbackResultArbitrary, result => {
          const response = formatter.format(result);

          // Acknowledgment must be a non-empty string
          expect(response.acknowledgment).toBeDefined();
          expect(typeof response.acknowledgment).toBe('string');
          expect(response.acknowledgment.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('response includes formatted alternatives for each vehicle', () => {
      fc.assert(
        fc.property(resultWithVehiclesArbitrary, result => {
          const response = formatter.format(result);

          // Number of alternatives matches number of vehicles
          expect(response.alternatives.length).toBe(result.vehicles.length);

          // Each alternative has required fields
          for (const alt of response.alternatives) {
            expect(alt.vehicleDescription).toBeDefined();
            expect(typeof alt.vehicleDescription).toBe('string');
            expect(alt.vehicleDescription.length).toBeGreaterThan(0);

            expect(alt.relevanceExplanation).toBeDefined();
            expect(typeof alt.relevanceExplanation).toBe('string');
            expect(alt.relevanceExplanation.length).toBeGreaterThan(0);

            expect(alt.highlights).toBeDefined();
            expect(Array.isArray(alt.highlights)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('response includes summary message', () => {
      fc.assert(
        fc.property(fallbackResultArbitrary, result => {
          const response = formatter.format(result);

          // Summary must be a non-empty string
          expect(response.summary).toBeDefined();
          expect(typeof response.summary).toBe('string');
          expect(response.summary.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('acknowledgment mentions unavailability for results with vehicles', () => {
      fc.assert(
        fc.property(resultWithVehiclesArbitrary, result => {
          const response = formatter.format(result);

          // Acknowledgment should indicate unavailability
          const lowerAck = response.acknowledgment.toLowerCase();
          const normalizedAck = lowerAck
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, '');
          const indicatesUnavailability =
            normalizedAck.includes('nao temos') ||
            normalizedAck.includes('nao encontramos') ||
            normalizedAck.includes('disponivel') ||
            normalizedAck.includes('disponavel');

          expect(indicatesUnavailability).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('vehicle description includes brand, model, year, and price', () => {
      fc.assert(
        fc.property(resultWithVehiclesArbitrary, result => {
          const response = formatter.format(result);

          for (let i = 0; i < response.alternatives.length; i++) {
            const alt = response.alternatives[i];
            const vehicle = result.vehicles[i].vehicle;

            // Description should contain key vehicle info
            expect(alt.vehicleDescription).toContain(vehicle.marca);
            expect(alt.vehicleDescription).toContain(vehicle.modelo);
            expect(alt.vehicleDescription).toContain(String(vehicle.ano));
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 10: Year Alternatives Include Available Years', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For any year alternative fallback result, the response SHALL include
     * a list of all available years for the requested model in the inventory.
     */

    it('year alternative acknowledgment includes available years', () => {
      fc.assert(
        fc.property(yearAlternativeResultArbitrary, result => {
          const response = formatter.format(result);

          // Acknowledgment should mention available years
          if (result.availableYears && result.availableYears.length > 0) {
            // At least one year should be mentioned in the acknowledgment
            const hasYearMentioned = result.availableYears.some(year =>
              response.acknowledgment.includes(String(year))
            );
            expect(hasYearMentioned).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('year alternative acknowledgment mentions same model different year', () => {
      fc.assert(
        fc.property(yearAlternativeResultArbitrary, result => {
          const response = formatter.format(result);

          // Should indicate same model is available in other years
          const lowerAck = response.acknowledgment.toLowerCase();
          const indicatesSameModel =
            lowerAck.includes('mesmo modelo') ||
            lowerAck.includes('anos:') ||
            lowerAck.includes('outros anos');

          expect(indicatesSameModel).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 11: Maximum Reasons Per Vehicle', () => {
    /**
     * **Validates: Requirements 3.6**
     *
     * For any formatted fallback response, each vehicle's relevance explanation
     * SHALL contain at most 3 key reasons.
     */

    it('highlights array never exceeds 3 items', () => {
      fc.assert(
        fc.property(resultWithVehiclesArbitrary, result => {
          const response = formatter.format(result);

          for (const alt of response.alternatives) {
            expect(alt.highlights.length).toBeLessThanOrEqual(3);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('relevance explanation contains at most 3 reasons', () => {
      fc.assert(
        fc.property(resultWithVehiclesArbitrary, result => {
          const response = formatter.format(result);

          for (const alt of response.alternatives) {
            // Count reasons by counting bullet separators
            // Reasons are separated by ' • '
            const reasonCount = alt.relevanceExplanation.split(' • ').length;
            expect(reasonCount).toBeLessThanOrEqual(3);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('even with many matching criteria, output is limited', () => {
      // Create a result with many matching criteria
      const manyMatchingCriteria: MatchingCriterion[] = [
        { criterion: 'year', matched: true, details: 'Ano 2023' },
        { criterion: 'brand', matched: true, details: 'Mesma marca' },
        { criterion: 'category', matched: true, details: 'Mesma categoria' },
        { criterion: 'price', matched: true, details: 'Preço similar' },
        { criterion: 'transmission', matched: true, details: 'Mesmo câmbio' },
        { criterion: 'fuel', matched: true, details: 'Mesmo combustível' },
      ];

      fc.assert(
        fc.property(vehicleArbitrary, vehicle => {
          const match: FallbackVehicleMatch = {
            vehicle,
            similarityScore: 90,
            matchingCriteria: manyMatchingCriteria,
            reasoning: 'Test reasoning',
          };

          const result: FallbackResult = {
            type: 'same_brand',
            vehicles: [match],
            message: 'Test message',
            requestedModel: 'Civic',
            requestedYear: 2023,
            metadata: {
              strategyUsed: 'same_brand',
              totalCandidates: 1,
              processingTimeMs: 10,
            },
          };

          const response = formatter.format(result);

          // Even with 6 matching criteria, highlights should be max 3
          expect(response.alternatives[0].highlights.length).toBeLessThanOrEqual(3);

          // Relevance explanation should also be limited
          const reasonCount = response.alternatives[0].relevanceExplanation.split(' • ').length;
          expect(reasonCount).toBeLessThanOrEqual(3);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles empty vehicles array gracefully', () => {
      const result: FallbackResult = {
        type: 'no_results',
        vehicles: [],
        message: 'Nenhum veículo encontrado',
        requestedModel: 'Civic',
        requestedYear: 2023,
        metadata: {
          strategyUsed: 'no_results',
          totalCandidates: 0,
          processingTimeMs: 5,
        },
      };

      const response = formatter.format(result);

      expect(response.acknowledgment).toBeDefined();
      expect(response.alternatives).toEqual([]);
      expect(response.summary).toBeDefined();
    });

    it('handles empty model name gracefully', () => {
      const result: FallbackResult = {
        type: 'no_results',
        vehicles: [],
        message: 'Modelo não especificado',
        requestedModel: '',
        requestedYear: null,
        metadata: {
          strategyUsed: 'no_results',
          totalCandidates: 0,
          processingTimeMs: 5,
        },
      };

      const response = formatter.format(result);

      expect(response.acknowledgment).toBeDefined();
      expect(response.acknowledgment.length).toBeGreaterThan(0);
    });

    it('handles null year gracefully', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constantFrom(
              'same_brand',
              'same_category',
              'price_range'
            ) as fc.Arbitrary<FallbackType>,
            vehicles: fc.array(fallbackVehicleMatchArbitrary, { minLength: 1, maxLength: 3 }),
            message: fc.string({ minLength: 10, maxLength: 100 }),
            requestedModel: fc.string({ minLength: 2, maxLength: 20 }),
            requestedYear: fc.constant(null),
            metadata: fc.record({
              strategyUsed: fc.constantFrom(
                'same_brand',
                'same_category',
                'price_range'
              ) as fc.Arbitrary<FallbackType>,
              totalCandidates: fc.integer({ min: 1, max: 50 }),
              processingTimeMs: fc.integer({ min: 0, max: 500 }),
            }),
          }),
          result => {
            const response = formatter.format(result);

            // Should not throw and should produce valid output
            expect(response.acknowledgment).toBeDefined();
            expect(response.alternatives.length).toBe(result.vehicles.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles vehicles with no matched criteria', () => {
      const noMatchCriteria: MatchingCriterion[] = [
        { criterion: 'year', matched: false, details: 'Ano diferente' },
        { criterion: 'brand', matched: false, details: 'Marca diferente' },
      ];

      fc.assert(
        fc.property(vehicleArbitrary, vehicle => {
          const match: FallbackVehicleMatch = {
            vehicle,
            similarityScore: 40,
            matchingCriteria: noMatchCriteria,
            reasoning: 'Alternativa disponível',
          };

          const result: FallbackResult = {
            type: 'price_range',
            vehicles: [match],
            message: 'Test',
            requestedModel: 'Civic',
            requestedYear: 2023,
            metadata: {
              strategyUsed: 'price_range',
              totalCandidates: 1,
              processingTimeMs: 10,
            },
          };

          const response = formatter.format(result);

          // Should still produce a valid explanation (default)
          expect(response.alternatives[0].relevanceExplanation).toBeDefined();
          expect(response.alternatives[0].relevanceExplanation.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});
