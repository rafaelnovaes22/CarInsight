/**
 * Serviço para classificar veículos usando LLM
 * Categoriza automaticamente: SUV, Sedan, Hatch, Pickup, Minivan
 * E determina aptidões: Uber, família, trabalho
 */

import { chatCompletion } from '../lib/llm-router';
import { logger } from '../lib/logger';

export interface VehicleClassification {
  category: 'SUV' | 'SEDAN' | 'HATCH' | 'PICKUP' | 'MINIVAN' | 'COUPE' | 'WAGON';
  aptoUber: boolean;
  aptoUberBlack: boolean;
  aptoFamilia: boolean;
  aptoTrabalho: boolean;
  confidence: number;
  reasoning: string;
}

export interface VehicleToClassify {
  marca: string;
  modelo: string;
  ano: number;
  carroceria?: string;
  portas?: number;
  combustivel?: string;
}

const CLASSIFICATION_PROMPT = `Você é um especialista em veículos brasileiros. Classifique o veículo abaixo.

VEÍCULO:
Marca: {marca}
Modelo: {modelo}
Ano: {ano}
Carroceria informada: {carroceria}
Portas: {portas}
Combustível: {combustivel}

REGRAS DE CLASSIFICAÇÃO:

CATEGORIA (escolha UMA):
- SUV: veículos utilitários esportivos (Creta, Tracker, Compass, HR-V, T-Cross, Kicks, Renegade, Tiggo, RAV4, etc)
- SEDAN: 4 portas com porta-malas separado (Corolla, Civic, HB20S, Onix Plus, Virtus, Cruze, City, etc)
- HATCH: compactos com porta traseira integrada (HB20, Onix, Polo, Gol, Argo, Mobi, Kwid, Ka, etc)
- PICKUP: caminhonetes e picapes (Strada, Toro, Saveiro, Hilux, S10, Ranger, Montana, etc)
- MINIVAN: monovolumes (Spin, Zafira, Livina, etc)
- COUPE: esportivos 2 portas
- WAGON: peruas/station wagon

UBER X (apto para trabalhar como motorista de app):
- Sim se: sedan ou hatch, ano >= 2015, 4 portas, ar condicionado presumido
- Não se: SUV, pickup, minivan, ano < 2015, ou modelo muito básico

UBER BLACK:
- Sim se: sedan executivo (Corolla, Civic, Cruze, Jetta, Fusion, etc), ano >= 2019
- Não se: hatch, SUV, pickup, ou sedan básico

FAMÍLIA (bom para família):
- Sim se: 5+ lugares, espaço interno, SUV, sedan médio/grande, minivan
- Não se: hatch compacto, 2 portas, pickup

TRABALHO (bom para trabalho/carga):
- Sim se: pickup, utilitário, ou veículo econômico
- Não se: esportivo, luxo, ou muito caro para manutenção

Responda APENAS com JSON válido:
{
  "category": "SUV|SEDAN|HATCH|PICKUP|MINIVAN|COUPE|WAGON",
  "aptoUber": true/false,
  "aptoUberBlack": true/false,
  "aptoFamilia": true/false,
  "aptoTrabalho": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "breve explicação"
}`;

/**
 * Classifica um veículo usando LLM
 */
export async function classifyVehicle(vehicle: VehicleToClassify): Promise<VehicleClassification> {
  try {
    const prompt = CLASSIFICATION_PROMPT
      .replace('{marca}', vehicle.marca || 'N/I')
      .replace('{modelo}', vehicle.modelo || 'N/I')
      .replace('{ano}', String(vehicle.ano || 'N/I'))
      .replace('{carroceria}', vehicle.carroceria || 'N/I')
      .replace('{portas}', String(vehicle.portas || 'N/I'))
      .replace('{combustivel}', vehicle.combustivel || 'N/I');

    const response = await chatCompletion([
      { role: 'system', content: 'Você é um classificador de veículos. Responda APENAS com JSON válido.' },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.1,
      maxTokens: 300
    });

    // Extrair JSON da resposta
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Resposta não contém JSON válido');
    }

    const classification = JSON.parse(jsonMatch[0]) as VehicleClassification;

    // Validar categoria
    const validCategories = ['SUV', 'SEDAN', 'HATCH', 'PICKUP', 'MINIVAN', 'COUPE', 'WAGON'];
    if (!validCategories.includes(classification.category)) {
      classification.category = 'HATCH'; // Default
    }

    logger.debug({
      vehicle: `${vehicle.marca} ${vehicle.modelo}`,
      classification
    }, 'Vehicle classified by LLM');

    return classification;

  } catch (error) {
    logger.error({ error, vehicle }, 'Failed to classify vehicle with LLM');

    // Fallback: classificação básica por palavras-chave
    return fallbackClassification(vehicle);
  }
}

/**
 * Classificação de fallback quando LLM falha
 */
function fallbackClassification(vehicle: VehicleToClassify): VehicleClassification {
  const modelo = (vehicle.modelo || '').toUpperCase();
  const carroceria = (vehicle.carroceria || '').toUpperCase();

  // Detectar categoria por palavras-chave
  let category: VehicleClassification['category'] = 'HATCH';

  const suvKeywords = ['CRETA', 'TRACKER', 'COMPASS', 'RENEGADE', 'HR-V', 'HRV', 'KICKS', 'T-CROSS', 'TCROSS', 'TIGGO', 'RAV4', 'TUCSON', 'SPORTAGE', 'DUSTER', 'CAPTUR', 'ECOSPORT'];
  const sedanKeywords = ['COROLLA', 'CIVIC', 'CRUZE', 'HB20S', 'ONIX PLUS', 'VIRTUS', 'CITY', 'SENTRA', 'VERSA', 'LOGAN', 'VOYAGE', 'PRISMA', 'CRONOS'];
  const pickupKeywords = ['STRADA', 'TORO', 'SAVEIRO', 'MONTANA', 'HILUX', 'S10', 'RANGER', 'AMAROK', 'FRONTIER', 'OROCH'];
  const minivanKeywords = ['SPIN', 'LIVINA', 'ZAFIRA', 'MERIVA', 'IDEA'];

  if (suvKeywords.some(k => modelo.includes(k)) || carroceria.includes('SUV')) {
    category = 'SUV';
  } else if (sedanKeywords.some(k => modelo.includes(k)) || carroceria.includes('SEDAN')) {
    category = 'SEDAN';
  } else if (pickupKeywords.some(k => modelo.includes(k)) || carroceria.includes('PICKUP') || carroceria.includes('PICAPE')) {
    category = 'PICKUP';
  } else if (minivanKeywords.some(k => modelo.includes(k)) || carroceria.includes('MINIVAN')) {
    category = 'MINIVAN';
  }

  const isSedan = category === 'SEDAN';
  const isHatch = category === 'HATCH';
  const ano = vehicle.ano || 0;

  return {
    category,
    aptoUber: (isSedan || isHatch) && ano >= 2015,
    aptoUberBlack: isSedan && ano >= 2019,
    aptoFamilia: ['SUV', 'SEDAN', 'MINIVAN'].includes(category),
    aptoTrabalho: category === 'PICKUP' || (isHatch && ano >= 2018),
    confidence: 0.6,
    reasoning: 'Classificação por fallback (LLM indisponível)'
  };
}

/**
 * Classifica múltiplos veículos em batch (com rate limiting)
 */
export async function classifyVehiclesBatch(
  vehicles: VehicleToClassify[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, VehicleClassification>> {
  const results = new Map<string, VehicleClassification>();
  
  for (let i = 0; i < vehicles.length; i++) {
    const vehicle = vehicles[i];
    const key = `${vehicle.marca}-${vehicle.modelo}-${vehicle.ano}`;
    
    // Evitar classificar duplicatas
    if (results.has(key)) {
      continue;
    }

    const classification = await classifyVehicle(vehicle);
    results.set(key, classification);

    if (onProgress) {
      onProgress(i + 1, vehicles.length);
    }

    // Rate limiting: 200ms entre chamadas
    if (i < vehicles.length - 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}

export const vehicleClassifier = {
  classifyVehicle,
  classifyVehiclesBatch,
  fallbackClassification
};

