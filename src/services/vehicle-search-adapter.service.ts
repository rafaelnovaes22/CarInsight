/**
 * Vehicle Search Adapter
 *
 * Adapter to use inMemoryVectorStore with the interface expected by VehicleExpertAgent
 *
 * **Feature: exact-vehicle-search**
 * Requirements: 1.1, 1.2
 *
 * **Feature: vehicle-fallback-recommendations**
 * Requirements: 5.1, 5.5
 *
 * **Feature: latency-optimization**
 * Requirements: 4.1-4.7, 5.1-5.5
 */

import { inMemoryVectorStore } from './in-memory-vector.service';
import { prisma } from '../lib/prisma';
import { VehicleRecommendation } from '../types/state.types';
import { logger, logEvent } from '../lib/logger';
import { exactSearchParser, ExtractedFilters } from './exact-search-parser.service';
import { exactSearchService, ExactSearchResult, Vehicle } from './exact-search.service';
import { FallbackService } from './fallback.service';
import { FallbackResult, FallbackVehicleMatch } from './fallback.types';
import {
  deterministicRanker,
  UseCase,
  RankingContext,
  DeterministicRankingResult,
} from './deterministic-ranker.service';

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
  // New Uber 2026 filters (latency-optimization)
  aptoUberX?: boolean;
  aptoUberComfort?: boolean;
  // Family filter
  aptoFamilia?: boolean;
  // Work filter
  aptoTrabalho?: boolean;
  aptoCarga?: boolean;
  aptoUsoDiario?: boolean;
  aptoEntrega?: boolean;
  // Travel filter
  aptoViagem?: boolean;
  // Exclude specific IDs
  excludeIds?: string[];
  // Motorcycle filter - CRITICAL: excludes motorcycles when searching for cars
  excludeMotorcycles?: boolean;
  // Context for smart scoring
  useCase?:
    | 'family'
    | 'uber'
    | 'uberX'
    | 'uberComfort'
    | 'uberBlack'
    | 'work'
    | 'travel'
    | 'general';
  hasCadeirinha?: boolean;
  minSeats?: number;
  // New category filters (latency-optimization)
  categoriaVeiculo?: string; // SUV, Sedan, Hatch, Pickup, etc.
  segmentoPreco?: string; // economico, intermediario, premium
  // Score-based filters (latency-optimization)
  minScoreConforto?: number;
  minScoreEconomia?: number;
  minScoreEspaco?: number;
  minScoreSeguranca?: number;
  minScoreCustoBeneficio?: number;
}

export class VehicleSearchAdapter {
  private fallbackService: FallbackService;

  constructor() {
    this.fallbackService = new FallbackService();
  }

  /**
   * Search vehicles using DeterministicRanker for use-case-based queries
   * Uses pre-calculated aptitude fields for fast SQL filtering (< 5s)
   *
   * **Feature: latency-optimization**
   * Requirements: 4.1-4.7, 5.1-5.5
   */
  async searchByUseCase(
    useCase: UseCase,
    filters: SearchFilters = {}
  ): Promise<VehicleRecommendation[]> {
    const limit = filters.limit || 5;
    const startTime = Date.now();

    try {
      logger.info({ useCase, filters }, 'Searching vehicles using DeterministicRanker');

      // Build ranking context from filters
      const context: RankingContext = {
        useCase,
        budget: filters.maxPrice,
        minYear: filters.minYear,
        maxKm: filters.maxKm,
        bodyTypes: filters.bodyType ? [filters.bodyType] : undefined,
        transmission: filters.transmission as 'Automático' | 'Manual' | undefined,
      };

      // Use DeterministicRanker for fast SQL-based ranking
      const result = await deterministicRanker.rank(context, limit);

      const totalTime = Date.now() - startTime;

      // Log performance metrics
      // **Feature: latency-optimization** - Requirements: 6.3, 6.4
      logEvent.vehicleSearched({
        conversationId: 'use-case-search',
        query: useCase,
        searchType: 'direct',
        resultsCount: result.vehicles.length,
        latencyMs: totalTime,
        filters: {
          useCase,
          budget: filters.maxPrice,
          minYear: filters.minYear,
          maxKm: filters.maxKm,
          filterTime: result.filterTime,
        },
      });

      // Alert if search exceeds 5 seconds
      if (totalTime > 5000) {
        logEvent.latencyAlert({
          conversationId: 'use-case-search',
          requestId: `search_${Date.now()}`,
          totalDurationMs: totalTime,
          thresholdMs: 5000,
          llmCallCount: 0,
          slowestStage: 'deterministic_ranking',
          slowestStageDurationMs: result.filterTime,
        });
      }

      logger.info(
        {
          useCase,
          totalFound: result.totalCount,
          returned: result.vehicles.length,
          filterTime: result.filterTime,
          totalTime,
        },
        'DeterministicRanker search completed'
      );

      // Convert to VehicleRecommendation format
      return result.vehicles.map(vehicle => ({
        vehicleId: vehicle.id,
        matchScore: vehicle.score,
        reasoning: vehicle.reasoning,
        highlights: vehicle.highlights,
        concerns: vehicle.concerns,
        vehicle: {
          id: vehicle.id,
          brand: vehicle.marca,
          model: vehicle.modelo,
          year: vehicle.ano,
          price: vehicle.preco,
          mileage: vehicle.km,
          bodyType: vehicle.carroceria,
          transmission: vehicle.cambio,
          fuelType: null, // Not returned by DeterministicRanker
          color: vehicle.cor || null,
          imageUrl: vehicle.fotoUrl || null,
          detailsUrl: vehicle.url || null,
          // Also include url field for compatibility with recommendation-formatter
          url: vehicle.url || null,
        },
      }));
    } catch (error) {
      logger.error({ error, useCase, filters }, 'Error in searchByUseCase');
      // Fallback to regular search if DeterministicRanker fails
      return this.search('', filters);
    }
  }

  /**
   * Search vehicles using semantic search + filters
   * When brand is specified, does DIRECT database search (not semantic)
   *
   * **Feature: exact-vehicle-search**
   * Requirements: 1.1, 1.2 - Prioritizes exact model+year searches
   *
   * **Feature: vehicle-fallback-recommendations**
   * Requirements: 5.1 - Invokes FallbackService when no exact results
   */
  async search(query: string, filters: SearchFilters = {}): Promise<VehicleRecommendation[]> {
    try {
      const limit = filters.limit || 5;

      // Step 1: Try exact search (model + year) first
      // Requirements: 1.1, 1.2 - Extract filters and prioritize exact matches
      const extractedFilters = await exactSearchParser.parse(query);

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
      // (não depender da busca semântica que pode não retornar o veículo)
      if (filters.brand || filters.model || filters.bodyType) {
        logger.info(
          { brand: filters.brand, model: filters.model, bodyType: filters.bodyType, query },
          'Direct database search for specific filter'
        );
        return this.searchDirectByFilters(filters);
      }

      // Get vehicle IDs from semantic search
      let vehicleIds: string[] = [];

      // CRITICAL FIX: Don't run semantic search for empty queries - it throws "Erro ao gerar embedding"
      if (query && query.trim().length > 0) {
        vehicleIds = await inMemoryVectorStore.search(query, limit * 2); // Get more to filter
      } else {
        logger.info('Empty query for semantic search, skipping to SQL fallback');
      }

      // Se busca semântica não retornou nada (ou foi pulada), fazer fallback para busca SQL
      if (vehicleIds.length === 0) {
        logger.info(
          { query, filters },
          'Semantic search returned empty (or skipped), falling back to SQL'
        );
        return this.searchFallbackSQL(filters);
      }

      // Fetch full vehicle data
      const vehicles = await prisma.vehicle.findMany({
        where: {
          id: {
            in: vehicleIds,
            notIn: filters.excludeIds || [],
          },
          disponivel: true,
          // CRITICAL: Exclude motorcycles when searching for cars
          ...(filters.excludeMotorcycles && {
            carroceria: { notIn: ['Moto', 'moto', 'MOTO', 'Motocicleta', 'motocicleta'] },
          }),
          // Apply filters
          ...(filters.maxPrice && { preco: { lte: filters.maxPrice } }),
          ...(filters.minPrice && { preco: { gte: filters.minPrice } }),
          ...(filters.minYear && { ano: { gte: filters.minYear } }),
          ...(filters.maxKm && { km: { lte: filters.maxKm } }),
          ...(filters.bodyType && {
            carroceria: { equals: filters.bodyType, mode: 'insensitive' },
          }),
          ...(filters.transmission && {
            cambio: { equals: filters.transmission, mode: 'insensitive' },
          }),
          ...(filters.brand && { marca: { equals: filters.brand, mode: 'insensitive' } }),
          // Legacy Uber filters
          ...(filters.aptoUber && { aptoUber: true }),
          ...(filters.aptoUberBlack && { aptoUberBlack: true }),
          // New Uber 2026 filters (latency-optimization)
          ...(filters.aptoUberX && { aptoUberX: true }),
          ...(filters.aptoUberComfort && { aptoUberComfort: true }),
          // Family filter
          ...(filters.aptoFamilia && { aptoFamilia: true }),
          // Work filter
          ...(filters.aptoTrabalho && { aptoTrabalho: true }),
          ...(filters.aptoCarga && { aptoCarga: true }),
          ...(filters.aptoUsoDiario && { aptoUsoDiario: true }),
          ...(filters.aptoEntrega && { aptoEntrega: true }),
          // Travel filter
          ...(filters.aptoViagem && { aptoViagem: true }),
          // Category filters (latency-optimization)
          ...(filters.categoriaVeiculo && {
            categoriaVeiculo: { equals: filters.categoriaVeiculo, mode: 'insensitive' },
          }),
          ...(filters.segmentoPreco && {
            segmentoPreco: { equals: filters.segmentoPreco, mode: 'insensitive' },
          }),
          // Score-based filters (latency-optimization)
          ...(filters.minScoreConforto && { scoreConforto: { gte: filters.minScoreConforto } }),
          ...(filters.minScoreEconomia && { scoreEconomia: { gte: filters.minScoreEconomia } }),
          ...(filters.minScoreEspaco && { scoreEspaco: { gte: filters.minScoreEspaco } }),
          ...(filters.minScoreSeguranca && { scoreSeguranca: { gte: filters.minScoreSeguranca } }),
          ...(filters.minScoreCustoBeneficio && {
            scoreCustoBeneficio: { gte: filters.minScoreCustoBeneficio },
          }),
        },
        take: limit,
        orderBy: this.getSortStrategy(filters),
      });

      // IN-MEMORY SORTING FOR UBER/WORK (Efficiency)
      // Since specific efficiency data is a string/mixed, we refine the sort here.
      if (
        filters.useCase === 'uber' ||
        filters.useCase === 'work' ||
        filters.aptoUber ||
        filters.aptoTrabalho
      ) {
        vehicles.sort((a, b) => {
          // 1. Year Priority (Hard constraint for Uber often, but we already sorted query by Year)
          // 2. Efficiency (Higher km/l is better)
          const effA = this.parseConsumption(a.economiaCombustivel);
          const effB = this.parseConsumption(b.economiaCombustivel);

          if (effA !== effB) {
            return effB - effA; // Descending efficiency (14km/l > 10km/l)
          }

          // 3. Fallback to Engine Size Proxy if data missing (lower engine ~ better efficiency)
          const engineA = this.extractEngineSize(a.versao);
          const engineB = this.extractEngineSize(b.versao);
          if (engineA !== engineB) {
            return engineA - engineB; // Ascending engine size (1.0 < 2.0)
          }

          return 0; // Maintain previous sort (Year/Km/Price)
        });
      }

      // Se filtrou por bodyType e não encontrou nada, buscar SEM o filtro de IDs
      // para verificar se existem veículos desse tipo no estoque
      if (vehicles.length === 0 && filters.bodyType) {
        const existsInStock = await prisma.vehicle.count({
          where: {
            disponivel: true,
            carroceria: { equals: filters.bodyType, mode: 'insensitive' },
          },
        });

        if (existsInStock === 0) {
          logger.info({ bodyType: filters.bodyType }, 'Body type not available in stock');
          return []; // Retorna vazio para trigger "não temos X no estoque"
        }

        // Se existe no estoque mas não veio da busca semântica, fazer fallback SQL
        return this.searchFallbackSQL(filters);
      }

      // Convert to VehicleRecommendation format
      return vehicles.map((vehicle, index) => ({
        vehicleId: vehicle.id,
        matchScore: Math.max(95 - index * 5, 70), // Simple scoring based on order
        reasoning: `Veículo ${index + 1} mais relevante para sua busca`,
        highlights: this.generateHighlights(vehicle),
        concerns: [],
        vehicle: {
          id: vehicle.id,
          brand: vehicle.marca,
          model: vehicle.modelo,
          year: vehicle.ano,
          price: vehicle.preco,
          mileage: vehicle.km,
          bodyType: vehicle.carroceria,
          transmission: vehicle.cambio,
          fuelType: vehicle.combustivel,
          color: vehicle.cor,
          imageUrl: vehicle.fotoUrl || null,
          detailsUrl: vehicle.url || null,
        },
      }));
    } catch (error) {
      logger.error({ error, query, filters }, 'Error searching vehicles');
      return [];
    }
  }

  /**
   * Perform exact search using ExactSearchService
   * Fetches inventory from database and delegates to ExactSearchService
   * When no exact results found, invokes FallbackService for alternatives
   *
   * **Feature: exact-vehicle-search**
   * Requirements: 1.1, 1.2 - Extract filters and prioritize exact matches
   *
   * **Feature: vehicle-fallback-recommendations**
   * Requirements: 5.1 - Automatic fallback invocation when no exact results
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
          // CRITICAL: Exclude motorcycles when searching for cars
          ...(searchFilters.excludeMotorcycles && {
            carroceria: { notIn: ['Moto', 'moto', 'MOTO', 'Motocicleta', 'motocicleta'] },
          }),
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

      // If exact search found results, return them
      if (result.vehicles.length > 0) {
        return this.convertExactResultToRecommendations(result, limit);
      }

      // No exact results - invoke FallbackService for alternatives
      // **Feature: vehicle-fallback-recommendations** - Requirements: 5.1
      if (extractedFilters.model) {
        const requestedYear =
          extractedFilters.year ??
          (extractedFilters.yearRange ? extractedFilters.yearRange.min : null);

        const referencePrice = searchFilters.maxPrice ?? searchFilters.minPrice;

        logger.info(
          {
            model: extractedFilters.model,
            year: requestedYear,
            referencePrice,
          },
          'Invoking FallbackService for alternatives'
        );

        const fallbackResult = this.fallbackService.findAlternatives(
          extractedFilters.model,
          requestedYear,
          inventory,
          referencePrice
        );

        logger.info(
          {
            fallbackType: fallbackResult.type,
            vehiclesFound: fallbackResult.vehicles.length,
            message: fallbackResult.message,
          },
          'FallbackService result'
        );

        // Convert fallback results to recommendations
        if (fallbackResult.vehicles.length > 0) {
          return this.convertFallbackResultToRecommendations(fallbackResult, limit);
        }
      }

      // No results from either service
      return this.convertExactResultToRecommendations(result, limit);
    } catch (error) {
      logger.error({ error, extractedFilters }, 'Error in performExactSearch');
      return [];
    }
  }

  /**
   * Convert FallbackResult to VehicleRecommendation format
   *
   * **Feature: vehicle-fallback-recommendations**
   * Requirements: 5.1, 5.5
   */
  private convertFallbackResultToRecommendations(
    result: FallbackResult,
    limit: number
  ): VehicleRecommendation[] {
    return result.vehicles.slice(0, limit).map((match: FallbackVehicleMatch) => ({
      vehicleId: match.vehicle.id,
      matchScore: match.similarityScore,
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
      // Include fallback metadata for downstream processing
      fallbackMetadata: {
        type: result.type,
        message: result.message,
        availableYears: result.availableYears,
        requestedModel: result.requestedModel,
        requestedYear: result.requestedYear,
      },
    }));
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
        // CRITICAL: Exclude motorcycles when searching for cars
        ...(filters.excludeMotorcycles && {
          carroceria: { notIn: ['Moto', 'moto', 'MOTO', 'Motocicleta', 'motocicleta'] },
        }),
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
        ...(filters.maxPrice && { preco: { lte: filters.maxPrice } }),
        ...(filters.minPrice && { preco: { gte: filters.minPrice } }),
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
   * Updated to support new aptitude filters (latency-optimization)
   *
   * **Feature: latency-optimization**
   * Requirements: 4.1-4.7
   */
  private async searchFallbackSQL(filters: SearchFilters): Promise<VehicleRecommendation[]> {
    const limit = filters.limit || 5;

    const vehicles = await prisma.vehicle.findMany({
      where: {
        disponivel: true,
        id: { notIn: filters.excludeIds || [] },
        // CRITICAL: Exclude motorcycles when searching for cars
        ...(filters.excludeMotorcycles && {
          carroceria: { notIn: ['Moto', 'moto', 'MOTO', 'Motocicleta', 'motocicleta'] },
        }),
        ...(filters.maxPrice && { preco: { lte: filters.maxPrice } }),
        ...(filters.minPrice && { preco: { gte: filters.minPrice } }),
        ...(filters.minYear && { ano: { gte: filters.minYear } }),
        ...(filters.maxKm && { km: { lte: filters.maxKm } }),
        ...(filters.bodyType && { carroceria: { equals: filters.bodyType, mode: 'insensitive' } }),
        ...(filters.transmission && {
          cambio: { equals: filters.transmission, mode: 'insensitive' },
        }),
        ...(filters.brand && { marca: { equals: filters.brand, mode: 'insensitive' } }),
        // Legacy Uber filters
        ...(filters.aptoUber && { aptoUber: true }),
        ...(filters.aptoUberBlack && { aptoUberBlack: true }),
        // New Uber 2026 filters (latency-optimization)
        ...(filters.aptoUberX && { aptoUberX: true }),
        ...(filters.aptoUberComfort && { aptoUberComfort: true }),
        // Other aptitude filters
        ...(filters.aptoFamilia && { aptoFamilia: true }),
        ...(filters.aptoTrabalho && { aptoTrabalho: true }),
        ...(filters.aptoCarga && { aptoCarga: true }),
        ...(filters.aptoUsoDiario && { aptoUsoDiario: true }),
        ...(filters.aptoEntrega && { aptoEntrega: true }),
        ...(filters.aptoViagem && { aptoViagem: true }),
        // Category filters (latency-optimization)
        ...(filters.categoriaVeiculo && {
          categoriaVeiculo: { equals: filters.categoriaVeiculo, mode: 'insensitive' },
        }),
        ...(filters.segmentoPreco && {
          segmentoPreco: { equals: filters.segmentoPreco, mode: 'insensitive' },
        }),
        // Score-based filters (latency-optimization)
        ...(filters.minScoreConforto && { scoreConforto: { gte: filters.minScoreConforto } }),
        ...(filters.minScoreEconomia && { scoreEconomia: { gte: filters.minScoreEconomia } }),
        ...(filters.minScoreEspaco && { scoreEspaco: { gte: filters.minScoreEspaco } }),
        ...(filters.minScoreSeguranca && { scoreSeguranca: { gte: filters.minScoreSeguranca } }),
        ...(filters.minScoreCustoBeneficio && {
          scoreCustoBeneficio: { gte: filters.minScoreCustoBeneficio },
        }),
      },
      take: limit,
      orderBy: this.getOrderByForFilters(filters),
    });

    logger.info({ filters, found: vehicles.length }, 'SQL fallback search results');

    return this.formatVehicleResults(vehicles);
  }

  /**
   * Formata veículos para o formato VehicleRecommendation
   */
  private formatVehicleResults(vehicles: any[]): VehicleRecommendation[] {
    return vehicles.map((vehicle, index) => ({
      vehicleId: vehicle.id,
      matchScore: Math.max(95 - index * 5, 70),
      reasoning: `Veículo ${index + 1} mais relevante para sua busca`,
      highlights: this.generateHighlights(vehicle),
      concerns: [],
      vehicle: {
        id: vehicle.id,
        brand: vehicle.marca,
        model: vehicle.modelo,
        year: vehicle.ano,
        price: vehicle.preco,
        mileage: vehicle.km,
        bodyType: vehicle.carroceria,
        transmission: vehicle.cambio,
        fuelType: vehicle.combustivel,
        color: vehicle.cor,
        imageUrl: vehicle.fotoUrl || null,
        detailsUrl: vehicle.url || null,
        url: vehicle.url || null,
      },
    }));
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

  /**
   * Determine sort strategy based on filters and use case
   * Updated to use pre-calculated scores for better ordering (latency-optimization)
   *
   * **Feature: latency-optimization**
   * Requirements: 4.3
   */
  private getSortStrategy(filters: SearchFilters): any[] {
    // Use case-specific ordering using pre-calculated scores
    const useCase = filters.useCase;

    if (useCase === 'family') {
      return [
        { scoreEspaco: 'desc' },
        { scoreConforto: 'desc' },
        { scoreSeguranca: 'desc' },
        { ano: 'desc' },
      ];
    }

    if (useCase === 'uber' || useCase === 'uberX') {
      return [{ ano: 'desc' }, { km: 'asc' }, { scoreEconomia: 'desc' }];
    }

    if (useCase === 'uberComfort' || useCase === 'uberBlack') {
      return [{ ano: 'desc' }, { scoreConforto: 'desc' }, { km: 'asc' }];
    }

    if (useCase === 'work') {
      return [{ scoreEconomia: 'desc' }, { scoreCustoBeneficio: 'desc' }, { preco: 'asc' }];
    }

    if (useCase === 'travel') {
      return [{ scoreConforto: 'desc' }, { scoreEconomia: 'desc' }, { km: 'asc' }];
    }

    // GLOBAL DEFAULT: Efficiency/Rationality Focus
    return [
      { ano: 'desc' }, // Newer cars (Better tech/lifespan)
      { km: 'asc' }, // Reliability
      { preco: 'asc' }, // ROI (Cheaper is better for same year/km)
    ];
  }

  /**
   * Get order by clause based on filters
   * Uses pre-calculated scores for use-case-specific ordering
   *
   * **Feature: latency-optimization**
   * Requirements: 4.3
   */
  private getOrderByForFilters(filters: SearchFilters): any[] {
    // If specific aptitude filters are set, use appropriate ordering
    if (filters.aptoFamilia) {
      return [{ scoreEspaco: 'desc' }, { scoreConforto: 'desc' }, { scoreSeguranca: 'desc' }];
    }

    if (filters.aptoUberComfort) {
      return [{ ano: 'desc' }, { scoreConforto: 'desc' }, { km: 'asc' }];
    }

    if (filters.aptoUberBlack) {
      return [{ ano: 'desc' }, { scoreConforto: 'desc' }, { km: 'asc' }];
    }

    if (filters.aptoUberX || filters.aptoUber) {
      return [{ ano: 'desc' }, { km: 'asc' }, { scoreEconomia: 'desc' }];
    }

    if (filters.aptoTrabalho || filters.aptoUsoDiario) {
      return [{ scoreEconomia: 'desc' }, { scoreCustoBeneficio: 'desc' }, { preco: 'asc' }];
    }

    if (filters.aptoViagem) {
      return [{ scoreConforto: 'desc' }, { scoreEconomia: 'desc' }, { km: 'asc' }];
    }

    if (filters.aptoCarga) {
      return [{ scoreEspaco: 'desc' }, { scoreCustoBeneficio: 'desc' }];
    }

    if (filters.aptoEntrega) {
      return [{ scoreEconomia: 'desc' }, { km: 'asc' }];
    }

    // Default ordering based on useCase if provided
    return this.getSortStrategy(filters);
  }

  /**
   * Helper to parse consumption string "10.5 km/l" to float 10.5
   */
  private parseConsumption(value: string | null): number {
    if (!value) return 0;
    const match = value.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }

  /**
   * Extract engine size from version string (e.g. "1.0", "1.6")
   */
  private extractEngineSize(version: string | null): number {
    if (!version) return 9.9; // Penalty for unknown
    const match = version.match(/(\d\.\d)/);
    return match ? parseFloat(match[0]) : 9.9;
  }
}

// Singleton export
export const vehicleSearchAdapter = new VehicleSearchAdapter();
