import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vehicleExpert } from '../../src/agents/vehicle-expert.agent';
import { vehicleSearchAdapter } from '../../src/services/vehicle-search-adapter.service';
import { chatCompletion } from '../../src/lib/llm-router';
import { VehicleRecommendation } from '../../src/types/state.types';
import * as preferenceExtractorModule from '../../src/agents/preference-extractor.agent';

vi.mock('../../src/services/vehicle-search-adapter.service');
vi.mock('../../src/lib/llm-router');
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function buildRecommendation(
  id: string,
  brand: string,
  model: string,
  year: number,
  price: number,
  bodyType: string
): VehicleRecommendation {
  return {
    vehicleId: id,
    matchScore: 95,
    reasoning: 'match',
    highlights: [],
    concerns: [],
    vehicle: {
      id,
      brand,
      model,
      year,
      price,
      mileage: 30000,
      bodyType,
    },
  };
}

function createContext(profile: Record<string, unknown> = {}) {
  return {
    conversationId: 'e2e-budget-guardrails',
    phoneNumber: '5511999999999',
    messages: [],
    mode: 'discovery',
    profile,
    metadata: { messageCount: 0, flags: [] },
  } as any;
}

describe('E2E: Budget Guardrails and Pending Recommendation Resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (chatCompletion as any).mockResolvedValue('Mocked response from LLM');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks for budget and stores pending recommendations for specific model search', async () => {
    const context = createContext();
    const onix2019 = buildRecommendation('v-onix-2019', 'Chevrolet', 'Onix', 2019, 50000, 'hatch');

    vi.spyOn(preferenceExtractorModule.preferenceExtractor, 'extract').mockResolvedValue({
      extracted: { brand: 'chevrolet', model: 'onix', minYear: 2019 },
      confidence: 0.95,
      fieldsExtracted: ['brand', 'model', 'minYear'],
      reasoning: 'model+year found',
    });

    (vehicleSearchAdapter.search as any).mockResolvedValue([onix2019]);

    const result = await vehicleExpert.chat('Quero um Onix 2019', context);

    expect(result.canRecommend).toBe(false);
    expect(result.nextMode).toBe('discovery');
    expect(result.response.toLowerCase()).toMatch(/or[çc]amento/i);
    expect(result.extractedPreferences._pendingRecommendations).toHaveLength(1);
    expect(result.extractedPreferences._waitingForBudgetForModel).toBe(true);
  });

  it('resumes pending specific model recommendations after budget is provided', async () => {
    const context = createContext();
    const onix2019 = buildRecommendation('v-onix-2019', 'Chevrolet', 'Onix', 2019, 50000, 'hatch');

    vi.spyOn(preferenceExtractorModule.preferenceExtractor, 'extract')
      .mockResolvedValueOnce({
        extracted: { brand: 'chevrolet', model: 'onix', minYear: 2019 },
        confidence: 0.95,
        fieldsExtracted: ['brand', 'model', 'minYear'],
        reasoning: 'model+year found',
      })
      .mockResolvedValueOnce({
        extracted: { budget: 80000, budgetMax: 80000 },
        confidence: 0.95,
        fieldsExtracted: ['budget'],
        reasoning: 'budget found',
      });

    (vehicleSearchAdapter.search as any).mockResolvedValue([onix2019]);

    const firstTurn = await vehicleExpert.chat('Quero um Onix 2019', context);
    expect(firstTurn.extractedPreferences._pendingRecommendations).toHaveLength(1);

    context.profile = firstTurn.extractedPreferences;
    context.messages = [
      { role: 'assistant', content: firstTurn.response, timestamp: new Date() },
      { role: 'user', content: 'Meu orcamento e 80 mil', timestamp: new Date() },
    ];

    const secondTurn = await vehicleExpert.chat('Meu orcamento e 80 mil', context);

    expect(secondTurn.canRecommend).toBe(true);
    expect(secondTurn.nextMode).toBe('recommendation');
    expect(secondTurn.recommendations).toHaveLength(1);
    expect(secondTurn.recommendations?.[0].vehicle.model).toBe('Onix');
    expect(secondTurn.extractedPreferences._pendingRecommendations).toBeUndefined();
    expect(secondTurn.extractedPreferences._waitingForBudgetForModel).toBeUndefined();
  });

  it('requires budget before showing "want others" alternatives and stores pending others', async () => {
    const context = createContext({
      customerName: 'Rafael',
      _showedRecommendation: true,
      _lastSearchType: 'recommendation',
      _lastShownVehicles: [
        {
          vehicleId: 'shown-1',
          brand: 'Honda',
          model: 'Civic',
          year: 2020,
          price: 90000,
          bodyType: 'sedan',
        },
      ],
    });

    vi.spyOn(preferenceExtractorModule.preferenceExtractor, 'extract').mockResolvedValue({
      extracted: {},
      confidence: 0.5,
      fieldsExtracted: [],
      reasoning: 'no extraction',
    });

    const corolla = buildRecommendation('new-1', 'Toyota', 'Corolla', 2020, 85000, 'sedan');
    (vehicleSearchAdapter.search as any).mockResolvedValue([corolla]);

    const result = await vehicleExpert.chat('quero outras opcoes', context);

    expect(result.canRecommend).toBe(false);
    expect(result.nextMode).toBe('discovery');
    expect(result.needsMoreInfo).toContain('budget');
    expect(result.response.toLowerCase()).toMatch(/or[çc]amento/i);
    expect(result.extractedPreferences._pendingOtherRecommendations).toBeDefined();
    expect(result.extractedPreferences._pendingOtherRecommendations).toHaveLength(1);
  });

  it('requires budget before confirming alternative year suggestions and stores pending year recommendations', async () => {
    const context = createContext({
      customerName: 'Rafael',
      _waitingForSuggestionResponse: true,
      _searchedItem: 'Onix',
      _availableYears: [2019],
    });

    vi.spyOn(preferenceExtractorModule.preferenceExtractor, 'extract').mockResolvedValue({
      extracted: {},
      confidence: 0.5,
      fieldsExtracted: [],
      reasoning: 'confirmation',
    });

    const onix2019 = buildRecommendation('onix-2019', 'Chevrolet', 'Onix', 2019, 52000, 'hatch');
    (vehicleSearchAdapter.search as any).mockResolvedValue([onix2019]);

    const result = await vehicleExpert.chat('sim', context);

    expect(result.canRecommend).toBe(false);
    expect(result.nextMode).toBe('discovery');
    expect(result.needsMoreInfo).toContain('budget');
    expect(result.extractedPreferences._pendingYearRecommendations).toBeDefined();
    expect(result.extractedPreferences._pendingYearRecommendations).toHaveLength(1);
    expect(result.extractedPreferences.minYear).toBe(2019);
  });

  it('requires budget before confirming Uber alternatives and stores pending uber recommendations', async () => {
    const context = createContext({
      customerName: 'Rafael',
      _waitingForSuggestionResponse: true,
      _waitingForUberXAlternatives: true,
    });

    vi.spyOn(preferenceExtractorModule.preferenceExtractor, 'extract').mockResolvedValue({
      extracted: {},
      confidence: 0.5,
      fieldsExtracted: [],
      reasoning: 'confirmation',
    });

    const hb20 = buildRecommendation('uber-1', 'Hyundai', 'HB20', 2021, 62000, 'hatch');
    (vehicleSearchAdapter.search as any).mockResolvedValue([hb20]);

    const result = await vehicleExpert.chat('sim', context);

    expect(result.canRecommend).toBe(false);
    expect(result.nextMode).toBe('discovery');
    expect(result.needsMoreInfo).toContain('budget');
    expect(result.extractedPreferences._pendingUberRecommendations).toBeDefined();
    expect(result.extractedPreferences._pendingUberRecommendations).toHaveLength(1);
  });
});
