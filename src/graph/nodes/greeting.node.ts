import { ConversationState, StateUpdate } from '../../types/state.types';
import { logger } from '../../lib/logger';
import { DISCLOSURE_MESSAGES } from '../../config/disclosure.messages';

/**
 * GreetingNode - First interaction with the customer
 * ISO 42001 Compliance: Includes AI disclosure in first message
 */
export async function greetingNode(state: ConversationState): Promise<StateUpdate> {
  logger.info({ conversationId: state.conversationId }, 'GreetingNode: Starting greeting');

  // Check if this is first message or returning
  const isFirstMessage = state.messages.length <= 1;

  let greetingMessage: string;

  if (isFirstMessage) {
    // ISO 42001: First time greeting with AI disclosure
    greetingMessage = `${DISCLOSURE_MESSAGES.INITIAL_GREETING}

🎯 Vou fazer 8 perguntas rápidas para entender suas necessidades e recomendar os melhores veículos para você.

Leva menos de 2 minutos! Vamos começar?

💰 Qual seu orçamento disponível para o carro?

_Exemplo: 50000 ou 50 mil_`;
  } else {
    // Returning or continuing conversation
    greetingMessage = `Olá novamente! 👋

Vamos continuar de onde paramos.

💰 Qual seu orçamento disponível para o carro?

_Exemplo: 50000 ou 50 mil_`;
  }

  // Update state
  return {
    messages: [
      ...state.messages,
      {
        role: 'assistant',
        content: greetingMessage,
        timestamp: new Date(),
      },
    ],
    quiz: {
      ...state.quiz,
      currentQuestion: 1,
      progress: 0,
    },
    graph: {
      ...state.graph,
      currentNode: 'quiz',
      previousNode: 'greeting',
      nodeHistory: [...state.graph.nodeHistory, 'greeting'],
    },
    metadata: {
      ...state.metadata,
      lastMessageAt: new Date(),
    },
  };
}
