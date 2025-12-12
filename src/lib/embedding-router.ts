import OpenAI from 'openai';
import { CohereClient } from 'cohere-ai';
import { env } from '../config/env';
import { logger } from './logger';

// Configuração dos providers
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY || 'mock-key',
});

const cohere = new CohereClient({
  token: env.COHERE_API_KEY || 'mock-key',
});

export interface EmbeddingProviderConfig {
  name: string;
  model: string;
  dimensions: number;
  enabled: boolean;
  priority: number;
  costPer1MTokens: number;
}

// Configuração dos modelos de embedding disponíveis
const EMBEDDING_PROVIDERS: EmbeddingProviderConfig[] = [
  {
    name: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    enabled: !!env.OPENAI_API_KEY && env.OPENAI_API_KEY !== 'mock-key',
    priority: 1, // Primário
    costPer1MTokens: 0.02, // $0.02 por 1M tokens
  },
  {
    name: 'cohere',
    model: 'embed-multilingual-v3.0',
    dimensions: 1024,
    enabled: !!env.COHERE_API_KEY && env.COHERE_API_KEY !== 'mock-key',
    priority: 2, // Fallback (excelente em português)
    costPer1MTokens: 0.01, // $0.01 por 1M tokens
  },
];

/**
 * Circuit Breaker para embeddings
 */
class EmbeddingCircuitBreaker {
  private failures: Map<string, number> = new Map();
  private lastFailure: Map<string, number> = new Map();
  private readonly threshold = 3;
  private readonly timeout = 60000; // 1 minuto

  isOpen(provider: string): boolean {
    const failures = this.failures.get(provider) || 0;
    const lastFail = this.lastFailure.get(provider) || 0;
    const now = Date.now();

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

const circuitBreaker = new EmbeddingCircuitBreaker();

/**
 * Gera embedding mock para desenvolvimento
 */
function generateMockEmbedding(dimensions: number): number[] {
  const embedding = [];
  for (let i = 0; i < dimensions; i++) {
    embedding.push(Math.random() * 2 - 1); // Valores entre -1 e 1
  }
  // Normalizar (para simular embeddings reais)
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

/**
 * Normaliza embedding para 1536 dimensões (necessário para compatibilidade)
 */
function normalizeEmbeddingDimensions(embedding: number[], targetDim: number = 1536): number[] {
  if (embedding.length === targetDim) {
    return embedding;
  }

  // Se menor, fazer padding com zeros
  if (embedding.length < targetDim) {
    return [...embedding, ...new Array(targetDim - embedding.length).fill(0)];
  }

  // Se maior, truncar
  return embedding.slice(0, targetDim);
}

/**
 * Executa chamada para OpenAI embeddings
 */
async function callOpenAIEmbedding(
  text: string
): Promise<{ embedding: number[]; usage: any; model: string }> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.trim(),
    encoding_format: 'float',
  });

  return {
    embedding: response.data[0].embedding,
    usage: response.usage,
    model: response.model,
  };
}

/**
 * Executa chamada para Cohere embeddings
 */
async function callCohereEmbedding(
  text: string
): Promise<{ embedding: number[]; usage: any; model: string }> {
  const response = await cohere.embed({
    texts: [text.trim()],
    model: 'embed-multilingual-v3.0',
    inputType: 'search_document',
    embeddingTypes: ['float'],
  });

  // Cohere retorna 1024 dimensões, normalizar para 1536 para compatibilidade
  const floatEmbeddings = Array.isArray(response.embeddings)
    ? response.embeddings[0]
    : response.embeddings.float![0];
  const embedding = normalizeEmbeddingDimensions(floatEmbeddings, 1536);

  return {
    embedding,
    usage: { total_tokens: text.split(/\s+/).length }, // Estimativa
    model: 'embed-multilingual-v3.0',
  };
}

/**
 * Executa chamada para OpenAI embeddings em batch
 */
async function callOpenAIEmbeddingBatch(
  texts: string[]
): Promise<{ embeddings: number[][]; usage: any; model: string }> {
  const cleanTexts = texts.map(t => t.trim()).filter(t => t.length > 0);

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: cleanTexts,
    encoding_format: 'float',
  });

  return {
    embeddings: response.data.map(item => item.embedding),
    usage: response.usage,
    model: response.model,
  };
}

/**
 * Executa chamada para Cohere embeddings em batch
 */
async function callCohereEmbeddingBatch(
  texts: string[]
): Promise<{ embeddings: number[][]; usage: any; model: string }> {
  const cleanTexts = texts.map(t => t.trim()).filter(t => t.length > 0);

  const response = await cohere.embed({
    texts: cleanTexts,
    model: 'embed-multilingual-v3.0',
    inputType: 'search_document',
    embeddingTypes: ['float'],
  });

  // Normalizar todos os embeddings para 1536 dimensões
  const floatEmbeddingsBatch = Array.isArray(response.embeddings)
    ? response.embeddings
    : response.embeddings.float!;
  const embeddings = floatEmbeddingsBatch.map((emb: number[]) =>
    normalizeEmbeddingDimensions(emb, 1536)
  );

  return {
    embeddings,
    usage: { total_tokens: texts.reduce((sum, t) => sum + t.split(/\s+/).length, 0) },
    model: 'embed-multilingual-v3.0',
  };
}

/**
 * Gera embedding com fallback automático e circuit breaker
 *
 * Ordem de prioridade:
 * 1. OpenAI text-embedding-3-small - Primário (1536 dim, $0.02/1M)
 * 2. Cohere embed-multilingual-v3.0 - Fallback (1024→1536 dim, $0.01/1M, excelente PT-BR)
 * 3. Mock - Se nenhum disponível
 */
export async function generateEmbedding(
  text: string,
  options: { retries?: number } = {}
): Promise<number[]> {
  const maxRetries = options.retries ?? 2;
  const providers = EMBEDDING_PROVIDERS.filter(p => p.enabled).sort(
    (a, b) => a.priority - b.priority
  );

  // Se nenhum provider configurado, usar mock
  if (providers.length === 0) {
    logger.warn('🤖 Using MOCK mode for embeddings (no API keys configured)');
    return generateMockEmbedding(1536);
  }

  // Validar input
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Texto vazio para gerar embedding');
  }

  // Tentar cada provider em ordem de prioridade
  for (const provider of providers) {
    // Verificar circuit breaker
    if (circuitBreaker.isOpen(provider.name)) {
      logger.warn({ provider: provider.name }, 'Circuit breaker open for embedding provider');
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
            textLength: cleanText.length,
          },
          'Attempting embedding generation'
        );

        let result;
        if (provider.name === 'openai') {
          result = await callOpenAIEmbedding(cleanText);
        } else if (provider.name === 'cohere') {
          result = await callCohereEmbedding(cleanText);
        } else {
          continue;
        }

        // Sucesso!
        circuitBreaker.recordSuccess(provider.name);

        logger.info(
          {
            provider: provider.name,
            model: result.model,
            dimensions: result.embedding.length,
            usage: result.usage,
          },
          'Embedding generated successfully'
        );

        return result.embedding;
      } catch (error: any) {
        logger.error(
          {
            provider: provider.name,
            model: provider.model,
            attempt,
            maxRetries,
            error: error.message,
          },
          'Embedding generation failed'
        );

        // Se foi a última tentativa, registrar falha
        if (attempt === maxRetries) {
          circuitBreaker.recordFailure(provider.name);
        }

        // Se não é a última tentativa, aguardar antes de retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }

  // Se todos falharam, usar mock como último recurso
  logger.error('All embedding providers failed, using mock embedding');
  return generateMockEmbedding(1536);
}

/**
 * Gera embeddings em batch com fallback
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  options: { retries?: number } = {}
): Promise<number[][]> {
  const maxRetries = options.retries ?? 2;
  const providers = EMBEDDING_PROVIDERS.filter(p => p.enabled).sort(
    (a, b) => a.priority - b.priority
  );

  // Se nenhum provider configurado, usar mock
  if (providers.length === 0) {
    logger.warn('🤖 Using MOCK mode for batch embeddings (no API keys configured)');
    return texts.map(() => generateMockEmbedding(1536));
  }

  // Validar input
  if (texts.length === 0) {
    return [];
  }

  const cleanTexts = texts.map(t => t.trim()).filter(t => t.length > 0);
  if (cleanTexts.length === 0) {
    return [];
  }

  // Tentar cada provider em ordem de prioridade
  for (const provider of providers) {
    if (circuitBreaker.isOpen(provider.name)) {
      logger.warn({ provider: provider.name }, 'Circuit breaker open for embedding provider');
      continue;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(
          {
            provider: provider.name,
            model: provider.model,
            attempt,
            maxRetries,
            count: cleanTexts.length,
          },
          'Attempting batch embedding generation'
        );

        let result;
        if (provider.name === 'openai') {
          result = await callOpenAIEmbeddingBatch(cleanTexts);
        } else if (provider.name === 'cohere') {
          result = await callCohereEmbeddingBatch(cleanTexts);
        } else {
          continue;
        }

        circuitBreaker.recordSuccess(provider.name);

        logger.info(
          {
            provider: provider.name,
            model: result.model,
            count: result.embeddings.length,
            dimensions: result.embeddings[0]?.length || 0,
            usage: result.usage,
          },
          'Batch embeddings generated successfully'
        );

        return result.embeddings;
      } catch (error: any) {
        logger.error(
          {
            provider: provider.name,
            model: provider.model,
            attempt,
            maxRetries,
            error: error.message,
          },
          'Batch embedding generation failed'
        );

        if (attempt === maxRetries) {
          circuitBreaker.recordFailure(provider.name);
        }

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }

  // Se todos falharam, usar mock
  logger.error('All embedding providers failed, using mock embeddings');
  return cleanTexts.map(() => generateMockEmbedding(1536));
}

/**
 * Calcula similaridade de cosseno entre dois vetores
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vetores devem ter o mesmo tamanho');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Obter status dos providers de embedding
 */
export function getEmbeddingProvidersStatus() {
  return EMBEDDING_PROVIDERS.map(provider => ({
    ...provider,
    circuitBreakerOpen: circuitBreaker.isOpen(provider.name),
  }));
}

/**
 * Resetar circuit breaker (útil para testes)
 */
export function resetCircuitBreaker() {
  circuitBreaker['failures'].clear();
  circuitBreaker['lastFailure'].clear();
}

// Exportar constantes
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
