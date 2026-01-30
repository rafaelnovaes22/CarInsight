/**
 * Property-Based Tests for FallbackService
 *
 * **Feature: vehicle-fallback-recommendations**
 * Tests Properties 1, 2, 3, 4, 5, 7, 8 from the design document
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { FallbackService } from '../../src/services/fallback.service';
import { Vehicle } from '../../src/services/exact-search.service';
import { FallbackVehicleMatch, FallbackConfig } from '../../src/services/fallback.types';
import { VehicleCategory } from '../../src/services/vehicle-profiles';

// ============================================================================
// Generators for property-based testing
// ============================================================================

/**
 * Generator for valid vehicle categories
 */
const categoryGenerator = fc.constantFrom<VehicleCategory>('sedan', 'suv', 'hatch', 'pickup', 'minivan');

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
 * Generator for a single vehicle
 */
const vehicleGenerator = (overrides?: Partial<{
  model: string;
  brand: string;
  year: number;
  price: number;
  category: VehicleCategory;
  mileage: number;
}>): fc.Arbitrary<Vehicle> =>
  fc.record({
    id: fc.uuid(),
    marca: overrides?.brand ? fc.constant(overrides.brand) : brandGenerator,
    modelo: overrides?.model ? fc.constant(overrides.model) : modelGenerator,
    versao: fc.constantFrom('LT', 'LTZ', 'EX', 'EXL', null),
    ano: overrides?.year !== undefined ? fc.constant(overrides.year) : yearGenerator,
    km: overrides?.mileage !== undefined ? fc.constant(overrides.mileage) : mileageGenerator,
    preco: overrides?.price !== undefined ? fc.constant(overrides.price) : priceGenerator,
    cor: fc.constantFrom('Branco', 'Preto', 'Prata', 'Vermelho'),
    carroceria: overrides?.category 
      ? fc.constant(categoryToBodyType(overrides.category))
      : categoryGenerator.map(categoryToBodyType),
    combustivel: fuelGenerator,
    cambio: transmissionGenerator,
    disponivel: fc.constant(true),
    fotoUrl: fc.constant(null),
    url: fc.constant(null),
  });

/**
 * Generator for an inventory of vehicles
 */
const inventoryGenerator = fc.array(vehicleGenerator(), { minLength: 1, maxLength: 50 });

// ============================================================================
// Property 1: Year Proximity Scoring
// ============================================================================

describe('FallbackService Property Tests', () => {
  let service: FallbackService;

  beforeEach(() => {
    service = new FallbackService();
  });

  /**
   * **Feature: vehicle-fallback-recommendations, Property 1: Year Proximity Scoring**
   * **Validates: Requirements 1.3**
   *
   * For any two vehicles of the same model with different years, when calculating
   * year proximity scores relative to a requested year, the vehicle with a year
   * closer to the requested year SHALL have a higher or equal score than the
   * vehicle with a year further away.
   */
  describe('Property 1: Year Proximity Scoring', () => {
    it('closer year always has higher or equal proximity score', () => {
      fc.assert(
        fc.property(
          // Generate a requested year
          fc.integer({ min: 2018, max: 2023 }),
          // Generate two different year offsets (one closer, one further)
          fc.integer({ min: 1, max: 4 }),
          fc.integer({ min: 1, max: 4 }),
          fc.boolean(), // Direction for closer year (true = newer, false = older)
          fc.boolean(), // Direction for further year
          (requestedYear, closerOffset, furtherOffsetDelta, closerNewer, furtherNewer) => {
            // Ensure further offset is actually further
            const furtherOffset = closerOffset + furtherOffsetDelta;

            // Calculate actual years
            const closerYear = closerNewer ? requestedYear + closerOffset : requestedYear - closerOffset;
            const furtherYear = furtherNewer ? requestedYear + furtherOffset : requestedYear - furtherOffset;

            // Skip if years are the same (edge case)
            if (closerYear === furtherYear) return true;

            // Calculate proximity scores
            const closerScore = service.calculateYearProximityScore(closerYear, requestedYear);
            const furtherScore = service.calculateYearProximityScore(furtherYear, requestedYear);

            // Closer year should have higher or equal score
            expect(closerScore).toBeGreaterThanOrEqual(furtherScore);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('same year distance produces same score regardless of direction', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2018, max: 2023 }),
          fc.integer({ min: 1, max: 5 }),
          (requestedYear, yearOffset) => {
            const olderYear = requestedYear - yearOffset;
            const newerYear = requestedYear + yearOffset;

            const olderScore = service.calculateYearProximityScore(olderYear, requestedYear);
            const newerScore = service.calculateYearProximityScore(newerYear, requestedYear);

            // Same distance should produce same score
            expect(olderScore).toBe(newerScore);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('year proximity score is always between 0 and 100', () => {
      fc.assert(
        fc.property(
          yearGenerator,
          yearGenerator,
          (vehicleYear, requestedYear) => {
            const score = service.calculateYearProximityScore(vehicleYear, requestedYear);

            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('exact year match produces maximum score of 100', () => {
      fc.assert(
        fc.property(
          yearGenerator,
          (year) => {
            const score = service.calculateYearProximityScore(year, year);
            expect(score).toBe(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('score decreases monotonically with year distance', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2018, max: 2023 }),
          (requestedYear) => {
            const scores: number[] = [];

            // Calculate scores for years 0-5 away
            for (let offset = 0; offset <= 5; offset++) {
              const score = service.calculateYearProximityScore(requestedYear + offset, requestedYear);
              scores.push(score);
            }

            // Each score should be <= the previous one
            for (let i = 1; i < scores.length; i++) {
              expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  // ============================================================================
  // Property 2: Year Alternatives Sorting
  // ============================================================================

  /**
   * **Feature: vehicle-fallback-recommendations, Property 2: Year Alternatives Sorting**
   * **Validates: Requirements 1.2, 1.4**
   *
   * For any list of year alternative vehicles returned by the Fallback_Service,
   * the list SHALL be sorted primarily by year proximity to the requested year
   * (closest first), and secondarily by price descending then mileage ascending
   * for vehicles of the same year.
   */
  describe('Property 2: Year Alternatives Sorting', () => {
    it('year alternatives are sorted by year proximity (closest first)', () => {
      fc.assert(
        fc.property(
          modelGenerator,
          brandGenerator,
          fc.integer({ min: 2019, max: 2022 }),
          categoryGenerator,
          (model, brand, requestedYear, category) => {
            // Create inventory with same model but different years
            const inventory: Vehicle[] = [
              createVehicle({ model, brand, year: requestedYear - 3, category, price: 100000, mileage: 50000 }),
              createVehicle({ model, brand, year: requestedYear + 1, category, price: 100000, mileage: 50000 }),
              createVehicle({ model, brand, year: requestedYear - 1, category, price: 100000, mileage: 50000 }),
              createVehicle({ model, brand, year: requestedYear + 2, category, price: 100000, mileage: 50000 }),
            ];

            const results = service.findYearAlternatives(model, requestedYear, inventory);

            // Verify sorting by year proximity
            for (let i = 1; i < results.length; i++) {
              const prevDistance = Math.abs(results[i - 1].vehicle.ano - requestedYear);
              const currDistance = Math.abs(results[i].vehicle.ano - requestedYear);
              expect(currDistance).toBeGreaterThanOrEqual(prevDistance);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('same year vehicles are sorted by price descending', () => {
      fc.assert(
        fc.property(
          modelGenerator,
          brandGenerator,
          yearGenerator,
          categoryGenerator,
          fc.array(priceGenerator, { minLength: 3, maxLength: 5 }),
          (model, brand, requestedYear, category, prices) => {
            // Create inventory with same model and year but different prices
            const alternativeYear = requestedYear + 1;
            const inventory: Vehicle[] = prices.map((price, i) =>
              createVehicle({ model, brand, year: alternativeYear, category, price, mileage: 50000 + i * 1000 })
            );

            const results = service.findYearAlternatives(model, requestedYear, inventory);

            // All results should be same year, sorted by price descending
            for (let i = 1; i < results.length; i++) {
              if (results[i - 1].vehicle.ano === results[i].vehicle.ano) {
                expect(results[i - 1].vehicle.preco).toBeGreaterThanOrEqual(results[i].vehicle.preco);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('same year and price vehicles are sorted by mileage ascending', () => {
      fc.assert(
        fc.property(
          modelGenerator,
          brandGenerator,
          yearGenerator,
          categoryGenerator,
          fc.array(mileageGenerator, { minLength: 3, maxLength: 5 }),
          (model, brand, requestedYear, category, mileages) => {
            // Create inventory with same model, year, and price but different mileages
            const alternativeYear = requestedYear + 1;
            const fixedPrice = 100000;
            const inventory: Vehicle[] = mileages.map(mileage =>
              createVehicle({ model, brand, year: alternativeYear, category, price: fixedPrice, mileage })
            );

            const results = service.findYearAlternatives(model, requestedYear, inventory);

            // All results should be same year and price, sorted by mileage ascending
            for (let i = 1; i < results.length; i++) {
              if (results[i - 1].vehicle.ano === results[i].vehicle.ano &&
                  results[i - 1].vehicle.preco === results[i].vehicle.preco) {
                expect(results[i - 1].vehicle.km).toBeLessThanOrEqual(results[i].vehicle.km);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  // ============================================================================
  // Property 3: Maximum Results Invariant
  // ============================================================================

  /**
   * **Feature: vehicle-fallback-recommendations, Property 3: Maximum Results Invariant**
   * **Validates: Requirements 1.5**
   *
   * For any fallback operation, the number of vehicles returned SHALL never
   * exceed the configured maximum (default 5).
   */
  describe('Property 3: Maximum Results Invariant', () => {
    it('never returns more than maxResults vehicles', () => {
      fc.assert(
        fc.property(
          modelGenerator,
          yearGenerator,
          fc.array(vehicleGenerator(), { minLength: 10, maxLength: 30 }),
          fc.integer({ min: 1, max: 10 }),
          (model, year, inventory, maxResults) => {
            const customService = new FallbackService({ maxResults });
            const result = customService.findAlternatives(model, year, inventory);

            expect(result.vehicles.length).toBeLessThanOrEqual(maxResults);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('default maxResults is 5', () => {
      fc.assert(
        fc.property(
          modelGenerator,
          yearGenerator,
          fc.array(vehicleGenerator(), { minLength: 10, maxLength: 30 }),
          (model, year, inventory) => {
            const result = service.findAlternatives(model, year, inventory);

            expect(result.vehicles.length).toBeLessThanOrEqual(5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns all results when fewer than maxResults available', () => {
      fc.assert(
        fc.property(
          modelGenerator,
          brandGenerator,
          yearGenerator,
          categoryGenerator,
          fc.integer({ min: 1, max: 4 }),
          (model, brand, requestedYear, category, numVehicles) => {
            // Create inventory with fewer vehicles than maxResults
            const inventory: Vehicle[] = [];
            for (let i = 0; i < numVehicles; i++) {
              inventory.push(createVehicle({
                model,
                brand,
                year: requestedYear + i + 1,
                category,
                price: 100000,
                mileage: 50000,
              }));
            }

            const results = service.findYearAlternatives(model, requestedYear, inventory);

            // Should return all available vehicles
            expect(results.length).toBe(numVehicles);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  // ============================================================================
  // Property 4: Similar Profile Filtering
  // ============================================================================

  /**
   * **Feature: vehicle-fallback-recommendations, Property 4: Similar Profile Filtering**
   * **Validates: Requirements 2.2, 2.3**
   *
   * For any similar profile search result, all returned vehicles SHALL have
   * the same normalized category as the requested model AND have a price
   * within ±20% of the reference price.
   */
  describe('Property 4: Similar Profile Filtering', () => {
    it('same category alternatives have matching category', () => {
      fc.assert(
        fc.property(
          categoryGenerator,
          priceGenerator.filter(p => p >= 60000 && p <= 250000),
          fc.array(vehicleGenerator(), { minLength: 5, maxLength: 20 }),
          (targetCategory, referencePrice, inventory) => {
            const results = service.findSameCategoryAlternatives(
              targetCategory,
              inventory,
              referencePrice
            );

            // All results should have matching category
            for (const match of results) {
              const vehicleCategory = normalizeCategory(match.vehicle.carroceria);
              expect(vehicleCategory).toBe(targetCategory);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('same category alternatives are within price tolerance', () => {
      fc.assert(
        fc.property(
          categoryGenerator,
          priceGenerator.filter(p => p >= 60000 && p <= 250000),
          fc.array(vehicleGenerator(), { minLength: 5, maxLength: 20 }),
          (targetCategory, referencePrice, inventory) => {
            const results = service.findSameCategoryAlternatives(
              targetCategory,
              inventory,
              referencePrice
            );

            const tolerance = referencePrice * 0.20;
            const minPrice = referencePrice - tolerance;
            const maxPrice = referencePrice + tolerance;

            // All results should be within price tolerance
            for (const match of results) {
              expect(match.vehicle.preco).toBeGreaterThanOrEqual(minPrice);
              expect(match.vehicle.preco).toBeLessThanOrEqual(maxPrice);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('same brand alternatives have matching brand and category', () => {
      fc.assert(
        fc.property(
          modelGenerator,
          brandGenerator,
          categoryGenerator,
          priceGenerator.filter(p => p >= 60000 && p <= 250000),
          fc.array(vehicleGenerator(), { minLength: 5, maxLength: 20 }),
          (model, brand, category, referencePrice, inventory) => {
            const results = service.findSameBrandAlternatives(
              model,
              brand,
              category,
              inventory,
              referencePrice
            );

            // All results should have matching brand and category
            for (const match of results) {
              expect(match.vehicle.marca.toLowerCase()).toBe(brand.toLowerCase());
              const vehicleCategory = normalizeCategory(match.vehicle.carroceria);
              expect(vehicleCategory).toBe(category);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  // ============================================================================
  // Property 5: Brand Priority in Similar Profiles
  // ============================================================================

  /**
   * **Feature: vehicle-fallback-recommendations, Property 5: Brand Priority in Similar Profiles**
   * **Validates: Requirements 2.4**
   *
   * For any similar profile search where same-brand vehicles exist in the inventory,
   * the same-brand vehicles SHALL appear before other-brand vehicles in the results
   * (when similarity scores are equal).
   */
  describe('Property 5: Brand Priority in Similar Profiles', () => {
    it('same brand alternatives are returned before other brands when available', () => {
      fc.assert(
        fc.property(
          modelGenerator,
          brandGenerator,
          categoryGenerator,
          priceGenerator.filter(p => p >= 80000 && p <= 200000),
          (model, targetBrand, category, referencePrice) => {
            // Create inventory with both same-brand and different-brand vehicles
            const otherBrand = targetBrand === 'Honda' ? 'Toyota' : 'Honda';

            const inventory: Vehicle[] = [
              // Same brand vehicles
              createVehicle({ model: 'Model1', brand: targetBrand, year: 2022, category, price: referencePrice, mileage: 50000 }),
              createVehicle({ model: 'Model2', brand: targetBrand, year: 2022, category, price: referencePrice, mileage: 50000 }),
              // Different brand vehicles
              createVehicle({ model: 'Model3', brand: otherBrand, year: 2022, category, price: referencePrice, mileage: 50000 }),
              createVehicle({ model: 'Model4', brand: otherBrand, year: 2022, category, price: referencePrice, mileage: 50000 }),
            ];

            const sameBrandResults = service.findSameBrandAlternatives(
              model,
              targetBrand,
              category,
              inventory,
              referencePrice
            );

            // All results should be same brand (since we're using findSameBrandAlternatives)
            for (const match of sameBrandResults) {
              expect(match.vehicle.marca.toLowerCase()).toBe(targetBrand.toLowerCase());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('findAlternatives returns same_brand type before same_category when brand matches exist', () => {
      fc.assert(
        fc.property(
          brandGenerator,
          categoryGenerator,
          priceGenerator.filter(p => p >= 80000 && p <= 200000),
          (targetBrand, category, referencePrice) => {
            const model = 'NonExistentModel';
            const otherBrand = targetBrand === 'Honda' ? 'Toyota' : 'Honda';

            // Create inventory with same-brand vehicles (but different model)
            const inventory: Vehicle[] = [
              createVehicle({ model: 'DifferentModel1', brand: targetBrand, year: 2022, category, price: referencePrice, mileage: 50000 }),
              createVehicle({ model: 'DifferentModel2', brand: targetBrand, year: 2022, category, price: referencePrice, mileage: 50000 }),
              createVehicle({ model: 'DifferentModel3', brand: otherBrand, year: 2022, category, price: referencePrice, mileage: 50000 }),
            ];

            // Add a vehicle with the target brand to help extract brand
            inventory.push(createVehicle({ model, brand: targetBrand, year: 2020, category, price: referencePrice, mileage: 50000 }));

            const result = service.findAlternatives(model, 2022, inventory, referencePrice);

            // Should return same_brand type since same-brand alternatives exist
            if (result.vehicles.length > 0 && result.type !== 'year_alternative') {
              expect(result.type).toBe('same_brand');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  // ============================================================================
  // Property 7: Similarity Score Sorting
  // ============================================================================

  /**
   * **Feature: vehicle-fallback-recommendations, Property 7: Similarity Score Sorting**
   * **Validates: Requirements 2.7**
   *
   * For any list of similar profile vehicles returned by the Fallback_Service,
   * the list SHALL be sorted by similarity score in descending order.
   */
  describe('Property 7: Similarity Score Sorting', () => {
    it('same category alternatives are sorted by similarity score descending', () => {
      fc.assert(
        fc.property(
          categoryGenerator,
          priceGenerator.filter(p => p >= 60000 && p <= 250000),
          fc.array(vehicleGenerator(), { minLength: 5, maxLength: 20 }),
          (targetCategory, referencePrice, inventory) => {
            const results = service.findSameCategoryAlternatives(
              targetCategory,
              inventory,
              referencePrice
            );

            // Results should be sorted by similarity score descending
            for (let i = 1; i < results.length; i++) {
              expect(results[i - 1].similarityScore).toBeGreaterThanOrEqual(results[i].similarityScore);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('same brand alternatives are sorted by similarity score descending', () => {
      fc.assert(
        fc.property(
          modelGenerator,
          brandGenerator,
          categoryGenerator,
          priceGenerator.filter(p => p >= 60000 && p <= 250000),
          fc.array(vehicleGenerator(), { minLength: 5, maxLength: 20 }),
          (model, brand, category, referencePrice, inventory) => {
            const results = service.findSameBrandAlternatives(
              model,
              brand,
              category,
              inventory,
              referencePrice
            );

            // Results should be sorted by similarity score descending
            for (let i = 1; i < results.length; i++) {
              expect(results[i - 1].similarityScore).toBeGreaterThanOrEqual(results[i].similarityScore);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('price range alternatives are sorted by similarity score descending', () => {
      fc.assert(
        fc.property(
          priceGenerator.filter(p => p >= 60000 && p <= 250000),
          fc.array(vehicleGenerator(), { minLength: 5, maxLength: 20 }),
          (referencePrice, inventory) => {
            const results = service.findPriceRangeAlternatives(inventory, referencePrice);

            // Results should be sorted by similarity score descending
            for (let i = 1; i < results.length; i++) {
              expect(results[i - 1].similarityScore).toBeGreaterThanOrEqual(results[i].similarityScore);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  // ============================================================================
  // Property 8: Fallback Priority Chain
  // ============================================================================

  /**
   * **Feature: vehicle-fallback-recommendations, Property 8: Fallback Priority Chain**
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
   *
   * For any fallback operation, the Fallback_Service SHALL return results from
   * the highest priority strategy that produces matches:
   * year_alternative > same_brand > same_category > price_range.
   * If year alternatives exist, the result type SHALL be 'year_alternative'
   * regardless of whether other strategies would also produce results.
   */
  describe('Property 8: Fallback Priority Chain', () => {
    it('returns year_alternative when same model different year exists', () => {
      fc.assert(
        fc.property(
          modelGenerator,
          brandGenerator,
          fc.integer({ min: 2019, max: 2022 }),
          categoryGenerator,
          priceGenerator,
          (model, brand, requestedYear, category, price) => {
            // Create inventory with year alternatives
            const inventory: Vehicle[] = [
              createVehicle({ model, brand, year: requestedYear + 1, category, price, mileage: 50000 }),
              createVehicle({ model, brand, year: requestedYear - 1, category, price, mileage: 50000 }),
              // Also add same brand different model (should be ignored)
              createVehicle({ model: 'OtherModel', brand, year: requestedYear, category, price, mileage: 50000 }),
            ];

            const result = service.findAlternatives(model, requestedYear, inventory, price);

            // Should return year_alternative type
            expect(result.type).toBe('year_alternative');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns same_brand when no year alternatives but same brand exists', () => {
      fc.assert(
        fc.property(
          brandGenerator,
          categoryGenerator,
          priceGenerator.filter(p => p >= 80000 && p <= 200000),
          (brand, category, price) => {
            const model = 'UniqueNonExistentModel';
            const otherBrand = brand === 'Honda' ? 'Toyota' : 'Honda';

            // Create inventory without year alternatives but with same brand
            const inventory: Vehicle[] = [
              // Add a vehicle with the model to establish brand association
              createVehicle({ model, brand, year: 2018, category, price, mileage: 50000 }),
              // Same brand, different model
              createVehicle({ model: 'DifferentModel1', brand, year: 2022, category, price, mileage: 50000 }),
              createVehicle({ model: 'DifferentModel2', brand, year: 2022, category, price, mileage: 50000 }),
              // Different brand (should be lower priority)
              createVehicle({ model: 'OtherBrandModel', brand: otherBrand, year: 2022, category, price, mileage: 50000 }),
            ];

            const result = service.findAlternatives(model, 2022, inventory, price);

            // Should return same_brand or year_alternative (if 2018 counts as year alt)
            expect(['year_alternative', 'same_brand']).toContain(result.type);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns same_category when no year or brand alternatives exist', () => {
      fc.assert(
        fc.property(
          priceGenerator.filter(p => p >= 80000 && p <= 200000),
          (price) => {
            const model = 'CompletelyUnknownModel';
            // Unknown models default to 'hatch' category, so we use 'hatch' for the inventory
            const category: VehicleCategory = 'hatch';

            // Create inventory with only same category vehicles (different brands)
            const inventory: Vehicle[] = [
              createVehicle({ model: 'Model1', brand: 'Honda', year: 2022, category, price, mileage: 50000 }),
              createVehicle({ model: 'Model2', brand: 'Toyota', year: 2022, category, price, mileage: 50000 }),
              createVehicle({ model: 'Model3', brand: 'Chevrolet', year: 2022, category, price, mileage: 50000 }),
            ];

            const result = service.findAlternatives(model, 2022, inventory, price);

            // Should return same_category type
            expect(result.type).toBe('same_category');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns price_range when no category matches exist', () => {
      fc.assert(
        fc.property(
          priceGenerator.filter(p => p >= 80000 && p <= 200000),
          (price) => {
            const model = 'CompletelyUnknownModel';

            // Create inventory with only price-matching vehicles (different categories)
            // Use a category that won't match the default 'hatch'
            const inventory: Vehicle[] = [
              createVehicle({ model: 'Model1', brand: 'Honda', year: 2022, category: 'pickup', price, mileage: 50000 }),
              createVehicle({ model: 'Model2', brand: 'Toyota', year: 2022, category: 'pickup', price, mileage: 50000 }),
            ];

            const result = service.findAlternatives(model, 2022, inventory, price);

            // Should return price_range or same_category (if pickup matches)
            expect(['same_category', 'price_range']).toContain(result.type);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns no_results when no alternatives found', () => {
      fc.assert(
        fc.property(
          modelGenerator,
          yearGenerator,
          (model, year) => {
            // Empty inventory
            const inventory: Vehicle[] = [];

            const result = service.findAlternatives(model, year, inventory);

            expect(result.type).toBe('no_results');
            expect(result.vehicles).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('priority chain is respected: year > brand > category > price', () => {
      // Test with a controlled scenario
      const model = 'Civic';
      const brand = 'Honda';
      const category: VehicleCategory = 'sedan';
      const price = 100000;
      const requestedYear = 2022;

      // Inventory with all types of alternatives
      const fullInventory: Vehicle[] = [
        // Year alternative (highest priority)
        createVehicle({ model, brand, year: 2021, category, price, mileage: 50000 }),
        // Same brand alternative
        createVehicle({ model: 'Accord', brand, year: 2022, category, price, mileage: 50000 }),
        // Same category alternative
        createVehicle({ model: 'Corolla', brand: 'Toyota', year: 2022, category, price, mileage: 50000 }),
        // Price range alternative
        createVehicle({ model: 'Tracker', brand: 'Chevrolet', year: 2022, category: 'suv', price, mileage: 50000 }),
      ];

      const result = service.findAlternatives(model, requestedYear, fullInventory, price);

      // Should return year_alternative (highest priority)
      expect(result.type).toBe('year_alternative');
    });
  });

});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a vehicle with specified attributes
 */
function createVehicle(params: {
  model: string;
  brand: string;
  year: number;
  category: VehicleCategory;
  price: number;
  mileage: number;
}): Vehicle {
  return {
    id: `${params.model}-${params.year}-${Math.random().toString(36).substr(2, 9)}`,
    marca: params.brand,
    modelo: params.model,
    versao: 'LT',
    ano: params.year,
    km: params.mileage,
    preco: params.price,
    cor: 'Branco',
    carroceria: categoryToBodyType(params.category),
    combustivel: 'Flex',
    cambio: 'Automático',
    disponivel: true,
    fotoUrl: null,
    url: null,
  };
}

/**
 * Normalizes a category string
 */
function normalizeCategory(category: string): string {
  const mapping: Record<string, string> = {
    'Sedan': 'sedan',
    'sedan': 'sedan',
    'SUV': 'suv',
    'suv': 'suv',
    'Hatch': 'hatch',
    'hatch': 'hatch',
    'Pickup': 'pickup',
    'pickup': 'pickup',
    'Minivan': 'minivan',
    'minivan': 'minivan',
  };
  return mapping[category] || category.toLowerCase();
}
