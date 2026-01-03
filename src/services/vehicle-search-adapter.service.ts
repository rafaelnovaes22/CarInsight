/**
 * Vehicle Search Adapter
 *
 * Simplified SQL-based search adapter.
 * Uses database filters + AI Reranker for recommendations.
 *
 * **Feature: exact-vehicle-search**
 * Requirements: 1.1, 1.2
 */

import { prisma } from '../lib/prisma';
import { VehicleRecommendation } from '../types/state.types';
import { logger } from '../lib/logger';
import { exactSearchParser, ExtractedFilters } from './exact-search-parser.service';
import { exactSearchService, ExactSearchResult, Vehicle } from './exact-search.service';

interface SearchFilters {
  maxPrice?: number;
  minPrice?: number;
  minYear?: number;
  maxKm?: number;
  bodyType?: string;
  transmission?: string;
  brand?: string;
  model?: string; // Modelo específico (ex: "Compass", "Civic")
  limit?: number;
  // Uber filters
  aptoUber?: boolean;
  aptoUberBlack?: boolean;
  // Family filter
  aptoFamilia?: boolean;
  // Work filter
  aptoTrabalho?: boolean;
  // Exclude specific IDs
  excludeIds?: string[];
}

export class VehicleSearchAdapter {
  /**
   * Search vehicles using semantic search + filters
   * When brand is specified, does DIRECT database search (not semantic)
   *
   * **Feature: exact-vehicle-search**
   * Requirements: 1.1, 1.2 - Prioritizes exact model+year searches
   */
  async search(query: string, filters: SearchFilters = {}): Promise<VehicleRecommendation[]> {
    try {
      const limit = filters.limit || 5;
      console.log(`DEBUG: Entering search with query: ${query}`);

      // Step 1: Try exact search (model + year) first
      // Requirements: 1.1, 1.2 - Extract filters and prioritize exact matches
      const extractedFilters = exactSearchParser.parse(query);

      if (extractedFilters.model && (extractedFilters.year || extractedFilters.yearRange)) {
        logger.info(
          {
            query,
            model: extractedFilters.model,
            year: extractedFilters.year,
            yearRange: extractedFilters.yearRange,
          },
          'Exact search detected - routing to ExactSearchService'
        );

        const exactResult = await this.performExactSearch(extractedFilters, filters, limit);
        if (exactResult.length > 0 || extractedFilters.model) {
          // Return exact results or empty if no matches (let caller handle unavailability)
          return exactResult;
        }
      }

      // Step 2: Se tem filtro de marca, modelo OU categoria específica, fazer busca DIRETA no banco
      if (filters.brand || filters.model || filters.bodyType) {
        console.log(`DEBUG: Direct search triggered. Model: ${filters.model}`);

        logger.info(
          { brand: filters.brand, model: filters.model, bodyType: filters.bodyType, query },
          'Direct database search for specific filter'
        );
        let results = await this.searchDirectByFilters(filters);

        // Smart Budget Relaxation: If no results found for specific model, try relaxing budget
        if (results.length === 0 && filters.model && filters.maxPrice) {
          logger.info(
            { model: filters.model },
            'No results for model with budget. Relaxing budget filter.'
          );
          const relaxedFilters = { ...filters };
          delete relaxedFilters.maxPrice;
          results = await this.searchDirectByFilters(relaxedFilters);

          if (results.length > 0) {
            logger.info({ count: results.length }, 'Found results after budget relaxation');
            // Logic handled below in recommendations formatting
          }
        }

        // Ensure direct search results also get budget warnings
        const recommendations = results; // searchDirectByFilters returns Recommendations directly
        if (filters && filters.maxPrice && results.length > 0) {
          recommendations.forEach(rec => {
            if (rec.vehicle.price && filters.maxPrice && rec.vehicle.price > filters.maxPrice) {
              rec.reasoning += ` (Valor acima do orçamento de R$ ${filters.maxPrice.toLocaleString('pt-BR')}, mas incluído por relevância exata)`;
              rec.concerns.push(
                `Preço R$ ${rec.vehicle.price.toLocaleString('pt-BR')} excede orçamento`
              );
            }
          });
        }
        return recommendations;
      }

      // Step 3: SQL-based search (embeddings removed - AI Reranker handles intelligent ordering)
      logger.info({ query, filters }, 'SQL-based search');
      return this.searchFallbackSQL(filters);
    } catch (error) {
      logger.error({ error, query, filters }, 'Error searching vehicles');
      return [];
    }
  }

  /**
   * Perform exact search using ExactSearchService
   * Fetches inventory from database and delegates to ExactSearchService
   *
   * **Feature: exact-vehicle-search**
   * Requirements: 1.1, 1.2 - Extract filters and prioritize exact matches
   */
  private async performExactSearch(
    extractedFilters: ExtractedFilters,
    searchFilters: SearchFilters,
    limit: number
  ): Promise<VehicleRecommendation[]> {
    try {
      // Fetch available inventory from database
      const dbVehicles = await prisma.vehicle.findMany({
        where: {
          disponivel: true,
          // Apply additional filters if provided
          ...(searchFilters.maxPrice && { preco: { lte: searchFilters.maxPrice } }),
          ...(searchFilters.minPrice && { preco: { gte: searchFilters.minPrice } }),
          ...(searchFilters.maxKm && { km: { lte: searchFilters.maxKm } }),
        },
      });

      // Convert to Vehicle interface expected by ExactSearchService
      const inventory: Vehicle[] = dbVehicles.map(v => ({
        id: v.id,
        marca: v.marca,
        modelo: v.modelo,
        versao: v.versao,
        ano: v.ano,
        km: v.km,
        preco: v.preco ?? 0, // Handle null with default
        cor: v.cor,
        carroceria: v.carroceria,
        combustivel: v.combustivel,
        cambio: v.cambio,
        disponivel: v.disponivel,
        fotoUrl: v.fotoUrl,
        url: v.url,
      }));

      // Perform exact search
      const result = exactSearchService.search(extractedFilters, inventory);

      logger.info(
        {
          type: result.type,
          vehiclesFound: result.vehicles.length,
          requestedModel: result.requestedModel,
          requestedYear: result.requestedYear,
          availableYears: result.availableYears,
        },
        'ExactSearchService result'
      );

      // Convert ExactSearchResult to VehicleRecommendation[]
      return this.convertExactResultToRecommendations(result, limit);
    } catch (error) {
      logger.error({ error, extractedFilters }, 'Error in performExactSearch');
      return [];
    }
  }

  /**
   * Convert ExactSearchResult to VehicleRecommendation format
   *
   * **Feature: exact-vehicle-search**
   */
  private convertExactResultToRecommendations(
    result: ExactSearchResult,
    limit: number
  ): VehicleRecommendation[] {
    return result.vehicles.slice(0, limit).map(match => ({
      vehicleId: match.vehicle.id,
      matchScore: match.matchScore,
      reasoning: match.reasoning,
      highlights: this.generateHighlightsFromVehicle(match.vehicle),
      concerns: [],
      vehicle: {
        id: match.vehicle.id,
        brand: match.vehicle.marca,
        model: match.vehicle.modelo,
        year: match.vehicle.ano,
        price: match.vehicle.preco,
        mileage: match.vehicle.km,
        bodyType: match.vehicle.carroceria,
        transmission: match.vehicle.cambio,
        fuelType: match.vehicle.combustivel,
        color: match.vehicle.cor,
        imageUrl: match.vehicle.fotoUrl || null,
        detailsUrl: match.vehicle.url || null,
      },
      // Include exact search metadata for downstream processing
      exactSearchMetadata: {
        type: result.type,
        message: result.message,
        availableYears: result.availableYears,
        requestedModel: result.requestedModel,
        requestedYear: result.requestedYear,
        matchType: match.matchType,
      },
    }));
  }

  /**
   * Generate highlights from Vehicle interface
   */
  private generateHighlightsFromVehicle(vehicle: Vehicle): string[] {
    const highlights: string[] = [];

    // Low mileage
    if (vehicle.km < 50000) {
      highlights.push(`Baixa quilometragem: ${vehicle.km.toLocaleString('pt-BR')}km`);
    }

    // Recent year
    const currentYear = new Date().getFullYear();
    if (vehicle.ano >= currentYear - 3) {
      highlights.push(`Veículo recente: ${vehicle.ano}`);
    }

    return highlights.slice(0, 3);
  }

  /**
   * Busca direta por marca, modelo e/ou categoria (não usa busca semântica)
   */
  private async searchDirectByFilters(filters: SearchFilters): Promise<VehicleRecommendation[]> {
    const limit = filters.limit || 5;

    // Mapear variações de categoria para busca
    const bodyTypeVariations = this.getBodyTypeVariations(filters.bodyType);

    const vehicles = await prisma.vehicle.findMany({
      where: {
        disponivel: true,
        id: { notIn: filters.excludeIds || [] },
        // Filtro de marca (se especificado)
        ...(filters.brand && { marca: { contains: filters.brand, mode: 'insensitive' } }),
        // Filtro de modelo (se especificado)
        ...(filters.model && { modelo: { contains: filters.model, mode: 'insensitive' } }),
        // Filtro de categoria/carroceria (se especificado) - com variações
        ...(bodyTypeVariations.length > 0 && {
          OR: bodyTypeVariations.map(bt => ({
            carroceria: { contains: bt, mode: 'insensitive' as const },
          })),
        }),
        // Apply other filters
        ...(filters.maxPrice || filters.minPrice
          ? {
              preco: {
                ...(filters.maxPrice && { lte: filters.maxPrice }),
                ...(filters.minPrice && { gte: filters.minPrice }),
              },
            }
          : {}),
        ...(filters.minYear && { ano: { gte: filters.minYear } }),
        ...(filters.maxKm && { km: { lte: filters.maxKm } }),
        ...(filters.transmission && {
          cambio: { equals: filters.transmission, mode: 'insensitive' },
        }),
      },
      take: limit,
      orderBy: [{ preco: 'desc' }, { km: 'asc' }, { ano: 'desc' }],
    });

    logger.info(
      {
        brand: filters.brand,
        model: filters.model,
        bodyType: filters.bodyType,
        bodyTypeVariations,
        found: vehicles.length,
      },
      'Direct filter search results'
    );

    return this.formatVehicleResults(vehicles);
  }

  /**
   * Retorna variações de nome para cada tipo de carroceria
   * Aceita variações comuns em português e inglês
   */
  private getBodyTypeVariations(bodyType?: string): string[] {
    if (!bodyType) return [];

    const bt = bodyType
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove acentos

    // Mapeamento completo de variações (inclui termos em PT e EN)
    const variationGroups: string[][] = [
      // Pickups / Caminhonetes
      ['pickup', 'picape', 'pick-up', 'caminhonete', 'camionete', 'cabine', 'truck'],

      // SUVs / Utilitários
      ['suv', 'utilitario', 'crossover', 'jipe', 'jeep', '4x4', 'off-road', 'offroad'],

      // Sedans
      ['sedan', 'seda', 'sedã', 'notchback', 'fastback'],

      // Hatches / Compactos
      ['hatch', 'hatchback', 'compacto', 'compact'],

      // Minivans / Monovolumes
      ['minivan', 'mini-van', 'monovolume', 'mpv', 'van', 'perua', 'wagon', 'station'],

      // Cupês / Esportivos
      ['coupe', 'cupe', 'cupê', 'esportivo', 'sport', 'roadster', 'conversivel', 'cabriolet'],

      // Motos / Motocicletas
      [
        'moto',
        'motocicleta',
        'scooter',
        'biz',
        'cub',
        'street',
        'trail',
        'custom',
        'naked',
        'sport',
      ],
    ];

    // Encontrar o grupo que contém a variação buscada
    for (const group of variationGroups) {
      if (group.some(v => bt.includes(v) || v.includes(bt))) {
        return group;
      }
    }

    // Se não encontrou grupo, retorna o termo original + algumas variações comuns
    return [bodyType, bt];
  }

  /**
   * Busca SQL fallback quando busca semântica não retorna resultados
   */
  private async searchFallbackSQL(filters: SearchFilters): Promise<VehicleRecommendation[]> {
    const limit = filters.limit || 5;

    const vehicles = await prisma.vehicle.findMany({
      where: {
        disponivel: true,
        id: { notIn: filters.excludeIds || [] },
        ...(filters.maxPrice && { preco: { lte: filters.maxPrice } }),
        ...(filters.minPrice && { preco: { gte: filters.minPrice } }),
        ...(filters.minYear && { ano: { gte: filters.minYear } }),
        ...(filters.maxKm && { km: { lte: filters.maxKm } }),
        ...(filters.bodyType && { carroceria: { equals: filters.bodyType, mode: 'insensitive' } }),
        ...(filters.transmission && {
          cambio: { equals: filters.transmission, mode: 'insensitive' },
        }),
        ...(filters.brand && { marca: { equals: filters.brand, mode: 'insensitive' } }),
        ...(filters.aptoUber && { aptoUber: true }),
        ...(filters.aptoUberBlack && { aptoUberBlack: true }),
        ...(filters.aptoFamilia && { aptoFamilia: true }),
        ...(filters.aptoTrabalho && { aptoTrabalho: true }),
      },
      take: limit,
      orderBy: [{ preco: 'desc' }, { km: 'asc' }, { ano: 'desc' }],
    });

    logger.info({ filters, found: vehicles.length }, 'SQL fallback search results');

    return this.formatVehicleResults(vehicles);
  }

  /**
   * Formata veículos para o formato VehicleRecommendation
   */
  private formatVehicleResults(
    vehicles: any[],
    scoreMap?: Map<string, number>,
    query?: string
  ): VehicleRecommendation[] {
    return vehicles.map((vehicle, index) => {
      let score = 0;
      // reasoning is modified OUTSIDE this function (in the caller), so here it is const
      const reasoning = `Veículo ${index + 1} mais relevante para sua busca`;

      if (scoreMap && index === 0) {
        console.log(
          `DEBUG: scoreMap sample key: ${Array.from(scoreMap.keys())[0]} (Type: ${typeof Array.from(scoreMap.keys())[0]})`
        );
        console.log(`DEBUG: vehicle.id: ${vehicle.id} (Type: ${typeof vehicle.id})`);
        console.log(`DEBUG: scoreMap has vehicle.id? ${scoreMap.has(vehicle.id)}`);
      }

      if (scoreMap && scoreMap.has(vehicle.id)) {
        score = scoreMap.get(vehicle.id)!;
        // Convert to 0-100 scale for matchScore (assuming score is cosine similarity -1 to 1, usually 0.3-0.8 for openAI)
        // OpenAI small embeddings usually range 0.7-0.85 for good matches.
        // Let's normalize visually: 0.7 -> 70, 0.8 -> 90, 0.9 -> 100
        // Or just map raw * 100 if user understands it.
        // Better: (score - 0.7) / 0.2 * 100 ?
        // For simplicity now, let's just multiply by 100, but capped.
        // Actually, just expose the RAW semantic score if it's high enough, but UI expects 0-100.
        // Let's use a simpler heuristic: score * 100.
      } else {
        // Fallback scoring
        score = Math.max(95 - index * 5, 70) / 100;
      }

      const matchScore = Math.round(score * 100);

      return {
        vehicleId: vehicle.id,
        matchScore: matchScore,
        reasoning: reasoning, // Will be updated by caller if budget violation
        highlights: this.generateHighlights(vehicle),
        concerns: [],
        vehicle: {
          id: vehicle.id,
          brand: vehicle.marca,
          model: vehicle.modelo,
          year: vehicle.ano,
          price: vehicle.preco ?? 0,
          mileage: vehicle.km,
          bodyType: vehicle.carroceria,
          transmission: vehicle.cambio,
          fuelType: vehicle.combustivel,
          color: vehicle.cor,
          imageUrl: vehicle.fotoUrl || null,
          detailsUrl: vehicle.url || null,
          description: vehicle.descricao || '', // Added for AI Reranker context
        },
      };
    });
  }

  /**
   * Generate highlights for a vehicle
   */
  private generateHighlights(vehicle: any): string[] {
    const highlights: string[] = [];

    // Low mileage
    if (vehicle.km < 50000) {
      highlights.push(`Baixa quilometragem: ${vehicle.km.toLocaleString('pt-BR')}km`);
    }

    // Recent year
    const currentYear = new Date().getFullYear();
    if (vehicle.ano >= currentYear - 3) {
      highlights.push(`Veículo recente: ${vehicle.ano}`);
    }

    // Features
    const features: string[] = [];
    if (vehicle.arCondicionado) features.push('Ar condicionado');
    if (vehicle.direcaoHidraulica) features.push('Direção hidráulica');
    if (vehicle.airbag) features.push('Airbag');
    if (vehicle.abs) features.push('ABS');

    if (features.length > 0) {
      highlights.push(`Equipado: ${features.slice(0, 2).join(', ')}`);
    }

    return highlights.slice(0, 3); // Max 3 highlights
  }
}

// Singleton export
export const vehicleSearchAdapter = new VehicleSearchAdapter();
