import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { LangGraphConversation } from '../../src/graph/langgraph-conversation';
import { ConversationState } from '../../src/types/state.types';
import { IGraphState } from '../../src/types/graph.types';
import { computeFiber, ConversationFiber, isRegression } from '../../src/utils/conversation-fiber';

vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockInvoke = vi.fn();
vi.mock('../../src/graph/workflow', () => ({
  createConversationGraph: () => ({
    invoke: mockInvoke,
  }),
}));

function createBaseState(): ConversationState {
  return {
    conversationId: 'fiber-e2e-conv',
    phoneNumber: '5511999999999',
    messages: [],
    profile: {},
    quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
    recommendations: [],
    graph: { currentNode: 'greeting', nodeHistory: [], errorCount: 0, loopCount: 0 },
    metadata: {
      startedAt: new Date(),
      lastMessageAt: new Date(),
      flags: [],
    },
  };
}

function createGraphResult(overrides: Partial<IGraphState>): IGraphState {
  return {
    messages: overrides.messages ?? [],
    phoneNumber: overrides.phoneNumber ?? '5511999999999',
    profile: overrides.profile ?? {},
    recommendations: overrides.recommendations ?? [],
    next: overrides.next ?? 'greeting',
    metadata: {
      startedAt: Date.now(),
      lastMessageAt: Date.now(),
      loopCount: 0,
      errorCount: 0,
      flags: [],
      ...overrides.metadata,
    },
    quiz: overrides.quiz ?? {
      currentQuestion: 1,
      progress: 0,
      answers: {},
      isComplete: false,
    },
  };
}

function conversationStateToGraphState(state: ConversationState): IGraphState {
  return {
    messages: state.messages.map(message =>
      message.role === 'user' ? new HumanMessage(message.content) : new AIMessage(message.content)
    ),
    phoneNumber: state.phoneNumber,
    profile: state.profile ?? {},
    recommendations: state.recommendations,
    next: state.graph.currentNode,
    metadata: {
      startedAt: state.metadata.startedAt.getTime(),
      lastMessageAt: state.metadata.lastMessageAt.getTime(),
      loopCount: state.graph.loopCount,
      errorCount: state.graph.errorCount,
      flags: state.metadata.flags,
      tokenUsage: state.metadata.tokenUsage,
      llmUsed: state.metadata.llmUsed,
    },
    quiz: state.quiz,
  };
}

describe('E2E: Fiber progression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps fiber progression monotonic across a realistic multi-turn conversation', async () => {
    const graph = new LangGraphConversation();
    const initialState = createBaseState();

    mockInvoke
      .mockResolvedValueOnce(
        createGraphResult({
          messages: [new HumanMessage('Oi'), new AIMessage('Olá! Qual seu nome?')],
          next: 'greeting',
          profile: {},
        })
      )
      .mockResolvedValueOnce(
        createGraphResult({
          messages: [
            new HumanMessage('Rafael'),
            new AIMessage('Prazer, Rafael. Qual faixa de orçamento?'),
          ],
          next: 'discovery',
          profile: { customerName: 'Rafael' },
        })
      )
      .mockResolvedValueOnce(
        createGraphResult({
          messages: [
            new HumanMessage('Um carro para viajar em família'),
            new AIMessage('Perfeito. E qual orçamento você imagina?'),
          ],
          next: 'discovery',
          profile: { customerName: 'Rafael', usage: 'viagem', people: 5 },
        })
      )
      .mockResolvedValueOnce(
        createGraphResult({
          messages: [
            new HumanMessage('150k'),
            new AIMessage('Já tenho algumas opções para te mostrar.'),
          ],
          next: 'search',
          profile: {
            customerName: 'Rafael',
            usage: 'viagem',
            people: 5,
            budget: 150000,
          },
        })
      )
      .mockResolvedValueOnce(
        createGraphResult({
          messages: [
            new HumanMessage('Gostei da BMW'),
            new AIMessage('Ótima escolha. Quer ver financiamento ou troca?'),
          ],
          next: 'recommendation',
          profile: {
            customerName: 'Rafael',
            usage: 'viagem',
            people: 5,
            budget: 150000,
            _showedRecommendation: true,
            _lastShownVehicles: [
              {
                vehicleId: 'v1',
                brand: 'BMW',
                model: 'X1',
                year: 2022,
                price: 149900,
              },
            ],
          },
          recommendations: [
            {
              vehicleId: 'v1',
              matchScore: 96,
              reasoning: 'Boa para viagens em família',
              highlights: ['Espaço'],
              concerns: [],
              vehicle: { id: 'v1', brand: 'BMW', model: 'X1' },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createGraphResult({
          messages: [
            new HumanMessage('Financiamento com carro na troca também'),
            new AIMessage('Consigo te ajudar com financiamento e avaliação da troca.'),
          ],
          next: 'negotiation',
          profile: {
            customerName: 'Rafael',
            usage: 'viagem',
            people: 5,
            budget: 150000,
            _showedRecommendation: true,
            wantsFinancing: true,
            hasTradeIn: true,
          },
          recommendations: [
            {
              vehicleId: 'v1',
              matchScore: 96,
              reasoning: 'Boa para viagens em família',
              highlights: ['Espaço'],
              concerns: [],
              vehicle: { id: 'v1', brand: 'BMW', model: 'X1' },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createGraphResult({
          messages: [
            new HumanMessage('Pode agendar uma visita'),
            new AIMessage('Perfeito, vou encaminhar para finalizar seu atendimento.'),
          ],
          next: 'end',
          profile: {
            customerName: 'Rafael',
            usage: 'viagem',
            people: 5,
            budget: 150000,
            _showedRecommendation: true,
            wantsFinancing: true,
            hasTradeIn: true,
          },
          recommendations: [
            {
              vehicleId: 'v1',
              matchScore: 96,
              reasoning: 'Boa para viagens em família',
              highlights: ['Espaço'],
              concerns: [],
              vehicle: { id: 'v1', brand: 'BMW', model: 'X1' },
            },
          ],
          metadata: {
            flags: ['visit_requested'],
          },
        })
      );

    const turns = [
      'Oi',
      'Rafael',
      'Um carro para viajar em família',
      '150k',
      'Gostei da BMW',
      'Financiamento com carro na troca também',
      'Pode agendar uma visita',
    ];

    const fibers: ConversationFiber[] = [];
    const nodes: string[] = [];
    let currentState = initialState;
    let previousGraphState = conversationStateToGraphState(initialState);

    fibers.push(computeFiber(previousGraphState).fiber);
    nodes.push(currentState.graph.currentNode);

    for (const turn of turns) {
      const result = await graph.processMessage(turn, currentState);
      const currentGraphState = conversationStateToGraphState(result.newState);

      expect(isRegression(previousGraphState, currentGraphState)).toBe(false);

      fibers.push(computeFiber(currentGraphState).fiber);
      nodes.push(result.newState.graph.currentNode);

      previousGraphState = currentGraphState;
      currentState = result.newState;
    }

    for (let i = 1; i < fibers.length; i++) {
      expect(fibers[i]).toBeGreaterThanOrEqual(fibers[i - 1]);
    }

    expect(fibers).toEqual([
      ConversationFiber.INITIAL_CONTACT,
      ConversationFiber.INITIAL_CONTACT,
      ConversationFiber.DISCOVERY,
      ConversationFiber.PROFILING,
      ConversationFiber.RECOMMENDATION_READY,
      ConversationFiber.EVALUATION,
      ConversationFiber.ENGAGEMENT,
      ConversationFiber.CLOSING,
    ]);

    expect(nodes).toEqual([
      'greeting',
      'greeting',
      'discovery',
      'discovery',
      'search',
      'recommendation',
      'negotiation',
      'end',
    ]);
  });
});
