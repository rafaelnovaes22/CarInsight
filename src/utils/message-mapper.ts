/**
 * Message Mapper Utility
 * Centralizes BaseMessage → role/content conversion used across nodes.
 */

import { BaseMessage } from '@langchain/core/messages';

export interface MappedMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Detects the role of a LangChain BaseMessage, handling both
 * class instances and serialized JSON objects from checkpoints.
 */
function detectMessageRole(message: BaseMessage): 'user' | 'assistant' {
  if (typeof message._getType === 'function') {
    return message._getType() === 'human' ? 'user' : 'assistant';
  }

  const msg = message as unknown as Record<string, unknown>;
  if (msg.type === 'human' || (typeof msg.id === 'string' && msg.id.includes('HumanMessage'))) {
    return 'user';
  }

  return 'assistant';
}

/**
 * Maps an array of LangChain BaseMessages to simple role/content objects.
 */
export function mapMessagesToContext(messages: BaseMessage[]): MappedMessage[] {
  return messages.map(m => ({
    role: detectMessageRole(m),
    content: m.content ? m.content.toString() : '',
  }));
}

/**
 * Counts user (human) messages in a BaseMessage array.
 */
export function countUserMessages(messages: BaseMessage[]): number {
  return messages.filter(m => detectMessageRole(m) === 'user').length;
}

/**
 * Checks if a BaseMessage is from the AI.
 */
export function isAIMessage(message: BaseMessage): boolean {
  return detectMessageRole(message) === 'assistant';
}
