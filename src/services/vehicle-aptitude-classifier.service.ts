/**
 * Vehicle Aptitude Classifier Service
 *
 * Classifica veículos usando LLM no momento da inserção/atualização,
 * calculando campos de aptidão e scores que serão usados para
 * filtragem SQL rápida em tempo de execução.
 */

import { chatCompletion } from '../lib/llm-router';
import { logger } from '../lib/logger';

// Tipos de entrada para classificação
export interface VehicleForClassification {
  id?: string;
  marca: string;
  modelo: string;
  versao?: string;
  ano: number;
  km: number;
  preco?: number;
  carroceria: string;
  combustivel: string;
  cambio: string;
  portas: number;
  arCondicionado: boolean;
  airbag?: boolean;
  abs?: boolean;
}

// Resultado da classificação
export interface VehicleAptitudeResult {
  // Campos booleanos de aptidão
  aptoFamilia: boolean;
  aptoUberX: boolean;
  aptoUberComfort: boolean;
  aptoUberBlack: boolean;
  aptoTrabalho: boolean;
  aptoViagem: boolean;
  aptoCarga: boolean;
  aptoUsoDiario: boolean;
  aptoEntrega: boolean;

  // Scores numéricos (1-10)
  scoreConforto: number;
  scoreEconomia: number;
  scoreEspaco: number;
  scoreSeguranca: number;
  scoreCustoBeneficio: number;

  // Categorização
  categoriaVeiculo: string;
  segmentoPreco: string;
}

// Interface do classificador
export interface IVehicleAptitudeClassifier {
  classify(vehicle: VehicleForClassification): Promise<VehicleAptitudeResult>;
}

const CLASSIFICATION_SYSTEM_PROMPT = `Você é um especialista em classificação de veículos.

Sua tarefa é analisar um veículo e determinar sua aptidão para diferentes casos de uso.

## REGRAS DE CLASSIFICAÇÃO

### aptoFamilia (boolean)
- TRUE se: SUV médio/grande, Minivan, Sedan médio (Corolla, Civic, Versa, Cobalt, Cronos)
- TRUE se: 4+ portas, espaço traseiro amplo, porta-malas generoso
- FALSE se: Hatch compacto/subcompacto (Mobi, Kwid, Up, HB20 hatch, Gol, Argo)
- Considerar: Segurança (Isofix, Airbags), facilidade de acesso

### aptoUberX (boolean) - Regras 2026
- TRUE se: Ano >= 2016, 4 portas, ar-condicionado
- FALSE se: Pickup, Minivan, Van, Furgão
- Hatches básicos (Kwid, Uno, Mobi) = TRUE mas com ressalvas

### aptoUberComfort (boolean) - Regras 2026
- TRUE se: Ano >= 2017, Sedan médio ou SUV espaçoso
- FALSE se: Renault Kardian, Citroën Basalt, Chery Tiggo 3/3X, Renault Logan
- Regras especiais em capitais:
  * VW Virtus: somente 2026+
  * Honda City: somente 2023+
  * Nivus: somente 2023+

### aptoUberBlack (boolean) - Regras 2026
- TRUE se: Ano >= 2018, Sedan executivo ou SUV premium
- FALSE se: Mesmos modelos excluídos do Comfort
- Aparência profissional é importante

### aptoTrabalho (boolean)
- TRUE se: Durável, econômico, baixo custo de manutenção
- Pickups para carga, Sedans para representação

### aptoViagem (boolean)
- TRUE se: Confortável, econômico, porta-malas amplo
- Sedans e SUVs são ideais
- Baixa quilometragem = mais confiável

### aptoCarga (boolean)
- TRUE se: Pickup, Van, Furgão, veículo com capacidade de carga

### aptoUsoDiario (boolean)
- TRUE se: Econômico, ar-condicionado, fácil de estacionar
- Hatches e sedans compactos são ideais

### aptoEntrega (boolean)
- TRUE se: Econômico, ágil, fácil de estacionar
- Motos, hatches compactos, vans pequenas

### scoreConforto (1-10)
- 9-10: SUVs premium, Sedans executivos, transmissão automática
- 7-8: SUVs médios, Sedans médios
- 5-6: Hatches médios, SUVs compactos
- 3-4: Hatches compactos
- 1-2: Hatches subcompactos, veículos básicos

### scoreEconomia (1-10)
- 9-10: Híbridos, elétricos, hatches econômicos
- 7-8: Sedans compactos, hatches médios
- 5-6: SUVs compactos, sedans médios
- 3-4: SUVs médios/grandes
- 1-2: Pickups diesel, SUVs premium

### scoreEspaco (1-10)
- 9-10: Minivans, SUVs grandes, Peruas
- 7-8: SUVs médios, Sedans grandes
- 5-6: SUVs compactos, Sedans médios
- 3-4: Hatches médios
- 1-2: Hatches compactos/subcompactos

### scoreSeguranca (1-10)
- 9-10: Veículos com múltiplos airbags, ABS, controle de estabilidade
- 7-8: Veículos com airbags frontais e ABS
- 5-6: Veículos com airbag motorista
- 3-4: Veículos básicos sem airbag
- 1-2: Veículos muito antigos

### scoreCustoBeneficio (1-10)
- Considerar: preço vs. equipamentos, ano, km, marca

### categoriaVeiculo (string)
- Valores: "hatch_compacto", "hatch_medio", "sedan_compacto", "sedan_medio", "sedan_executivo", "suv_compacto", "suv_medio", "suv_grande", "pickup", "minivan", "van", "esportivo"

### segmentoPreco (string)
- Valores: "economico" (até R$60k), "intermediario" (R$60k-R$120k), "premium" (acima de R$120k)

Retorne APENAS JSON válido no formato especificado.`;

// Modelos excluídos do Uber Comfort/Black
const EXCLUDED_COMFORT_MODELS = ['kardian', 'basalt', 'tiggo 3', 'tiggo 3x', 'logan'];

// Modelos com regras especiais de ano em capitais
const SPECIAL_YEAR_RULES: Record<string, number> = {
  virtus: 2026,
  city: 2023,
  nivus: 2023,
};

/**
 * Classificação determinística (fallback quando LLM falha)
 */
export function getDeterministicClassification(
  vehicle: VehicleForClassification
): VehicleAptitudeResult {
  const carroceria = vehicle.carroceria.toLowerCase();
  const modelo = vehicle.modelo.toLowerCase();
  const marca = vehicle.marca.toLowerCase();
  const currentYear = new Date().getFullYear();

  // Detectar tipo de carroceria
  const isSUV = carroceria.includes('suv');
  const isSedan = carroceria.includes('sedan');
  const isHatch = carroceria.includes('hatch');
  const isPickup = carroceria.includes('pickup') || carroceria.includes('picape');
  const isVan = carroceria.includes('van') || carroceria.includes('furgão');
  const isMinivan = carroceria.includes('minivan');

  // Detectar se é hatch compacto/subcompacto
  const compactHatches = ['mobi', 'kwid', 'up', 'gol', 'uno', 'celta', 'palio', 'fox', 'argo'];
  const isCompactHatch = isHatch && compactHatches.some(h => modelo.includes(h));

  // Detectar se é sedan médio
  const mediumSedans = [
    'corolla',
    'civic',
    'versa',
    'cobalt',
    'cronos',
    'virtus',
    'city',
    'sentra',
  ];
  const isMediumSedan = isSedan && mediumSedans.some(s => modelo.includes(s));

  // Detectar modelos excluídos do Comfort
  const isExcludedComfort = EXCLUDED_COMFORT_MODELS.some(m => modelo.includes(m));

  // Verificar regras especiais de ano
  let specialMinYear = 0;
  for (const [model, minYear] of Object.entries(SPECIAL_YEAR_RULES)) {
    if (modelo.includes(model)) {
      specialMinYear = minYear;
      break;
    }
  }

  // Calcular aptidões
  const aptoFamilia = (isSUV || isMediumSedan || isMinivan) && vehicle.portas >= 4;
  const aptoUberX =
    vehicle.ano >= 2016 && vehicle.portas >= 4 && vehicle.arCondicionado && !isPickup && !isVan;
  const aptoUberComfort =
    vehicle.ano >= Math.max(2017, specialMinYear) &&
    (isSUV || isMediumSedan) &&
    !isExcludedComfort &&
    vehicle.arCondicionado;
  const aptoUberBlack =
    vehicle.ano >= Math.max(2018, specialMinYear) &&
    (isSUV || isMediumSedan) &&
    !isExcludedComfort &&
    vehicle.arCondicionado;
  const aptoTrabalho = true;
  const aptoViagem = (isSUV || isSedan) && vehicle.km < 100000;
  const aptoCarga = isPickup || isVan;
  const aptoUsoDiario = vehicle.arCondicionado && (isHatch || isSedan);
  const aptoEntrega = isCompactHatch || isVan;

  // Calcular scores
  const scoreConforto = isSUV ? 7 : isMediumSedan ? 6 : isSedan ? 5 : isHatch ? 4 : 3;
  const scoreEconomia = isCompactHatch
    ? 8
    : isHatch
      ? 7
      : isSedan
        ? 6
        : isSUV
          ? 4
          : isPickup
            ? 3
            : 5;
  const scoreEspaco = isMinivan ? 9 : isSUV ? 8 : isMediumSedan ? 6 : isSedan ? 5 : isHatch ? 4 : 3;
  const scoreSeguranca =
    vehicle.airbag && vehicle.abs ? 7 : vehicle.airbag ? 5 : vehicle.abs ? 4 : 3;
  const scoreCustoBeneficio =
    vehicle.ano >= currentYear - 3 ? 7 : vehicle.ano >= currentYear - 6 ? 6 : 5;

  // Categorizar veículo
  let categoriaVeiculo = 'hatch_compacto';
  if (isMinivan) categoriaVeiculo = 'minivan';
  else if (isVan) categoriaVeiculo = 'van';
  else if (isPickup) categoriaVeiculo = 'pickup';
  else if (isSUV) categoriaVeiculo = 'suv_medio';
  else if (isMediumSedan) categoriaVeiculo = 'sedan_medio';
  else if (isSedan) categoriaVeiculo = 'sedan_compacto';
  else if (isCompactHatch) categoriaVeiculo = 'hatch_compacto';
  else if (isHatch) categoriaVeiculo = 'hatch_medio';

  // Segmento de preço
  const preco = vehicle.preco || 0;
  const segmentoPreco = preco > 120000 ? 'premium' : preco > 60000 ? 'intermediario' : 'economico';

  return {
    aptoFamilia,
    aptoUberX,
    aptoUberComfort,
    aptoUberBlack,
    aptoTrabalho,
    aptoViagem,
    aptoCarga,
    aptoUsoDiario,
    aptoEntrega,
    scoreConforto,
    scoreEconomia,
    scoreEspaco,
    scoreSeguranca,
    scoreCustoBeneficio,
    categoriaVeiculo,
    segmentoPreco,
  };
}

/**
 * Valida e normaliza scores para o intervalo [1, 10]
 */
function normalizeScore(score: number): number {
  if (typeof score !== 'number' || isNaN(score)) return 5;
  return Math.min(10, Math.max(1, Math.round(score)));
}

/**
 * Valida categoria de veículo
 */
const VALID_CATEGORIES = [
  'hatch_compacto',
  'hatch_medio',
  'sedan_compacto',
  'sedan_medio',
  'sedan_executivo',
  'suv_compacto',
  'suv_medio',
  'suv_grande',
  'pickup',
  'minivan',
  'van',
  'esportivo',
];

function normalizeCategory(category: string): string {
  const normalized = category?.toLowerCase().replace(/\s+/g, '_') || 'hatch_compacto';
  return VALID_CATEGORIES.includes(normalized) ? normalized : 'hatch_compacto';
}

/**
 * Valida segmento de preço
 */
const VALID_SEGMENTS = ['economico', 'intermediario', 'premium'];

function normalizeSegment(segment: string): string {
  const normalized = segment?.toLowerCase() || 'economico';
  return VALID_SEGMENTS.includes(normalized) ? normalized : 'economico';
}

export class VehicleAptitudeClassifier implements IVehicleAptitudeClassifier {
  /**
   * Classifica um veículo usando LLM
   */
  async classify(vehicle: VehicleForClassification): Promise<VehicleAptitudeResult> {
    try {
      const userPrompt = `Classifique o seguinte veículo:

VEÍCULO:
- Marca: ${vehicle.marca}
- Modelo: ${vehicle.modelo}
- Versão: ${vehicle.versao || 'N/A'}
- Ano: ${vehicle.ano}
- KM: ${vehicle.km.toLocaleString('pt-BR')}
- Preço: R$ ${(vehicle.preco || 0).toLocaleString('pt-BR')}
- Carroceria: ${vehicle.carroceria}
- Combustível: ${vehicle.combustivel}
- Câmbio: ${vehicle.cambio}
- Portas: ${vehicle.portas}
- Ar-condicionado: ${vehicle.arCondicionado ? 'Sim' : 'Não'}
- Airbag: ${vehicle.airbag ? 'Sim' : 'Não'}
- ABS: ${vehicle.abs ? 'Sim' : 'Não'}

Retorne APENAS um JSON válido com a seguinte estrutura:
{
  "aptoFamilia": boolean,
  "aptoUberX": boolean,
  "aptoUberComfort": boolean,
  "aptoUberBlack": boolean,
  "aptoTrabalho": boolean,
  "aptoViagem": boolean,
  "aptoCarga": boolean,
  "aptoUsoDiario": boolean,
  "aptoEntrega": boolean,
  "scoreConforto": number (1-10),
  "scoreEconomia": number (1-10),
  "scoreEspaco": number (1-10),
  "scoreSeguranca": number (1-10),
  "scoreCustoBeneficio": number (1-10),
  "categoriaVeiculo": string,
  "segmentoPreco": string
}`;

      const response = await chatCompletion(
        [
          { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0.1,
          maxTokens: 500,
        }
      );

      return this.parseResponse(response, vehicle);
    } catch (error) {
      logger.warn(
        { error: (error as Error).message, vehicle: `${vehicle.marca} ${vehicle.modelo}` },
        'LLM classification failed, using deterministic fallback'
      );
      return getDeterministicClassification(vehicle);
    }
  }

  /**
   * Parse e valida resposta do LLM
   */
  private parseResponse(
    response: string,
    vehicle: VehicleForClassification
  ): VehicleAptitudeResult {
    try {
      // Limpar resposta (remover markdown code blocks se presente)
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(cleaned);

      // Validar e normalizar resultado
      return {
        aptoFamilia: Boolean(parsed.aptoFamilia),
        aptoUberX: Boolean(parsed.aptoUberX),
        aptoUberComfort: Boolean(parsed.aptoUberComfort),
        aptoUberBlack: Boolean(parsed.aptoUberBlack),
        aptoTrabalho: Boolean(parsed.aptoTrabalho),
        aptoViagem: Boolean(parsed.aptoViagem),
        aptoCarga: Boolean(parsed.aptoCarga),
        aptoUsoDiario: Boolean(parsed.aptoUsoDiario),
        aptoEntrega: Boolean(parsed.aptoEntrega),
        scoreConforto: normalizeScore(parsed.scoreConforto),
        scoreEconomia: normalizeScore(parsed.scoreEconomia),
        scoreEspaco: normalizeScore(parsed.scoreEspaco),
        scoreSeguranca: normalizeScore(parsed.scoreSeguranca),
        scoreCustoBeneficio: normalizeScore(parsed.scoreCustoBeneficio),
        categoriaVeiculo: normalizeCategory(parsed.categoriaVeiculo),
        segmentoPreco: normalizeSegment(parsed.segmentoPreco),
      };
    } catch (error) {
      logger.warn(
        { error: (error as Error).message, response: response.substring(0, 200) },
        'Failed to parse LLM response, using deterministic fallback'
      );
      return getDeterministicClassification(vehicle);
    }
  }
}

// Singleton export
export const vehicleAptitudeClassifier = new VehicleAptitudeClassifier();
