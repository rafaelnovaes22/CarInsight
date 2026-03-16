/**
 * Automotive Domain Plugin
 *
 * Full implementation of DomainPlugin for the automotive vertical.
 * Wires up all existing automotive agents, nodes, services, and fiber.
 *
 * The actual code stays in src/agents/, src/graph/nodes/, src/services/, etc.
 * This plugin acts as the integration layer that the platform uses to
 * discover and orchestrate automotive-specific behavior.
 */

import type {
  DomainPlugin,
  DomainNodeDefinition,
  IGenericGraphState,
  FiberDefinition,
  FiberResult,
  ISearchAdapter,
  GenericRecommendation,
  DisclosureMessages,
} from '../../core/types';

import {
  greetingNode,
  discoveryNode,
  searchNode,
  recommendationNode,
  financingNode,
  tradeInNode,
  negotiationNode,
} from '../../graph/nodes';

import { computeFiber, checkFiberGuard } from '../../utils/conversation-fiber';

import type { IGraphState } from '../../types/graph.types';

// ── Constants ──

export const AUTOMOTIVE_DOMAIN_ID = 'automotive';
export const AUTOMOTIVE_DOMAIN_NAME = 'CarInsight — Assistente Automotivo';
export const AUTOMOTIVE_DOMAIN_VERSION = '1.0.0';

// ── Adapter: IGraphState ↔ IGenericGraphState ──

/**
 * Wraps an automotive node handler to conform to the generic interface.
 * Since the existing nodes already use IGraphState, this is a transparent cast.
 */
function wrapNode(
  name: string,
  handler: (state: IGraphState) => Promise<Partial<IGraphState>>
): DomainNodeDefinition {
  return {
    name,
    handler: handler as unknown as DomainNodeDefinition['handler'],
  };
}

// ── Fiber Adapter ──

const automotiveFiberDefinition: FiberDefinition = {
  phases: [
    { id: 0, label: 'Contato Inicial', description: 'Primeiro contato, sem identidade' },
    { id: 1, label: 'Descoberta', description: 'Nome coletado, sem preferências' },
    { id: 2, label: 'Perfilamento', description: 'Preferências parciais' },
    { id: 3, label: 'Pronto para Recomendar', description: 'Perfil completo para recomendação' },
    { id: 4, label: 'Avaliação', description: 'Recomendações exibidas' },
    { id: 5, label: 'Engajamento', description: 'Financiamento, troca, interesse' },
    { id: 6, label: 'Fechamento', description: 'Handoff ou visita solicitada' },
  ],

  computeFiber(state: IGenericGraphState): FiberResult {
    return computeFiber(state as unknown as IGraphState);
  },

  checkGuard(state: IGenericGraphState, nextNode: string, sourceNode?: string): string | null {
    return checkFiberGuard(state as unknown as IGraphState, nextNode, sourceNode);
  },
};

// ── Search Adapter (placeholder — real implementation in Phase 3) ──

const automotiveSearchAdapter: ISearchAdapter = {
  async search(
    _query: string,
    _filters: Record<string, unknown>
  ): Promise<GenericRecommendation[]> {
    // Phase 3: wire up VehicleSearchAdapterService here
    return [];
  },

  async getById(_id: string): Promise<Record<string, unknown> | null> {
    // Phase 3: wire up prisma.vehicle.findUnique here
    return null;
  },
};

// ── Route Resolver ──

function automotiveRouteResolver(state: IGenericGraphState): string {
  const nextNode = state.next;

  const nodeMap: Record<string, string> = {
    greeting: 'greeting',
    discovery: 'discovery',
    clarification: 'discovery',
    ready_to_recommend: 'search',
    search: 'search',
    recommendation: 'recommendation',
    refinement: 'recommendation',
    financing: 'financing',
    trade_in: 'trade_in',
    negotiation: 'negotiation',
    end: '__END__',
    handoff: '__END__',
  };

  return nodeMap[nextNode] || 'greeting';
}

// ── Disclosure Messages ──

const automotiveDisclosure: DisclosureMessages = {
  greeting:
    '🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas ou dúvidas complexas, posso transferir você para nossa equipe humana.',
  handoff: 'Vou te transferir para um de nossos consultores que pode te ajudar melhor!',
  aiDisclaimer:
    '🤖 _Sou a assistente virtual do CarInsight e, neste caso, um atendente humano pode te ajudar melhor!_',
};

// ── Plugin Implementation ──

export const automotiveDomainPlugin: DomainPlugin = {
  // Identity
  id: AUTOMOTIVE_DOMAIN_ID,
  name: AUTOMOTIVE_DOMAIN_NAME,
  version: AUTOMOTIVE_DOMAIN_VERSION,

  // Conversation Graph
  nodes: [
    wrapNode('greeting', greetingNode),
    wrapNode('discovery', discoveryNode),
    wrapNode('search', searchNode),
    wrapNode('recommendation', recommendationNode),
    wrapNode('financing', financingNode),
    wrapNode('trade_in', tradeInNode),
    wrapNode('negotiation', negotiationNode),
  ],
  entryPoint: 'greeting',
  routeResolver: automotiveRouteResolver,

  // Fiber
  fiberDefinition: automotiveFiberDefinition,

  // Initial State
  createInitialProfile() {
    return {};
  },

  createInitialState() {
    return {
      messages: [],
      phoneNumber: '',
      profile: {},
      recommendations: [],
      next: 'greeting',
      metadata: {
        startedAt: Date.now(),
        lastMessageAt: Date.now(),
        loopCount: 0,
        errorCount: 0,
        flags: [],
      },
      domainData: {},
    };
  },

  // Prompts & Messages
  systemPrompts: {
    main: 'Você é um assistente de vendas automotivo amigável e profissional. Ajude o cliente a encontrar o veículo ideal.',
  },
  disclosureMessages: automotiveDisclosure,
  exitResponse: 'Obrigado por conversar conosco! Se precisar, é só voltar. Até mais! 👋',
  welcomeResponse:
    '👋 Olá! Sou a assistente virtual do *CarInsight*. Vou te ajudar a encontrar o carro perfeito!',

  // Search
  searchAdapter: automotiveSearchAdapter,
};
