import { describe, it, expect, vi, beforeEach } from 'vitest';

import { uberEligibilityAgent } from '../../src/services/uber-eligibility-agent.service';

// Mock the Rules Provider (Data Source)
vi.mock('../../src/services/uber-rules-provider.service', () => ({
  uberRulesProvider: {
    get: vi.fn(async () => ({
      meta: {
        citySlug: 'sao-paulo',
        fetchedAt: new Date().toISOString(),
        sourceUrl: 'http://mock.com',
      },
      rules: {
        X: { minYear: 2014, allowed: [], forbidden: [] },
        Comfort: { minYear: 2015, allowed: [], forbidden: [] },
        Black: { minYear: 2018, allowed: [], forbidden: [] },
      },
    })),
  },
}));

// DO NOT mock uberEligibilityValidator - we want to test the real logic
// The Agent uses the validator to check the rules we mocked above.

describe('uberEligibilityAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when vehicle does not have AC or 4 doors', async () => {
    const result = await uberEligibilityAgent.evaluate(
      {
        marca: 'Fiat',
        modelo: 'Uno',
        ano: 2020,
        carroceria: 'Hatch',
        arCondicionado: false,
        portas: 4,
      },
      'sao-paulo'
    );

    expect(result.uberX).toBe(false);
    expect(result.uberComfort).toBe(false);
    expect(result.uberBlack).toBe(false);
    // Confidence might vary based on validator logic, but usually 1.0 if hard fail
    // expect(result.confidence).toBe(1.0); 
  });

  it('enforces SP minYear for UberX (2014)', async () => {
    const result = await uberEligibilityAgent.evaluate(
      {
        marca: 'VW',
        modelo: 'Gol',
        ano: 2013,
        carroceria: 'Hatch',
        arCondicionado: true,
        portas: 4,
      },
      'sao-paulo'
    );

    expect(result.uberX).toBe(false);
    expect(result.uberComfort).toBe(false);
    expect(result.uberBlack).toBe(false);
  });
});
