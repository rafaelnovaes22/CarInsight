import { describe, it, expect, beforeEach } from 'vitest';
import { QuizAgent } from '../../src/agents/quiz.agent';

describe('Quiz Agent - E2E', () => {
  let quizAgent: QuizAgent;

  beforeEach(() => {
    quizAgent = new QuizAgent();
  });

  describe('Welcome Message', () => {
    it('deve gerar mensagem de boas-vindas', () => {
      const message = quizAgent.getWelcomeMessage();
      
      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(50);
    });
  });

  describe('Process Answer', () => {
    it('deve processar resposta válida de orçamento', async () => {
      const result = await quizAgent.processAnswer('50000', 0, {});
      
      expect(result).toBeDefined();
      expect(result.answers).toHaveProperty('budget');
      expect(result.progressIncrement).toBe(true);
    });

    it('deve rejeitar orçamento inválido', async () => {
      const result = await quizAgent.processAnswer('abc', 0, {});
      
      expect(result.progressIncrement).toBe(false);
    });
  });
});
