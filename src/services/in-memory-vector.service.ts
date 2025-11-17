import { PrismaClient } from '@prisma/client';
import { generateEmbedding } from '../lib/chromadb';

const prisma = new PrismaClient();

interface VehicleEmbedding {
  vehicleId: string;
  embedding: number[];
  description: string;
  metadata: {
    brand: string;
    model: string;
    year: number;
    price: number;
    mileage: number;
  };
}

class InMemoryVectorStore {
  private embeddings: VehicleEmbedding[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('🧠 Inicializando vector store in-memory...');

    const vehicles = await prisma.vehicle.findMany({
      where: { disponivel: true },
    });

    console.log(`📊 Gerando embeddings para ${vehicles.length} veículos...`);

    for (const vehicle of vehicles) {
      const description = this.buildVehicleDescription(vehicle);
      const embedding = await generateEmbedding(description);

      this.embeddings.push({
        vehicleId: vehicle.id,
        embedding,
        description,
        metadata: {
          brand: vehicle.marca,
          model: vehicle.modelo,
          year: vehicle.ano,
          price: vehicle.preco,
          mileage: vehicle.km,
        },
      });
    }

    this.initialized = true;
    console.log(`✅ Vector store pronto com ${this.embeddings.length} embeddings`);
  }

  async search(queryText: string, limit: number = 5): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const queryEmbedding = await generateEmbedding(queryText);

    const results = this.embeddings.map((item) => ({
      vehicleId: item.vehicleId,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding),
      metadata: item.metadata,
    }));

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit).map((r) => r.vehicleId);
  }

  async searchWithScores(
    queryText: string,
    limit: number = 5
  ): Promise<Array<{ vehicleId: string; score: number }>> {
    if (!this.initialized) {
      await this.initialize();
    }

    const queryEmbedding = await generateEmbedding(queryText);

    const results = this.embeddings.map((item) => ({
      vehicleId: item.vehicleId,
      score: this.cosineSimilarity(queryEmbedding, item.embedding),
    }));

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  getCount(): number {
    return this.embeddings.length;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async clear(): Promise<void> {
    this.embeddings = [];
    this.initialized = false;
    console.log('🗑️  Vector store limpo');
  }

  private buildVehicleDescription(vehicle: any): string {
    const parts = [
      `${vehicle.marca} ${vehicle.modelo} ${vehicle.versao || ''}`,
      `ano ${vehicle.ano}`,
      `${vehicle.km.toLocaleString('pt-BR')}km`,
      `${vehicle.combustivel}`,
      `${vehicle.cambio}`,
      `cor ${vehicle.cor}`,
    ];

    const features = [];
    if (vehicle.arCondicionado) features.push('ar condicionado');
    if (vehicle.direcaoHidraulica) features.push('direção hidráulica');
    if (vehicle.airbag) features.push('airbag');
    if (vehicle.abs) features.push('abs');
    if (vehicle.vidroEletrico) features.push('vidro elétrico');
    if (vehicle.travaEletrica) features.push('trava elétrica');
    
    if (features.length > 0) {
      parts.push(`equipamentos: ${features.join(', ')}`);
    }

    if (vehicle.descricao) {
      parts.push(vehicle.descricao);
    }

    parts.push(`preço R$ ${vehicle.preco.toLocaleString('pt-BR')}`);

    return parts.join('. ');
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vetores devem ter o mesmo tamanho');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

export const inMemoryVectorStore = new InMemoryVectorStore();
