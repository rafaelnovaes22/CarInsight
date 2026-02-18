import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn(),
}));

import { chatCompletion } from '../../src/lib/llm-router';
import { recommendationExplainer } from '../../src/services/recommendation-explainer.service';

describe('RecommendationExplainerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const input = {
    recommendation: {
      vehicleId: 'v1',
      matchScore: 90,
      reasoning: 'Veiculo indicado para familia',
      highlights: ['Espacoso para familia', 'Baixa quilometragem'],
      concerns: ['Cambio manual'],
      vehicle: { brand: 'Honda', model: 'City', year: 2022 },
    } as any,
    evidence: {
      useCase: 'familia',
      profileSignals: ['uso familiar', 'orcamento ate R$ 100.000'],
      selectedBecause: ['Espacoso para familia', 'Baixa quilometragem'],
      notIdealBecause: ['Cambio manual'],
      matchedCharacteristics: ['espaco', 'orcamento'],
    },
  };

  it('returns deterministic explanation when slm is disabled', async () => {
    const explanation = await recommendationExplainer.explain(input, false);
    expect(explanation.strategy).toBe('deterministic');
    expect(explanation.selectedBecause.length).toBeGreaterThan(0);
  });

  it('parses slm response when valid json is returned', async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce({
      content: JSON.stringify({
        summary: 'Boa para familia por espaco e custo.',
        matchedCharacteristics: ['espaco', 'orcamento'],
        selectedBecause: ['Espacoso para familia', 'Dentro do orcamento'],
        notIdealBecause: ['Cambio manual'],
        confidence: 0.9,
      }),
      usage: {},
      model: 'mock',
    } as any);

    const explanation = await recommendationExplainer.explain(input, true);
    expect(explanation.strategy).toBe('slm');
    expect(explanation.summary.length).toBeGreaterThan(0);
    expect(explanation.selectedBecause.length).toBeGreaterThan(0);
  });
});
