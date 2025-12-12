import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vehicleExpert } from '../../src/agents/vehicle-expert.agent';
import { vehicleSearchAdapter } from '../../src/services/vehicle-search-adapter.service';
import { chatCompletion } from '../../src/lib/llm-router';
import { VehicleRecommendation } from '../../src/types/state.types';
import * as preferenceExtractorModule from '../../src/agents/preference-extractor.agent';

// Mock dependencies
vi.mock('../../src/services/vehicle-search-adapter.service');
vi.mock('../../src/lib/llm-router');
// We don't verify full LLM extraction here, we can mock preference extractor or trust it's tested elsewhere.
// To test intent logic in VehicleExpert, we need to make sure preferenceExtractor returns expected values.
// So we can spy on preferenceExtractor.extract.

describe('Vehicle Expert Intent Detection', () => {
  let context: any;

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      conversationId: 'test-conv',
      phoneNumber: '123456789',
      messages: [],
      mode: 'discovery',
      profile: {},
      metadata: { messageCount: 0 },
    };

    // Mock chatCompletion to return simple text when called by VehicleExpert (e.g. generating questions)
    // This handles "generateNextQuestion" and "answerQuestion"
    (chatCompletion as any).mockResolvedValue('Mocked response from LLM');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should detect Specific Model + Year and return vehicles directly', async () => {
    const userMessage = 'Quero um Onix 2019';

    // Mock preference extractor to return the specific model/Year
    // We spy on the singleton instance method
    const extractSpy = vi
      .spyOn(preferenceExtractorModule.preferenceExtractor, 'extract')
      .mockResolvedValue({
        extracted: { brand: 'chevrolet', model: 'onix', minYear: 2019 },
        confidence: 0.95,
        fieldsExtracted: ['brand', 'model', 'minYear'],
        reasoning: 'Model and year found',
      });

    // Mock search adapter to return the specific vehicle
    const mockVehicle: VehicleRecommendation = {
      vehicleId: 'v1',
      matchScore: 100,
      reasoning: 'Exact match',
      highlights: [],
      concerns: [],
      vehicle: {
        id: 'v1',
        brand: 'Chevrolet',
        model: 'Onix',
        year: 2019,
        price: 50000,
        mileage: 30000,
        bodyType: 'hatch',
      },
    };

    // The agent calls `getRecommendations` which calls `vehicleSearchAdapter.search`
    (vehicleSearchAdapter.search as any).mockResolvedValue([mockVehicle]);

    const result = await vehicleExpert.chat(userMessage, context);

    expect(result.nextMode).toBe('recommendation');
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations![0].vehicle.year).toBe(2019);
    expect(result.response).toContain('Onix 2019'); // Should find exact match
    expect(result.extractedPreferences._lastSearchType).toBe('specific');
  });

  it('should handle Alternative Year selection', async () => {
    // Stage 1: User asks for Onix 2020, but we only have 2019
    const userMessage1 = 'Quero um Onix 2020';

    vi.spyOn(preferenceExtractorModule.preferenceExtractor, 'extract').mockResolvedValue({
      extracted: { brand: 'chevrolet', model: 'onix', minYear: 2020 },
      confidence: 0.95,
      fieldsExtracted: ['brand', 'model', 'minYear'],
      reasoning: 'Model and year found',
    });

    // Search returns existing 2019 model (but we asked for 2020)
    const mockVehicle2019: VehicleRecommendation = {
      vehicleId: 'v1',
      matchScore: 90,
      reasoning: 'Alternative',
      highlights: [],
      concerns: [],
      vehicle: {
        id: 'v1',
        brand: 'Chevrolet',
        model: 'Onix',
        year: 2019,
        price: 50000,
        mileage: 30000,
        bodyType: 'hatch',
      },
    };

    // Adapter returns the 2019 model even if we filtered for 2020 in logic,
    // BUT specific-model-year logic in Agent filters them out if they don't match EXACTLY.
    // So we simulate adapter returning the 2019 one when searched broadly for "Onix".
    (vehicleSearchAdapter.search as any).mockResolvedValue([mockVehicle2019]);

    const result1 = await vehicleExpert.chat(userMessage1, context);

    // Should NOT recommend yet because year doesn't match
    expect(result1.canRecommend).toBe(false);
    expect(result1.extractedPreferences._availableYears).toContain(2019);
    expect(result1.response).toContain('2019'); // Should offer 2019

    // Stage 2: User selects "2019"
    const userMessage2 = 'Pode ser 2019';

    // Context has the state from previous turn
    context.profile = result1.extractedPreferences;

    vi.spyOn(preferenceExtractorModule.preferenceExtractor, 'extract').mockResolvedValue({
      extracted: {},
      confidence: 0.5,
      fieldsExtracted: [],
      reasoning: 'Confirmation',
    });

    const result2 = await vehicleExpert.chat(userMessage2, context);

    expect(result2.canRecommend).toBe(true);
    expect(result2.recommendations).toHaveLength(1);
    expect(result2.recommendations![0].vehicle.year).toBe(2019);
    expect(result2.extractedPreferences._lastSearchType).toBe('specific');
  });

  it('should persist financing intent', async () => {
    const userMessage = 'Quero financiar';

    vi.spyOn(preferenceExtractorModule.preferenceExtractor, 'extract').mockResolvedValue({
      extracted: { wantsFinancing: true },
      confidence: 0.9,
      fieldsExtracted: ['wantsFinancing'],
      reasoning: 'Financing request',
    });

    const result = await vehicleExpert.chat(userMessage, context);

    expect(result.extractedPreferences.wantsFinancing).toBe(true);
  });

  it('should persist trade-in detailed info', async () => {
    const userMessage = 'Tenho um Gol 2010 para troca';

    vi.spyOn(preferenceExtractorModule.preferenceExtractor, 'extract').mockResolvedValue({
      extracted: { hasTradeIn: true, tradeInBrand: 'vw', tradeInModel: 'gol', tradeInYear: 2010 },
      confidence: 0.95,
      fieldsExtracted: ['hasTradeIn', 'tradeInBrand', 'tradeInModel', 'tradeInYear'],
      reasoning: 'Trade-in details',
    });

    const result = await vehicleExpert.chat(userMessage, context);

    expect(result.extractedPreferences.hasTradeIn).toBe(true);
    expect(result.extractedPreferences.tradeInModel).toBe('gol');
    expect(result.extractedPreferences.tradeInYear).toBe(2010);
  });
});
