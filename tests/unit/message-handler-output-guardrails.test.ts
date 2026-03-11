import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCacheGet,
  mockCacheSet,
  mockConversationCreate,
  mockConversationFindFirst,
  mockConversationUpdate,
  mockEventCreate,
  mockMessageCreate,
  mockRecommendationCreate,
  mockValidateInput,
  mockValidateOutput,
} = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockConversationCreate: vi.fn(),
  mockConversationFindFirst: vi.fn(),
  mockConversationUpdate: vi.fn(),
  mockEventCreate: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockRecommendationCreate: vi.fn(),
  mockValidateInput: vi.fn(),
  mockValidateOutput: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    conversation: {
      findFirst: mockConversationFindFirst,
      create: mockConversationCreate,
      update: mockConversationUpdate,
      updateMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    event: {
      create: mockEventCreate,
    },
    message: {
      create: mockMessageCreate,
    },
    recommendation: {
      create: mockRecommendationCreate,
    },
  },
}));

vi.mock('../../src/lib/redis', () => ({
  cache: {
    get: mockCacheGet,
    set: mockCacheSet,
    del: vi.fn(),
  },
}));

vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/guardrails.service', () => ({
  guardrails: {
    validateInput: mockValidateInput,
    validateOutput: mockValidateOutput,
  },
}));

vi.mock('../../src/graph/langgraph-conversation', () => ({
  LangGraphConversation: class {
    async processMessage() {
      return {
        newState: {
          conversationId: 'conv-1',
          phoneNumber: '5511999999999',
          messages: [],
          quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
          profile: {},
          recommendations: [],
          graph: { currentNode: 'discovery', nodeHistory: [], errorCount: 0, loopCount: 0 },
          metadata: {
            startedAt: new Date(),
            lastMessageAt: new Date(),
            flags: [],
          },
        },
        response: 'Resposta base com preco R$ 50.000',
      };
    }
  },
}));

vi.mock('../../src/services/data-rights.service', () => ({
  dataRightsService: {
    hasUserData: vi.fn().mockResolvedValue(false),
    deleteUserData: vi.fn().mockResolvedValue(true),
    exportUserData: vi
      .fn()
      .mockResolvedValue({ totalRegistros: 0, mensagens: [], recomendacoes: [] }),
  },
}));

vi.mock('../../src/lib/feature-flags', () => ({
  featureFlags: {
    isEnabled: vi.fn().mockReturnValue(false),
    shouldUseConversationalMode: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../../src/services/follow-up.service', () => ({
  followUpService: {
    cancelPendingFollowUps: vi.fn().mockResolvedValue(undefined),
    handleOptOut: vi.fn().mockResolvedValue(undefined),
    scheduleFollowUp: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/services/conversion-tracker.service', () => ({
  conversionTracker: {
    calculateScore: vi.fn().mockReturnValue(0),
    shouldScheduleFollowUp: vi.fn().mockReturnValue(false),
  },
}));

import { MessageHandlerV2 } from '../../src/services/message-handler-v2.service';

describe('MessageHandlerV2 output guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockValidateInput.mockResolvedValue({
      allowed: true,
      sanitizedInput: 'Quero um carro',
    });
    mockValidateOutput.mockReturnValue({
      allowed: true,
      sanitizedInput: 'Resposta final com disclaimer',
    });
    mockConversationFindFirst.mockResolvedValue({
      id: 'conv-1',
      phoneNumber: '5511999999999',
      status: 'active',
      currentStep: 'greeting',
      lastMessageAt: new Date(),
    });
    mockConversationUpdate.mockResolvedValue(undefined);
    mockConversationCreate.mockResolvedValue(undefined);
    mockEventCreate.mockResolvedValue(undefined);
    mockMessageCreate.mockResolvedValue({ id: 'msg-1' });
    mockRecommendationCreate.mockResolvedValue(undefined);
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue('OK');
  });

  it('returns and persists the sanitized output from guardrails', async () => {
    const handler = new MessageHandlerV2();

    const response = await handler.handleMessage('5511999999999', 'quero um carro');

    expect(response).toBe('Resposta final com disclaimer');

    const outgoingCall = mockMessageCreate.mock.calls.find(
      call => call[0]?.data?.direction === 'outgoing'
    );

    expect(outgoingCall?.[0]?.data?.content).toBe('Resposta final com disclaimer');
  });
});
