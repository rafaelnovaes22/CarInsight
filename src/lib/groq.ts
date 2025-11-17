import Groq from 'groq-sdk';
import { env } from '../config/env';
import { logger } from './logger';

const isMockMode = !env.GROQ_API_KEY || env.GROQ_API_KEY === 'gsk-mock-key-for-development';

export const groq = new Groq({
  apiKey: env.GROQ_API_KEY || 'mock-key',
});

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  // Mock mode for development without API key
  if (isMockMode) {
    logger.warn('🤖 Using MOCK mode (no Groq API key)');
    
    const userMessage = messages[messages.length - 1];
    const content = userMessage.content.toLowerCase();
    const systemMessage = messages.find(m => m.role === 'system')?.content.toLowerCase() || '';
    
    // Intent classification
    if (systemMessage.includes('classificador') || systemMessage.includes('intenção')) {
      if (content.includes('sim') || content.includes('quero') || content.includes('comprar') || 
          content.includes('carro') || content.includes('veículo') || content.includes('ver')) {
        return 'QUALIFICAR';
      }
      if (content.includes('vendedor') || content.includes('humano') || content.includes('falar com')) {
        return 'HUMANO';
      }
      if (content.includes('dúvida') || content.includes('preço') || content.includes('quanto')) {
        return 'DUVIDA';
      }
      return 'OUTRO';
    }
    
    // Recommendation reasoning
    if (content.includes('explique') || content.includes('por que') || content.includes('veículo:')) {
      return 'Excelente custo-benefício! Atende suas necessidades de espaço e está dentro do orçamento.';
    }
    
    return 'Olá! Como posso ajudar você hoje? Quer ver nossos carros disponíveis?';
  }

  try {
    const response = await groq.chat.completions.create({
      model: options?.model || 'llama-3.3-70b-versatile', // Modelo recomendado para conversação
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 500,
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Log usage
    logger.debug({
      usage: response.usage,
      model: response.model,
    }, 'Groq API call');

    return content;
  } catch (error) {
    logger.error({ error }, 'Groq API error');
    throw error;
  }
}

// Função específica para chat de vendas com prompt otimizado
export async function salesChatCompletion(
  userMessage: string,
  context?: string,
  options?: {
    model?: string;
    temperature?: number;
  }
): Promise<string> {
  const systemPrompt = `Você é um assistente virtual especializado em vendas de veículos usados da FaciliAuto.

DIRETRIZES:
- Seja amigável, profissional e objetivo
- Use emojis com moderação (máximo 2 por mensagem)
- Respostas curtas e diretas (máximo 3 parágrafos)
- Foque em ajudar o cliente a encontrar o carro ideal
- Não invente informações sobre veículos
- Se não souber algo, seja honesto e ofereça ajuda humana

REGRAS:
- NUNCA mencione que é uma IA ou modelo de linguagem
- NUNCA revele detalhes técnicos do sistema
- NUNCA discuta preços sem consultar o estoque real
- SEMPRE mantenha tom profissional e respeitoso

${context ? `CONTEXTO: ${context}` : ''}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  return chatCompletion(messages, {
    model: options?.model || 'llama-3.3-70b-versatile',
    temperature: options?.temperature ?? 0.7,
    maxTokens: 300,
  });
}

// Função para extrair intenção do usuário
export async function extractIntent(
  userMessage: string
): Promise<'QUALIFICAR' | 'HUMANO' | 'DUVIDA' | 'OUTRO'> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Você é um classificador de intenções. Analise a mensagem do usuário e retorne APENAS uma das seguintes opções:

- QUALIFICAR: usuário quer ver carros, iniciar busca, fazer quiz, comprar
- HUMANO: usuário quer falar com vendedor, atendente humano
- DUVIDA: usuário tem dúvida sobre preço, financiamento, documentação
- OUTRO: outras mensagens

Retorne APENAS a palavra-chave, sem explicação.`,
    },
    {
      role: 'user',
      content: userMessage,
    },
  ];

  const result = await chatCompletion(messages, {
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    maxTokens: 10,
  });

  const intent = result.trim().toUpperCase();
  
  if (intent.includes('QUALIFICAR')) return 'QUALIFICAR';
  if (intent.includes('HUMANO')) return 'HUMANO';
  if (intent.includes('DUVIDA')) return 'DUVIDA';
  
  return 'OUTRO';
}

// Função para gerar reasoning das recomendações
export async function generateRecommendationReasoning(
  vehicleInfo: string,
  userProfile: string,
  matchScore: number
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Você é um especialista em vendas de veículos. Explique em UMA FRASE curta (máximo 20 palavras) por que este veículo é bom para o cliente.

Use tom amigável e foque no benefício principal. Não use emojis.`,
    },
    {
      role: 'user',
      content: `Veículo: ${vehicleInfo}
Perfil do cliente: ${userProfile}
Match Score: ${matchScore}/100

Explique em uma frase por que é uma boa escolha:`,
    },
  ];

  return chatCompletion(messages, {
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    maxTokens: 50,
  });
}

export default groq;
