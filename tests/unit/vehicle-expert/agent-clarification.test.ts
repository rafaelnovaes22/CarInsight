import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VehicleExpertAgent } from '../../../src/agents/vehicle-expert.agent';
import { ConversationContext } from '../../../src/types/conversation.types';

vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn(async () =>
    JSON.stringify({
      extracted: {},
      confidence: 0.5,
      reasoning: 'Mock extraction',
      fieldsExtracted: [],
    })
  ),
}));

vi.mock('../../../src/services/vehicle-search-adapter.service', () => ({
  vehicleSearchAdapter: {
    search: vi.fn(async () => []),
  },
}));

vi.mock('../../../src/agents/preference-extractor.agent', () => ({
  preferenceExtractor: {
    extract: vi.fn(async () => ({
      extracted: {},
      confidence: 0.9,
      reasoning: 'Mock',
      fieldsExtracted: [],
    })),
    mergeWithProfile: vi.fn((current: any, extracted: any) => ({ ...current, ...extracted })),
  },
}));

describe('VehicleExpertAgent clarification guard', () => {
  let expert: VehicleExpertAgent;

  beforeEach(() => {
    expert = new VehicleExpertAgent();
    vi.clearAllMocks();
  });

  it('asks for clarification instead of starting a new flow on ambiguous seller typo', async () => {
    const context: ConversationContext = {
      conversationId: 'test-clarify',
      phoneNumber: '5511999999999',
      mode: 'negotiation',
      profile: {
        _showedRecommendation: true,
        _lastSearchType: 'recommendation',
        _lastShownVehicles: [
          { vehicleId: 'v1', brand: 'RENAULT', model: 'CAPTUR', year: 2019, price: 76990 },
        ],
      },
      messages: [],
      metadata: {
        startedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: 4,
        extractionCount: 0,
        questionsAsked: 0,
        userQuestions: 0,
      },
    };

    const response = await expert.chat('Vendedoe', context);

    expect(response.response.toLowerCase()).toContain('quis dizer');
    expect(response.response.toLowerCase()).toContain('vendedor');
    expect(response.nextMode).toBe('negotiation');
    expect(response.extractedPreferences._showedRecommendation).toBe(true);
  });
});
