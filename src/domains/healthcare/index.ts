/**
 * Healthcare Domain Plugin
 *
 * Proof-of-concept implementation of DomainPlugin for healthcare/clinic scheduling.
 * Provides appointment booking via WhatsApp with specialty triage.
 *
 * 4 nodes: greeting → triage → scheduling → confirmation
 * Search adapter uses mock data (no Prisma model in this phase).
 */

import type {
  DomainPlugin,
  DomainNodeDefinition,
  IGenericGraphState,
  DisclosureMessages,
} from '../../core/types';

import {
  healthcareGreetingNode,
  healthcareTriageNode,
  healthcareSchedulingNode,
  healthcareConfirmationNode,
} from './nodes';

import { healthcareFiberDefinition } from './fiber';
import { healthcareSearchAdapter } from './search-adapter';
import { healthcarePrompts, healthcareDisclosure } from './config';

// ── Constants ──

export const HEALTHCARE_DOMAIN_ID = 'healthcare';
export const HEALTHCARE_DOMAIN_NAME = 'ClinicInsight — Assistente de Agendamento';
export const HEALTHCARE_DOMAIN_VERSION = '0.1.0';

// ── Node Wrapper ──

function wrapNode(
  name: string,
  handler: (state: IGenericGraphState) => Promise<Partial<IGenericGraphState>>
): DomainNodeDefinition {
  return { name, handler };
}

// ── Route Resolver ──

function healthcareRouteResolver(state: IGenericGraphState): string {
  const nextNode = state.next;

  const nodeMap: Record<string, string> = {
    greeting: 'greeting',
    triage: 'triage',
    scheduling: 'scheduling',
    confirmation: 'confirmation',
    end: '__END__',
    __END__: '__END__',
    handoff: '__END__',
  };

  return nodeMap[nextNode] || 'greeting';
}

// ── Plugin Implementation ──

export const healthcareDomainPlugin: DomainPlugin = {
  // Identity
  id: HEALTHCARE_DOMAIN_ID,
  name: HEALTHCARE_DOMAIN_NAME,
  version: HEALTHCARE_DOMAIN_VERSION,

  // Conversation Graph
  nodes: [
    wrapNode('greeting', healthcareGreetingNode),
    wrapNode('triage', healthcareTriageNode),
    wrapNode('scheduling', healthcareSchedulingNode),
    wrapNode('confirmation', healthcareConfirmationNode),
  ],
  entryPoint: 'greeting',
  routeResolver: healthcareRouteResolver,

  // Fiber
  fiberDefinition: healthcareFiberDefinition,

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
  systemPrompts: healthcarePrompts,
  disclosureMessages: healthcareDisclosure as DisclosureMessages,
  exitResponse: 'Obrigado por utilizar nosso servico de agendamento! Ate a proxima.',
  welcomeResponse:
    'Ola! Sou o assistente virtual de agendamento de consultas. Como posso te ajudar hoje?',

  // Search
  searchAdapter: healthcareSearchAdapter,
};
