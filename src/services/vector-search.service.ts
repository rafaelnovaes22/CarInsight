import { PrismaClient } from '@prisma/client';
import { generateEmbedding, stringToEmbedding, searchSimilar } from '../lib/embeddings';
import { logger } from '../lib/logger';

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
  price: number | null;
  fuelType: string;
  transmission: string;
  color: string | null;
  features: string[];
  photos?: string[];
  matchScore: number;
  matchReasons: string[];
}

export class VectorSearchService {
  /**
   * Busca veículos usando embeddings OpenAI + critérios híbridos
   */
  async searchVehicles(
    criteria: VehicleSearchCriteria,
    limit: number = 5
  ): Promise<ScoredVehicle[]> {
    try {
      const hasEmbeddings = await this.checkEmbeddingsAvailable();

      if (hasEmbeddings && process.env.OPENAI_API_KEY) {
        logger.info('🔍 Usando busca vetorial (OpenAI embeddings)');
        return this.vectorSearch(criteria, limit);
      } else {
        logger.info('🔍 Usando busca SQL (fallback)');
        return this.sqlSearch(criteria, limit);
      }
    } catch (error: any) {
      logger.error({ error: error.message }, 'Erro na busca de veículos');
      return this.sqlSearch(criteria, limit);
    }
  }

  /**
   * Verifica se existem embeddings no banco
   */
  private async checkEmbeddingsAvailable(): Promise<boolean> {
    try {
      const result = await prisma.$queryRaw<
        { count: number }[]
      >`SELECT COUNT(*) as count FROM "Vehicle" WHERE "embedding" IS NOT NULL`;
      return Number(result[0].count) > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Busca vetorial usando OpenAI embeddings
   */
  private async vectorSearch(
    criteria: VehicleSearchCriteria,
    limit: number
  ): Promise<ScoredVehicle[]> {
    try {
      const queryText = this.buildQueryText(criteria);
      logger.info({ query: queryText }, 'Gerando embedding para query');

      const queryEmbedding = await generateEmbedding(queryText);

      // Buscar veículos similares diretamente via pgvector e PostgreSQL
      const vectorString = `[${queryEmbedding.join(',')}]`;
      const similarVehiclesData = await prisma.$queryRaw<any[]>`
        SELECT v.*, 1 - (v.embedding <=> ${vectorString}::vector) as "semanticScore"
        FROM "Vehicle" v
        WHERE v.disponivel = true AND v.embedding IS NOT NULL
        ORDER BY v.embedding <=> ${vectorString}::vector
        LIMIT ${limit * 2}
      `;

      if (similarVehiclesData.length === 0) {
        logger.warn('Nenhum veículo com embedding encontrado na busca vetorial via pgvector');
        return this.sqlSearch(criteria, limit);
      }

      logger.info(
        {
          found: similarVehiclesData.length,
          topScore: similarVehiclesData[0]?.semanticScore,
        },
        'Veículos similares encontrados via pgvector'
      );

      // Calcular score híbrido (40% semântico + 60% critérios)
      const scoredVehicles = similarVehiclesData.map(vehicle => {
        const semanticScore = vehicle.semanticScore;
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
          _semanticScore: Math.round(semanticScore * 100),
          _criteriaScore: Math.round(criteriaScore * 100),
        };
      });

      // Ordenar por matchScore, com desempate por preço (desc), km (asc), ano (desc)
      scoredVehicles.sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        if ((b.price ?? 0) !== (a.price ?? 0)) return (b.price ?? 0) - (a.price ?? 0);
        if (a.mileage !== b.mileage) return a.mileage - b.mileage;
        return b.year - a.year;
      });

      return scoredVehicles.slice(0, limit);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Erro na busca vetorial');
      return this.sqlSearch(criteria, limit);
    }
  }

  /**
   * Busca SQL tradicional (fallback)
   */
  private async sqlSearch(
    criteria: VehicleSearchCriteria,
    limit: number
  ): Promise<ScoredVehicle[]> {
    try {
      const where: any = { disponivel: true };

      if (criteria.budget) {
        where.preco = { lte: criteria.budget * 1.1 };
      }

      if (criteria.year) {
        where.ano = { gte: criteria.year };
      }

      if (criteria.mileage) {
        where.km = { lte: criteria.mileage };
      }

      if (criteria.bodyType) {
        where.carroceria = criteria.bodyType;
      }

      if (criteria.brand) {
        where.marca = { contains: criteria.brand, mode: 'insensitive' };
      }

      const vehicles = await prisma.vehicle.findMany({
        where,
        take: limit * 2,
        orderBy: [{ preco: 'desc' }, { km: 'asc' }, { ano: 'desc' }],
      });

      const scoredVehicles = vehicles.map(vehicle => {
        const criteriaScore = this.calculateCriteriaMatch(vehicle, criteria);
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
          matchScore: Math.round(criteriaScore * 100),
          matchReasons,
        };
      });

      // Ordenar por matchScore, com desempate por preço (desc), km (asc), ano (desc)
      scoredVehicles.sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        if ((b.price ?? 0) !== (a.price ?? 0)) return (b.price ?? 0) - (a.price ?? 0);
        if (a.mileage !== b.mileage) return a.mileage - b.mileage;
        return b.year - a.year;
      });

      return scoredVehicles.slice(0, limit);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Erro na busca SQL');
      return [];
    }
  }

  /**
   * Constrói texto de query para gerar embedding
   */
  private buildQueryText(criteria: VehicleSearchCriteria): string {
    const parts: string[] = [];

    if (criteria.budget) {
      parts.push(`orçamento até R$ ${criteria.budget.toLocaleString('pt-BR')}`);
    }

    if (criteria.usage) {
      parts.push(`uso ${criteria.usage}`);
    }

    if (criteria.persons) {
      parts.push(`para ${criteria.persons} pessoas`);
    }

    if (criteria.essentialItems && criteria.essentialItems.length > 0) {
      parts.push(`com ${criteria.essentialItems.join(', ')}`);
    }

    if (criteria.bodyType) {
      parts.push(`carroceria ${criteria.bodyType}`);
    }

    if (criteria.year) {
      parts.push(`ano ${criteria.year} ou mais novo`);
    }

    if (criteria.mileage) {
      parts.push(`até ${criteria.mileage.toLocaleString('pt-BR')}km`);
    }

    if (criteria.brand) {
      parts.push(`marca ${criteria.brand}`);
    }

    return parts.join(', ');
  }

  /**
   * Calcula score baseado em critérios objetivos
   */
  private calculateCriteriaMatch(vehicle: any, criteria: VehicleSearchCriteria): number {
    let score = 0;
    let totalWeight = 0;

    // Orçamento (peso 30%) - Priorizar veículos que utilizam melhor o orçamento
    if (criteria.budget) {
      const budgetWeight = 0.3;
      totalWeight += budgetWeight;

      if (vehicle.preco <= criteria.budget) {
        // Calcular quão próximo está do orçamento (quanto mais perto, melhor)
        const budgetUtilization = vehicle.preco / criteria.budget;

        // Veículos entre 60-100% do orçamento recebem score proporcional
        // Veículos muito baratos (<60% do budget) recebem penalização
        if (budgetUtilization >= 0.6) {
          // Score proporcional: R$60k com budget R$75k = 80% = score 0.24
          score += budgetWeight * budgetUtilization;
        } else {
          // Penaliza veículos muito abaixo do orçamento (pode não atender expectativas)
          score += budgetWeight * 0.4;
        }
      } else if (vehicle.preco <= criteria.budget * 1.1) {
        // Até 10% acima: ainda bom, mas com pequena penalização
        score += budgetWeight * 0.85;
      } else if (vehicle.preco <= criteria.budget * 1.2) {
        // Até 20% acima: aceitável se o cliente puder esticar
        score += budgetWeight * 0.6;
      }
    }

    // Ano (peso 15%)
    if (criteria.year) {
      const yearWeight = 0.15;
      totalWeight += yearWeight;

      if (vehicle.ano >= criteria.year) {
        const yearsAbove = vehicle.ano - criteria.year;
        score += yearWeight * Math.min(1, 1 - yearsAbove * 0.05);
      } else {
        const yearsBelow = criteria.year - vehicle.ano;
        score += yearWeight * Math.max(0, 1 - yearsBelow * 0.2);
      }
    }

    // Quilometragem (peso 15%)
    if (criteria.mileage) {
      const mileageWeight = 0.15;
      totalWeight += mileageWeight;

      if (vehicle.km <= criteria.mileage) {
        score += mileageWeight;
      } else if (vehicle.km <= criteria.mileage * 1.2) {
        score += mileageWeight * 0.5;
      }
    }

    // Carroceria (peso 20%)
    if (criteria.bodyType) {
      const bodyWeight = 0.2;
      totalWeight += bodyWeight;

      if (vehicle.carroceria.toLowerCase() === criteria.bodyType.toLowerCase()) {
        score += bodyWeight;
      }
    }

    // Marca (peso 10%)
    if (criteria.brand && criteria.brand !== 'qualquer') {
      const brandWeight = 0.1;
      totalWeight += brandWeight;

      if (vehicle.marca.toLowerCase().includes(criteria.brand.toLowerCase())) {
        score += brandWeight;
      }
    }

    // Itens essenciais (peso 10%)
    if (criteria.essentialItems && criteria.essentialItems.length > 0) {
      const itemsWeight = 0.1;
      totalWeight += itemsWeight;

      let matchedItems = 0;
      criteria.essentialItems.forEach(item => {
        const itemLower = item.toLowerCase();
        if (
          (itemLower.includes('ar') && vehicle.arCondicionado) ||
          (itemLower.includes('direção') && vehicle.direcaoHidraulica) ||
          (itemLower.includes('airbag') && vehicle.airbag) ||
          (itemLower.includes('abs') && vehicle.abs) ||
          (itemLower.includes('vidro') && vehicle.vidroEletrico) ||
          (itemLower.includes('trava') && vehicle.travaEletrica) ||
          (itemLower.includes('alarme') && vehicle.alarme)
        ) {
          matchedItems++;
        }
      });

      score += itemsWeight * (matchedItems / criteria.essentialItems.length);
    }

    return totalWeight > 0 ? score / totalWeight : 0.5;
  }

  /**
   * Gera razões do match
   */
  private generateMatchReasons(vehicle: any, criteria: VehicleSearchCriteria): string[] {
    const reasons: string[] = [];

    if (criteria.budget && vehicle.preco <= criteria.budget) {
      reasons.push('Dentro do orçamento');
    }

    if (criteria.year && vehicle.ano >= criteria.year) {
      reasons.push(`Ano ${vehicle.ano}`);
    }

    if (criteria.mileage && vehicle.km <= criteria.mileage) {
      reasons.push('Baixa quilometragem');
    }

    if (criteria.bodyType && vehicle.carroceria.toLowerCase() === criteria.bodyType.toLowerCase()) {
      reasons.push(`Carroceria ${vehicle.carroceria}`);
    }

    const features = this.extractFeatures(vehicle);
    if (features.length > 0) {
      reasons.push(`${features.length} equipamentos`);
    }

    return reasons;
  }

  /**
   * Extrai features do veículo
   */
  private extractFeatures(vehicle: any): string[] {
    const features: string[] = [];

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
}
