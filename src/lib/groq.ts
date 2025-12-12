import Groq from 'groq-sdk';
import { env } from '../config/env';
import { logger } from './logger';
import { chatCompletion as routerChatCompletion } from './llm-router';

const isMockMode = !env.GROQ_API_KEY || env.GROQ_API_KEY === 'gsk-mock-key-for-development';

export const groq = new Groq({
  apiKey: env.GROQ_API_KEY || 'mock-key',
});

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat completion com LLM Routing automático
 * Primário: GPT-4o-mini (OpenAI)
 * Fallback: LLaMA 3.1 8B Instant (Groq)
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  // Usar o novo LLM Router que gerencia fallback automaticamente
  return routerChatCompletion(messages, {
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    retries: 2,
  });
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

NEUTRALIDADE (ISO 42001):
- NUNCA faça suposições baseadas em gênero, idade, localização ou nome
- Recomende veículos APENAS baseado em orçamento e necessidades declaradas
- Se o cliente não declarar preferência, PERGUNTE ao invés de assumir
- Trate TODOS os clientes com igual respeito e seriedade

${context ? `CONTEXTO: ${context}` : ''}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  return chatCompletion(messages, {
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
    temperature: 0.7,
    maxTokens: 50,
  });
}

export default groq;
