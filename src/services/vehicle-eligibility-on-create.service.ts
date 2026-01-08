import { prisma } from '../lib/prisma';
import { uberEligibilityAgent } from './uber-eligibility-agent.service';

export class VehicleEligibilityOnCreateService {
  async markDefaultEligibility(vehicleId: string): Promise<void> {
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
      },
    });

    if (!vehicle) return;

    const result = await uberEligibilityAgent.evaluate(
      {
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        ano: vehicle.ano,
        carroceria: vehicle.carroceria,
        arCondicionado: vehicle.arCondicionado,
        portas: vehicle.portas,
        cambio: vehicle.cambio || undefined,
      },
      'sao-paulo'
    );

    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        aptoUber: result.uberX || result.uberComfort,
        aptoUberBlack: result.uberBlack,
      },
    });
  }
}

export const vehicleEligibilityOnCreateService = new VehicleEligibilityOnCreateService();
