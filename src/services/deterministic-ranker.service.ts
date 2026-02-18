/**
 * Deterministic Ranker Service
 *
 * Ranqueia veículos usando campos pré-calculados via SQL,
 * eliminando a necessidade de LLM em tempo de execução.
 * Reduz latência de ~60s para < 5s.
 */

import { prisma } from '../lib/prisma';
import { logger, logEvent } from '../lib/logger';
import { Prisma } from '@prisma/client';

// Tipos de uso principal
export type UseCase =
  | 'familia'
  | 'uberX'
  | 'uberComfort'
  | 'uberBlack'
  | 'uber' // genérico, mapeia para uberX
  | 'trabalho'
  | 'viagem'
  | 'carga'
  | 'usoDiario'
  | 'entrega';

// Contexto de ranqueamento
export interface RankingContext {
  useCase: UseCase;
  budget?: number;
  minYear?: number;
  maxKm?: number;
  bodyTypes?: string[];
  transmission?: 'Automático' | 'Manual';
  priorities?: string[];
  numberOfPeople?: number;
}

export interface VehicleScoreBreakdown {
  baseScore: number;
  weightedCriteria: {
    conforto: number;
    economia: number;
    espaco: number;
    seguranca: number;
    custoBeneficio: number;
  };
  bonuses: string[];
  penalties: string[];
}

// Veículo ranqueado
export interface RankedVehicle {
  id: string;
  marca: string;
  modelo: string;
  ano: number;
  preco: number;
  km: number;
  carroceria: string;
  cambio: string;
  score: number;
  reasoning: string;
  highlights: string[];
  concerns: string[];
  scoreBreakdown?: VehicleScoreBreakdown;
  rawScores?: {
    conforto: number;
    economia: number;
    espaco: number;
    seguranca: number;
    custoBeneficio: number;
  };
  // Campos para exibição de links e imagens
  url?: string | null;
  detailUrl?: string | null;
  fotoUrl?: string | null;
  cor?: string | null;
}

// Resultado do ranqueamento
export interface DeterministicRankingResult {
  vehicles: RankedVehicle[];
  totalCount: number;
  filterTime: number;
  useCase: UseCase;
}

// Mapeamento de caso de uso para filtro de aptidão
const USE_CASE_FILTERS: Record<UseCase, string> = {
  familia: 'aptoFamilia',
  uberX: 'aptoUberX',
  uberComfort: 'aptoUberComfort',
  uberBlack: 'aptoUberBlack',
  uber: 'aptoUberX',
  trabalho: 'aptoTrabalho',
  viagem: 'aptoViagem',
  carga: 'aptoCarga',
  usoDiario: 'aptoUsoDiario',
  entrega: 'aptoEntrega',
};

// Mapeamento de caso de uso para ordenação
const USE_CASE_ORDER: Record<UseCase, Prisma.VehicleOrderByWithRelationInput[]> = {
  familia: [{ scoreEspaco: 'desc' }, { scoreConforto: 'desc' }, { scoreSeguranca: 'desc' }],
  uberX: [{ ano: 'desc' }, { km: 'asc' }, { scoreEconomia: 'desc' }],
  uberComfort: [{ ano: 'desc' }, { scoreConforto: 'desc' }, { km: 'asc' }],
  uberBlack: [{ ano: 'desc' }, { scoreConforto: 'desc' }, { km: 'asc' }],
  uber: [{ ano: 'desc' }, { km: 'asc' }, { scoreEconomia: 'desc' }],
  trabalho: [{ scoreEconomia: 'desc' }, { scoreCustoBeneficio: 'desc' }, { preco: 'asc' }],
  viagem: [{ scoreConforto: 'desc' }, { scoreEconomia: 'desc' }, { km: 'asc' }],
  carga: [{ scoreEspaco: 'desc' }, { scoreCustoBeneficio: 'desc' }],
  usoDiario: [{ scoreEconomia: 'desc' }, { scoreCustoBeneficio: 'desc' }],
  entrega: [{ scoreEconomia: 'desc' }, { km: 'asc' }],
};

// Pesos para cálculo de score total por caso de uso
const USE_CASE_WEIGHTS: Record<UseCase, Record<string, number>> = {
  familia: {
    scoreEspaco: 0.35,
    scoreConforto: 0.3,
    scoreSeguranca: 0.25,
    scoreCustoBeneficio: 0.1,
  },
  uberX: { scoreEconomia: 0.4, scoreCustoBeneficio: 0.3, scoreConforto: 0.2, scoreSeguranca: 0.1 },
  uberComfort: {
    scoreConforto: 0.4,
    scoreEspaco: 0.25,
    scoreEconomia: 0.2,
    scoreCustoBeneficio: 0.15,
  },
  uberBlack: {
    scoreConforto: 0.5,
    scoreEspaco: 0.25,
    scoreSeguranca: 0.15,
    scoreCustoBeneficio: 0.1,
  },
  uber: { scoreEconomia: 0.4, scoreCustoBeneficio: 0.3, scoreConforto: 0.2, scoreSeguranca: 0.1 },
  trabalho: {
    scoreEconomia: 0.4,
    scoreCustoBeneficio: 0.35,
    scoreConforto: 0.15,
    scoreSeguranca: 0.1,
  },
  viagem: { scoreConforto: 0.35, scoreEconomia: 0.3, scoreEspaco: 0.2, scoreSeguranca: 0.15 },
  carga: { scoreEspaco: 0.5, scoreCustoBeneficio: 0.3, scoreEconomia: 0.2 },
  usoDiario: { scoreEconomia: 0.4, scoreCustoBeneficio: 0.35, scoreConforto: 0.25 },
  entrega: { scoreEconomia: 0.5, scoreCustoBeneficio: 0.3, scoreConforto: 0.2 },
};

export class DeterministicRankerService {
  /**
   * Ranqueia veículos usando campos pré-calculados
   */
  async rank(context: RankingContext, limit: number = 10): Promise<DeterministicRankingResult> {
    const startTime = Date.now();
    const useCase = this.normalizeUseCase(context.useCase);

    try {
      // Construir filtro WHERE
      const where = this.buildWhereClause(context, useCase);

      // Construir ordenação
      const orderBy = USE_CASE_ORDER[useCase];

      // Buscar veículos
      const vehicles = await prisma.vehicle.findMany({
        where,
        orderBy,
        take: limit * 2, // Buscar mais para ter margem após cálculo de score
        select: {
          id: true,
          marca: true,
          modelo: true,
          versao: true,
          ano: true,
          preco: true,
          km: true,
          carroceria: true,
          cambio: true,
          combustivel: true,
          scoreConforto: true,
          scoreEconomia: true,
          scoreEspaco: true,
          scoreSeguranca: true,
          scoreCustoBeneficio: true,
          categoriaVeiculo: true,
          segmentoPreco: true,
          aptoFamilia: true,
          aptoUberX: true,
          aptoUberComfort: true,
          aptoUberBlack: true,
          // Campos para exibição de links e imagens
          url: true,
          detailUrl: true,
          fotoUrl: true,
          cor: true,
        },
      });

      // Calcular score total e gerar reasoning
      const rankedVehicles = vehicles
        .map(v => this.calculateVehicleScore(v, useCase, context))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      const filterTime = Date.now() - startTime;

      // Log performance metrics using structured event logging
      // **Feature: latency-optimization** - Requirements: 6.3
      logEvent.deterministicRanking({
        useCase,
        filterTimeMs: filterTime,
        vehiclesFound: vehicles.length,
        vehiclesReturned: rankedVehicles.length,
        budget: context.budget,
      });

      logger.info(
        {
          useCase,
          totalFound: vehicles.length,
          returned: rankedVehicles.length,
          filterTime,
          budget: context.budget,
        },
        'Deterministic ranking completed'
      );

      return {
        vehicles: rankedVehicles,
        totalCount: vehicles.length,
        filterTime,
        useCase,
      };
    } catch (error) {
      logger.error({ error, context }, 'Deterministic ranking failed');
      throw error;
    }
  }

  /**
   * Normaliza caso de uso
   */
  private normalizeUseCase(useCase: string): UseCase {
    const normalized = useCase.toLowerCase().trim();

    // Mapeamentos de sinônimos
    if (normalized.includes('uber') && normalized.includes('black')) return 'uberBlack';
    if (normalized.includes('uber') && normalized.includes('comfort')) return 'uberComfort';
    if (normalized.includes('uber') || normalized.includes('99') || normalized.includes('app'))
      return 'uberX';
    if (
      normalized.includes('famil') ||
      normalized.includes('criança') ||
      normalized.includes('cadeirinha')
    )
      return 'familia';
    if (
      normalized.includes('viag') ||
      normalized.includes('estrada') ||
      normalized.includes('rodovia')
    )
      return 'viagem';
    if (
      normalized.includes('carg') ||
      normalized.includes('frete') ||
      normalized.includes('mudança')
    )
      return 'carga';
    if (normalized.includes('entreg') || normalized.includes('delivery')) return 'entrega';
    if (
      normalized.includes('diário') ||
      normalized.includes('commute') ||
      normalized.includes('dia a dia')
    )
      return 'usoDiario';
    if (normalized.includes('trabalh') || normalized.includes('profissional')) return 'trabalho';

    return 'usoDiario'; // default
  }

  /**
   * Constrói cláusula WHERE baseada no contexto
   */
  private buildWhereClause(context: RankingContext, useCase: UseCase): Prisma.VehicleWhereInput {
    const aptitudeField = USE_CASE_FILTERS[useCase];

    const where: Prisma.VehicleWhereInput = {
      disponivel: true,
      [aptitudeField]: true,
    };

    // Filtro de orçamento
    if (context.budget) {
      where.preco = { lte: context.budget };
    }

    // Filtro de ano mínimo
    if (context.minYear) {
      where.ano = { gte: context.minYear };
    }

    // Filtro de km máximo
    if (context.maxKm) {
      where.km = { lte: context.maxKm };
    }

    // Filtro de tipo de carroceria (case-insensitive)
    if (context.bodyTypes && context.bodyTypes.length > 0) {
      // Use OR with mode insensitive for each body type to handle case differences
      // e.g., profile sends 'suv' but DB stores 'SUV'
      where.OR = context.bodyTypes.map(bt => ({
        carroceria: { equals: bt, mode: 'insensitive' as const },
      }));
    }

    // Filtro de transmissão
    if (context.transmission) {
      where.cambio = context.transmission;
    }

    return where;
  }

  /**
   * Calcula score total do veículo baseado nos pesos do caso de uso
   */
  private calculateVehicleScore(
    vehicle: any,
    useCase: UseCase,
    context: RankingContext
  ): RankedVehicle {
    const weights = USE_CASE_WEIGHTS[useCase];

    // Calcular score ponderado
    // Os scores individuais são de 1-10, mas na prática variam de 3-9
    // Normalizamos para uma escala de 50-100 para melhor UX
    // Score 3 -> 50, Score 6 -> 75, Score 9 -> 100
    let weightedScore = 0;
    let totalWeight = 0;

    for (const [field, weight] of Object.entries(weights)) {
      const rawValue = vehicle[field] || 5; // default 5 se não calculado
      // Normalizar de escala 1-10 para 50-100
      // Fórmula: 50 + (value - 1) * (50 / 9) ≈ 50 + value * 5.56
      const normalizedValue = 50 + (rawValue - 1) * 5.56;
      weightedScore += normalizedValue * weight;
      totalWeight += weight;
    }

    let score = Math.round(weightedScore / totalWeight);

    // Bônus por ano recente
    const currentYear = new Date().getFullYear();
    if (vehicle.ano >= currentYear - 2) score = Math.min(100, score + 5);
    if (vehicle.ano >= currentYear) score = Math.min(100, score + 3);

    // Bônus por baixa quilometragem
    if (vehicle.km < 30000) score = Math.min(100, score + 5);
    else if (vehicle.km < 50000) score = Math.min(100, score + 3);

    // Bônus por câmbio automático (para Uber e família)
    if (['familia', 'uberX', 'uberComfort', 'uberBlack', 'uber'].includes(useCase)) {
      if (vehicle.cambio === 'Automático' || vehicle.cambio === 'CVT') {
        score = Math.min(100, score + 5);
      }
    }

    // Bônus específicos por categoria de uso
    // Cada categoria valoriza características diferentes
    switch (useCase) {
      case 'familia':
        // Família valoriza espaço, segurança e conforto
        if (vehicle.scoreEspaco >= 7) score = Math.min(100, score + 3);
        if (vehicle.scoreSeguranca >= 7) score = Math.min(100, score + 3);
        if (vehicle.scoreConforto >= 6) score = Math.min(100, score + 2);
        break;

      case 'viagem':
        // Viagem valoriza conforto, economia e espaço
        if (vehicle.scoreConforto >= 6) score = Math.min(100, score + 3);
        if (vehicle.scoreEconomia >= 6) score = Math.min(100, score + 3);
        if (vehicle.scoreEspaco >= 7) score = Math.min(100, score + 2);
        break;

      case 'uberX':
      case 'uber':
        // Uber X valoriza economia e custo-benefício
        if (vehicle.scoreEconomia >= 7) score = Math.min(100, score + 4);
        if (vehicle.scoreCustoBeneficio >= 7) score = Math.min(100, score + 3);
        break;

      case 'uberComfort':
        // Uber Comfort valoriza conforto e espaço
        if (vehicle.scoreConforto >= 7) score = Math.min(100, score + 4);
        if (vehicle.scoreEspaco >= 6) score = Math.min(100, score + 3);
        break;

      case 'uberBlack':
        // Uber Black valoriza conforto premium e segurança
        if (vehicle.scoreConforto >= 8) score = Math.min(100, score + 5);
        if (vehicle.scoreSeguranca >= 7) score = Math.min(100, score + 3);
        break;

      case 'trabalho':
      case 'usoDiario':
        // Trabalho/uso diário valoriza economia e custo-benefício
        if (vehicle.scoreEconomia >= 7) score = Math.min(100, score + 4);
        if (vehicle.scoreCustoBeneficio >= 7) score = Math.min(100, score + 3);
        break;

      case 'carga':
        // Carga valoriza espaço e custo-benefício
        if (vehicle.scoreEspaco >= 8) score = Math.min(100, score + 5);
        if (vehicle.scoreCustoBeneficio >= 6) score = Math.min(100, score + 3);
        break;

      case 'entrega':
        // Entrega valoriza economia e baixa manutenção
        if (vehicle.scoreEconomia >= 8) score = Math.min(100, score + 5);
        if (vehicle.scoreCustoBeneficio >= 7) score = Math.min(100, score + 3);
        break;
    }

    // Gerar highlights e concerns
    const { highlights, concerns } = this.generateHighlightsAndConcerns(vehicle, useCase);

    // Gerar reasoning
    const reasoning = this.generateReasoning(vehicle, useCase, score);

    return {
      id: vehicle.id,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      ano: vehicle.ano,
      preco: vehicle.preco || 0,
      km: vehicle.km,
      carroceria: vehicle.carroceria,
      cambio: vehicle.cambio,
      score,
      reasoning,
      highlights,
      concerns,
      // Campos para exibição de links e imagens
      url: vehicle.url || vehicle.detailUrl || null,
      detailUrl: vehicle.detailUrl || vehicle.url || null,
      fotoUrl: vehicle.fotoUrl,
      cor: vehicle.cor,
    };
  }

  /**
   * Gera highlights e concerns baseados no veículo e caso de uso
   */
  private generateHighlightsAndConcerns(
    vehicle: any,
    useCase: UseCase
  ): { highlights: string[]; concerns: string[] } {
    const highlights: string[] = [];
    const concerns: string[] = [];
    const currentYear = new Date().getFullYear();

    // Highlights gerais
    if (vehicle.ano >= currentYear - 2) {
      highlights.push(`Veículo recente (${vehicle.ano})`);
    }
    if (vehicle.km < 50000) {
      highlights.push(`Baixa quilometragem (${vehicle.km.toLocaleString('pt-BR')} km)`);
    }
    if (vehicle.cambio === 'Automático' || vehicle.cambio === 'CVT') {
      highlights.push('Câmbio automático');
    }

    // Highlights específicos por caso de uso
    if (useCase === 'familia') {
      if (vehicle.scoreEspaco >= 7) highlights.push('Espaçoso para família');
      if (vehicle.scoreSeguranca >= 7) highlights.push('Boa segurança');
    } else if (['uberX', 'uberComfort', 'uberBlack', 'uber'].includes(useCase)) {
      if (vehicle.scoreEconomia >= 7) highlights.push('Econômico');
      if (vehicle.scoreConforto >= 7) highlights.push('Confortável para passageiros');
    } else if (useCase === 'viagem') {
      if (vehicle.scoreConforto >= 7) highlights.push('Confortável para viagens');
      if (vehicle.scoreEconomia >= 7) highlights.push('Econômico na estrada');
    }

    // Concerns
    if (vehicle.km > 100000) {
      concerns.push(`Quilometragem alta (${vehicle.km.toLocaleString('pt-BR')} km)`);
    }
    if (vehicle.ano < currentYear - 5) {
      concerns.push(`Veículo com ${currentYear - vehicle.ano} anos`);
    }
    if (vehicle.cambio === 'Manual' && ['familia', 'uberComfort', 'uberBlack'].includes(useCase)) {
      concerns.push('Câmbio manual');
    }

    return {
      highlights: highlights.slice(0, 3),
      concerns: concerns.slice(0, 2),
    };
  }

  /**
   * Gera reasoning baseado no veículo e caso de uso
   */
  private generateReasoning(vehicle: any, useCase: UseCase, score: number): string {
    const marca = vehicle.marca;
    const modelo = vehicle.modelo;
    const ano = vehicle.ano;

    const useCaseDescriptions: Record<UseCase, string> = {
      familia: 'uso familiar',
      uberX: 'UberX',
      uberComfort: 'Uber Comfort',
      uberBlack: 'Uber Black',
      uber: 'aplicativos de transporte',
      trabalho: 'trabalho',
      viagem: 'viagens',
      carga: 'transporte de carga',
      usoDiario: 'uso diário',
      entrega: 'entregas',
    };

    const useCaseDesc = useCaseDescriptions[useCase];

    if (score >= 90) {
      return `${marca} ${modelo} ${ano} é excelente para ${useCaseDesc}. Atende todos os critérios principais.`;
    } else if (score >= 75) {
      return `${marca} ${modelo} ${ano} é uma ótima opção para ${useCaseDesc}. Bom custo-benefício.`;
    } else if (score >= 60) {
      return `${marca} ${modelo} ${ano} é adequado para ${useCaseDesc}, com alguns compromissos.`;
    } else {
      return `${marca} ${modelo} ${ano} pode atender ${useCaseDesc}, mas há opções melhores.`;
    }
  }
}

// Singleton export
export const deterministicRanker = new DeterministicRankerService();
