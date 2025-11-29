/**
 * Vehicle Search Adapter
 * 
 * Adapter to use inMemoryVectorStore with the interface expected by VehicleExpertAgent
 */

import { inMemoryVectorStore } from './in-memory-vector.service';
import { prisma } from '../lib/prisma';
import { VehicleRecommendation } from '../types/state.types';
import { logger } from '../lib/logger';

interface SearchFilters {
  maxPrice?: number;
  minPrice?: number;
  minYear?: number;
  maxKm?: number;
  bodyType?: string;
  transmission?: string;
  brand?: string;
  limit?: number;
  // Uber filters
  aptoUber?: boolean;
  aptoUberBlack?: boolean;
  // Family filter
  aptoFamilia?: boolean;
  // Work filter
  aptoTrabalho?: boolean;
}

export class VehicleSearchAdapter {
  /**
   * Search vehicles using semantic search + filters
   */
  async search(
    query: string,
    filters: SearchFilters = {}
  ): Promise<VehicleRecommendation[]> {
    try {
      const limit = filters.limit || 5;

      // Get vehicle IDs from semantic search
      const vehicleIds = await inMemoryVectorStore.search(query, limit * 2); // Get more to filter

      if (vehicleIds.length === 0) {
        logger.warn({ query, filters }, 'No vehicles found in semantic search');
        return [];
      }

      // Fetch full vehicle data
      const vehicles = await prisma.vehicle.findMany({
        where: {
          id: { in: vehicleIds },
          disponivel: true,
          // Apply filters
          ...(filters.maxPrice && { preco: { lte: filters.maxPrice } }),
          ...(filters.minPrice && { preco: { gte: filters.minPrice } }),
          ...(filters.minYear && { ano: { gte: filters.minYear } }),
          ...(filters.maxKm && { km: { lte: filters.maxKm } }),
          ...(filters.bodyType && { carroceria: filters.bodyType }),
          ...(filters.transmission && { cambio: filters.transmission }),
          ...(filters.brand && { marca: filters.brand }),
          // Uber filters
          ...(filters.aptoUber && { aptoUber: true }),
          ...(filters.aptoUberBlack && { aptoUberBlack: true }),
          // Family filter
          ...(filters.aptoFamilia && { aptoFamilia: true }),
          // Work filter
          ...(filters.aptoTrabalho && { aptoTrabalho: true }),
        },
        take: limit,
      });

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
        }
      }));

    } catch (error) {
      logger.error({ error, query, filters }, 'Error searching vehicles');
      return [];
    }
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
    const features = [];
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
