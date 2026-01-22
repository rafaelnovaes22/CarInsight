import { describe, it, expect } from 'vitest';
import { VehicleClassifierService } from '../../src/services/vehicle-classifier.service';
import { Vehicle } from '@prisma/client';

describe('VehicleClassifierService', () => {
  // Helper to create mock vehicles
  const createVehicle = (overrides: Partial<Vehicle>): Vehicle =>
    ({
      id: '1',
      marca: 'Test',
      modelo: 'Test',
      ano: 2020,
      km: 50000,
      preco: 50000,
      carroceria: 'Hatch',
      combustivel: 'Flex',
      cambio: 'Manual',
      arCondicionado: true,
      portas: 4,
      ...overrides,
    }) as Vehicle;

  it('should classify strict Family cars correctly', () => {
    // SUV 4 doors -> Family
    const suv = createVehicle({ carroceria: 'SUV', portas: 4 });
    expect(VehicleClassifierService.classify(suv).aptoFamilia).toBe(true);

    // Sedan 4 doors -> Family
    const sedan = createVehicle({ carroceria: 'Sedan', portas: 4 });
    expect(VehicleClassifierService.classify(sedan).aptoFamilia).toBe(true);

    // Hatch 4 doors -> NOT Family (strict rule)
    const hatch = createVehicle({ carroceria: 'Hatch', portas: 4 });
    expect(VehicleClassifierService.classify(hatch).aptoFamilia).toBe(false);

    // SUV 2 doors -> NOT Family
    const suv2p = createVehicle({ carroceria: 'SUV', portas: 2 });
    expect(VehicleClassifierService.classify(suv2p).aptoFamilia).toBe(false);
  });

  it('should classify Cargo vehicles correctly', () => {
    // Pickup -> Cargo
    const pickup = createVehicle({ carroceria: 'Picape' });
    expect(VehicleClassifierService.classify(pickup).aptoCarga).toBe(true);

    // Van -> Cargo
    const van = createVehicle({ carroceria: 'Van' });
    expect(VehicleClassifierService.classify(van).aptoCarga).toBe(true);

    // Minivan -> Cargo (accepted as utility)
    const minivan = createVehicle({ carroceria: 'Minivan' });
    expect(VehicleClassifierService.classify(minivan).aptoCarga).toBe(true);

    // Sedan -> NOT Cargo
    const sedan = createVehicle({ carroceria: 'Sedan' });
    expect(VehicleClassifierService.classify(sedan).aptoCarga).toBe(false);
  });

  it('should classify Daily Use (Commute) correctly', () => {
    // Economical + AC -> Daily Use
    const econCar = createVehicle({
      carroceria: 'Hatch',
      km: 30000, // Low KM -> High economy usually implies good condition, logic uses 'hatch' -> high
      arCondicionado: true,
    });
    // Hatch is classified as 'alta' economy in logic
    expect(VehicleClassifierService.classify(econCar).aptoUsoDiario).toBe(true);

    // No AC -> NOT Daily Use (comfort requirement)
    const noAc = createVehicle({ carroceria: 'Hatch', arCondicionado: false });
    expect(VehicleClassifierService.classify(noAc).aptoUsoDiario).toBe(false);

    // Gas Guzzler (SUV High KM) -> 'baixa' economy -> NOT Daily Use
    const guzzler = createVehicle({ carroceria: 'SUV', km: 200000 });
    // SUV -> Baixa economy
    expect(VehicleClassifierService.classify(guzzler).aptoUsoDiario).toBe(false);
  });

  it('should classify Delivery (Apps) correctly', () => {
    // New Hatch (2020) -> Delivery OK
    const deliverySpec = createVehicle({ ano: 2020, carroceria: 'Hatch', portas: 2 });
    expect(VehicleClassifierService.classify(deliverySpec).aptoEntrega).toBe(true);

    // Old Car (2005) -> Delivery Fail (<2010)
    const oldCar = createVehicle({ ano: 2005 });
    expect(VehicleClassifierService.classify(oldCar).aptoEntrega).toBe(false);
  });

  it('should classify Uber X correctly (Whitelist)', () => {
    // Onix (Chevrolet) -> OK
    const onix = createVehicle({
      marca: 'Chevrolet',
      modelo: 'Onix',
      ano: 2018,
      arCondicionado: true,
      portas: 4,
    });
    expect(VehicleClassifierService.classify(onix).aptoUber).toBe(true);

    // Fusca -> Fail (Model not in whitelist)
    const fusca = createVehicle({ marca: 'Volkswagen', modelo: 'Fusca', ano: 2018 });
    expect(VehicleClassifierService.classify(fusca).aptoUber).toBe(false);
  });
});
