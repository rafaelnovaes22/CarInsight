import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { CategoryClassifierService } from './category-classifier.service';

/**
 * Service to classify vehicles in ALL categories when created.
 * Uses specialized LLM prompts per category for maximum accuracy.
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
        ano: true,
        carroceria: true,
        arCondicionado: true,
        portas: true,
        cambio: true,
        cor: true,
        combustivel: true,
        km: true,
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

      // Update all classification flags in the database
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          aptoUber: result.aptoUber,
          aptoUberBlack: result.aptoUberBlack,
          aptoFamilia: result.aptoFamilia,
          aptoCarga: result.aptoCarga,
          aptoUsoDiario: result.aptoUsoDiario,
          aptoEntrega: result.aptoEntrega,
          aptoViagem: result.aptoViagem,
        },
      });

      logger.info(
        {
          vehicleId,
          classifications: {
            familia: result.aptoFamilia,
            uber: result.aptoUber,
            uberBlack: result.aptoUberBlack,
            carga: result.aptoCarga,
            usoDiario: result.aptoUsoDiario,
            entrega: result.aptoEntrega,
            viagem: result.aptoViagem,
          },
          llmUsed: result.llmUsed,
        },
        'Vehicle classification complete'
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
