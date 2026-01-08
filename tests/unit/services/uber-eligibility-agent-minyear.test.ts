import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockRulesGet = vi.fn();
vi.mock('../../../src/services/uber-rules-provider.service', () => ({
  uberRulesProvider: {
    get: (...args: any[]) => mockRulesGet(...args),
  },
}));

const mockValidateEligibility = vi.fn();
vi.mock('../../../src/services/uber-eligibility-validator.service', () => ({
  uberEligibilityValidator: {
    validateEligibility: (...args: any[]) => mockValidateEligibility(...args),
  },
}));

import { uberEligibilityAgent } from '../../../src/services/uber-eligibility-agent.service';

describe('UberEligibilityAgent minYear enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces model-specific minYear > decree when model is eligible but stricter', async () => {
    const nowYear = new Date().getFullYear();
    const minYearDecree = nowYear - 10;

    mockRulesGet.mockResolvedValue({
      meta: { citySlug: 'sao-paulo', sourceUrl: 'u', fetchedAt: new Date().toISOString(), ttlDays: 30 },
      rules: {
        uberX: {
          eligible: [
            { brand: 'Toyota', model: 'Corolla', minYear: minYearDecree + 2, raw: 'Toyota Corolla' },
          ],
        },
        uberComfort: { eligible: [] },
        uberBlack: { eligible: [] },
      },
    });

    const vehicle = {
      marca: 'Toyota',
      modelo: 'Corolla',
      ano: minYearDecree + 1, // passes decree, fails model stricter rule
      carroceria: 'Sedan',
      arCondicionado: true,
      portas: 4,
    };

    const res = await uberEligibilityAgent.evaluate(vehicle as any, 'sao-paulo');

    expect(res.uberX).toBe(false);
    expect(res.reasoning).toContain('ano inferior');
    expect(mockValidateEligibility).not.toHaveBeenCalled();
  });
});
