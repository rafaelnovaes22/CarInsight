import { PrismaClient } from '@prisma/client';
import { getCollection, generateEmbedding, isChromaDBAvailable } from '../lib/chromadb';
import { inMemoryVectorStore } from './in-memory-vector.service';

const prisma = new PrismaClient();

export interface VehicleSearchCriteria {
  budget?: number;
  usage?: string;
  persons?: number;
  essentialItems?: string[];
  bodyType?: string;
  year?: number;
  mileage?: number;
  brand?: string;
}

export interface ScoredVehicle {
  id: string;
  model: string;
  brand: string;
  version: string;
  year: number;
  mileage: number;
  price: number;
  fuelType: string;
  transmission: string;
  color: string;
  features: string[];
  photos?: string[];
  matchScore: number;
  matchReasons: string[];
}

export class VectorSearchService {
  async searchVehicles(
    criteria: VehicleSearchCriteria,
    limit: number = 5
  ): Promise<ScoredVehicle[]> {
    const useChromaDB = await isChromaDBAvailable();

    if (useChromaDB) {
      console.log('🔍 Usando busca vetorial (ChromaDB)');
      return this.vectorSearch(criteria, limit);
    } else if (inMemoryVectorStore.isInitialized() || await this.tryInitializeInMemory()) {
      console.log('🔍 Usando busca vetorial (In-Memory)');
      return this.inMemoryVectorSearch(criteria, limit);
    } else {
      console.log('🔍 Usando busca SQL (fallback)');
      return this.sqlSearch(criteria, limit);
    }
  }

  private async tryInitializeInMemory(): Promise<boolean> {
    try {
      await inMemoryVectorStore.initialize();
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar in-memory store:', error);
      return false;
    }
  }

  private async inMemoryVectorSearch(
    criteria: VehicleSearchCriteria,
    limit: number
  ): Promise<ScoredVehicle[]> {
    try {
      const queryText = this.buildQueryText(criteria);
      console.log(`📝 Query: "${queryText}"`);

      const results = await inMemoryVectorStore.searchWithScores(queryText, limit * 2);

      if (results.length === 0) {
        console.warn('⚠️  Nenhum resultado no in-memory store, usando SQL');
        return this.sqlSearch(criteria, limit);
      }

      const vehicleIds = results.map((r) => r.vehicleId);

      const vehicles = await prisma.vehicle.findMany({
        where: {
          id: { in: vehicleIds },
          disponivel: true,
        },
      });

      const scoredVehicles = vehicles.map((vehicle) => {
        const result = results.find((r) => r.vehicleId === vehicle.id);
        const semanticScore = result?.score || 0;
        
        const criteriaScore = this.calculateCriteriaMatch(vehicle, criteria);
        
        const finalScore = semanticScore * 0.4 + criteriaScore * 0.6;

        const matchReasons = this.generateMatchReasons(vehicle, criteria);

        return {
          id: vehicle.id,
          model: vehicle.modelo,
          brand: vehicle.marca,
          version: vehicle.versao || '',
          year: vehicle.ano,
          mileage: vehicle.km,
          price: vehicle.preco,
          fuelType: vehicle.combustivel,
          transmission: vehicle.cambio,
          color: vehicle.cor,
          features: this.extractFeatures(vehicle),
          photos: vehicle.fotosUrls ? JSON.parse(vehicle.fotosUrls) : [],
          matchScore: Math.round(finalScore * 100),
          matchReasons,
        };
      });

      scoredVehicles.sort((a, b) => b.matchScore - a.matchScore);

      return scoredVehicles.slice(0, limit);
    } catch (error) {
      console.error('❌ Erro na busca in-memory:', error);
      return this.sqlSearch(criteria, limit);
    }
  }

  private async vectorSearch(
    criteria: VehicleSearchCriteria,
    limit: number
  ): Promise<ScoredVehicle[]> {
    const collection = getCollection();
    if (!collection) {
      return this.sqlSearch(criteria, limit);
    }

    try {
      const queryText = this.buildQueryText(criteria);
      console.log(`📝 Query: "${queryText}"`);

      const queryEmbedding = await generateEmbedding(queryText);

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit * 2,
      });

      if (!results.ids[0] || results.ids[0].length === 0) {
        console.warn('⚠️  Nenhum resultado no ChromaDB, usando SQL');
        return this.sqlSearch(criteria, limit);
      }

      const vehicleIds = results.ids[0];
      const distances = results.distances?.[0] || [];

      const vehicles = await prisma.vehicle.findMany({
        where: {
          id: { in: vehicleIds },
          disponivel: true,
        },
      });

      const scoredVehicles = vehicles.map((vehicle, index) => {
        const distance = distances[vehicleIds.indexOf(vehicle.id)] || 1;
        const semanticScore = Math.max(0, 1 - distance);
        
        const criteriaScore = this.calculateCriteriaMatch(vehicle, criteria);
        
        const finalScore = semanticScore * 0.4 + criteriaScore * 0.6;

        const matchReasons = this.generateMatchReasons(vehicle, criteria);

        return {
          id: vehicle.id,
          model: vehicle.model,
          brand: vehicle.brand,
          version: vehicle.version || '',
          year: vehicle.year,
          mileage: vehicle.mileage,
          price: vehicle.price,
          fuelType: vehicle.fuelType,
          transmission: vehicle.transmission,
          color: vehicle.color,
          features: vehicle.features || [],
          photos: vehicle.photos || [],
          matchScore: Math.round(finalScore * 100),
          matchReasons,
        };
      });

      scoredVehicles.sort((a, b) => b.matchScore - a.matchScore);

      return scoredVehicles.slice(0, limit);
    } catch (error) {
      console.error('❌ Erro na busca vetorial:', error);
      return this.sqlSearch(criteria, limit);
    }
  }

  private async sqlSearch(
    criteria: VehicleSearchCriteria,
    limit: number
  ): Promise<ScoredVehicle[]> {
    const where: any = { disponivel: true };

    if (criteria.budget) {
      where.preco = { lte: criteria.budget * 1.1 };
    }

    if (criteria.brand) {
      where.marca = { contains: criteria.brand, mode: 'insensitive' };
    }

    if (criteria.year) {
      where.ano = { gte: criteria.year };
    }

    if (criteria.mileage) {
      where.km = { lte: criteria.mileage };
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      take: limit * 3,
    });

    const scoredVehicles = vehicles.map((vehicle) => {
      const matchScore = this.calculateCriteriaMatch(vehicle, criteria);
      const matchReasons = this.generateMatchReasons(vehicle, criteria);

      return {
        id: vehicle.id,
        model: vehicle.modelo,
        brand: vehicle.marca,
        version: vehicle.versao || '',
        year: vehicle.ano,
        mileage: vehicle.km,
        price: vehicle.preco,
        fuelType: vehicle.combustivel,
        transmission: vehicle.cambio,
        color: vehicle.cor,
        features: this.extractFeatures(vehicle),
        photos: vehicle.fotosUrls ? JSON.parse(vehicle.fotosUrls) : [],
        matchScore: Math.round(matchScore * 100),
        matchReasons,
      };
    });

    scoredVehicles.sort((a, b) => b.matchScore - a.matchScore);

    return scoredVehicles.slice(0, limit);
  }

  private buildQueryText(criteria: VehicleSearchCriteria): string {
    const parts: string[] = [];

    if (criteria.usage) {
      parts.push(`uso ${criteria.usage}`);
    }

    if (criteria.persons) {
      parts.push(`${criteria.persons} pessoas`);
    }

    if (criteria.bodyType) {
      parts.push(`carroceria ${criteria.bodyType}`);
    }

    if (criteria.essentialItems && criteria.essentialItems.length > 0) {
      parts.push(`itens ${criteria.essentialItems.join(', ')}`);
    }

    if (criteria.budget) {
      parts.push(`orçamento até R$ ${criteria.budget}`);
    }

    if (criteria.brand) {
      parts.push(`marca ${criteria.brand}`);
    }

    if (criteria.year) {
      parts.push(`ano ${criteria.year} ou mais novo`);
    }

    if (criteria.mileage) {
      parts.push(`até ${criteria.mileage}km`);
    }

    return parts.join(', ') || 'veículo usado';
  }

  private calculateCriteriaMatch(vehicle: any, criteria: VehicleSearchCriteria): number {
    let score = 0;
    let totalWeight = 0;

    if (criteria.budget) {
      totalWeight += 30;
      const price = vehicle.preco || vehicle.price;
      const priceDiff = Math.abs(price - criteria.budget);
      const priceScore = Math.max(0, 1 - priceDiff / criteria.budget);
      score += priceScore * 30;
    }

    if (criteria.brand) {
      totalWeight += 15;
      const brand = vehicle.marca || vehicle.brand;
      if (brand.toLowerCase().includes(criteria.brand.toLowerCase())) {
        score += 15;
      }
    }

    if (criteria.year) {
      totalWeight += 15;
      const year = vehicle.ano || vehicle.year;
      if (year >= criteria.year) {
        const yearDiff = year - criteria.year;
        score += Math.min(15, 10 + yearDiff);
      }
    }

    if (criteria.mileage) {
      totalWeight += 15;
      const mileage = vehicle.km || vehicle.mileage;
      if (mileage <= criteria.mileage) {
        const mileageScore = 1 - mileage / criteria.mileage;
        score += mileageScore * 15;
      }
    }

    if (criteria.essentialItems && criteria.essentialItems.length > 0) {
      totalWeight += 15;
      const features = this.extractFeatures(vehicle);
      const matchingFeatures = criteria.essentialItems.filter((item) =>
        features.some((f: string) => f.toLowerCase().includes(item.toLowerCase()))
      );
      score += (matchingFeatures.length / criteria.essentialItems.length) * 15;
    }

    totalWeight += 10;
    const photos = vehicle.fotosUrls ? JSON.parse(vehicle.fotosUrls) : [];
    score += photos.length > 0 ? 10 : 5;

    return totalWeight > 0 ? score / totalWeight : 0.5;
  }

  private extractFeatures(vehicle: any): string[] {
    const features = [];
    if (vehicle.arCondicionado) features.push('Ar condicionado');
    if (vehicle.direcaoHidraulica) features.push('Direção hidráulica');
    if (vehicle.airbag) features.push('Airbag');
    if (vehicle.abs) features.push('ABS');
    if (vehicle.vidroEletrico) features.push('Vidro elétrico');
    if (vehicle.travaEletrica) features.push('Trava elétrica');
    if (vehicle.alarme) features.push('Alarme');
    if (vehicle.rodaLigaLeve) features.push('Roda de liga leve');
    if (vehicle.som) features.push('Som');
    return features;
  }

  private generateMatchReasons(vehicle: any, criteria: VehicleSearchCriteria): string[] {
    const reasons: string[] = [];

    const price = vehicle.preco || vehicle.price;
    const brand = vehicle.marca || vehicle.brand;
    const year = vehicle.ano || vehicle.year;
    const mileage = vehicle.km || vehicle.mileage;
    const fuelType = vehicle.combustivel || vehicle.fuelType;

    if (criteria.budget && price <= criteria.budget * 1.05) {
      reasons.push(`Dentro do orçamento (R$ ${price.toLocaleString('pt-BR')})`);
    }

    if (criteria.brand && brand.toLowerCase().includes(criteria.brand.toLowerCase())) {
      reasons.push(`Marca ${brand}`);
    }

    if (criteria.year && year >= criteria.year) {
      reasons.push(`Ano ${year}`);
    }

    if (criteria.mileage && mileage <= criteria.mileage) {
      reasons.push(`${mileage.toLocaleString('pt-BR')}km rodados`);
    }

    if (criteria.essentialItems && criteria.essentialItems.length > 0) {
      const features = this.extractFeatures(vehicle);
      const matchingFeatures = criteria.essentialItems.filter((item) =>
        features.some((f: string) => f.toLowerCase().includes(item.toLowerCase()))
      );
      if (matchingFeatures.length > 0) {
        reasons.push(`Possui ${matchingFeatures.join(', ')}`);
      }
    }

    if (fuelType === 'Flex') {
      reasons.push('Motor flex (economia)');
    }

    const photos = vehicle.fotosUrls ? JSON.parse(vehicle.fotosUrls) : [];
    if (photos.length > 0) {
      reasons.push(`${photos.length} fotos disponíveis`);
    }

    return reasons.slice(0, 4);
  }
}

export const vectorSearchService = new VectorSearchService();
