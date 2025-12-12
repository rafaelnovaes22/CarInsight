/**
 * SearchResultSerializer
 *
 * Serializes and deserializes ExactSearchResult objects to/from JSON strings.
 * Ensures data integrity during round-trip serialization.
 *
 * **Feature: exact-vehicle-search**
 * Requirements: 6.1, 6.2, 6.3
 */

import {
  ExactSearchResult,
  ExactSearchResultType,
  Vehicle,
  VehicleMatch,
} from './exact-search.service';

/**
 * Serialized vehicle structure
 */
export interface SerializedVehicle {
  id: string;
  marca: string;
  modelo: string;
  versao: string | null;
  ano: number;
  km: number;
  preco: number;
  cor: string;
  carroceria: string;
  combustivel: string;
  cambio: string;
  disponivel: boolean;
  fotoUrl?: string | null;
  url?: string | null;
}

/**
 * Serialized vehicle match structure
 */
export interface SerializedVehicleMatch {
  vehicle: SerializedVehicle;
  matchScore: number;
  reasoning: string;
  matchType: 'exact' | 'year_alternative' | 'suggestion';
}

/**
 * Serialized search result structure with metadata
 */
export interface SerializedSearchResult {
  type: ExactSearchResultType;
  vehicles: SerializedVehicleMatch[];
  message: string;
  metadata: {
    requestedModel: string;
    requestedYear: number;
    availableYears?: number[];
    timestamp: string;
  };
}

/**
 * SearchResultSerializer class
 * Handles serialization and deserialization of ExactSearchResult objects
 */
export class SearchResultSerializer {
  /**
   * Serialize an ExactSearchResult to a JSON string
   *
   * @param result - The ExactSearchResult to serialize
   * @returns JSON string representation of the result
   *
   * Requirements: 6.1, 6.3
   */
  serialize(result: ExactSearchResult): string {
    const serialized: SerializedSearchResult = {
      type: result.type,
      vehicles: result.vehicles.map(vm => this.serializeVehicleMatch(vm)),
      message: result.message,
      metadata: {
        requestedModel: result.requestedModel,
        requestedYear: result.requestedYear,
        availableYears: result.availableYears,
        timestamp: new Date().toISOString(),
      },
    };

    return JSON.stringify(serialized);
  }

  /**
   * Deserialize a JSON string back to an ExactSearchResult
   *
   * @param json - The JSON string to deserialize
   * @returns The deserialized ExactSearchResult
   * @throws Error if JSON is invalid or missing required fields
   *
   * Requirements: 6.2
   */
  deserialize(json: string): ExactSearchResult {
    const parsed = JSON.parse(json) as SerializedSearchResult;

    // Validate required fields
    this.validateSerializedResult(parsed);

    const result: ExactSearchResult = {
      type: parsed.type,
      vehicles: parsed.vehicles.map(vm => this.deserializeVehicleMatch(vm)),
      message: parsed.message,
      requestedModel: parsed.metadata.requestedModel,
      requestedYear: parsed.metadata.requestedYear,
    };

    // Include availableYears if present
    if (parsed.metadata.availableYears !== undefined) {
      result.availableYears = parsed.metadata.availableYears;
    }

    return result;
  }

  /**
   * Serialize a VehicleMatch object
   */
  private serializeVehicleMatch(vm: VehicleMatch): SerializedVehicleMatch {
    return {
      vehicle: this.serializeVehicle(vm.vehicle),
      matchScore: vm.matchScore,
      reasoning: vm.reasoning,
      matchType: vm.matchType,
    };
  }

  /**
   * Deserialize a SerializedVehicleMatch back to VehicleMatch
   */
  private deserializeVehicleMatch(svm: SerializedVehicleMatch): VehicleMatch {
    return {
      vehicle: this.deserializeVehicle(svm.vehicle),
      matchScore: svm.matchScore,
      reasoning: svm.reasoning,
      matchType: svm.matchType,
    };
  }

  /**
   * Serialize a Vehicle object
   */
  private serializeVehicle(vehicle: Vehicle): SerializedVehicle {
    return {
      id: vehicle.id,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      versao: vehicle.versao,
      ano: vehicle.ano,
      km: vehicle.km,
      preco: vehicle.preco,
      cor: vehicle.cor,
      carroceria: vehicle.carroceria,
      combustivel: vehicle.combustivel,
      cambio: vehicle.cambio,
      disponivel: vehicle.disponivel,
      fotoUrl: vehicle.fotoUrl,
      url: vehicle.url,
    };
  }

  /**
   * Deserialize a SerializedVehicle back to Vehicle
   */
  private deserializeVehicle(sv: SerializedVehicle): Vehicle {
    return {
      id: sv.id,
      marca: sv.marca,
      modelo: sv.modelo,
      versao: sv.versao,
      ano: sv.ano,
      km: sv.km,
      preco: sv.preco,
      cor: sv.cor,
      carroceria: sv.carroceria,
      combustivel: sv.combustivel,
      cambio: sv.cambio,
      disponivel: sv.disponivel,
      fotoUrl: sv.fotoUrl,
      url: sv.url,
    };
  }

  /**
   * Validate that a parsed object has all required fields
   */
  private validateSerializedResult(parsed: unknown): asserts parsed is SerializedSearchResult {
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid serialized result: not an object');
    }

    const obj = parsed as Record<string, unknown>;

    if (!obj.type || typeof obj.type !== 'string') {
      throw new Error('Invalid serialized result: missing or invalid type');
    }

    const validTypes: ExactSearchResultType[] = [
      'exact',
      'year_alternatives',
      'suggestions',
      'unavailable',
    ];
    if (!validTypes.includes(obj.type as ExactSearchResultType)) {
      throw new Error(`Invalid serialized result: invalid type "${obj.type}"`);
    }

    if (!Array.isArray(obj.vehicles)) {
      throw new Error('Invalid serialized result: vehicles must be an array');
    }

    if (typeof obj.message !== 'string') {
      throw new Error('Invalid serialized result: missing or invalid message');
    }

    if (!obj.metadata || typeof obj.metadata !== 'object') {
      throw new Error('Invalid serialized result: missing or invalid metadata');
    }

    const metadata = obj.metadata as Record<string, unknown>;

    if (typeof metadata.requestedModel !== 'string') {
      throw new Error('Invalid serialized result: missing or invalid requestedModel in metadata');
    }

    if (typeof metadata.requestedYear !== 'number') {
      throw new Error('Invalid serialized result: missing or invalid requestedYear in metadata');
    }
  }
}

// Singleton export
export const searchResultSerializer = new SearchResultSerializer();
