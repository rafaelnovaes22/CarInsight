import { describe, it, expect, vi, beforeEach } from 'vitest';

import { uberEligibilityAgent } from '../../src/services/uber-eligibility-agent.service';

vi.mock('../../src/services/uber-eligibility-validator.service', () => ({
  uberEligibilityValidator: {
    validateEligibility: vi.fn(async () => ({
      uberX: true,
      uberComfort: true,
      uberBlack: true,
      reasoning: 'mock',
      confidence: 0.9,
    })),
  },
}));

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
    expect(result.confidence).toBe(1.0);
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
    expect(result.confidence).toBe(1.0);
  });
});
