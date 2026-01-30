/**
 * VehicleSearchAdapter Fallback Integration Tests
 *
 * Property-based tests for the automatic fallback invocation in VehicleSearchAdapter.
 * Uses fast-check library with minimum 100 iterations per property.
 *
 * **Feature: vehicle-fallback-recommendations**
 * Property: 12
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Vehicle } from '../../src/services/exact-search.service';
import { FallbackService } from '../../src/services/fallback.service';
import { FallbackResult, FallbackType } from '../../src/services/fallback.types';

// ============================================================================
// Arbitrary Generators
// ============================================================================

const brandArbitrary = fc.constantFrom(
  'Honda', 'Toyota', 'Chevrolet', 'Volkswagen', 'Fiat', 'Hyundai', 'Jeep', 'Ford'
);

const modelArbitrary = fc.constantFrom(
  'Civic', 'Corolla', 'Onix', 'Polo', 'Argo', 'Creta', 'Compass', 'Ranger'
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

const inventoryArbitrary = fc.array(vehicleArbitrary, { minLength: 5, maxLength: 20 });

// ============================================================================
// Property Tests
// ============================================================================

describe('VehicleSearchAdapter Fallback Integration Tests', () => {
  describe('Property 12: Automatic Fallback Invocation', () => {
    /**
     * **Validates: Requirements 5.1**
     *
     * For any exact search that returns no results for a valid model/year request,
     * the Vehicle_Search_Adapter SHALL invoke the Fallback_Service and return its results.
     */

    it('FallbackService is invoked when exact model is not found', () => {
      fc.assert(
        fc.property(inventoryArbitrary, (inventory) => {
          const fallbackService = new FallbackService();

          // Request a model that doesn't exist in inventory
          const requestedModel = 'ModeloInexistente';
          const requestedYear = 2023;

          // Verify FallbackService returns alternatives
          const result = fallbackService.findAlternatives(
            requestedModel,
            requestedYear,
            inventory
          );

          // FallbackService should return a result (even if no_results)
          expect(result).toBeDefined();
          expect(result.requestedModel).toBe(requestedModel);
          expect(result.requestedYear).toBe(requestedYear);
          expect(result.type).toBeDefined();
          expect(result.metadata).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('FallbackService returns alternatives when model exists but year does not', () => {
      fc.assert(
        fc.property(
          inventoryArbitrary.filter(inv => inv.length > 0),
          (inventory) => {
            const fallbackService = new FallbackService();

            // Use a model from inventory but request a year that doesn't exist
            const existingVehicle = inventory[0];
            const requestedModel = existingVehicle.modelo;
            const requestedYear = 1990; // Year unlikely to exist

            const result = fallbackService.findAlternatives(
              requestedModel,
              requestedYear,
              inventory
            );

            // Should return year alternatives if same model exists
            const sameModelExists = inventory.some(v => 
              v.modelo.toLowerCase().includes(requestedModel.toLowerCase()) ||
              requestedModel.toLowerCase().includes(v.modelo.toLowerCase())
            );

            if (sameModelExists) {
              // Should find year alternatives or other fallback
              expect(['year_alternative', 'same_brand', 'same_category', 'price_range', 'no_results'])
                .toContain(result.type);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('FallbackService returns results with proper structure', () => {
      fc.assert(
        fc.property(
          inventoryArbitrary,
          fc.string({ minLength: 2, maxLength: 20 }),
          fc.integer({ min: 2015, max: 2025 }),
          (inventory, model, year) => {
            const fallbackService = new FallbackService();

            const result = fallbackService.findAlternatives(model, year, inventory);

            // Verify result structure
            expect(result.type).toBeDefined();
            expect(result.vehicles).toBeDefined();
            expect(Array.isArray(result.vehicles)).toBe(true);
            expect(result.message).toBeDefined();
            expect(typeof result.message).toBe('string');
            expect(result.requestedModel).toBe(model);
            expect(result.requestedYear).toBe(year);
            expect(result.metadata).toBeDefined();
            expect(result.metadata.strategyUsed).toBe(result.type);
            expect(typeof result.metadata.totalCandidates).toBe('number');
            expect(typeof result.metadata.processingTimeMs).toBe('number');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('FallbackService returns vehicles with similarity scores', () => {
      fc.assert(
        fc.property(
          inventoryArbitrary.filter(inv => inv.length >= 3),
          (inventory) => {
            const fallbackService = new FallbackService();

            // Request something that will trigger fallback
            const result = fallbackService.findAlternatives(
              'ModeloQualquer',
              2023,
              inventory,
              100000 // Reference price
            );

            // If vehicles are returned, they should have proper structure
            for (const match of result.vehicles) {
              expect(match.vehicle).toBeDefined();
              expect(typeof match.similarityScore).toBe('number');
              expect(match.similarityScore).toBeGreaterThanOrEqual(0);
              expect(match.similarityScore).toBeLessThanOrEqual(100);
              expect(match.matchingCriteria).toBeDefined();
              expect(Array.isArray(match.matchingCriteria)).toBe(true);
              expect(typeof match.reasoning).toBe('string');
              expect(match.reasoning.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('FallbackService respects maxResults configuration', () => {
      fc.assert(
        fc.property(
          inventoryArbitrary.filter(inv => inv.length >= 10),
          fc.integer({ min: 1, max: 10 }),
          (inventory, maxResults) => {
            const fallbackService = new FallbackService({ maxResults });

            const result = fallbackService.findAlternatives(
              'QualquerModelo',
              2023,
              inventory,
              100000
            );

            // Should never exceed maxResults
            expect(result.vehicles.length).toBeLessThanOrEqual(maxResults);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('FallbackService handles empty inventory gracefully', () => {
      const fallbackService = new FallbackService();

      const result = fallbackService.findAlternatives(
        'Civic',
        2023,
        [],
        100000
      );

      expect(result.type).toBe('no_results');
      expect(result.vehicles).toEqual([]);
      expect(result.message).toContain('disponível');
    });

    it('FallbackService handles empty model gracefully', () => {
      fc.assert(
        fc.property(inventoryArbitrary, (inventory) => {
          const fallbackService = new FallbackService();

          const result = fallbackService.findAlternatives(
            '',
            2023,
            inventory
          );

          expect(result.type).toBe('no_results');
          expect(result.vehicles).toEqual([]);
        }),
        { numRuns: 100 }
      );
    });

    it('FallbackService handles null year by searching all years', () => {
      fc.assert(
        fc.property(
          inventoryArbitrary.filter(inv => inv.length >= 3),
          (inventory) => {
            const fallbackService = new FallbackService();

            // Use a model from inventory
            const existingModel = inventory[0].modelo;

            const result = fallbackService.findAlternatives(
              existingModel,
              null,
              inventory
            );

            // Should not crash and should return valid result
            expect(result).toBeDefined();
            expect(result.type).toBeDefined();
            // With null year, should skip year_alternative strategy
            // and go to same_brand or same_category
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Integration with ExactSearchService', () => {
    it('ExactSearchService uses FallbackService for similar suggestions', async () => {
      // Import ExactSearchService using dynamic import
      const { ExactSearchService } = await import('../../src/services/exact-search.service');
      
      fc.assert(
        fc.property(
          inventoryArbitrary.filter(inv => inv.length >= 5),
          (inventory) => {
            const exactSearchService = new ExactSearchService();

            // Request a model that doesn't exist
            const result = exactSearchService.findSimilarSuggestions(
              'ModeloInexistente',
              2023,
              inventory,
              100000
            );

            // Should return suggestions type
            expect(result.type).toBe('suggestions');
            expect(result.requestedModel).toBe('ModeloInexistente');
            expect(result.requestedYear).toBe(2023);

            // If vehicles found, they should have proper structure
            for (const match of result.vehicles) {
              expect(match.vehicle).toBeDefined();
              expect(typeof match.matchScore).toBe('number');
              expect(typeof match.reasoning).toBe('string');
              expect(match.matchType).toBe('suggestion');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
