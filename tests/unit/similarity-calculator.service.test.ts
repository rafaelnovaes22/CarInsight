/**
 * Property-Based Tests for SimilarityCalculator Service
 *
 * **Feature: vehicle-fallback-recommendations**
 * Tests Property 6 from the design document
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  SimilarityCalculator,
  SimilarityResult,
} from '../../src/services/similarity-calculator.service';
import { Vehicle } from '../../src/services/exact-search.service';
import { SimilarityCriteria, SimilarityWeights } from '../../src/services/fallback.types';
import { VehicleCategory } from '../../src/services/vehicle-profiles';

// ============================================================================
// Generators for property-based testing
// ============================================================================

/**
 * Generator for valid vehicle categories
 */
const categoryGenerator = fc.constantFrom<VehicleCategory>(
  'sedan',
  'suv',
  'hatch',
  'pickup',
  'minivan'
);

/**
 * Generator for valid brands
 */
const brandGenerator = fc.constantFrom(
  'Honda',
  'Toyota',
  'Chevrolet',
  'Volkswagen',
  'Fiat',
  'Hyundai',
  'Nissan',
  'Ford',
  'Jeep',
  'Renault'
);

/**
 * Generator for valid model names
 */
const modelGenerator = fc.constantFrom(
  'Civic',
  'Corolla',
  'Onix',
  'Polo',
  'Argo',
  'Creta',
  'Tracker',
  'Compass',
  'HB20',
  'Kicks'
);

/**
 * Generator for vehicle prices (reasonable range in BRL)
 */
const priceGenerator = fc.integer({ min: 50000, max: 300000 });

/**
 * Generator for vehicle years
 */
const yearGenerator = fc.integer({ min: 2015, max: 2025 });

/**
 * Generator for vehicle mileage
 */
const mileageGenerator = fc.integer({ min: 0, max: 200000 });

/**
 * Generator for transmission types
 */
const transmissionGenerator = fc.constantFrom('Manual', 'Automático', 'CVT');

/**
 * Generator for fuel types
 */
const fuelGenerator = fc.constantFrom('Flex', 'Gasolina', 'Diesel', 'Elétrico');

/**
 * Maps category to body type string (as stored in Vehicle)
 */
function categoryToBodyType(category: VehicleCategory): string {
  const mapping: Record<VehicleCategory, string> = {
    sedan: 'Sedan',
    suv: 'SUV',
    hatch: 'Hatch',
    pickup: 'Pickup',
    minivan: 'Minivan',
  };
  return mapping[category];
}

/**
 * Generator for a single vehicle with specific attributes
 */
const vehicleGenerator = (
  overrides?: Partial<{
    category: VehicleCategory;
    brand: string;
    price: number;
    transmission: string;
    fuel: string;
  }>
): fc.Arbitrary<Vehicle> =>
  fc.record({
    id: fc.uuid(),
    marca: overrides?.brand ? fc.constant(overrides.brand) : brandGenerator,
    modelo: modelGenerator,
    versao: fc.constantFrom('LT', 'LTZ', 'EX', 'EXL', null),
    ano: yearGenerator,
    km: mileageGenerator,
    preco: overrides?.price !== undefined ? fc.constant(overrides.price) : priceGenerator,
    cor: fc.constantFrom('Branco', 'Preto', 'Prata', 'Vermelho'),
    carroceria: overrides?.category
      ? fc.constant(categoryToBodyType(overrides.category))
      : categoryGenerator.map(categoryToBodyType),
    combustivel: overrides?.fuel ? fc.constant(overrides.fuel) : fuelGenerator,
    cambio: overrides?.transmission ? fc.constant(overrides.transmission) : transmissionGenerator,
    disponivel: fc.constant(true),
    fotoUrl: fc.constant(null),
    url: fc.constant(null),
  });

/**
 * Generator for similarity criteria
 */
const criteriaGenerator = (
  overrides?: Partial<SimilarityCriteria>
): fc.Arbitrary<SimilarityCriteria> =>
  fc.record({
    targetCategory: overrides?.targetCategory
      ? fc.constant(overrides.targetCategory)
      : categoryGenerator,
    targetBrand:
      overrides?.targetBrand !== undefined
        ? fc.constant(overrides.targetBrand)
        : fc.option(brandGenerator, { nil: undefined }),
    targetPrice:
      overrides?.targetPrice !== undefined ? fc.constant(overrides.targetPrice) : priceGenerator,
    targetYear: fc.option(yearGenerator, { nil: undefined }),
    targetTransmission:
      overrides?.targetTransmission !== undefined
        ? fc.constant(overrides.targetTransmission)
        : fc.option(transmissionGenerator, { nil: undefined }),
    targetFuel:
      overrides?.targetFuel !== undefined
        ? fc.constant(overrides.targetFuel)
        : fc.option(fuelGenerator, { nil: undefined }),
  });

/**
 * Counts the number of matching criteria between a vehicle and criteria
 */
function countMatchingCriteria(result: SimilarityResult): number {
  return result.matchingCriteria.filter(c => c.matched).length;
}

// ============================================================================
// Property 6: Similarity Score Monotonicity
// ============================================================================

describe('SimilarityCalculator Property Tests', () => {
  const calculator = new SimilarityCalculator();

  /**
   * **Feature: vehicle-fallback-recommendations, Property 6: Similarity Score Monotonicity**
   * **Validates: Requirements 2.5, 2.6**
   *
   * For any two vehicles being compared for similarity, the vehicle with more
   * matching criteria (category, brand, price range, transmission, fuel) SHALL
   * have a higher or equal similarity score.
   */
  describe('Property 6: Similarity Score Monotonicity', () => {
    it('vehicle with more matching criteria has higher or equal score', () => {
      fc.assert(
        fc.property(
          // Generate a target criteria with all fields specified
          categoryGenerator,
          brandGenerator,
          priceGenerator,
          transmissionGenerator,
          fuelGenerator,
          (targetCategory, targetBrand, targetPrice, targetTransmission, targetFuel) => {
            const criteria: SimilarityCriteria = {
              targetCategory,
              targetBrand,
              targetPrice,
              targetTransmission,
              targetFuel,
            };

            // Vehicle A: matches ALL criteria
            const vehicleA: Vehicle = {
              id: 'vehicle-a',
              marca: targetBrand,
              modelo: 'TestModel',
              versao: 'LT',
              ano: 2022,
              km: 50000,
              preco: targetPrice, // Exact price match
              cor: 'Branco',
              carroceria: categoryToBodyType(targetCategory),
              combustivel: targetFuel,
              cambio: targetTransmission,
              disponivel: true,
              fotoUrl: null,
              url: null,
            };

            // Vehicle B: matches FEWER criteria (different brand)
            const vehicleB: Vehicle = {
              ...vehicleA,
              id: 'vehicle-b',
              marca: targetBrand === 'Honda' ? 'Toyota' : 'Honda', // Different brand
            };

            const resultA = calculator.calculate(vehicleA, criteria);
            const resultB = calculator.calculate(vehicleB, criteria);

            const matchCountA = countMatchingCriteria(resultA);
            const matchCountB = countMatchingCriteria(resultB);

            // Vehicle A should have more matches
            expect(matchCountA).toBeGreaterThan(matchCountB);

            // Vehicle A should have higher or equal score
            expect(resultA.score).toBeGreaterThanOrEqual(resultB.score);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('adding a matching criterion never decreases the score', () => {
      fc.assert(
        fc.property(
          categoryGenerator,
          brandGenerator,
          priceGenerator,
          (targetCategory, targetBrand, targetPrice) => {
            // Criteria without transmission/fuel
            const criteriaBasic: SimilarityCriteria = {
              targetCategory,
              targetBrand,
              targetPrice,
            };

            // Criteria with transmission
            const criteriaWithTransmission: SimilarityCriteria = {
              ...criteriaBasic,
              targetTransmission: 'Automático',
            };

            // Vehicle that matches category, brand, price, AND transmission
            const vehicle: Vehicle = {
              id: 'test-vehicle',
              marca: targetBrand,
              modelo: 'TestModel',
              versao: 'LT',
              ano: 2022,
              km: 50000,
              preco: targetPrice,
              cor: 'Branco',
              carroceria: categoryToBodyType(targetCategory),
              combustivel: 'Flex',
              cambio: 'Automático', // Matches the transmission criteria
              disponivel: true,
              fotoUrl: null,
              url: null,
            };

            const resultBasic = calculator.calculate(vehicle, criteriaBasic);
            const resultWithTransmission = calculator.calculate(vehicle, criteriaWithTransmission);

            // Adding a matching criterion should not decrease the score
            // (it may increase or stay the same depending on weight distribution)
            expect(resultWithTransmission.score).toBeGreaterThanOrEqual(resultBasic.score);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('category match contributes significantly to score', () => {
      fc.assert(
        fc.property(
          categoryGenerator,
          brandGenerator,
          priceGenerator,
          (targetCategory, targetBrand, targetPrice) => {
            const criteria: SimilarityCriteria = {
              targetCategory,
              targetBrand,
              targetPrice,
            };

            // Vehicle with matching category
            const vehicleMatchingCategory: Vehicle = {
              id: 'matching-category',
              marca: targetBrand === 'Honda' ? 'Toyota' : 'Honda', // Different brand
              modelo: 'TestModel',
              versao: 'LT',
              ano: 2022,
              km: 50000,
              preco: targetPrice * 2, // Price outside tolerance
              cor: 'Branco',
              carroceria: categoryToBodyType(targetCategory), // Matching category
              combustivel: 'Flex',
              cambio: 'Manual',
              disponivel: true,
              fotoUrl: null,
              url: null,
            };

            // Vehicle with non-matching category
            const differentCategory = targetCategory === 'sedan' ? 'suv' : 'sedan';
            const vehicleNonMatchingCategory: Vehicle = {
              ...vehicleMatchingCategory,
              id: 'non-matching-category',
              carroceria: categoryToBodyType(differentCategory as VehicleCategory),
            };

            const resultMatching = calculator.calculate(vehicleMatchingCategory, criteria);
            const resultNonMatching = calculator.calculate(vehicleNonMatchingCategory, criteria);

            // Category match should result in higher score
            expect(resultMatching.score).toBeGreaterThan(resultNonMatching.score);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('price within tolerance scores higher than price outside tolerance', () => {
      fc.assert(
        fc.property(
          categoryGenerator,
          priceGenerator.filter(p => p >= 60000 && p <= 250000), // Ensure room for tolerance
          (targetCategory, targetPrice) => {
            const criteria: SimilarityCriteria = {
              targetCategory,
              targetPrice,
            };

            // Vehicle with price within 20% tolerance
            const priceWithinTolerance = targetPrice; // Exact match
            const vehicleWithinTolerance: Vehicle = {
              id: 'within-tolerance',
              marca: 'Honda',
              modelo: 'TestModel',
              versao: 'LT',
              ano: 2022,
              km: 50000,
              preco: priceWithinTolerance,
              cor: 'Branco',
              carroceria: categoryToBodyType(targetCategory),
              combustivel: 'Flex',
              cambio: 'Manual',
              disponivel: true,
              fotoUrl: null,
              url: null,
            };

            // Vehicle with price outside tolerance (50% higher)
            const priceOutsideTolerance = Math.round(targetPrice * 1.5);
            const vehicleOutsideTolerance: Vehicle = {
              ...vehicleWithinTolerance,
              id: 'outside-tolerance',
              preco: priceOutsideTolerance,
            };

            const resultWithin = calculator.calculate(vehicleWithinTolerance, criteria);
            const resultOutside = calculator.calculate(vehicleOutsideTolerance, criteria);

            // Price within tolerance should score higher
            expect(resultWithin.score).toBeGreaterThan(resultOutside.score);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('matching all criteria produces maximum possible score', () => {
      fc.assert(
        fc.property(
          categoryGenerator,
          brandGenerator,
          priceGenerator,
          transmissionGenerator,
          fuelGenerator,
          (targetCategory, targetBrand, targetPrice, targetTransmission, targetFuel) => {
            const criteria: SimilarityCriteria = {
              targetCategory,
              targetBrand,
              targetPrice,
              targetTransmission,
              targetFuel,
            };

            // Vehicle that matches ALL criteria perfectly
            const perfectMatch: Vehicle = {
              id: 'perfect-match',
              marca: targetBrand,
              modelo: 'TestModel',
              versao: 'LT',
              ano: 2022,
              km: 50000,
              preco: targetPrice,
              cor: 'Branco',
              carroceria: categoryToBodyType(targetCategory),
              combustivel: targetFuel,
              cambio: targetTransmission,
              disponivel: true,
              fotoUrl: null,
              url: null,
            };

            const result = calculator.calculate(perfectMatch, criteria);

            // All criteria should be matched
            const allMatched = result.matchingCriteria.every(c => c.matched);
            expect(allMatched).toBe(true);

            // Score should be 100 (maximum)
            expect(result.score).toBe(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('matching no criteria produces minimum score', () => {
      fc.assert(
        fc.property(
          categoryGenerator,
          brandGenerator,
          priceGenerator,
          transmissionGenerator,
          fuelGenerator,
          (targetCategory, targetBrand, targetPrice, targetTransmission, targetFuel) => {
            const criteria: SimilarityCriteria = {
              targetCategory,
              targetBrand,
              targetPrice,
              targetTransmission,
              targetFuel,
            };

            // Vehicle that matches NO criteria
            const differentCategory = targetCategory === 'sedan' ? 'pickup' : 'sedan';
            const differentBrand = targetBrand === 'Honda' ? 'Toyota' : 'Honda';
            const differentTransmission = targetTransmission === 'Manual' ? 'Automático' : 'Manual';
            const differentFuel = targetFuel === 'Flex' ? 'Diesel' : 'Flex';
            const differentPrice = targetPrice * 3; // Way outside tolerance

            const noMatch: Vehicle = {
              id: 'no-match',
              marca: differentBrand,
              modelo: 'TestModel',
              versao: 'LT',
              ano: 2022,
              km: 50000,
              preco: differentPrice,
              cor: 'Branco',
              carroceria: categoryToBodyType(differentCategory as VehicleCategory),
              combustivel: differentFuel,
              cambio: differentTransmission,
              disponivel: true,
              fotoUrl: null,
              url: null,
            };

            const result = calculator.calculate(noMatch, criteria);

            // No criteria should be matched
            const noneMatched = result.matchingCriteria.every(c => !c.matched);
            expect(noneMatched).toBe(true);

            // Score should be 0 (minimum)
            expect(result.score).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('score is always between 0 and 100', () => {
      fc.assert(
        fc.property(vehicleGenerator(), criteriaGenerator(), (vehicle, criteria) => {
          const result = calculator.calculate(vehicle, criteria);

          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);
        }),
        { numRuns: 100 }
      );
    });

    it('monotonicity holds when progressively adding matching criteria', () => {
      fc.assert(
        fc.property(
          categoryGenerator,
          brandGenerator,
          priceGenerator,
          transmissionGenerator,
          fuelGenerator,
          (targetCategory, targetBrand, targetPrice, targetTransmission, targetFuel) => {
            // Create a vehicle that matches all criteria
            const vehicle: Vehicle = {
              id: 'test-vehicle',
              marca: targetBrand,
              modelo: 'TestModel',
              versao: 'LT',
              ano: 2022,
              km: 50000,
              preco: targetPrice,
              cor: 'Branco',
              carroceria: categoryToBodyType(targetCategory),
              combustivel: targetFuel,
              cambio: targetTransmission,
              disponivel: true,
              fotoUrl: null,
              url: null,
            };

            // Test with progressively more criteria
            const criteriaLevels: SimilarityCriteria[] = [
              // Level 1: Only category
              { targetCategory, targetPrice: targetPrice * 3 }, // Price won't match
              // Level 2: Category + price
              { targetCategory, targetPrice },
              // Level 3: Category + price + brand
              { targetCategory, targetPrice, targetBrand },
              // Level 4: Category + price + brand + transmission
              { targetCategory, targetPrice, targetBrand, targetTransmission },
              // Level 5: All criteria
              { targetCategory, targetPrice, targetBrand, targetTransmission, targetFuel },
            ];

            const scores = criteriaLevels.map(
              criteria => calculator.calculate(vehicle, criteria).score
            );

            // Each level should have score >= previous level
            for (let i = 1; i < scores.length; i++) {
              expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Unit Tests for Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles empty brand in criteria', () => {
      const vehicle: Vehicle = {
        id: 'test',
        marca: 'Honda',
        modelo: 'Civic',
        versao: 'LT',
        ano: 2022,
        km: 50000,
        preco: 100000,
        cor: 'Branco',
        carroceria: 'Sedan',
        combustivel: 'Flex',
        cambio: 'Automático',
        disponivel: true,
        fotoUrl: null,
        url: null,
      };

      const criteria: SimilarityCriteria = {
        targetCategory: 'sedan',
        targetPrice: 100000,
        // No targetBrand specified
      };

      const result = calculator.calculate(vehicle, criteria);

      // Should not include brand in matching criteria
      const brandCriterion = result.matchingCriteria.find(c => c.criterion === 'brand');
      expect(brandCriterion).toBeUndefined();

      // Score should still be calculated
      expect(result.score).toBeGreaterThan(0);
    });

    it('handles zero target price gracefully', () => {
      const vehicle: Vehicle = {
        id: 'test',
        marca: 'Honda',
        modelo: 'Civic',
        versao: 'LT',
        ano: 2022,
        km: 50000,
        preco: 100000,
        cor: 'Branco',
        carroceria: 'Sedan',
        combustivel: 'Flex',
        cambio: 'Automático',
        disponivel: true,
        fotoUrl: null,
        url: null,
      };

      const criteria: SimilarityCriteria = {
        targetCategory: 'sedan',
        targetPrice: 0, // Edge case
      };

      const result = calculator.calculate(vehicle, criteria);

      // Price criterion should not match
      const priceCriterion = result.matchingCriteria.find(c => c.criterion === 'price');
      expect(priceCriterion?.matched).toBe(false);
    });

    it('normalizes category variations correctly', () => {
      const vehicle: Vehicle = {
        id: 'test',
        marca: 'Honda',
        modelo: 'Civic',
        versao: 'LT',
        ano: 2022,
        km: 50000,
        preco: 100000,
        cor: 'Branco',
        carroceria: 'Sedã', // Portuguese variation
        combustivel: 'Flex',
        cambio: 'Automático',
        disponivel: true,
        fotoUrl: null,
        url: null,
      };

      const criteria: SimilarityCriteria = {
        targetCategory: 'sedan', // English normalized
        targetPrice: 100000,
      };

      const result = calculator.calculate(vehicle, criteria);

      // Category should match after normalization
      const categoryCriterion = result.matchingCriteria.find(c => c.criterion === 'category');
      expect(categoryCriterion?.matched).toBe(true);
    });

    it('normalizes transmission variations correctly', () => {
      const vehicle: Vehicle = {
        id: 'test',
        marca: 'Honda',
        modelo: 'Civic',
        versao: 'LT',
        ano: 2022,
        km: 50000,
        preco: 100000,
        cor: 'Branco',
        carroceria: 'Sedan',
        combustivel: 'Flex',
        cambio: 'CVT', // Variation
        disponivel: true,
        fotoUrl: null,
        url: null,
      };

      const criteria: SimilarityCriteria = {
        targetCategory: 'sedan',
        targetPrice: 100000,
        targetTransmission: 'Automático', // Should match CVT
      };

      const result = calculator.calculate(vehicle, criteria);

      // Transmission should match (CVT is automatic)
      const transmissionCriterion = result.matchingCriteria.find(
        c => c.criterion === 'transmission'
      );
      expect(transmissionCriterion?.matched).toBe(true);
    });

    it('custom weights affect score calculation', () => {
      const customCalculator = new SimilarityCalculator({
        category: 80, // Double the default
        brand: 10,
        price: 5,
        features: 5,
      });

      const vehicle: Vehicle = {
        id: 'test',
        marca: 'Toyota', // Different brand
        modelo: 'Corolla',
        versao: 'LT',
        ano: 2022,
        km: 50000,
        preco: 200000, // Different price
        cor: 'Branco',
        carroceria: 'Sedan', // Matching category
        combustivel: 'Diesel', // Different fuel
        cambio: 'Manual', // Different transmission
        disponivel: true,
        fotoUrl: null,
        url: null,
      };

      const criteria: SimilarityCriteria = {
        targetCategory: 'sedan',
        targetBrand: 'Honda',
        targetPrice: 100000,
        targetTransmission: 'Automático',
        targetFuel: 'Flex',
      };

      const defaultResult = calculator.calculate(vehicle, criteria);
      const customResult = customCalculator.calculate(vehicle, criteria);

      // Custom calculator should give higher score because category weight is higher
      // and category is the only matching criterion
      expect(customResult.score).toBeGreaterThan(defaultResult.score);
    });
  });
});
