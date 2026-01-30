import { handleUberBlackQuestion } from '../../src/agents/vehicle-expert/processors/uber-handler';
import { vehicleSearchAdapter } from '../../src/services/vehicle-search-adapter.service';
import { ConversationContext } from '../../src/types/conversation.types';
import { CustomerProfile } from '../../src/types/state.types';
import { vi, describe, it, expect } from 'vitest';

// Mock dependencies
const mockContext: ConversationContext = {
  conversationId: 'test-conv',
  phoneNumber: '123456789',
  mode: 'discovery',
  profile: {},
  messages: [],
  metadata: {
    startedAt: new Date(),
    lastMessageAt: new Date(),
    messageCount: 1,
    extractionCount: 0,
    questionsAsked: 0,
    userQuestions: 0,
  },
};

const getAppCategoryNameMock = () => 'Uber X';

describe('Uber Flow Refinements', () => {
  it('should ask for budget if missing', async () => {
    const result = await handleUberBlackQuestion(
      'quero um uber black',
      mockContext,
      { minYear: 2018 },
      { extracted: { minYear: 2018 } },
      Date.now(),
      getAppCategoryNameMock
    );

    expect(result.handled).toBe(true);
    expect(result.response?.response).toContain('qual seria seu orçamento');
    expect(result.response?.extractedPreferences._waitingForBudget).toBe(true);
    expect(result.response?.canRecommend).toBe(false);
  });

  it('should search if budget is present', async () => {
    // Mock adapter output to avoid real DB hits in unit test logic if needed,
    // but here we might want to test integration or mock the adapter.
    // For this reproduction script, let's mock the adapter.search to see parameters.
    const spySearch = vi.spyOn(vehicleSearchAdapter, 'search');
    spySearch.mockResolvedValue([]);

    await handleUberBlackQuestion(
      'quero um uber black',
      mockContext,
      { minYear: 2018, budget: 100000 },
      { extracted: { minYear: 2018, budget: 100000 } },
      Date.now(),
      getAppCategoryNameMock
    );

    expect(spySearch).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        maxPrice: 100000,
        useCase: 'uber',
      })
    );
  });

  describe('VehicleSearchAdapter Sort Strategy', () => {
    // Access private method via any cast or test public search behavior
    // Since getSortStrategy is private, we test public behavior via search filters

    it('should return Uber sort strategy when useCase is uber', () => {
      // We can't easily unit test private methods without exporting them or using prototype access
      // Let's use prototype access for verification:
      const adapter = vehicleSearchAdapter as any;
      const strategy = adapter.getSortStrategy({ useCase: 'uber' });

      // Updated for latency-optimization: now uses pre-calculated scores
      expect(strategy).toHaveLength(3);
      expect(strategy[0]).toEqual({ ano: 'desc' });
      expect(strategy[1]).toEqual({ km: 'asc' });
      expect(strategy[2]).toEqual({ scoreEconomia: 'desc' }); // Changed from preco to scoreEconomia for latency-optimization
    });

    it('should return Default sort strategy when no useCase', () => {
      const adapter = vehicleSearchAdapter as any;
      const strategy = adapter.getSortStrategy({});

      expect(strategy).toHaveLength(3);
      expect(strategy[0]).toEqual({ ano: 'desc' }); // New Global Default: Efficiency candidate
      expect(strategy[1]).toEqual({ km: 'asc' });
      expect(strategy[2]).toEqual({ preco: 'asc' });
    });
  });
});
