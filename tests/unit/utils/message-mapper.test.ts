import { describe, it, expect } from 'vitest';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import {
  mapMessagesToContext,
  countUserMessages,
  isAIMessage,
} from '../../../src/utils/message-mapper';

describe('message-mapper', () => {
  describe('mapMessagesToContext', () => {
    it('should map HumanMessage to user role', () => {
      const messages = [new HumanMessage('oi')];
      const result = mapMessagesToContext(messages);
      expect(result).toEqual([{ role: 'user', content: 'oi' }]);
    });

    it('should map AIMessage to assistant role', () => {
      const messages = [new AIMessage('olá!')];
      const result = mapMessagesToContext(messages);
      expect(result).toEqual([{ role: 'assistant', content: 'olá!' }]);
    });

    it('should map mixed messages correctly', () => {
      const messages = [
        new HumanMessage('quero um carro'),
        new AIMessage('qual seu orçamento?'),
        new HumanMessage('80 mil'),
      ];
      const result = mapMessagesToContext(messages);
      expect(result).toHaveLength(3);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
      expect(result[2].role).toBe('user');
    });

    it('should handle empty messages array', () => {
      const result = mapMessagesToContext([]);
      expect(result).toEqual([]);
    });

    it('should handle serialized message objects', () => {
      const serialized = { type: 'human', content: 'test', id: 'msg1' } as any;
      const result = mapMessagesToContext([serialized]);
      expect(result[0].role).toBe('user');
    });
  });

  describe('countUserMessages', () => {
    it('should count only human messages', () => {
      const messages = [
        new HumanMessage('oi'),
        new AIMessage('olá!'),
        new HumanMessage('quero um SUV'),
      ];
      expect(countUserMessages(messages)).toBe(2);
    });

    it('should return 0 for empty array', () => {
      expect(countUserMessages([])).toBe(0);
    });

    it('should return 0 for only AI messages', () => {
      const messages = [new AIMessage('olá'), new AIMessage('posso ajudar?')];
      expect(countUserMessages(messages)).toBe(0);
    });
  });

  describe('isAIMessage', () => {
    it('should return true for AIMessage', () => {
      expect(isAIMessage(new AIMessage('test'))).toBe(true);
    });

    it('should return false for HumanMessage', () => {
      expect(isAIMessage(new HumanMessage('test'))).toBe(false);
    });
  });
});
