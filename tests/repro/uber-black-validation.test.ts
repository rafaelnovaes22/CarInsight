import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleUberBlackQuestion,
  UberHandlerResult,
} from '../../src/agents/vehicle-expert/processors/uber-handler';
import { vehicleSearchAdapter } from '../../src/services/vehicle-search-adapter.service';
import { ConversationContext, ConversationMode } from '../../src/types/conversation.types';
import { CustomerProfile } from '../../src/types/state.types';

// Mock dependencies
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/services/vehicle-search-adapter.service', () => ({
  vehicleSearchAdapter: {
    search: vi.fn(),
  },
}));

describe('Uber Black Validation Fix', () => {
  const mockContext: ConversationContext = {
    conversationId: 'test-session',
    phoneNumber: '5511999999999',
    profile: {
      name: 'Test User',
      model: 'Corolla', // User has interested in Corolla
    } as any,
    messages: [],
    mode: 'discovery' as ConversationMode,
    metadata: {
      messageCount: 1,
      lastMessageAt: new Date(),
      startedAt: new Date(),
      extractionCount: 0,
      questionsAsked: 0,
      userQuestions: 0,
    },
  };

  const mockGetAppCategoryName = vi.fn().mockReturnValue('Uber Black');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should NOT handle specific vehicle questions in handleUberBlackQuestion (return handled: false)', async () => {
    // Scenario: User asks "esse corolla serve para uber black?"
    // The handler should detect "esse" or "corolla" and delegate to eligibility handler
    const userMessage = 'esse corolla serve para uber black?';

    // Explicitly set model in extracted preferences as well to simulate real flow
    const extracted = { extracted: { model: 'Corolla' } };
    const updatedProfile: Partial<CustomerProfile> = { model: 'Corolla' };

    const result = await handleUberBlackQuestion(
      userMessage,
      mockContext,
      updatedProfile,
      extracted,
      Date.now(),
      mockGetAppCategoryName
    );

    expect(result.handled).toBe(false);
  });

  it('should handle generic questions in handleUberBlackQuestion (return handled: true)', async () => {
    // Scenario: User asks "quais carros para uber black?"
    const userMessage = 'quais carros para uber black?';

    const extracted = { extracted: {} };
    const updatedProfile: Partial<CustomerProfile> = { budget: 90000 };

    // Mock search result for generic flow
    (vehicleSearchAdapter.search as any).mockResolvedValue([
      { vehicle: { brand: 'Kia', model: 'Stonic', year: 2022, price: 90000, mileage: 30000 } },
    ]);

    const result = await handleUberBlackQuestion(
      userMessage,
      mockContext,
      updatedProfile,
      extracted,
      Date.now(),
      mockGetAppCategoryName
    );

    expect(result.handled).toBe(true);
    expect(vehicleSearchAdapter.search).toHaveBeenCalledWith(
      '',
      expect.objectContaining({ aptoUberBlack: true })
    );
  });
});
