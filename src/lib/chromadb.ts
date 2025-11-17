import { ChromaClient, Collection } from 'chromadb';
import { OpenAI } from 'openai';

const COLLECTION_NAME = 'vehicles';

let chromaClient: ChromaClient | null = null;
let collection: Collection | null = null;
let openai: OpenAI | null = null;

export async function initChromaDB(): Promise<void> {
  try {
    const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
    
    chromaClient = new ChromaClient({
      path: chromaUrl,
    });

    console.log(`🔗 Conectando ao ChromaDB (${chromaUrl})...`);
    await chromaClient.heartbeat();
    console.log('✅ ChromaDB conectado!');

    try {
      collection = await chromaClient.getOrCreateCollection({
        name: COLLECTION_NAME,
        metadata: { 'hnsw:space': 'cosine' },
      });
      console.log(`✅ Collection "${COLLECTION_NAME}" pronta`);
    } catch (error) {
      console.error('❌ Erro ao criar collection:', error);
      throw error;
    }
  } catch (error) {
    console.warn('⚠️  ChromaDB não disponível. Usando modo in-memory com embeddings mock.');
    console.log('💡 Para habilitar ChromaDB real:');
    console.log('   1. Instalar: pip install chromadb');
    console.log('   2. Rodar: chroma run --path ./chroma_data');
    chromaClient = null;
    collection = null;
  }
}

export function getChromaClient(): ChromaClient | null {
  return chromaClient;
}

export function getCollection(): Collection | null {
  return collection;
}

export function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY || 'sk-mock-key';
    
    if (apiKey === 'sk-mock-key' || apiKey.startsWith('sk-mock')) {
      console.warn('⚠️  Usando OpenAI em modo MOCK. Embeddings serão simulados.');
    }
    
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const openaiClient = getOpenAI();
  const apiKey = process.env.OPENAI_API_KEY || 'sk-mock-key';

  if (apiKey === 'sk-mock-key' || apiKey.startsWith('sk-mock')) {
    return generateMockEmbedding(text);
  }

  try {
    const response = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Erro ao gerar embedding:', error);
    console.warn('⚠️  Usando embedding mock como fallback');
    return generateMockEmbedding(text);
  }
}

function generateMockEmbedding(text: string): number[] {
  const dimension = 1536;
  const seed = hashString(text);
  const random = seededRandom(seed);
  
  const embedding = [];
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
    hash = ((hash << 5) - hash) + char;
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
  if (!chromaClient) return false;
  
  try {
    await chromaClient.heartbeat();
    return true;
  } catch {
    return false;
  }
}

export async function closeChromaDB(): Promise<void> {
  chromaClient = null;
  collection = null;
  openai = null;
  console.log('🔌 ChromaDB desconectado');
}
