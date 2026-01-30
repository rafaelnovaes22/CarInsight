import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { CategoryClassifierService } from './category-classifier.service';
import {
  vehicleAptitudeClassifier,
  VehicleForClassification,
} from './vehicle-aptitude-classifier.service';

/**
 * Service to classify vehicles in ALL categories when created.
 * Uses specialized LLM prompts per category for maximum accuracy.
 * Also calculates aptitude scores for fast SQL-based ranking.
 */
export class VehicleEligibilityOnCreateService {
  /**
   * Classify a vehicle in all categories using specialized LLM prompts.
   * Called when a vehicle is created in the system.
   */
  async markAllCategories(vehicleId: string): Promise<void> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        marca: true,
        modelo: true,
        versao: true,
        ano: true,
        carroceria: true,
        arCondicionado: true,
        portas: true,
        cambio: true,
        cor: true,
        combustivel: true,
        km: true,
        preco: true,
        airbag: true,
        abs: true,
      },
    });

    if (!vehicle) {
      logger.warn({ vehicleId }, 'Vehicle not found for classification');
      return;
    }

    logger.info(
      { vehicleId, marca: vehicle.marca, modelo: vehicle.modelo },
      'Classifying vehicle in all categories'
    );

    try {
      // Use the new CategoryClassifierService with specialized prompts
      const result = await CategoryClassifierService.classifyAll(vehicle);

      // Calculate aptitude scores using VehicleAptitudeClassifier
      const vehicleForClassification: VehicleForClassification = {
        id: vehicle.id,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        versao: vehicle.versao || undefined,
        ano: vehicle.ano,
        km: vehicle.km,
        preco: vehicle.preco || undefined,
        carroceria: vehicle.carroceria,
        combustivel: vehicle.combustivel,
        cambio: vehicle.cambio,
        portas: vehicle.portas,
        arCondicionado: vehicle.arCondicionado,
        airbag: vehicle.airbag,
        abs: vehicle.abs,
      };

      const aptitudeResult = await vehicleAptitudeClassifier.classify(vehicleForClassification);

      // Update all classification flags and aptitude scores in the database
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          // Legacy category flags
          aptoUber: result.aptoUber,
          aptoUberBlack: result.aptoUberBlack,
          aptoFamilia: result.aptoFamilia,
          aptoCarga: result.aptoCarga,
          aptoUsoDiario: result.aptoUsoDiario,
          aptoEntrega: result.aptoEntrega,
          aptoViagem: result.aptoViagem,

          // New Uber 2026 aptitude flags
          aptoUberX: aptitudeResult.aptoUberX,
          aptoUberComfort: aptitudeResult.aptoUberComfort,

          // Aptitude scores for fast SQL ranking
          scoreConforto: aptitudeResult.scoreConforto,
          scoreEconomia: aptitudeResult.scoreEconomia,
          scoreEspaco: aptitudeResult.scoreEspaco,
          scoreSeguranca: aptitudeResult.scoreSeguranca,
          scoreCustoBeneficio: aptitudeResult.scoreCustoBeneficio,

          // Vehicle categorization
          categoriaVeiculo: aptitudeResult.categoriaVeiculo,
          segmentoPreco: aptitudeResult.segmentoPreco,

          // Classification metadata
          classifiedAt: new Date(),
          classificationVersion: 1,
        },
      });

      logger.info(
        {
          vehicleId,
          classifications: {
            familia: result.aptoFamilia,
            uber: result.aptoUber,
            uberBlack: result.aptoUberBlack,
            uberX: aptitudeResult.aptoUberX,
            uberComfort: aptitudeResult.aptoUberComfort,
            carga: result.aptoCarga,
            usoDiario: result.aptoUsoDiario,
            entrega: result.aptoEntrega,
            viagem: result.aptoViagem,
          },
          scores: {
            conforto: aptitudeResult.scoreConforto,
            economia: aptitudeResult.scoreEconomia,
            espaco: aptitudeResult.scoreEspaco,
            seguranca: aptitudeResult.scoreSeguranca,
            custoBeneficio: aptitudeResult.scoreCustoBeneficio,
          },
          categoria: aptitudeResult.categoriaVeiculo,
          segmento: aptitudeResult.segmentoPreco,
          llmUsed: result.llmUsed,
        },
        'Vehicle classification complete with aptitude scores'
      );
    } catch (error) {
      logger.error({ vehicleId, error: (error as Error).message }, 'Failed to classify vehicle');
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility.
   * @deprecated Use markAllCategories instead
   */
  async markDefaultEligibility(vehicleId: string): Promise<void> {
    return this.markAllCategories(vehicleId);
  }
}

export const vehicleEligibilityOnCreateService = new VehicleEligibilityOnCreateService();
