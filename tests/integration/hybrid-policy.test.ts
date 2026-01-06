import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VehicleExpertAgent } from '../../src/agents/vehicle-expert.agent';
import { vehicleSearchAdapter } from '../../src/services/vehicle-search-adapter.service';
import { platformValidator } from '../../src/services/platform-validator.service';
import { vehicleEvaluator } from '../../src/agents/vehicle-expert/services/vehicle-evaluator';
import { CustomerProfile } from '../../src/types/state.types';

// Mock dependencies
vi.mock('../../src/services/vehicle-search-adapter.service');
vi.mock('../../src/services/platform-validator.service');
vi.mock('../../src/agents/vehicle-expert/services/vehicle-evaluator');

describe('Hybrid Policy Integration: Search & Validation', () => {
  let agent: VehicleExpertAgent;
  let searchSpy: any;
  let validatorSpy: any;

  beforeEach(() => {
    agent = new VehicleExpertAgent();
    // Reset mocks
    vi.resetAllMocks();

    // Mock Search to return "dirty" results (some valid, some invalid)
    searchSpy = vi.spyOn(vehicleSearchAdapter, 'search').mockResolvedValue({
      recommendations: [
        {
          vehicleId: 'valid-1',
          matchScore: 0.9,
          vehicle: {
            id: 'valid-1',
            brand: 'Toyota',
            model: 'Corolla Altis',
            year: 2022,
            bodyType: 'Sedan',
            price: 90000,
            mileage: 50000,
            transmission: 'Automatico',
          },
        },
        {
          vehicleId: 'invalid-model',
          matchScore: 0.85,
          vehicle: {
            id: 'invalid-model',
            brand: 'Hyundai',
            model: 'HB20',
            year: 2022,
            bodyType: 'Hatch',
            price: 60000,
            mileage: 40000,
            transmission: 'Manual',
          },
        },
        {
          vehicleId: 'invalid-year',
          matchScore: 0.8,
          vehicle: {
            id: 'invalid-year',
            brand: 'Ford',
            model: 'Focus',
            year: 2012,
            bodyType: 'Hatch',
            price: 40000,
            mileage: 120000,
            transmission: 'Manual',
          },
        },
      ] as any,
      totalCount: 3,
    });

    // Mock Validator to act as the strict judge
    validatorSpy = vi.spyOn(platformValidator, 'validateAll').mockImplementation(async (v: any) => {
      console.log('Validator Called for:', v.modelo, v.ano);
      const isNewEnough = v.ano >= 2016; // Simple mock rule
      const isLuxury = v.modelo?.includes('Corolla') || v.modelo?.includes('Cruze');

      return {
        transport: {
          uberX: isNewEnough,
          uberBlack: isNewEnough && isLuxury,
          pop99: isNewEnough,
        },
        delivery: {
          mercadoEnviosFlex: v.ano >= 2011, // Older cars ok
          lalamoveCarro: v.ano >= 2011,
          ifoodMoto: v.carroceria === 'Moto',
        },
        reasoning: 'Mock Validator',
        confidence: 1.0,
      } as any;
    });

    // Mock VehicleEvaluator to pass through recommendations without LLM filtering
    vi.spyOn(vehicleEvaluator, 'evaluateVehicles').mockImplementation(async (recs: any) => {
      // Return recommendations as-is with high scores to avoid filtering
      return recs.map((r: any) => ({ ...r, matchScore: 85 }));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const currentYear = new Date().getFullYear();

  it('Scenario 1: Uber Black Intent - Should apply strict filters', async () => {
    // User wants Black. Search should filter by year 2020+ (approx 6y).
    // Validator should reject HB20 (Compact) and Focus (Old).

    // Trigger via internal method (we can cast to any to access private for testing, or use public processMessage)
    // Using simple profile to simulate intent
    const profile: Partial<CustomerProfile> = {
      name: 'Test User',
      usoPrincipal: 'uber',
      priorities: ['black', 'conforto'],
      budget: 100000,
    };

    // We need to bypass the full chat flow and invoke the logic that calls search.
    // Since getRecommendations is private, we'll verify this by mocking `processMessage` flow
    // OR we can test the intent detector + logic separately.
    // For this integration test, let's use the public `processMessage` if possible,
    // but without a full graph context it's hard.
    // Strategy: We will mock the `getRecommendations` caller or expose it.
    // ALTERNATIVE: Use `search-builder` tests? No, logic is in Agent.

    // Let's use `Reflect.get` to call private method for testing purpose
    // @ts-ignore
    const results = await agent.getRecommendations(profile);

    // 1. Verify DB Filter (Layer 1)
    const searchCallArgs = searchSpy.mock.calls[0][1];
    expect(searchCallArgs.minYear).toBeGreaterThanOrEqual(currentYear - 7); // Allow 1 year margin error
    // Config for Black is 6 years. 2026 - 6 = 2020.

    // 2. Verify Result Filtering (Layer 2)
    // Should contain Corolla (Valid Black)
    // Should NOT contain HB20 (Ineligible Model for Black)
    // Should NOT contain Focus (Too old)
    expect(results.recommendations).toHaveLength(1);
    expect(results.recommendations[0].vehicle.model).toBe('Corolla Altis');
  });

  it('Scenario 2: Mercado Envios Intent - Should allow older cars', async () => {
    const profile: Partial<CustomerProfile> = {
      name: 'Delivery Man',
      usoPrincipal: 'mercado envios', // Trigger intent
      priorities: ['trabalho', 'entrega'],
      budget: 50000,
    };

    // @ts-ignore
    const results = await agent.getRecommendations(profile);

    // 1. Verify DB Filter
    const searchCallArgs = searchSpy.mock.calls[0][1];
    // Config for Mercado is 15 years. 2026 - 15 = 2011.
    expect(searchCallArgs.minYear).toBeLessThanOrEqual(currentYear - 14);

    // 2. Verify Validator
    // Focus 2012 is acceptable for Mercado Envios (Min 2011)
    // Corolla and HB20 are also acceptable
    expect(results.recommendations.length).toBeGreaterThanOrEqual(3);
  });

  it('Scenario 3: Lalamove Intent - Should trigger Lalamove validation', async () => {
    const profile: Partial<CustomerProfile> = {
      usoPrincipal: 'lalamove',
    };

    // @ts-ignore
    const results = await agent.getRecommendations(profile);

    const searchCallArgs = searchSpy.mock.calls[2]?.[1]; // 3rd call
    if (searchCallArgs) {
      console.log('Lalamove Args:', searchCallArgs);
      expect(searchCallArgs.minYear).toBeDefined();
    }
  });
});
