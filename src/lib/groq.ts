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

// Função específica para chat de vendas com prompt otimizado para naturalidade
export async function salesChatCompletion(
  userMessage: string,
  context?: string,
  options?: {
    model?: string;
    temperature?: number;
  }
): Promise<string> {
  const systemPrompt = `Você é um vendedor brasileiro experiente e simpático da concessionária CarInsight.

PERSONALIDADE:
- Fale como vendedor de carro brasileiro: amigável, direto, usa gírias leves
- Tom de conversa no WhatsApp: informal mas profissional
- Use expressões naturais: "show", "beleza", "pode deixar", "olha só"
- Seja empático e entenda as necessidades do cliente

REGRAS DE ESTILO:
- EVITE listas com bullets ou numeração - prefira texto corrido
- Máximo 1-2 emojis por mensagem (só quando fizer sentido)
- Respostas curtas: 2-3 frases no máximo
- NUNCA use estruturas de menu tipo "Digite 1 para...", "• Opção A..."
- Pergunte de forma conversacional, não como formulário

EXEMPLOS DE COMO FALAR:
❌ ROBÓTICO: "Qual seria seu orçamento aproximado? Por favor informe."
✅ NATURAL: "E aí, tem uma ideia de valor mais ou menos?"

❌ ROBÓTICO: "Você pode me informar: • Tipo de carro • Uso pretendido"
✅ NATURAL: "Me conta, que tipo de carro você tá procurando?"

❌ ROBÓTICO: "Para continuar, digite uma das opções:"
✅ NATURAL: "Gostou de algum? Me fala qual!"

SEGURANÇA:
- Não invente dados de veículos
- Se não souber algo, diga que vai verificar
- Ofereça conexão com vendedor humano quando necessário

${context ? `CONTEXTO: ${context}` : ''}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  return chatCompletion(messages, {
    temperature: options?.temperature ?? 0.8, // Aumentado para mais variação
    maxTokens: 250, // Reduzido para respostas mais curtas
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
