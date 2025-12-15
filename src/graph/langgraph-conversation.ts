/**
 * LangGraph Conversation System - Integrated
 * Uses LangGraph StateGraph for conversation flow management
 */

import { logger } from '../lib/logger';
import { ConversationState, BotMessage, GraphContext } from '../types/state.types';
import { IGraphState } from '../types/graph.types';
import { createConversationGraph } from './workflow';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';

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
      logger.info(
        { conversationId, message },
        'LangGraph: Processing message via Graph'
      );

      // Invoke the graph
      // The graph handles persistence via PrismaCheckpointer using thread_id
      const config = { configurable: { thread_id: conversationId } };

      // We pass the new user message. The graph loads history from persistence.
      // Note: If this is the VERY first message and nothing is in persistence, 
      // the graph will initialize with default state + this message.
      const result = await this.app.invoke(
        {
          messages: [new HumanMessage(message)],
          // Merge relevant existing state functionality if needed, e.g. persistence of legacy fields not yet in graph
          // But ideally graph persistence is the source of truth now.
        },
        config
      );

      const finalState = result as IGraphState;
      const lastMessage = finalState.messages[finalState.messages.length - 1];
      const responseContent = lastMessage?.content?.toString() || '';

      logger.info(
        {
          conversationId,
          processingTime: Date.now() - startTime,
          nextNode: finalState.next,
        },
        'LangGraph: Execution completed'
      );

      // Map back to legacy state for compatibility with external caller
      const newState = this.mapToLegacyState(finalState, state);

      return {
        response: responseContent,
        newState,
      };

    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          conversationId
        },
        'LangGraph: Error processing message'
      );

      return {
        response: 'Desculpe, tive um problema ao processar sua mensagem. Pode reformular? 🤔',
        newState: state, // Return original state on error
      };
    }
  }

  /**
   * Maps IGraphState back to ConversationState for backward compatibility
   */
  private mapToLegacyState(graphState: IGraphState, originalState: ConversationState): ConversationState {
    // Convert BaseMessage[] to BotMessage[]
    const mappedMessages: BotMessage[] = graphState.messages.map(msg => {
      const role = msg instanceof HumanMessage ? 'user' : 'assistant';
      return {
        role,
        content: msg.content.toString(),
        timestamp: new Date(), // We might lose exact timestamp in BaseMessage unless stored in additional_kwargs
      };
    });

    const graphContext: GraphContext = {
      currentNode: graphState.next,
      nodeHistory: originalState.graph.nodeHistory, // We might lose purely graph-internal history logic unless we track it
      errorCount: graphState.metadata.errorCount,
      loopCount: graphState.metadata.loopCount,
    };

    return {
      conversationId: originalState.conversationId,
      phoneNumber: originalState.phoneNumber,
      messages: mappedMessages,
      quiz: graphState.quiz,
      profile: graphState.profile as any, // Type partial compatibility
      recommendations: graphState.recommendations,
      graph: graphContext,
      metadata: {
        startedAt: new Date(graphState.metadata.startedAt),
        lastMessageAt: new Date(graphState.metadata.lastMessageAt),
        flags: graphState.metadata.flags,
      }
    };
  }
}
