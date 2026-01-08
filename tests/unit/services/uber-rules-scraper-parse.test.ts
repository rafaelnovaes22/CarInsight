import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { uberRulesScraperService } from '../../../src/services/uber-rules-scraper.service';

describe('UberRulesScraperService parsing (by modality)', () => {
  it('parses brand/model rows and splits minYears by category tags in parentheses', async () => {
    const sample = [
      'Audi',
      'A4 - 1996 (Envios Carro) / 2011 (UberX, Bag, Prioridade) / 2018 (Comfort, Comfort Planet) / 2019 (Black Bag, Black)',
      'A6 - 2011 (UberX) / 2019 (Black)',
      'Toyota',
      'Corolla - 2011 (UberX) / 2018 (Comfort) / 2019 (Black)',
    ].join('\n');

    const rules = (uberRulesScraperService as any).extractEligibleModelRules(sample);

    // A4: UberX @2011, Comfort @2018, Black @2019
    expect(rules.uberX.eligible).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ brand: 'Audi', model: 'A4', minYear: 2011 }),
        expect.objectContaining({ brand: 'Audi', model: 'A6', minYear: 2011 }),
        expect.objectContaining({ brand: 'Toyota', model: 'Corolla', minYear: 2011 }),
      ])
    );

    expect(rules.uberComfort.eligible).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ brand: 'Audi', model: 'A4', minYear: 2018 }),
        expect.objectContaining({ brand: 'Toyota', model: 'Corolla', minYear: 2018 }),
      ])
    );

    expect(rules.uberBlack.eligible).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ brand: 'Audi', model: 'A4', minYear: 2019 }),
        expect.objectContaining({ brand: 'Audi', model: 'A6', minYear: 2019 }),
        expect.objectContaining({ brand: 'Toyota', model: 'Corolla', minYear: 2019 }),
      ])
    );

    // Non-ride modalities should also be captured
    expect(rules.envios_carro.eligible).toEqual(
      expect.arrayContaining([expect.objectContaining({ brand: 'Audi', model: 'A4', minYear: 1996 })])
    );

    // Other tags should be slugged
    expect(rules.bag.eligible).toEqual(
      expect.arrayContaining([expect.objectContaining({ brand: 'Audi', model: 'A4', minYear: 2011 })])
    );
    expect(rules.prioridade.eligible).toEqual(
      expect.arrayContaining([expect.objectContaining({ brand: 'Audi', model: 'A4', minYear: 2011 })])
    );
  });
});
