import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { env } from '../config/env';
import { logger } from './logger';
import { traceable } from 'langsmith/traceable';

// ConfiguraÃ§Ã£o dos providers
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY || 'mock-key',
});

const groq = new Groq({
  apiKey: env.GROQ_API_KEY || 'mock-key',
});

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRouterOptions {
  temperature?: number;
  maxTokens?: number;
  retries?: number;
  timeout?: number;
}

export interface LLMProviderConfig {
  name: string;
  model: string;
  enabled: boolean;
  priority: number;
  costPer1MTokens: { input: number; output: number };
}

// ConfiguraÃ§Ã£o dos modelos disponÃ­veis
const LLM_PROVIDERS: LLMProviderConfig[] = [
  {
    name: 'openai',
    model: 'gpt-4.1-mini',
    enabled: !!env.OPENAI_API_KEY && env.OPENAI_API_KEY !== 'mock-key',
    priority: 1, // PrimÃ¡rio
    costPer1MTokens: { input: 0.4, output: 1.6 },
  },
  {
    name: 'groq',
    // Modelo Llama 3.1 8B Instant (Fallback rÃ¡pido e econÃ´mico)
    model: 'llama-3.1-8b-instant',
    enabled: !!env.GROQ_API_KEY && env.GROQ_API_KEY !== 'mock-key',
    priority: 2, // Fallback
    costPer1MTokens: { input: 0.05, output: 0.08 },
  },
];

/**
 * Classe para gerenciar circuit breaker (previne chamadas repetidas a serviÃ§os falhando)
 */
class CircuitBreaker {
  private failures: Map<string, number> = new Map();
  private lastFailure: Map<string, number> = new Map();
  private readonly threshold = 3; // Falhas antes de abrir circuito
  private readonly timeout = 60000; // 1 minuto para tentar novamente

  isOpen(provider: string): boolean {
    const failures = this.failures.get(provider) || 0;
    const lastFail = this.lastFailure.get(provider) || 0;
    const now = Date.now();

    // Se passou o timeout, resetar
    if (now - lastFail > this.timeout) {
      this.failures.set(provider, 0);
      return false;
    }

    return failures >= this.threshold;
  }

  recordFailure(provider: string): void {
    const current = this.failures.get(provider) || 0;
    this.failures.set(provider, current + 1);
    this.lastFailure.set(provider, Date.now());
  }

  recordSuccess(provider: string): void {
    this.failures.set(provider, 0);
  }
}

const circuitBreaker = new CircuitBreaker();

/**
 * Executa chamada para OpenAI gpt-4.1-mini
 */
const callOpenAI = traceable(
  async function callOpenAI(
    messages: ChatMessage[],
    options: LLMRouterOptions
  ): Promise<{ content: string; usage: any; model: string }> {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 500,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      usage: response.usage,
      model: response.model,
    };
  },
  { name: 'call_openai', run_type: 'llm' }
);

/**
 * Executa chamada para Groq LLaMA 3.1 8B Instant
 */
const callGroq = traceable(
  async function callGroq(
    messages: ChatMessage[],
    options: LLMRouterOptions
  ): Promise<{ content: string; usage: any; model: string }> {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 500,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      usage: response.usage,
      model: response.model,
    };
  },
  { name: 'call_groq', run_type: 'llm' }
);

/**
 * Modo mock para desenvolvimento sem API keys
 */
function mockResponse(messages: ChatMessage[]): {
  content: string;
  usage: any;
  model: string;
} {
  const userMessage = messages[messages.length - 1];
  const content = userMessage.content.toLowerCase();
  const systemMessage = messages.find(m => m.role === 'system')?.content.toLowerCase() || '';

  // Intent classification
  if (systemMessage.includes('classificador') || systemMessage.includes('intenÃ§Ã£o')) {
    if (
      content.includes('sim') ||
      content.includes('quero') ||
      content.includes('comprar') ||
      content.includes('carro') ||
      content.includes('veÃ­culo') ||
      content.includes('ver')
    ) {
      return {
        content: 'QUALIFICAR',
        usage: { prompt_tokens: 50, completion_tokens: 1, total_tokens: 51 },
        model: 'mock',
      };
    }
    if (
      content.includes('vendedor') ||
      content.includes('humano') ||
      content.includes('falar com')
    ) {
      return {
        content: 'HUMANO',
        usage: { prompt_tokens: 50, completion_tokens: 1, total_tokens: 51 },
        model: 'mock',
      };
    }
    if (content.includes('dÃºvida') || content.includes('preÃ§o') || content.includes('quanto')) {
      return {
        content: 'DUVIDA',
        usage: { prompt_tokens: 50, completion_tokens: 1, total_tokens: 51 },
        model: 'mock',
      };
    }
    return {
      content: 'OUTRO',
      usage: { prompt_tokens: 50, completion_tokens: 1, total_tokens: 51 },
      model: 'mock',
    };
  }

  // Recommendation reasoning
  if (
    content.includes('explique') ||
    content.includes('por que') ||
    content.includes('veÃ­culo:')
  ) {
    return {
      content:
        'Excelente custo-benefÃ­cio! Atende suas necessidades de espaÃ§o e estÃ¡ dentro do orÃ§amento.',
      usage: { prompt_tokens: 100, completion_tokens: 15, total_tokens: 115 },
      model: 'mock',
    };
  }

  return {
    content: 'OlÃ¡! Como posso ajudar vocÃª hoje? Quer ver nossos carros disponÃ­veis?',
    usage: { prompt_tokens: 50, completion_tokens: 12, total_tokens: 62 },
    model: 'mock',
  };
}

/**
 * LLM Router com fallback automÃ¡tico e circuit breaker
 *
 * Ordem de prioridade:
 * 1. gpt-4.1-mini (OpenAI) - PrimÃ¡rio
 * 2. LLaMA 3.1 8B Instant (Groq) - Fallback
 * 3. Mock Mode - Se nenhum disponÃ­vel
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: LLMRouterOptions = {}
): Promise<{ content: string; usage: any; model: string }> {
  const maxRetries = options.retries ?? 2;
  const providers = LLM_PROVIDERS.filter(p => p.enabled).sort((a, b) => a.priority - b.priority);

  // Se nenhum provider estÃ¡ configurado, usar mock
  if (providers.length === 0) {
    logger.warn('ðŸ¤– Using MOCK mode (no API keys configured)');
    return mockResponse(messages);
  }

  // Tentar cada provider em ordem de prioridade
  for (const provider of providers) {
    // Verificar circuit breaker
    if (circuitBreaker.isOpen(provider.name)) {
      logger.warn({ provider: provider.name }, 'Circuit breaker open, skipping provider');
      continue;
    }

    // Tentar com retry
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(
          {
            provider: provider.name,
            model: provider.model,
            attempt,
            maxRetries,
          },
          'Attempting LLM call'
        );

        let result;
        if (provider.name === 'openai') {
          result = await callOpenAI(messages, options);
        } else if (provider.name === 'groq') {
          result = await callGroq(messages, options);
        } else {
          continue;
        }

        // Sucesso!
        circuitBreaker.recordSuccess(provider.name);

        logger.info(
          {
            provider: provider.name,
            model: result.model,
            usage: result.usage,
            contentLength: result.content.length,
          },
          'LLM call successful'
        );

        return result;
      } catch (error: any) {
        logger.error(
          {
            provider: provider.name,
            model: provider.model,
            attempt,
            maxRetries,
            error: error.message,
          },
          'LLM call failed'
        );

        // Se foi a Ãºltima tentativa, registrar falha
        if (attempt === maxRetries) {
          circuitBreaker.recordFailure(provider.name);
        }

        // Se nÃ£o Ã© a Ãºltima tentativa, aguardar antes de retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }

  // Se todos falharam, usar mock como Ãºltimo recurso
  logger.error('All LLM providers failed, using mock response');
  return mockResponse(messages);
}

/**
 * Obter estatÃ­sticas dos providers disponÃ­veis
 */
export function getLLMProvidersStatus() {
  return LLM_PROVIDERS.map(provider => ({
    ...provider,
    circuitBreakerOpen: circuitBreaker.isOpen(provider.name),
  }));
}

/**
 * ForÃ§ar reset do circuit breaker (Ãºtil para testes)
 */
export function resetCircuitBreaker() {
  circuitBreaker['failures'].clear();
  circuitBreaker['lastFailure'].clear();
}

/**
 * Calculate cost based on model and token usage
 * Returns cost in USD
 */
export function calculateCost(
  model: string,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  if (!usage) return 0;

  // Find provider by model name (approximate match)
  const provider = LLM_PROVIDERS.find(p => model.includes(p.model) || p.model.includes(model));

  if (!provider) {
    // Default to gpt-4.1-mini if unknown
    const defaultProvider = LLM_PROVIDERS.find(p => p.name === 'openai');
    if (defaultProvider) {
      const inputCost = (usage.prompt_tokens / 1_000_000) * defaultProvider.costPer1MTokens.input;
      const outputCost =
        (usage.completion_tokens / 1_000_000) * defaultProvider.costPer1MTokens.output;
      return inputCost + outputCost;
    }
    return 0;
  }

  const inputCost = (usage.prompt_tokens / 1_000_000) * provider.costPer1MTokens.input;
  const outputCost = (usage.completion_tokens / 1_000_000) * provider.costPer1MTokens.output;

  return inputCost + outputCost;
}
