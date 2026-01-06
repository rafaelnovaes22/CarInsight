
import { chatCompletion } from '../lib/llm-router';
import { logger } from '../lib/logger';
import { PlatformRulesConfig } from '../config/platform-rules.config';

/**
 * Result of the multi-app validation
 */
export interface PlatformEligibilityResult {
  // Transport
  transport: {
    uberX: boolean;
    uberComfort: boolean;
    uberBlack: boolean;
    pop99: boolean;
    comfort99: boolean;
    indrive: boolean;
  };

  // Delivery
  delivery: {
    ifoodMoto: boolean;
    ifoodBike: boolean;
    loggiMoto: boolean;
    loggiVan: boolean;
    lalamoveCarro: boolean; // New
    lalamoveMoto: boolean; // New
    lalamoveUtility: boolean; // New
    mercadoEnviosFlex: boolean; // New
    shopee: boolean; // New
  };

  reasoning: string;
  confidence: number;
}

// Backward compatibility interface
export interface UberEligibilityResult {
  uberX: boolean;
  uberComfort: boolean;
  uberBlack: boolean;
  reasoning: string;
  confidence: number;
  // Extended fields (optional for older callers)
  otherApps?: PlatformEligibilityResult;
}

export interface VehicleInfo {
  marca: string;
  modelo: string;
  ano: number;
  carroceria: string;
  arCondicionado: boolean;
  portas: number;
  cambio: string;
  cor?: string;
  cilindrada?: number; // Optional: Required for Moto rules
}

export class PlatformValidator {

  /**
   * Validate vehicle against ALL platform rules
   */
  async validateAll(vehicle: VehicleInfo): Promise<PlatformEligibilityResult> {
    const startTime = Date.now();
    const currentYear = new Date().getFullYear();

    try {
      // 1. Generate Prompt from Config
      const prompt = `${PlatformRulesConfig.generateMasterPrompt(currentYear)}

VEÍCULO A ANALISAR:
- Marca: ${vehicle.marca}
- Modelo: ${vehicle.modelo}
- Ano: ${vehicle.ano}
- Tipo/Carroceria: ${vehicle.carroceria}
- Ar: ${vehicle.arCondicionado ? 'Sim' : 'Não'}
- Portas: ${vehicle.portas}
${vehicle.cilindrada ? `- Cilindrada: ${vehicle.cilindrada}cc` : ''}

Retorne JSON no formato:
{
  "transport": { "uberX": bool, "uberComfort": bool, "uberBlack": bool, "pop99": bool, "comfort99": bool, "indrive": bool },
  "delivery": { "ifoodMoto": bool, "loggiMoto": bool, "lalamoveCarro": bool, "lalamoveMoto": bool, "mercadoEnviosFlex": bool, "shopee": bool },
  "reasoning": "Resumo curto",
  "confidence": 0.0 to 1.0
}`;

      // 2. Call LLM
      const response = await chatCompletion([{ role: 'user', content: prompt }], {
        temperature: 0.1,
        maxTokens: 400,
      });

      const result = JSON.parse(response.trim());

      logger.info(
        { vehicle: `${vehicle.modelo} ${vehicle.ano}`, result, time: Date.now() - startTime },
        'Platform eligibility validated'
      );

      return {
        transport: {
          uberX: !!result.transport?.uberX,
          uberComfort: !!result.transport?.uberComfort,
          uberBlack: !!result.transport?.uberBlack,
          pop99: !!result.transport?.pop99,
          comfort99: !!result.transport?.comfort99,
          indrive: !!result.transport?.indrive,
        },
        delivery: {
          ifoodMoto: !!result.delivery?.ifoodMoto,
          ifoodBike: !!result.delivery?.ifoodBike,
          loggiMoto: !!result.delivery?.loggiMoto,
          loggiVan: !!result.delivery?.loggiVan,
          lalamoveCarro: !!result.delivery?.lalamoveCarro,
          lalamoveMoto: !!result.delivery?.lalamoveMoto,
          lalamoveUtility: !!result.delivery?.lalamoveUtility,
          mercadoEnviosFlex: !!result.delivery?.mercadoEnviosFlex,
          shopee: !!result.delivery?.shopee,
        },
        reasoning: result.reasoning || '',
        confidence: result.confidence || 0.8,
      };

    } catch (error) {
      logger.error({ error, vehicle }, 'Error validating platform eligibility');
      return this.fallbackValidation(vehicle, currentYear);
    }
  }

  /**
   * Backward compatibility Checks (Mimics old UberEligibilityValidator)
   */
  async validateEligibility(vehicle: VehicleInfo): Promise<UberEligibilityResult> {
    const fullResult = await this.validateAll(vehicle);

    return {
      uberX: fullResult.transport.uberX,
      uberComfort: fullResult.transport.uberComfort,
      uberBlack: fullResult.transport.uberBlack,
      reasoning: fullResult.reasoning,
      confidence: fullResult.confidence,
      otherApps: fullResult
    };
  }

  /**
   * Fallback logic mostly for Transport (Safety Net)
   */
  private fallbackValidation(vehicle: VehicleInfo, currentYear: number): PlatformEligibilityResult {
    const rules = PlatformRulesConfig.transport.uber; // Use Uber rules as baseline for fallback

    // Logic similar to before, but simplified for fallback safety
    const isMoto = vehicle.carroceria.toLowerCase().includes('moto');
    const isCar = !isMoto;

    // Default fail
    const res: PlatformEligibilityResult = {
      transport: { uberX: false, uberComfort: false, uberBlack: false, pop99: false, comfort99: false, indrive: false },
      delivery: { ifoodMoto: false, ifoodBike: false, loggiMoto: false, loggiVan: false, lalamoveCarro: false, lalamoveMoto: false, lalamoveUtility: false, mercadoEnviosFlex: false, shopee: false },
      reasoning: 'Fallback: Logic failed, returning safe defaults.',
      confidence: 0.5
    };

    if (isCar) {
      if (vehicle.ano >= currentYear - 10 && vehicle.portas >= 4 && vehicle.arCondicionado) {
        res.transport.uberX = true;
        res.transport.pop99 = true;
        res.transport.indrive = true;
      }
      // Add other simple fallbacks if needed
    }

    if (isMoto) {
      if (vehicle.ano >= currentYear - 12) {
        res.delivery.ifoodMoto = true;
        res.delivery.loggiMoto = true;
      }
    }

    return res;
  }

  getExplanation(vehicle: VehicleInfo, result: UberEligibilityResult): string {
    // Extended explanation supporting multi-app if present
    const apps: string[] = [];

    if (result.uberX) apps.push('Uber X');
    if (result.uberBlack) apps.push('Uber Black');

    if (result.otherApps) {
      if (result.otherApps.transport.pop99) apps.push('99 Pop');
      if (result.otherApps.delivery.ifoodMoto) apps.push('iFood (Moto)');
      if (result.otherApps.delivery.mercadoEnviosFlex) apps.push('Mercado Envios Flex');
      if (result.otherApps.delivery.shopee) apps.push('Shopee Xpress');
      if (result.otherApps.delivery.lalamoveCarro) apps.push('Lalamove (Carro)');
    }

    if (apps.length === 0) return `❌ ${vehicle.modelo}: Não elegível. ${result.reasoning}`;

    return `✅ ${vehicle.modelo} ${vehicle.ano}\nApto para: ${apps.join(', ')}\n📝 ${result.reasoning}`;
  }
}

// Export singleton with alias for backward compatibility
export const platformValidator = new PlatformValidator();
export const uberEligibilityValidator = platformValidator; 
