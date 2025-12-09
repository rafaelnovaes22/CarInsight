/**
 * Eligible Models Resolver Service
 * 
 * Consulta o LLM para obter lista de modelos permitidos para critérios especiais
 * como Uber Black, Uber X, Uber Comfort, etc.
 * 
 * Isso garante que as recomendações sejam precisas e atualizadas com os requisitos
 * oficiais de cada categoria.
 */

import { chatCompletion } from '../lib/llm-router';
import { logger } from '../lib/logger';

export type SpecialCriteria = 'uber_black' | 'uber_x' | 'uber_comfort' | 'familia_grande' | 'carga_pesada';

export interface EligibleModelsResult {
  criteria: SpecialCriteria;
  allowedModels: string[];
  allowedBrands: string[];
  minYear: number;
  bodyTypes: string[];
  additionalRequirements: string[];
  reasoning: string;
  confidence: number;
}

// Cache para evitar chamadas repetidas ao LLM (cache de 1 hora)
const modelsCache = new Map<SpecialCriteria, { result: EligibleModelsResult; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

export class EligibleModelsResolverService {

  private readonly UBER_BLACK_PROMPT = `Você é um especialista em requisitos do Uber Brasil.

TAREFA: Liste TODOS os modelos de veículos que são ACEITOS para UBER BLACK no Brasil em 2024.

CRITÉRIOS OFICIAIS UBER BLACK:
- Ano: 2018 ou mais recente
- Tipo: APENAS Sedan PREMIUM/EXECUTIVO
- Portas: 4
- Ar-condicionado: Obrigatório
- Interior: Couro (preferencial)
- Cor: Preto (preferencial, mas não obrigatório)

MODELOS TIPICAMENTE ACEITOS:
- Sedans executivos/premium das principais marcas
- Toyota: Corolla, Camry
- Honda: Civic, Accord
- Chevrolet: Cruze
- Volkswagen: Jetta, Passat
- Nissan: Sentra
- Hyundai: Azera, Elantra
- Ford: Fusion
- Etc.

NUNCA ACEITOS NO UBER BLACK:
- Hatches (Gol, Polo, Onix hatch, HB20 hatch, etc.)
- Sedans compactos/populares (Voyage, Prisma, HB20S, Logan, Versa)
- SUVs
- Minivans
- Pickups

Retorne APENAS um JSON válido no formato:
{
  "allowedModels": ["corolla", "civic", "cruze", "sentra", "jetta", "fusion", "azera", "elantra", "camry", "accord", "passat"],
  "allowedBrands": ["toyota", "honda", "chevrolet", "volkswagen", "nissan", "hyundai", "ford"],
  "minYear": 2018,
  "bodyTypes": ["sedan"],
  "additionalRequirements": ["4 portas", "ar condicionado", "sedan executivo/premium"],
  "reasoning": "Uber Black requer sedans executivos/premium de 2018+ com 4 portas e ar condicionado. Sedans compactos/populares como Voyage, Prisma, HB20S NÃO são aceitos.",
  "confidence": 0.95
}`;

  private readonly UBER_X_PROMPT = `Você é um especialista em requisitos do Uber Brasil.

TAREFA: Liste os modelos de veículos ACEITOS para UBER X / 99Pop no Brasil em 2024.

CRITÉRIOS OFICIAIS UBER X:
- Ano: 2012 ou mais recente
- Tipo: Sedan compacto/médio OU Hatch
- Portas: 4
- Ar-condicionado: Obrigatório

MODELOS ACEITOS:
- Hatches: Gol, Polo, Fox, Onix, Argo, HB20, Sandero, Ka, Fit, etc.
- Sedans: Voyage, Prisma, Cronos, Virtus, HB20S, Logan, Versa, Corolla, Civic, etc.

NUNCA ACEITOS:
- SUVs
- Pickups
- Minivans
- Veículos 2 portas

Retorne APENAS um JSON válido no formato:
{
  "allowedModels": ["gol", "polo", "fox", "onix", "argo", "hb20", "sandero", "ka", "fit", "voyage", "prisma", "cronos", "virtus", "hb20s", "logan", "versa", "corolla", "civic", "sentra", "cruze"],
  "allowedBrands": ["volkswagen", "chevrolet", "fiat", "hyundai", "renault", "ford", "honda", "toyota", "nissan"],
  "minYear": 2012,
  "bodyTypes": ["sedan", "hatch"],
  "additionalRequirements": ["4 portas", "ar condicionado"],
  "reasoning": "Uber X aceita sedans e hatches de 2012+ com 4 portas e ar condicionado.",
  "confidence": 0.95
}`;

  private readonly UBER_COMFORT_PROMPT = `Você é um especialista em requisitos do Uber Brasil.

TAREFA: Liste os modelos de veículos ACEITOS para UBER COMFORT / 99TOP no Brasil em 2024.

CRITÉRIOS OFICIAIS UBER COMFORT:
- Ano: 2015 ou mais recente
- Tipo: Sedan médio/grande, Minivan, SUV médio
- Portas: 4
- Espaço: Amplo (bagageiro espaçoso)
- Ar-condicionado: Obrigatório

MODELOS ACEITOS:
- Sedans médios: Corolla, Civic, Sentra, Cruze, Jetta
- Minivans: Spin, Zafira, Livina
- SUVs: Tucson, Compass, Kicks, Creta, HR-V

Retorne APENAS um JSON válido no formato:
{
  "allowedModels": ["corolla", "civic", "sentra", "cruze", "jetta", "spin", "zafira", "livina", "tucson", "compass", "kicks", "creta", "hrv", "tracker"],
  "allowedBrands": ["toyota", "honda", "nissan", "chevrolet", "volkswagen", "hyundai", "jeep"],
  "minYear": 2015,
  "bodyTypes": ["sedan", "minivan", "suv"],
  "additionalRequirements": ["4 portas", "ar condicionado", "espaço amplo"],
  "reasoning": "Uber Comfort aceita sedans médios, minivans e SUVs de 2015+ com espaço amplo.",
  "confidence": 0.95
}`;

  /**
   * Resolve modelos permitidos para um critério especial
   */
  async resolveEligibleModels(criteria: SpecialCriteria): Promise<EligibleModelsResult> {
    const startTime = Date.now();

    // Verificar cache
    const cached = modelsCache.get(criteria);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      logger.info({ criteria, cached: true }, 'Returning cached eligible models');
      return cached.result;
    }

    try {
      const prompt = this.getPromptForCriteria(criteria);
      
      const response = await chatCompletion([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.1, // Baixa temperatura para consistência
        maxTokens: 500
      });

      // Parse JSON response
      const parsed = this.parseResponse(response, criteria);

      // Salvar no cache
      modelsCache.set(criteria, { result: parsed, timestamp: Date.now() });

      logger.info({
        criteria,
        modelsCount: parsed.allowedModels.length,
        processingTime: Date.now() - startTime
      }, 'Eligible models resolved from LLM');

      return parsed;

    } catch (error) {
      logger.error({ error, criteria }, 'Error resolving eligible models from LLM');

      // Fallback para lista estática
      return this.getFallbackModels(criteria);
    }
  }

  /**
   * Verifica se um veículo é elegível para um critério especial
   */
  async isVehicleEligible(
    vehicle: { brand: string; model: string; year: number; bodyType?: string },
    criteria: SpecialCriteria
  ): Promise<{ eligible: boolean; reason: string }> {
    const eligibleModels = await this.resolveEligibleModels(criteria);

    const brandLower = vehicle.brand.toLowerCase();
    const modelLower = vehicle.model.toLowerCase();
    const bodyTypeLower = (vehicle.bodyType || '').toLowerCase();

    // Verificar ano mínimo
    if (vehicle.year < eligibleModels.minYear) {
      return {
        eligible: false,
        reason: `Ano ${vehicle.year} abaixo do mínimo exigido (${eligibleModels.minYear}+)`
      };
    }

    // Verificar se o modelo está na lista
    const modelAllowed = eligibleModels.allowedModels.some(m => 
      modelLower.includes(m.toLowerCase()) || m.toLowerCase().includes(modelLower)
    );

    // Verificar se a marca está na lista
    const brandAllowed = eligibleModels.allowedBrands.some(b => 
      brandLower.includes(b.toLowerCase()) || b.toLowerCase().includes(brandLower)
    );

    // Verificar tipo de carroceria
    const bodyTypeAllowed = eligibleModels.bodyTypes.length === 0 || 
      eligibleModels.bodyTypes.some(bt => bodyTypeLower.includes(bt.toLowerCase()));

    if (!modelAllowed) {
      return {
        eligible: false,
        reason: `Modelo ${vehicle.model} não está na lista de modelos permitidos para ${criteria}`
      };
    }

    if (!bodyTypeAllowed) {
      return {
        eligible: false,
        reason: `Tipo de carroceria ${vehicle.bodyType} não é aceito para ${criteria}`
      };
    }

    return {
      eligible: true,
      reason: `${vehicle.brand} ${vehicle.model} ${vehicle.year} é elegível para ${criteria}`
    };
  }

  /**
   * Filtra lista de veículos mantendo apenas os elegíveis
   */
  async filterEligibleVehicles<T extends { brand: string; model: string; year: number; bodyType?: string }>(
    vehicles: T[],
    criteria: SpecialCriteria
  ): Promise<T[]> {
    const eligibleModels = await this.resolveEligibleModels(criteria);

    return vehicles.filter(vehicle => {
      const modelLower = vehicle.model.toLowerCase();
      const brandLower = vehicle.brand.toLowerCase();
      const bodyTypeLower = (vehicle.bodyType || '').toLowerCase();

      // Verificar ano
      if (vehicle.year < eligibleModels.minYear) {
        return false;
      }

      // Verificar modelo
      const modelMatch = eligibleModels.allowedModels.some(m => 
        modelLower.includes(m.toLowerCase()) || m.toLowerCase().includes(modelLower)
      );

      if (!modelMatch) {
        return false;
      }

      // Verificar bodyType se especificado
      if (eligibleModels.bodyTypes.length > 0) {
        const bodyTypeMatch = eligibleModels.bodyTypes.some(bt => 
          bodyTypeLower.includes(bt.toLowerCase())
        );
        if (!bodyTypeMatch && bodyTypeLower) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Obtém prompt para o critério especificado
   */
  private getPromptForCriteria(criteria: SpecialCriteria): string {
    switch (criteria) {
      case 'uber_black':
        return this.UBER_BLACK_PROMPT;
      case 'uber_x':
        return this.UBER_X_PROMPT;
      case 'uber_comfort':
        return this.UBER_COMFORT_PROMPT;
      default:
        return this.UBER_X_PROMPT; // Default
    }
  }

  /**
   * Parse da resposta do LLM
   */
  private parseResponse(response: string, criteria: SpecialCriteria): EligibleModelsResult {
    try {
      // Limpar resposta
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(cleaned);

      return {
        criteria,
        allowedModels: parsed.allowedModels || [],
        allowedBrands: parsed.allowedBrands || [],
        minYear: parsed.minYear || 2018,
        bodyTypes: parsed.bodyTypes || [],
        additionalRequirements: parsed.additionalRequirements || [],
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 0.8
      };

    } catch (error) {
      logger.error({ error, response }, 'Failed to parse LLM response for eligible models');
      return this.getFallbackModels(criteria);
    }
  }

  /**
   * Lista de modelos fallback caso o LLM falhe
   */
  private getFallbackModels(criteria: SpecialCriteria): EligibleModelsResult {
    switch (criteria) {
      case 'uber_black':
        return {
          criteria,
          allowedModels: ['corolla', 'civic', 'cruze', 'sentra', 'jetta', 'fusion', 'azera', 'elantra', 'camry', 'accord', 'passat'],
          allowedBrands: ['toyota', 'honda', 'chevrolet', 'volkswagen', 'nissan', 'hyundai', 'ford'],
          minYear: 2018,
          bodyTypes: ['sedan'],
          additionalRequirements: ['4 portas', 'ar condicionado', 'sedan executivo/premium'],
          reasoning: 'Uber Black requer sedans executivos de 2018+ (fallback)',
          confidence: 0.9
        };

      case 'uber_x':
        return {
          criteria,
          allowedModels: ['gol', 'polo', 'fox', 'onix', 'argo', 'hb20', 'sandero', 'ka', 'fit', 'voyage', 'prisma', 'cronos', 'virtus', 'hb20s', 'logan', 'versa', 'corolla', 'civic', 'sentra', 'cruze'],
          allowedBrands: ['volkswagen', 'chevrolet', 'fiat', 'hyundai', 'renault', 'ford', 'honda', 'toyota', 'nissan'],
          minYear: 2012,
          bodyTypes: ['sedan', 'hatch'],
          additionalRequirements: ['4 portas', 'ar condicionado'],
          reasoning: 'Uber X aceita sedans e hatches de 2012+ (fallback)',
          confidence: 0.9
        };

      case 'uber_comfort':
        return {
          criteria,
          allowedModels: ['corolla', 'civic', 'sentra', 'cruze', 'jetta', 'spin', 'zafira', 'livina', 'tucson', 'compass', 'kicks', 'creta', 'hrv', 'tracker'],
          allowedBrands: ['toyota', 'honda', 'nissan', 'chevrolet', 'volkswagen', 'hyundai', 'jeep'],
          minYear: 2015,
          bodyTypes: ['sedan', 'minivan', 'suv'],
          additionalRequirements: ['4 portas', 'ar condicionado', 'espaço amplo'],
          reasoning: 'Uber Comfort aceita sedans médios, minivans e SUVs de 2015+ (fallback)',
          confidence: 0.9
        };

      default:
        return {
          criteria,
          allowedModels: [],
          allowedBrands: [],
          minYear: 2015,
          bodyTypes: [],
          additionalRequirements: [],
          reasoning: 'Critério não reconhecido',
          confidence: 0.5
        };
    }
  }

  /**
   * Limpa o cache
   */
  clearCache(): void {
    modelsCache.clear();
    logger.info('Eligible models cache cleared');
  }
}

// Singleton export
export const eligibleModelsResolver = new EligibleModelsResolverService();
