import { describe, it, expect, vi, beforeEach } from 'vitest';

import { VehicleExpertAgent } from '../../src/agents/vehicle-expert.agent';

vi.mock('../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn(async () =>
    JSON.stringify({ extracted: {}, confidence: 0.9, reasoning: 'mock', fieldsExtracted: [] })
  ),
}));

vi.mock('../../src/agents/preference-extractor.agent', () => ({
  preferenceExtractor: {
    extract: vi.fn(async () => ({ extracted: {}, confidence: 0.9, reasoning: 'mock', fieldsExtracted: [] })),
    mergeWithProfile: vi.fn((current: any, extracted: any) => ({ ...current, ...extracted })),
  },
}));

vi.mock('../../src/services/vehicle-search-adapter.service', () => ({
  vehicleSearchAdapter: {
    search: vi.fn(async () => [
      {
        vehicleId: 'v1',
        matchScore: 90,
        reasoning: 'x',
        highlights: [],
        concerns: [],
        vehicle: {
          id: 'v1',
          brand: 'Toyota',
          model: 'Corolla',
          year: 2020,
          price: 80000,
          mileage: 50000,
          bodyType: 'Sedan',
          transmission: 'Automatico',
          fuelType: 'Flex',
          color: 'Prata',
          imageUrl: null,
          detailsUrl: null,
        },
      },
      {
        vehicleId: 'v2',
        matchScore: 80,
        reasoning: 'y',
        highlights: [],
        concerns: [],
        vehicle: {
          id: 'v2',
          brand: 'VW',
          model: 'Gol',
          year: 2014,
          price: 40000,
          mileage: 90000,
          bodyType: 'Hatch',
          transmission: 'Manual',
          fuelType: 'Flex',
          color: 'Branco',
          imageUrl: null,
          detailsUrl: null,
        },
      },
    ]),
  },
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    vehicle: {
      findMany: vi.fn(async () => [
        {
          id: 'v1',
          marca: 'Toyota',
          modelo: 'Corolla',
          ano: 2020,
          carroceria: 'Sedan',
          arCondicionado: true,
          portas: 4,
          cambio: 'Automatico',
        },
        {
          id: 'v2',
          marca: 'VW',
          modelo: 'Gol',
          ano: 2014,
          carroceria: 'Hatch',
          arCondicionado: true,
          portas: 4,
          cambio: 'Manual',
        },
      ]),
    },
  },
}));

vi.mock('../../src/services/uber-eligibility-agent.service', () => ({
  uberEligibilityAgent: {
    evaluate: vi.fn(async (vehicle: any, citySlug: string) => {
      if (citySlug === 'rio-de-janeiro' && vehicle.modelo.toLowerCase().includes('gol')) {
        return {
          uberX: false,
          uberComfort: false,
          uberBlack: false,
          reasoning: 'mock reject in RJ',
          confidence: 1,
          source: { citySlug, sourceUrl: 'x', fetchedAt: new Date().toISOString() },
        };
      }
      return {
        uberX: true,
        uberComfort: false,
        uberBlack: false,
        reasoning: 'mock ok',
        confidence: 1,
        source: { citySlug, sourceUrl: 'x', fetchedAt: new Date().toISOString() },
      };
    }),
  },
}));

describe('VehicleExpertAgent - Uber city post-filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters out vehicles that fail city-specific evaluation when city != SP', async () => {
    const agent = new VehicleExpertAgent();

    const context: any = {
      mode: 'conversational',
      messages: [],
      profile: {
        usoPrincipal: 'uber',
        citySlug: 'rio-de-janeiro',
      },
      metadata: { messageCount: 1 },
    };

    const resp = await agent.chat('quero carro pra uber', context);

    const shown = resp.extractedPreferences?._lastShownVehicles || [];
    const ids = shown.map((v: any) => v.vehicleId);

    expect(ids).toContain('v1');
    expect(ids).not.toContain('v2');
  });
});
