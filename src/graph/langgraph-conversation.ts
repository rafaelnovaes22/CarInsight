/**
 * LangGraph Conversation System - Integrated
 * Uses LangGraph StateGraph for conversation flow management
 */

import { HumanMessage } from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';
import { logger } from '../lib/logger';
import { ConversationState, BotMessage, GraphContext } from '../types/state.types';
import { IGraphState } from '../types/graph.types';
import { createConversationGraph } from './workflow';

const FALLBACK_RESPONSE =
  'Como posso ajudar voce? Se preferir, digite "vendedor" para falar com nossa equipe.';

const isAiMessage = (message: any): boolean => {
  if (!message) return false;

  if (typeof message._getType === 'function') {
    return message._getType() === 'ai';
  }

  return message.type === 'ai' || message.id?.includes('AIMessage');
};

/**
 * LangGraph Conversation Manager
 * Manages conversation flow using the compiled LangGraph workflow
 */
export class LangGraphConversation {
  private app: Runnable;

  constructor() {
    this.app = createConversationGraph();
  }

  /**
   * Process a message using the LangGraph workflow
   */
  async processMessage(
    message: string,
    state: ConversationState
  ): Promise<{ response: string; newState: ConversationState }> {
    const startTime = Date.now();
    const conversationId = state.conversationId;

    try {
      logger.info({ conversationId, message }, 'LangGraph: Processing message via Graph');

      const config = { configurable: { thread_id: conversationId } };

      const result = await this.app.invoke(
        {
          messages: [new HumanMessage(message)],
        },
        config
      );

      const finalState = result as IGraphState;
      const lastMessage = finalState.messages[finalState.messages.length - 1];
      const responseContent =
        isAiMessage(lastMessage) && lastMessage?.content ? lastMessage.content.toString() : '';
      const newState = this.mapToLegacyState(finalState, state);

      if (!responseContent.trim()) {
        const lastMessageType =
          typeof lastMessage?._getType === 'function'
            ? lastMessage._getType()
            : ((lastMessage as any)?.type ?? 'unknown');

        logger.warn(
          { conversationId, nextNode: finalState.next, lastMessageType },
          'LangGraph: Missing AI response'
        );

        return {
          response: FALLBACK_RESPONSE,
          newState,
        };
      }

      logger.info(
        {
          conversationId,
          processingTime: Date.now() - startTime,
          nextNode: finalState.next,
        },
        'LangGraph: Execution completed'
      );

      return {
        response: responseContent,
        newState,
      };
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          conversationId,
        },
        'LangGraph: Error processing message'
      );
      return {
        response: 'Desculpe, tive um problema ao processar sua mensagem. Pode reformular?',
        newState: state,
      };
    }
  }

  /**
   * Maps IGraphState back to ConversationState for backward compatibility
   */
  private mapToLegacyState(
    graphState: IGraphState,
    originalState: ConversationState
  ): ConversationState {
    const mappedMessages: BotMessage[] = graphState.messages.map(msg => {
      let role: 'user' | 'assistant' = 'assistant';

      if (msg instanceof HumanMessage) {
        role = 'user';
      } else if (typeof msg._getType === 'function' && msg._getType() === 'human') {
        role = 'user';
      } else if ((msg as any).type === 'human' || (msg as any).id?.includes('HumanMessage')) {
        role = 'user';
      }

      return {
        role,
        content: msg.content ? msg.content.toString() : '',
        timestamp: new Date(),
      };
    });

    const graphContext: GraphContext = {
      currentNode: graphState.next,
      nodeHistory: originalState.graph.nodeHistory,
      errorCount: graphState.metadata.errorCount,
      loopCount: graphState.metadata.loopCount,
    };

    return {
      conversationId: originalState.conversationId,
      phoneNumber: originalState.phoneNumber,
      messages: mappedMessages,
      quiz: graphState.quiz,
      profile: graphState.profile as any,
      recommendations: graphState.recommendations,
      graph: graphContext,
      metadata: {
        startedAt: new Date(graphState.metadata.startedAt),
        lastMessageAt: new Date(graphState.metadata.lastMessageAt),
        flags: graphState.metadata.flags,
        tokenUsage: graphState.metadata.tokenUsage,
        llmUsed: graphState.metadata.llmUsed,
      },
    };
  }
}
