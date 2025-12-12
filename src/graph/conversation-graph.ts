/**
 * LangGraph Conversation Flow for FaciliAuto
 * 
 * Simple linear flow:
 * START → Greeting → Quiz → Search → Recommendation → END
 */

import { ConversationState, BotMessage } from '../types/state.types';
import { greetingNode } from './nodes/greeting.node';
import { quizNode } from './nodes/quiz.node';
import { searchNode } from './nodes/search.node';
import { recommendationNode } from './nodes/recommendation.node';
import { logger } from '../lib/logger';

/**
 * Route to next node based on current state
 */
function _routeNext(state: ConversationState): string {
  const currentNode = state.graph.currentNode;

  // Prevent infinite loops
  if (state.graph.loopCount > 20) {
    logger.error({ conversationId: state.conversationId }, 'ConversationGraph: Loop limit exceeded');
    return 'END';
  }

  // Routing logic
  switch (currentNode) {
    case 'greeting':
      return 'quiz';

    case 'quiz':
      if (state.quiz.isComplete) {
        return 'search';
      }
      return 'quiz'; // Stay in quiz until complete

    case 'search':
      return 'recommendation';

    case 'recommendation': {
      // Check if user wants to end conversation
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage.content.toLowerCase().includes('vendedor') ||
        lastMessage.content.toLowerCase().includes('agendar')) {
        return 'END';
      }
      return 'recommendation'; // Stay in recommendation for follow-ups
    }

    default:
      return 'END';
  }
}

/**
 * Execute conversation graph (simplified implementation)
 * This is a basic implementation. When LangGraph is installed, we'll use the full StateGraph
 */
export class ConversationGraph {
  async invoke(input: {
    conversationId: string;
    phoneNumber: string;
    message: string;
    currentState?: ConversationState;
  }): Promise<ConversationState> {

    // Initialize or use existing state
    let state: ConversationState = input.currentState || {
      conversationId: input.conversationId,
      phoneNumber: input.phoneNumber,
      messages: [],
      quiz: {
        currentQuestion: 1,
        progress: 0,
        answers: {},
        isComplete: false,
      },
      profile: null,
      recommendations: [],
      graph: {
        currentNode: 'greeting',
        nodeHistory: [],
        errorCount: 0,
        loopCount: 0,
      },
      metadata: {
        startedAt: new Date(),
        lastMessageAt: new Date(),
        flags: [],
      },
    };

    // Add user message to state
    const userMessage: BotMessage = {
      role: 'user',
      content: input.message,
      timestamp: new Date(),
    };
    state.messages = [...state.messages, userMessage];

    // Increment loop counter
    state.graph.loopCount = (state.graph.loopCount || 0) + 1;

    logger.info({
      conversationId: input.conversationId,
      currentNode: state.graph.currentNode,
      messageCount: state.messages.length
    }, 'ConversationGraph: Processing message');

    // Execute current node
    let update;
    try {
      switch (state.graph.currentNode) {
        case 'greeting':
          update = await greetingNode(state);
          break;

        case 'quiz':
          update = await quizNode(state);
          break;

        case 'search':
          update = await searchNode(state);
          break;

        case 'recommendation':
          update = await recommendationNode(state);
          break;

        default:
          logger.warn({ currentNode: state.graph.currentNode }, 'ConversationGraph: Unknown node');
          update = {
            messages: [
              ...state.messages,
              {
                role: 'assistant',
                content: 'Desculpe, algo deu errado. Digite "vendedor" para falar com nossa equipe.',
                timestamp: new Date(),
              },
            ],
          };
      }

      // Merge update into state
      state = { ...state, ...update };

      logger.info({
        conversationId: input.conversationId,
        nextNode: state.graph.currentNode,
        quizProgress: state.quiz.progress
      }, 'ConversationGraph: Node executed');

    } catch (error) {
      logger.error({ error, conversationId: input.conversationId }, 'ConversationGraph: Node execution error');

      state.graph.errorCount = (state.graph.errorCount || 0) + 1;
      state.messages = [
        ...state.messages,
        {
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro. Por favor, tente novamente ou digite "vendedor" para ajuda.',
          timestamp: new Date(),
        },
      ];
    }

    return state;
  }

  /**
   * Get the last assistant message from state
   */
  getLastResponse(state: ConversationState): string {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      return lastMessage.content;
    }
    return 'Desculpe, não consegui processar sua mensagem.';
  }
}

// Export singleton instance
export const conversationGraph = new ConversationGraph();
