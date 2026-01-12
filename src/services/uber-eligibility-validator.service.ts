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
  cambio?: string;
  cor?: string;
}

export class UberEligibilityValidator {
  private readonly UBER_CRITERIA_PROMPT = `ATENÇÃO MÁXIMA: Você é um validador RIGOROSO de veículos para Uber Black/Comfort no Brasil (2025).

🚨 REGRA DE OURO (EXCLUSÕES IMEDIATAS):
Se o veículo estiver nesta lista, ele **NUNCA** pode ser Uber Black, não importa o ano ou preço:
- **HB20 / HB20S** (Qualquer versão) -> JAMAIS BLACK.
- **Onix / Onix Plus / Prisma** -> JAMAIS BLACK.
- **Fiat Cronos / Grand Siena / Siena** -> JAMAIS BLACK.
- **VW Voyage / Virtus (exceto Exclusive/GTS)** -> JAMAIS BLACK.
- **Ford Ka / Ka Sedan** -> JAMAIS BLACK.
- **Toyota Yaris / Etios** -> JAMAIS BLACK.
- **Nissan Versa / V-Drive** -> JAMAIS BLACK.
- **Honda City** -> JAMAIS BLACK.
- **Renault Logan / Sandero** -> JAMAIS BLACK.

Se o carro for um desses, **uberBlack DEVE SER FALSE**. Não hesite.

---

CRITÉRIOS POR CATEGORIA (FOCO SÃO PAULO - SP):

1. **UBER X** (Entrada):
   - **Ano: 2014 ou mais recente** (Regra SÃO PAULO).
   - Aceita quase tudo 2014+ com 4 portas e Ar.
   - Hatchs compactos (Mobi, Kwid, HB20) são aceitos.
   - Sedans compactos (HB20S, Cronos) são aceitos.
   - **PROIBIDO**: Carros 2 Portas (Jamais aceito). 
   - **PROIBIDO**: Ano < 2014 (Celtas/Palios 2010-2013 não entram em SP).

2. **UBER COMFORT** (Intermediário):
   - Max 6 anos (2019+).
   - Espaço interno decente.
   - **NÃO ACEITA HATCHS PEQUENOS** (Mobi, Kwid, Gol, HB20 Hatch, Onix Hatch).
   - **ACEITA** Sedans compactos modernos (HB20S, Onix Plus, Cronos, Virtus) e SUVs.

3. **UBER BLACK** (Premium - Apenas Sedans Médios/Grandes e SUVs):
   - Max 6 anos (2019+).
   - Cores sóbrias (Preto, Prata, Cinza, Branco, Azul-marinho).
   - **SOMENTE SEDANS MÉDIOS+**: Corolla, Civic, Sentra, Cerato, Cruze, Jetta.
   - **SUVs SELECIONADOS**: Compass, Kicks, Creta, HR-V, T-Cross, Renegade, Tracker, Sportage, Tucson, Tiguan, Equinox, Taos, Corolla Cross.
   - **JAMAIS**: Carros populares, compactos "de entrada" (Mobi, Kwid) ou modelos muito antigos.
   - **OBS**: SUVs Compactos modernos (2020+) como Tracker e T-Cross em versões topo de linha são aceitos em algumas categorias Black/Comfort. Na dúvida, se for 2019+ e SUV, considere apto.

---

TAREFA:
Analise o veículo abaixo. Primeiro verifique se ele está na LISTA DE EXCLUSÃO do Black.
Retorne JSON estrito.

Exemplo de Raciocínio Esperado para HB20S:
"HB20S é um sedan compacto popular. Está na lista de exclusão do Black. Aceito no X e Comfort (se novo)." -> uberBlack: false.

Formato de resposta:
{
  "uberX": true/false,
  "uberComfort": true/false,
  "uberBlack": true/false,
  "reasoning": "Seja direto. Mencione a exclusão se houver.",
  "confidence": 1.0
}`;

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

      const response = await chatCompletion([{ role: 'user', content: prompt }], {
        temperature: 0.1, // Baixa temperatura para consistência
        maxTokens: 300,
      });

      // Parse JSON response
      const result = JSON.parse(response.trim());

      logger.info(
        {
          vehicle: `${vehicle.marca} ${vehicle.modelo}`,
          result,
          processingTime: Date.now() - startTime,
        },
        'Uber eligibility validated'
      );

      return {
        uberX: result.uberX || false,
        uberComfort: result.uberComfort || false,
        uberBlack: result.uberBlack || false,
        reasoning: result.reasoning || 'No reasoning provided',
        confidence: result.confidence || 0.8,
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
    const isMinivan = carrNorm.includes('minivan') || vehicle.modelo.toLowerCase().includes('spin');
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
        confidence: 0.9,
      };
    }

    // Uber X: Only sedan/hatch, 2012+
    const uberX = (isSedan || isHatch) && !isSUV && !isMinivan && vehicle.ano >= 2012;

    // Uber Comfort: Sedan, minivan, SUV médio, 2015+
    const uberComfort = (isSedan || isMinivan || isSUV) && vehicle.ano >= 2015;

    // Uber Black: Only sedan, 2018+
    const uberBlack = isSedan && !isMinivan && !isSUV && vehicle.ano >= 2018;

    return {
      uberX,
      uberComfort,
      uberBlack,
      reasoning: 'Fallback: Conservative rule-based validation',
      confidence: 0.6,
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
        batch.map(async vehicle => {
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

    logger.info(
      {
        total: vehicles.length,
        uberX: Array.from(results.values()).filter(r => r.uberX).length,
        uberComfort: Array.from(results.values()).filter(r => r.uberComfort).length,
        uberBlack: Array.from(results.values()).filter(r => r.uberBlack).length,
      },
      'Batch validation completed'
    );

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
