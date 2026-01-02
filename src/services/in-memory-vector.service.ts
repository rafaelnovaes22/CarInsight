import { PrismaClient } from '@prisma/client';
import { generateEmbedding } from '../lib/embeddings';

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
  private initializing = false;

  async initialize(): Promise<void> {
    if (this.initialized || this.initializing) {
      return;
    }

    this.initializing = true;

    // Inicializa em background sem bloquear o servidor
    this.initializeInBackground().catch(error => {
      console.error('❌ Erro ao inicializar vector store:', error);
      this.initializing = false;
    });
  }

  private async initializeInBackground(): Promise<void> {
    console.log('🧠 Inicializando vector store in-memory (background)...');

    const vehicles = await prisma.vehicle.findMany({
      where: { disponivel: true },
    });

    console.log(`📊 Carregando embeddings para ${vehicles.length} veículos...`);

    let loadedFromDb = 0;
    let generatedNew = 0;

    for (const vehicle of vehicles) {
      const description = this.buildVehicleDescription(vehicle);
      let embedding: number[];

      // Verificar se já tem embedding salvo no banco
      if (vehicle.embedding) {
        try {
          embedding = JSON.parse(vehicle.embedding);
          loadedFromDb++;
        } catch (e) {
          // Embedding inválido, regenerar
          embedding = await this.generateAndSaveEmbedding(vehicle.id, description);
          generatedNew++;
        }
      } else {
        // Não tem embedding, gerar e salvar
        embedding = await this.generateAndSaveEmbedding(vehicle.id, description);
        generatedNew++;
      }

      this.embeddings.push({
        vehicleId: vehicle.id,
        embedding,
        description,
        metadata: {
          brand: vehicle.marca,
          model: vehicle.modelo,
          year: vehicle.ano,
          price: vehicle.preco ?? 0,
          mileage: vehicle.km,
        },
      });
    }

    this.initialized = true;
    this.initializing = false;
    console.log(
      `✅ Vector store pronto: ${loadedFromDb} carregados do DB, ${generatedNew} gerados novos`
    );
  }

  /**
   * Gera embedding e salva no banco para não precisar regenerar
   */
  private async generateAndSaveEmbedding(
    vehicleId: string,
    description: string
  ): Promise<number[]> {
    const embedding = await generateEmbedding(description);

    // Salvar no banco para próxima inicialização
    await prisma.vehicle
      .update({
        where: { id: vehicleId },
        data: {
          embedding: JSON.stringify(embedding),
          embeddingModel: 'text-embedding-3-small',
          embeddingGeneratedAt: new Date(),
        },
      })
      .catch(error => {
        console.warn(`⚠️ Erro ao salvar embedding do veículo ${vehicleId}:`, error.message);
      });

    return embedding;
  }

  async search(queryText: string, limit: number = 5): Promise<string[]> {
    // Se não está inicializado, retorna array vazio (fallback para SQL)
    if (!this.initialized) {
      console.log('⚠️  Vector store ainda não pronto, usando fallback SQL');
      return [];
    }

    const queryEmbedding = await generateEmbedding(queryText);

    const results = this.embeddings.map(item => ({
      vehicleId: item.vehicleId,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding),
      metadata: item.metadata,
    }));

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit).map(r => r.vehicleId);
  }

  async searchWithScores(
    queryText: string,
    limit: number = 5
  ): Promise<Array<{ vehicleId: string; score: number }>> {
    // Se não está inicializado, retorna array vazio (fallback para SQL)
    if (!this.initialized) {
      console.log('⚠️  Vector store ainda não pronto, usando fallback SQL');
      return [];
    }

    const queryEmbedding = await generateEmbedding(queryText);

    const results = this.embeddings.map(item => ({
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

    const features: string[] = [];
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

    if (vehicle.preco) {
      parts.push(`preço R$ ${vehicle.preco.toLocaleString('pt-BR')}`);
    }

    // --- DATA ENRICHMENT: Inject criteria tags to guide valid semantic matching ---
    const criteria: string[] = [];
    const bodyType = vehicle.carroceria?.toLowerCase() || '';
    const version = vehicle.versao?.toLowerCase() || '';
    const model = vehicle.modelo?.toLowerCase() || '';
    const desc = vehicle.descricao?.toLowerCase() || '';

    // Criteria: Family / Space / Trip
    if (
      bodyType.includes('suv') ||
      bodyType.includes('utilitário') ||
      bodyType.includes('minivan') ||
      bodyType.includes('perua') ||
      desc.includes('7 lugares') ||
      model.includes('7 lugares')
    ) {
      criteria.push('ideal para família', 'espaçoso', 'porta-malas grande', 'conforto para viagem');
    }

    // Criteria: Comfort / Executive
    if (bodyType.includes('sedan') || bodyType.includes('sedã')) {
      criteria.push('conforto', 'porta-malas espaçoso', 'carro familiar', 'executivo');
    }

    // Criteria: Economy / City
    if (bodyType.includes('hatch')) {
      // Try to detect 1.0 engine
      const isOnePointZero =
        version.includes('1.0') || desc.includes('1.0') || model.includes('1.0');
      if (isOnePointZero) {
        criteria.push('econômico', 'carro urbano', 'bom para dia a dia', 'baixo consumo');
      } else {
        criteria.push('prático', 'compacto', 'ágil');
      }
    }

    // Criteria: Utility / Work
    if (bodyType.includes('picape') || bodyType.includes('pickup')) {
      criteria.push(
        'picape',
        'caminhonete',
        'robusto',
        'para trabalho',
        'caçamba',
        'off-road',
        'transportar carga'
      );
    }

    let finalDescription = parts.join('. ');

    if (criteria.length > 0) {
      finalDescription += ` [Critérios: ${criteria.join(', ')}]`;
    }

    // Prepend Category for strong signal
    return `Categoria: ${vehicle.carroceria}. ${finalDescription}`;
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
