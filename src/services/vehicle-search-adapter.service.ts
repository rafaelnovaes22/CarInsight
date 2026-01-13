/**
 * Vehicle Search Adapter
 *
 * Adapter to use inMemoryVectorStore with the interface expected by VehicleExpertAgent
 *
 * **Feature: exact-vehicle-search**
 * Requirements: 1.1, 1.2
 */

import { inMemoryVectorStore } from './in-memory-vector.service';
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
  // Motorcycle filter - CRITICAL: excludes motorcycles when searching for cars
  excludeMotorcycles?: boolean;
  // Context for smart scoring
  useCase?: 'family' | 'uber' | 'work' | 'travel' | 'general';
  hasCadeirinha?: boolean;
  minSeats?: number;
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
          // Uber filters
          ...(filters.aptoUber && { aptoUber: true }),
          ...(filters.aptoUberBlack && { aptoUberBlack: true }),
          // Family filter
          ...(filters.aptoFamilia && { aptoFamilia: true }),
          // Work filter
          ...(filters.aptoTrabalho && { aptoTrabalho: true }),
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
   */
  private getSortStrategy(filters: SearchFilters): any[] {
    // GLOBAL DEFAULT: Efficiency/Rationality Focus
    // We prioritize newer cars (better chance of good efficiency/tech) from DB,
    // then refine with in-memory efficiency sort.
    return [
      { ano: 'desc' }, // Newer cars (Better tech/lifespan)
      { km: 'asc' }, // Reliability
      { preco: 'asc' }, // ROI (Cheaper is better for same year/km)
    ];
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
