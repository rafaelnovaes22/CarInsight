import { describe, expect, it } from 'vitest';
import { recommendationEvidence } from '../../src/services/recommendation-evidence.service';

describe('RecommendationEvidenceService', () => {
  it('builds deterministic evidence aligned with profile constraints', () => {
    const rec: any = {
      vehicleId: 'v1',
      matchScore: 92,
      reasoning: 'Boa opcao para uso familiar',
      highlights: ['Espacoso para familia', 'Baixa quilometragem (30.000 km)'],
      concerns: [],
      vehicle: {
        brand: 'Toyota',
        model: 'Corolla',
        year: 2022,
        price: 95000,
        transmission: 'Automatico',
        bodyType: 'Sedan',
      },
    };

    const evidence = recommendationEvidence.build(rec, {
      useCase: 'familia',
      budget: 100000,
      people: 5,
      priorities: ['espaco', 'conforto'],
    });

    expect(evidence.useCase).toBe('familia');
    expect(evidence.selectedBecause.length).toBeGreaterThan(0);
    expect(evidence.profileSignals.length).toBeGreaterThan(0);
    expect(evidence.matchedCharacteristics).toContain('espaco');
  });
});
