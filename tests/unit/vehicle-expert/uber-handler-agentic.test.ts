import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockFindUnique = vi.fn();
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    vehicle: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      findMany: vi.fn(),
    },
  },
}));

const mockAgentEvaluate = vi.fn();
vi.mock('../../../src/services/uber-eligibility-agent.service', () => ({
  uberEligibilityAgent: {
    evaluate: (...args: any[]) => mockAgentEvaluate(...args),
  },
}));

const mockValidatorGetExplanation = vi.fn();
vi.mock('../../../src/services/uber-eligibility-validator.service', () => ({
  uberEligibilityValidator: {
    getExplanation: (...args: any[]) => mockValidatorGetExplanation(...args),
  },
}));

import { handleUberEligibilityQuestion } from '../../../src/agents/vehicle-expert/processors/uber-handler';
import type { ConversationContext } from '../../../src/types/conversation.types';

describe('Uber handler uses agentic eligibility (uberEligibilityAgent) when vehicle is known', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls uberEligibilityAgent.evaluate with citySlug', async () => {
    mockFindUnique.mockResolvedValue({
      marca: 'Toyota',
      modelo: 'Corolla',
      ano: 2020,
      carroceria: 'Sedan',
      portas: 4,
      arCondicionado: true,
    });

    mockAgentEvaluate.mockResolvedValue({
      uberX: true,
      uberComfort: true,
      uberBlack: true,
      reasoning: 'ok',
      confidence: 1,
      source: {
        citySlug: 'rio-de-janeiro',
        sourceUrl: 'x',
        fetchedAt: new Date().toISOString(),
      },
    });

    mockValidatorGetExplanation.mockReturnValue('✅ Apto');

    const ctx: ConversationContext = {
      conversationId: 'c1',
      phoneNumber: '55',
      mode: 'discovery',
      profile: {
        citySlug: 'rio-de-janeiro',
        _lastShownVehicles: [
          { vehicleId: 'v1', brand: 'Toyota', model: 'Corolla', year: 2020, price: 100000 },
        ],
      },
      messages: [] as any,
      metadata: {
        startedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: 1,
        extractionCount: 0,
        questionsAsked: 0,
        userQuestions: 0,
      },
    };

    const res = await handleUberEligibilityQuestion(
      'Esse Corolla serve pra Uber X?',
      ctx,
      { citySlug: 'rio-de-janeiro' },
      { extracted: {} },
      Date.now()
    );

    expect(res.handled).toBe(true);
    expect(mockAgentEvaluate).toHaveBeenCalled();
    expect(mockAgentEvaluate.mock.calls[0][1]).toBe('rio-de-janeiro');
  });
});
