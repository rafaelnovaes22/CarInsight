import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from './logger';

const isMockMode = env.OPENAI_API_KEY === 'sk-mock-key-for-development';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function chatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  // Mock mode for development without API key
  if (isMockMode) {
    logger.warn('🤖 Using MOCK mode (no OpenAI API key)');

    const userMessage = messages[messages.length - 1];
    const content =
      typeof userMessage.content === 'string' ? userMessage.content.toLowerCase() : '';

    // Simple mock responses based on context
    if (content.includes('intenção') || content.includes('identifique')) {
      if (content.includes('comprar') || content.includes('carro') || content.includes('veículo')) {
        return 'QUALIFICAR';
      }
      if (content.includes('vendedor') || content.includes('humano')) {
        return 'HUMANO';
      }
      if (content.includes('dúvida') || content.includes('preço')) {
        return 'DUVIDA';
      }
      return 'OUTRO';
    }

    if (content.includes('explique') || content.includes('por que')) {
      return 'Excelente custo-benefício! Atende suas necessidades de espaço e está dentro do orçamento.';
    }

    return 'Olá! Como posso ajudar você hoje? Quer ver nossos carros disponíveis?';
  }

  try {
    const response = await openai.chat.completions.create({
      model: options?.model || 'gpt-4',
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 500,
    });

    const content = response.choices[0]?.message?.content || '';

    // Log usage
    logger.debug(
      {
        usage: response.usage,
        model: response.model,
      },
      'OpenAI API call'
    );

    return content;
  } catch (error) {
    logger.error({ error }, 'OpenAI API error');
    throw error;
  }
}

export default openai;
