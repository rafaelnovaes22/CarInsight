import { StateGraph, END } from '@langchain/langgraph';
import { IGraphState, createInitialState } from '../types/graph.types';
import {
  greetingNode,
  discoveryNode,
  searchNode,
  recommendationNode,
  financingNode,
  tradeInNode,
  negotiationNode,
} from './nodes';
import { PrismaCheckpointer } from './persistence/prisma-saver';
import { logger } from '../lib/logger';
import { RunnableConfig } from '@langchain/core/runnables';

/**
 * Route function that determines the next node based on the 'next' state property
 */
const routeNode = (state: IGraphState) => {
  // Stop execution if the last message was from the AI (waiting for user input)
  // Stop execution if the last message was from the AI (waiting for user input)
  const lastMessage = state.messages[state.messages.length - 1];

  // Robust check for AI message (handles serialized objects)
  let isAi = false;
  if (lastMessage) {
    if (typeof lastMessage._getType === 'function') {
      isAi = lastMessage._getType() === 'ai';
    } else {
      // Serialized check
      const msg = lastMessage as any;
      isAi = msg.type === 'ai' || msg.id?.includes('AIMessage');
    }
  }

  if (isAi) {
    return END;
  }

  const nextNode = state.next;
  logger.info({ nextNode }, 'Router: Validating transition');

  // Map state 'next' values to actual graph nodes
  switch (nextNode) {
    case 'greeting':
      return 'greeting';
    case 'discovery':
      return 'discovery';
    case 'clarification':
      // Clarification is handled by discovery in the LangGraph workflow.
      return 'discovery';
    case 'ready_to_recommend':
      return 'search';
    case 'search':
      return 'search';
    case 'recommendation':
      return 'recommendation';
    case 'refinement':
      return 'recommendation';
    case 'financing':
      return 'financing';
    case 'trade_in':
      return 'trade_in';
    case 'negotiation':
      return 'negotiation';
    case 'end':
    case 'handoff':
      return END;
    default: {
      // Keep the user in discovery if profile already exists to avoid name-collection loops.
      const fallbackNode = state.profile?.customerName ? 'discovery' : 'greeting';
      logger.warn({ nextNode, fallbackNode }, 'Router: Unknown next state, using safe fallback');
      return fallbackNode;
    }
  }
};

/**
 * Create the persistent conversation graph
 */
export const createConversationGraph = (config?: { checkpointer?: any }) => {
  // Explicitly define node names for TypeScript if needed, or rely on string literals
  const workflow = new StateGraph<IGraphState>({
    channels: {
      messages: {
        value: (x: any[], y: any[]) => x.concat(y),
        default: () => [],
      },
      phoneNumber: {
        value: (x: string, y: string) => y, // Always take latest
        default: () => '',
      },
      profile: {
        value: (x: any, y: any) => ({ ...x, ...y }),
        default: () => ({}),
      },
      recommendations: {
        value: (x: any, y: any) => (y ? y : x), // Overwrite or Keep
        default: () => [],
      },
      next: {
        value: (x: string, y: string) => y,
        default: () => 'greeting',
      },
      metadata: {
        value: (x: any, y: any) => ({ ...x, ...y }),
        default: () => ({
          startedAt: Date.now(),
          lastMessageAt: Date.now(),
          loopCount: 0,
          errorCount: 0,
          flags: [],
        }),
      },
      quiz: {
        value: (x: any, y: any) => ({ ...x, ...y }),
        default: () => ({
          currentQuestion: 1,
          progress: 0,
          answers: {},
          isComplete: false,
        }),
      },
    },
  });

  // Add Nodes - name them explicitly
  workflow.addNode('greeting', greetingNode);
  workflow.addNode('discovery', discoveryNode);
  workflow.addNode('search', searchNode);
  workflow.addNode('recommendation', recommendationNode);
  workflow.addNode('financing', financingNode);
  workflow.addNode('trade_in', tradeInNode);
  workflow.addNode('negotiation', negotiationNode);

  // Set Entry Point - Cast to any if strict typing fails inappropriately due to version mismatch
  workflow.setEntryPoint('greeting' as any);

  // Define Edges with Routing Logic
  // Using explicit casts to avoid 'not assignable to param' if library expects specific generic keys
  workflow.addConditionalEdges('greeting' as any, routeNode);
  workflow.addConditionalEdges('discovery' as any, routeNode);
  workflow.addConditionalEdges('search' as any, routeNode);
  workflow.addConditionalEdges('recommendation' as any, routeNode);
  workflow.addConditionalEdges('financing' as any, routeNode);
  workflow.addConditionalEdges('trade_in' as any, routeNode);
  workflow.addConditionalEdges('negotiation' as any, routeNode);

  // Compile with Checkpointer
  // Use provided checkpointer or default to PrismaCheckpointer
  const checkpointer = config?.checkpointer ?? new PrismaCheckpointer();

  return workflow.compile({
    checkpointer,
  });
};
