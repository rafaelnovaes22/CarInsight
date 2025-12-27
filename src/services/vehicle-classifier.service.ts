
export interface VehicleClassificationInput {
  model: string;
  brand: string; // Adicionado para validação LLM
  year: number;
  price: number;
  category: string;
  fuel: string;
  transmission: string; // Adicionado para validação LLM
  features: {
    arCondicionado: boolean;
    direcaoHidraulica: boolean;
    airbag: boolean;
    abs: boolean;
    portas: number;
  };
}

export class VehicleClassifierService {

  static detectUberEligibility(vehicle: VehicleClassificationInput): boolean {
    // Uber normal: veículo em bom estado, ano recente, preço acessível
    const yearValid = vehicle.year >= 2010;
    // Ampliando range de preço para realidade atual
    const priceValid = vehicle.price >= 20000 && vehicle.price <= 100000;

    const categoryUpper = vehicle.category.toUpperCase();
    const categoryValid = categoryUpper !== 'MOTO' && categoryUpper !== 'OUTROS';

    const fuelUpper = vehicle.fuel.toUpperCase();
    const fuelValid = fuelUpper === 'FLEX' || fuelUpper === 'GASOLINA' || fuelUpper === 'DIESEL';

    return yearValid && priceValid && categoryValid && fuelValid;
  }

  static detectUberBlackEligibility(vehicle: VehicleClassificationInput): boolean {
    // Uber Black: veículos premium, completos, ano mais recente

    // EXCLUSÃO: Sedans compactos não entram
    const COMPACT_SEDANS = [
      'HB20S', 'HB20', 'ONIX', 'PRISMA', 'CRONOS', 'VOYAGE', 'LOGAN',
      'KA', 'YARIS', 'CITY', 'VERSA', 'VIRTUS', 'COBALT', 'SIENA', 'GRAND SIENA'
    ];

    const modelUpper = vehicle.model.toUpperCase();
    const isCompact = COMPACT_SEDANS.some(c => modelUpper.includes(c));

    if (isCompact) return false;

    // Regra oficial ~6 anos, mantemos 2018 como margem de segurança/qualidade
    const yearValidStrict = vehicle.year >= 2018;

    // Preço mínimo para filtrar "falsos positivos" de sedans médios muito desvalorizados
    const priceValid = vehicle.price >= 50000;

    // Apenas SEDAN (SUV vai para Black Bag, mas aqui simplificamos como False para Black puro)
    const categoryUpper = vehicle.category.toUpperCase();
    const categoryValid = categoryUpper === 'SEDAN';

    const fuelUpper = vehicle.fuel.toUpperCase();
    const fuelValid = fuelUpper === 'FLEX' || fuelUpper === 'GASOLINA';

    const { features } = vehicle;
    const featuresValid = features.arCondicionado && features.direcaoHidraulica && features.airbag && features.abs;

    return yearValidStrict && priceValid && categoryValid && !isCompact && fuelValid && featuresValid;
  }

  static detectFamilyEligibility(vehicle: VehicleClassificationInput): boolean {
    // Critérios para Família:
    // 1. Categoria: SUV, Sedan ou Minivan
    const categoryUpper = vehicle.category.toUpperCase();
    const targetCategories = ['SUV', 'SEDAN', 'MINIVAN'];
    const hasSpace = targetCategories.includes(categoryUpper);

    // 2. Segurança/Conforto obrigatórios
    const { features } = vehicle;
    const isSafeAndComfortable = features.arCondicionado &&
      features.direcaoHidraulica &&
      features.airbag &&
      features.abs &&
      features.portas === 4;

    return hasSpace && isSafeAndComfortable;
  }

  static detectWorkEligibility(vehicle: VehicleClassificationInput): boolean {
    // Critérios para Trabalho:
    // Econômico (Hatch/Sedan), Utilitário (Pickup) ou Entregas (Moto)
    const categoryUpper = vehicle.category.toUpperCase();
    const workCategories = ['HATCH', 'SEDAN', 'PICKUP', 'PICAPE', 'MOTO'];

    return workCategories.includes(categoryUpper) && vehicle.year >= 2010; // Relaxado para 2010 para incluir motos de entrega
  }

  static async detectEligibilityWithLLM(vehicle: VehicleClassificationInput): Promise<import('./uber-eligibility-validator.service').UberEligibilityResult> {
    const { uberEligibilityValidator } = await import('./uber-eligibility-validator.service');

    // 🚨 REGRA HARDCODED: Ano Mínimo SP
    // Carros: 2014 (Regra Uber X)
    // Motos: 2010 (Regra Entregas/Flexível)
    const isMoto = vehicle.category.toUpperCase() === 'MOTO';
    const minYear = isMoto ? 2010 : 2014;

    if (vehicle.year < minYear) {
      return {
        uberX: false,
        uberComfort: false,
        uberBlack: false,
        reasoning: `Reprovado automaticamente: Ano inferior a ${minYear} (Restrição SP).`,
        confidence: 1.0
      };
    }

    return uberEligibilityValidator.validateEligibility({
      marca: vehicle.brand,
      modelo: vehicle.model,
      ano: vehicle.year,
      carroceria: vehicle.category,
      arCondicionado: vehicle.features.arCondicionado,
      portas: vehicle.features.portas,
      cambio: vehicle.transmission,
      cor: '' // Cor não é crítica para X/Comfort, e Black assume ok se não informada no seed
    });
  }
}
