import axios from 'axios';

const JINA_API_URL = 'https://api.jina.ai/v1/embeddings';

export async function initChromaDB(): Promise<void> {
  console.log('ℹ️  Usando Jina AI para embeddings (grátis)');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.JINA_API_KEY;

  // Se não tem API key, usa mock
  if (!apiKey || apiKey === 'sk-mock-key') {
    console.warn('⚠️  JINA_API_KEY não configurada, usando mock embeddings');
    return generateMockEmbedding(text);
  }

  try {
    const response = await axios.post(
      JINA_API_URL,
      {
        input: [text],
        model: 'jina-embeddings-v3',
        dimensions: 1024,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 10000,
      }
    );

    return response.data.data[0].embedding;
  } catch (error: any) {
    console.error('❌ Erro ao gerar embedding com Jina AI:', error.message);
    console.warn('⚠️  Usando mock embedding como fallback');
    return generateMockEmbedding(text);
  }
}

function generateMockEmbedding(text: string): number[] {
  const dimension = 1536;
  const seed = hashString(text);
  const random = seededRandom(seed);

  const embedding: number[] = [];
  for (let i = 0; i < dimension; i++) {
    embedding.push(random() * 2 - 1);
  }

  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / norm);
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export async function isChromaDBAvailable(): Promise<boolean> {
  return false;
}

export async function closeChromaDB(): Promise<void> {
  console.log('🔌 ChromaDB desconectado');
}
