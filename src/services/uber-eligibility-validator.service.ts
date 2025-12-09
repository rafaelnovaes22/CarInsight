/**
 * Uber Eligibility Validator
 * 
 * Uses LLM to validate Uber/99 eligibility based on official criteria
 * instead of static whitelist (which becomes outdated quickly)
 */

import { chatCompletion } from '../lib/llm-router';
import { logger } from '../lib/logger';

export interface UberEligibilityResult {
  uberX: boolean;
  uberComfort: boolean;
  uberBlack: boolean;
  reasoning: string;
  confidence: number;
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
}

export class UberEligibilityValidator {

  private readonly UBER_CRITERIA_PROMPT = `Você é um especialista em requisitos do Uber e 99 no Brasil.

CRITÉRIOS OFICIAIS UBER/99 (2024):

**UBER X / 99Pop:**
- Ano: 2012 ou mais recente
- Tipo: APENAS Sedan compacto/médio OU Hatch
- Portas: 4
- Ar-condicionado: Obrigatório
- NUNCA ACEITO: SUV, Picape, Minivan, Van

**UBER COMFORT / 99TOP / 99XL:**
- Ano: 2015 ou mais recente  
- Tipo: Sedan médio/grande, Minivan (ex: Spin), SUV médio
- Portas: 4
- Espaço: Amplo (bagageiro)
- Ar-condicionado: Obrigatório
- ACEITA: Minivans como Spin, Zafira

**UBER BLACK / 99BLACK:**
- Ano: 2018 ou mais recente
- Tipo: APENAS Sedan PREMIUM
- Portas: 4
- Ar-condicionado: Obrigatório
- Interior: Couro (preferencial)
- Cor: Preto (preferencial)
- NUNCA ACEITO: SUV, Minivan, Hatch

**99TAXI (equivalente a Uber Comfort):**
- Mesmos critérios do Uber Comfort
- Foco em sedans médios/grandes e minivans

**NUNCA ACEITO EM NENHUMA CATEGORIA UBER/99:**
- Picapes (Hilux, Ranger, S10, L200, etc)
- Vans grandes (Master, Sprinter)
- SUVs grandes (Pajero, SW4, Grand Cherokee)
- Veículos 2 portas
- Veículos rebaixados
- Placa vermelha
- Adesivados

IMPORTANTE:
- Spin (Chevrolet) É MINIVAN → ✅ Comfort/XL/Bag/99TOP | ❌ X/99Pop | ❌ Black/99Black
- Compass (Jeep) É SUV → ✅ Comfort/99TOP | ❌ X/99Pop | ❌ Black/99Black
- Civic/Corolla (Sedan médio) → ✅ X/99Pop | ✅ Comfort/99TOP | ✅ Black/99Black (se 2018+)
- Gol/Onix (Hatch) → ✅ X/99Pop | ❌ Comfort/99TOP | ❌ Black/99Black

EQUIVALÊNCIAS:
- Uber X = 99Pop
- Uber Comfort = 99TOP = 99XL = 99Taxi
- Uber Black = 99Black

TAREFA:
Analise o veículo e retorne JSON com elegibilidade para cada categoria.

Formato de resposta:
{
  "uberX": true/false,          // Inclui 99Pop
  "uberComfort": true/false,    // Inclui 99TOP, 99XL, 99Taxi
  "uberBlack": true/false,      // Inclui 99Black
  "reasoning": "Explicação clara do por quê",
  "confidence": 0.0-1.0
}

Seja RIGOROSO. Em caso de dúvida, marque false.`;

  /**
   * Validate Uber eligibility using LLM
   */
  async validateEligibility(vehicle: VehicleInfo): Promise<UberEligibilityResult> {
    const startTime = Date.now();

    try {
      const prompt = `${this.UBER_CRITERIA_PROMPT}

VEÍCULO A ANALISAR:
- Marca: ${vehicle.marca}
- Modelo: ${vehicle.modelo}
- Ano: ${vehicle.ano}
- Tipo/Carroceria: ${vehicle.carroceria}
- Ar-condicionado: ${vehicle.arCondicionado ? 'Sim' : 'Não'}
- Portas: ${vehicle.portas}
- Câmbio: ${vehicle.cambio}
${vehicle.cor ? `- Cor: ${vehicle.cor}` : ''}

Retorne APENAS o JSON, sem texto adicional:`;

      const response = await chatCompletion([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.1, // Baixa temperatura para consistência
        maxTokens: 300
      });

      // Parse JSON response
      const result = JSON.parse(response.trim());

      logger.info({
        vehicle: `${vehicle.marca} ${vehicle.modelo}`,
        result,
        processingTime: Date.now() - startTime
      }, 'Uber eligibility validated');

      return {
        uberX: result.uberX || false,
        uberComfort: result.uberComfort || false,
        uberBlack: result.uberBlack || false,
        reasoning: result.reasoning || 'No reasoning provided',
        confidence: result.confidence || 0.8
      };

    } catch (error) {
      logger.error({ error, vehicle }, 'Error validating Uber eligibility');

      // Fallback: conservative validation
      return this.fallbackValidation(vehicle);
    }
  }

  /**
   * Fallback validation if LLM fails (conservative approach)
   */
  private fallbackValidation(vehicle: VehicleInfo): UberEligibilityResult {
    const carrNorm = vehicle.carroceria.toLowerCase();

    // Conservative: reject if any doubt
    const isMinivan = carrNorm.includes('minivan') ||
      vehicle.modelo.toLowerCase().includes('spin');
    const isSUV = carrNorm.includes('suv');
    const isPickup = carrNorm.includes('pickup') || carrNorm.includes('picape');
    const isSedan = carrNorm.includes('sedan');
    const isHatch = carrNorm.includes('hatch');

    // Never allowed types
    if (isPickup || vehicle.portas < 4 || !vehicle.arCondicionado) {
      return {
        uberX: false,
        uberComfort: false,
        uberBlack: false,
        reasoning: 'Fallback: Does not meet basic requirements',
        confidence: 0.9
      };
    }

    // Uber X: Only sedan/hatch, 2012+
    const uberX = (isSedan || isHatch) &&
      !isSUV &&
      !isMinivan &&
      vehicle.ano >= 2012;

    // Uber Comfort: Sedan, minivan, SUV médio, 2015+
    const uberComfort = (isSedan || isMinivan || isSUV) &&
      vehicle.ano >= 2015;

    // Uber Black: Only sedan, 2018+
    const uberBlack = isSedan &&
      !isMinivan &&
      !isSUV &&
      vehicle.ano >= 2018;

    return {
      uberX,
      uberComfort,
      uberBlack,
      reasoning: 'Fallback: Conservative rule-based validation',
      confidence: 0.6
    };
  }

  /**
   * Batch validate multiple vehicles
   */
  async validateBatch(vehicles: VehicleInfo[]): Promise<Map<string, UberEligibilityResult>> {
    const results = new Map<string, UberEligibilityResult>();

    logger.info({ count: vehicles.length }, 'Starting batch validation');

    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < vehicles.length; i += batchSize) {
      const batch = vehicles.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (vehicle) => {
          const key = `${vehicle.marca}-${vehicle.modelo}-${vehicle.ano}`;
          const result = await this.validateEligibility(vehicle);
          return { key, result };
        })
      );

      batchResults.forEach(({ key, result }) => {
        results.set(key, result);
      });

      // Small delay between batches
      if (i + batchSize < vehicles.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info({
      total: vehicles.length,
      uberX: Array.from(results.values()).filter(r => r.uberX).length,
      uberComfort: Array.from(results.values()).filter(r => r.uberComfort).length,
      uberBlack: Array.from(results.values()).filter(r => r.uberBlack).length
    }, 'Batch validation completed');

    return results;
  }

  /**
   * Get explanation for user about Uber eligibility
   */
  getExplanation(vehicle: VehicleInfo, result: UberEligibilityResult): string {
    const vehicleName = `${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}`;

    const eligible: string[] = [];
    if (result.uberX) eligible.push('Uber X / 99Pop');
    if (result.uberComfort) eligible.push('Uber Comfort / XL / Bag');
    if (result.uberBlack) eligible.push('Uber Black');

    if (eligible.length === 0) {
      return `❌ ${vehicleName} não é apto para Uber/99.\n\n${result.reasoning}`;
    }

    return `✅ ${vehicleName} é apto para: ${eligible.join(', ')}

${result.reasoning}

${eligible.length < 3 ? `\n⚠️ NÃO é apto para: ${this.getNotEligible(result).join(', ')}` : ''}`;
  }

  private getNotEligible(result: UberEligibilityResult): string[] {
    const notEligible: string[] = [];
    if (!result.uberX) notEligible.push('Uber X');
    if (!result.uberComfort) notEligible.push('Uber Comfort');
    if (!result.uberBlack) notEligible.push('Uber Black');
    return notEligible;
  }
}

// Singleton export
export const uberEligibilityValidator = new UberEligibilityValidator();
