import { logger } from './logger';
import {
  generateEmbedding as routerGenerateEmbedding,
  generateEmbeddingsBatch as routerGenerateEmbeddingsBatch,
  cosineSimilarity as routerCosineSimilarity,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from './embedding-router';

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  model: string;
}

export interface SimilarityResult {
  id: string;
  score: number;
  metadata?: any;
}

/**
 * Gera embedding com fallback automático
 * Primário: OpenAI text-embedding-3-small
 * Fallback: Cohere embed-multilingual-v3.0
 * @param text Texto para gerar embedding
 * @returns Array de números (1536 dimensões)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('Texto vazio para gerar embedding');
    }

    logger.info({ text: cleanText.substring(0, 100) }, 'Gerando embedding...');

    // Usar router que gerencia fallback automaticamente
    const embedding = await routerGenerateEmbedding(cleanText, { retries: 2 });

    logger.info(
      {
        dimensions: embedding.length,
        model: EMBEDDING_MODEL,
      },
      'Embedding gerado com sucesso'
    );

    return embedding;
  } catch (error: any) {
    logger.error({ error: error.message }, 'Erro ao gerar embedding');
    throw new Error(`Falha ao gerar embedding: ${error.message}`);
  }
}

/**
 * Gera embeddings para múltiplos textos em batch com fallback
 * @param texts Array de textos
 * @returns Array de embeddings
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  try {
    if (texts.length === 0) {
      return [];
    }

    const cleanTexts = texts.map(t => t.trim()).filter(t => t.length > 0);

    if (cleanTexts.length === 0) {
      return [];
    }

    logger.info({ count: cleanTexts.length }, 'Gerando embeddings em batch...');

    // Usar router que gerencia fallback automaticamente
    const embeddings = await routerGenerateEmbeddingsBatch(cleanTexts, { retries: 2 });

    logger.info(
      {
        count: embeddings.length,
        dimensions: embeddings[0]?.length || 0,
      },
      'Embeddings batch gerados com sucesso'
    );

    return embeddings;
  } catch (error: any) {
    logger.error({ error: error.message }, 'Erro ao gerar embeddings batch');
    throw new Error(`Falha ao gerar embeddings batch: ${error.message}`);
  }
}

/**
 * Calcula similaridade de cosseno entre dois vetores
 * @param a Vetor A
 * @param b Vetor B
 * @returns Score de similaridade (0-1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  return routerCosineSimilarity(a, b);
}

/**
 * Busca itens similares a um embedding de query
 * @param queryEmbedding Embedding da query
 * @param items Array de items com embeddings
 * @param topK Número de resultados
 * @returns Array de resultados ordenados por similaridade
 */
export function searchSimilar(
  queryEmbedding: number[],
  items: Array<{ id: string; embedding: number[]; metadata?: any }>,
  topK: number = 5
): SimilarityResult[] {
  if (items.length === 0) {
    return [];
  }

  const results = items.map(item => ({
    id: item.id,
    score: cosineSimilarity(queryEmbedding, item.embedding),
    metadata: item.metadata,
  }));

  return results.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Converte array de números para string JSON (para salvar no banco)
 * @param embedding Array de números
 * @returns String JSON
 */
export function embeddingToString(embedding: number[]): string {
  return JSON.stringify(embedding);
}

/**
 * Converte string JSON para array de números
 * @param embeddingStr String JSON
 * @returns Array de números
 */
export function stringToEmbedding(embeddingStr: string | null): number[] | null {
  if (!embeddingStr) {
    return null;
  }

  try {
    const parsed = JSON.parse(embeddingStr);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch (error) {
    logger.error({ error }, 'Erro ao parsear embedding');
    return null;
  }
}

/**
 * Valida se um embedding está no formato correto
 * @param embedding Array para validar
 * @returns true se válido
 */
export function isValidEmbedding(embedding: any): boolean {
  if (!Array.isArray(embedding)) {
    return false;
  }

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    return false;
  }

  return embedding.every(n => typeof n === 'number' && !isNaN(n));
}

/**
 * Calcula estatísticas de um embedding
 * @param embedding Array de números
 * @returns Objeto com estatísticas
 */
export function getEmbeddingStats(embedding: number[]) {
  const sum = embedding.reduce((acc, val) => acc + val, 0);
  const mean = sum / embedding.length;
  const variance =
    embedding.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / embedding.length;
  const stdDev = Math.sqrt(variance);

  const magnitude = Math.sqrt(embedding.reduce((acc, val) => acc + val * val, 0));

  return {
    dimensions: embedding.length,
    mean: mean.toFixed(6),
    stdDev: stdDev.toFixed(6),
    magnitude: magnitude.toFixed(6),
    min: Math.min(...embedding).toFixed(6),
    max: Math.max(...embedding).toFixed(6),
  };
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
