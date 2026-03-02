/**
 * Financing Response Handler
 *
 * Handles the user response when they provide down payment or trade-in info
 * for financing simulation.
 */

import { logger } from '../../../lib/logger';
import { PostRecommendationContext, HandlerResult } from './types';
import {
  simulateFinancing,
  formatFinancingSimulation,
  extractMoneyValue,
} from '../../../services/financing-simulator.service';

/**
 * Common car brands for trade-in detection
 */
const CAR_BRANDS = [
  'fiat',
  'volkswagen',
  'vw',
  'chevrolet',
  'gm',
  'ford',
  'honda',
  'toyota',
  'hyundai',
  'renault',
  'nissan',
  'jeep',
  'peugeot',
  'citroen',
  'mitsubishi',
  'kia',
  'bmw',
  'mercedes',
  'audi',
  'volvo',
  'land rover',
  'range rover',
];

/**
 * Common car models for trade-in detection
 */
const CAR_MODELS = [
  // Fiat
  'uno',
  'palio',
  'siena',
  'strada',
  'toro',
  'argo',
  'mobi',
  'cronos',
  'pulse',
  'fastback',
  // VW
  'gol',
  'voyage',
  'polo',
  'virtus',
  'saveiro',
  'amarok',
  'tcross',
  't-cross',
  'nivus',
  'jetta',
  'passat',
  'tiguan',
  'fox',
  'up',
  // Chevrolet
  'onix',
  'prisma',
  'cruze',
  'tracker',
  'spin',
  's10',
  'montana',
  'equinox',
  'cobalt',
  'celta',
  'corsa',
  'astra',
  'vectra',
  // Ford
  'ka',
  'fiesta',
  'focus',
  'ecosport',
  'ranger',
  'fusion',
  'edge',
  'territory',
  // Honda
  'civic',
  'city',
  'fit',
  'hrv',
  'hr-v',
  'wrv',
  'wr-v',
  'accord',
  'crv',
  'cr-v',
  // Toyota
  'corolla',
  'yaris',
  'etios',
  'hilux',
  'sw4',
  'rav4',
  'camry',
  // Hyundai
  'hb20',
  'hb20s',
  'creta',
  'tucson',
  'santa fe',
  'i30',
  'azera',
  'elantra',
  // Renault
  'kwid',
  'sandero',
  'logan',
  'duster',
  'captur',
  'oroch',
  'stepway',
  // Nissan
  'march',
  'versa',
  'sentra',
  'kicks',
  'frontier',
  // Jeep
  'renegade',
  'compass',
  'commander',
  'wrangler',
  'cherokee',
  // Others
  'kicks',
  'sportage',
  'sorento',
  'soul',
  'cerato',
];

/**
 * Patterns to detect financing response with down payment info
 */
const ENTRY_PATTERNS = {
  // Valor específico: "10 mil", "5000 de entrada", "R$ 15.000"
  withValue: /(\d+(?:[.,]\d+)?)\s*(mil|k|reais|r\$)?(\s*(de\s*)?(entrada)?)?/i,

  // Sem entrada: "sem entrada", "zero", "nada", "0"
  noEntry: /sem\s*entrada|zero|nada de entrada|^0$|não tenho entrada|nao tenho/i,

  // À vista: "à vista", "a vista", "pagar tudo"
  cashPayment: /[àa]\s*vista|pagar\s*tudo|pagamento\s*total|inteiro/i,

  // Tem troca mas sem valor de entrada em dinheiro
  onlyTradeIn: /s[óo]\s*(a\s*)?troca|apenas\s*(a\s*)?troca|dar\s*s[óo]\s*(na\s*)?troca/i,
};

/**
 * Patterns to detect trade-in vehicle in the message
 */
const TRADEIN_PATTERNS = {
  // "tenho um Fiesta 2016", "meu carro é um Polo 2018"
  hasVehicleMention: /\b(tenho|meu|minha|um|uma)\s+(um\s+)?([\wà-ü-]+)\s+(\d{4})\b/i,

  // "e um Fiesta 2016", "mais um Ka 2019"
  conjunctionVehicle: /\b(e\s+um|mais\s+um|com\s+um|além\s+de\s+um)\s+([\wà-ü-]+)\s+(\d{4})\b/i,

  // Just "Fiesta 2016" or "2016 Fiesta" as trade-in context
  vehicleYear: /\b([\wà-ü-]+)\s+(\d{4})\b|\b(\d{4})\s+([\wà-ü-]+)\b/i,

  // "na troca", "pra troca", "de troca"
  tradeInContext: /\b(na|pra|para|de)\s*troca\b/i,
};

/**
 * Extract trade-in vehicle info from message
 */
const extractTradeInVehicle = (
  message: string
): { model?: string; year?: number; brand?: string } | null => {
  const normalized = message.toLowerCase();

  // Check if message mentions trade-in context
  const _hasTradeInContext =
    TRADEIN_PATTERNS.tradeInContext.test(normalized) ||
    /troca|meu\s*(carro|veículo)|tenho\s*(um|uma)/i.test(normalized);

  // Try to extract vehicle model and year
  let model: string | undefined;
  let year: number | undefined;
  let brand: string | undefined;

  // Pattern: "e um Fiesta 2016" or "tenho um Polo 2018"
  const vehicleMatch = message.match(
    /\b(?:tenho|meu|minha|um|uma|e\s+um|mais\s+um)\s+(?:um\s+)?([\wà-ü-]+)\s+(\d{4})\b/i
  );
  if (vehicleMatch) {
    const potentialModel = vehicleMatch[1].toLowerCase();
    year = parseInt(vehicleMatch[2]);

    // Check if this is a known car model
    if (CAR_MODELS.includes(potentialModel)) {
      model = potentialModel;
    } else if (CAR_BRANDS.includes(potentialModel)) {
      brand = potentialModel;
    }
  }

  // Pattern: just "Fiesta 2016" or "2016 Fiesta"
  if (!model) {
    const simpleMatch = message.match(/\b([\wà-ü-]+)\s+(\d{4})\b/gi);
    if (simpleMatch) {
      for (const match of simpleMatch) {
        const parts = match.split(/\s+/);
        const potentialModel = parts[0].toLowerCase();
        const potentialYear = parseInt(parts[1]);

        if (CAR_MODELS.includes(potentialModel) && potentialYear >= 2000 && potentialYear <= 2025) {
          model = potentialModel;
          year = potentialYear;
          break;
        }
      }
    }
  }

  // Pattern: "2016 Fiesta"
  if (!model) {
    const reverseMatch = message.match(/\b(\d{4})\s+([\wà-ü-]+)\b/gi);
    if (reverseMatch) {
      for (const match of reverseMatch) {
        const parts = match.split(/\s+/);
        const potentialYear = parseInt(parts[0]);
        const potentialModel = parts[1].toLowerCase();

        if (CAR_MODELS.includes(potentialModel) && potentialYear >= 2000 && potentialYear <= 2025) {
          year = potentialYear;
          model = potentialModel;
          break;
        }
      }
    }
  }

  if (model || year || brand) {
    return { model, year, brand };
  }

  return null;
};

/**
 * Detect if message is a financing response with entry info AND/OR trade-in
 */
export const isFinancingResponse = (
  message: string,
  awaitingFinancingDetails: boolean
): boolean => {
  if (!awaitingFinancingDetails) return false;

  const normalized = message.toLowerCase().trim();

  // Check if contains entry info
  const hasEntryInfo =
    ENTRY_PATTERNS.noEntry.test(normalized) ||
    ENTRY_PATTERNS.cashPayment.test(normalized) ||
    ENTRY_PATTERNS.onlyTradeIn.test(normalized) ||
    extractMoneyValue(normalized) !== null;

  // Check if contains trade-in vehicle mention
  const tradeInVehicle = extractTradeInVehicle(message);
  const hasTradeInVehicle = tradeInVehicle !== null;

  return hasEntryInfo || hasTradeInVehicle;
};

/**
 * Handle financing response with down payment info
 */
export const handleFinancingResponse = (ctx: PostRecommendationContext): HandlerResult => {
  const { userMessage, lastShownVehicles, extracted, startTime } = ctx;

  const normalized = userMessage.toLowerCase().trim();
  const firstVehicle = lastShownVehicles[0];

  if (!firstVehicle) {
    return { handled: false };
  }

  const vehiclePrice = firstVehicle.price;
  const vehicleName = `${firstVehicle.brand} ${firstVehicle.model} ${firstVehicle.year}`;

  // Check for cash payment (à vista)
  if (ENTRY_PATTERNS.cashPayment.test(normalized)) {
    logger.info({ vehicleName, vehiclePrice }, 'User wants to pay cash');

    return {
      handled: true,
      response: {
        response: `Perfeito! Pagamento à vista do ${vehicleName}! 💰✨

*Valor:* R$ ${vehiclePrice.toLocaleString('pt-BR')}

Excelente escolha! 🎉 

Quer que eu te passe para um vendedor finalizar a compra? Ele pode dar mais detalhes sobre:
• Condições especiais para pagamento à vista
• Documentação necessária
• Agendamento para ver o carro

_Digite "vendedor" para falar com nossa equipe!_`,
        extractedPreferences: {
          ...extracted.extracted,
          wantsFinancing: false,
          _showedRecommendation: true,
          _lastShownVehicles: lastShownVehicles,
          _awaitingFinancingDetails: false,
        },
        needsMoreInfo: [],
        canRecommend: false,
        nextMode: 'negotiation',
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0.95,
          llmUsed: 'rule-based',
        },
      },
    };
  }

  // Extract down payment value
  let downPayment = 0;

  if (ENTRY_PATTERNS.noEntry.test(normalized) || ENTRY_PATTERNS.onlyTradeIn.test(normalized)) {
    downPayment = 0;
  } else {
    const extractedValue = extractMoneyValue(normalized);
    if (extractedValue !== null) {
      downPayment = extractedValue;
    }
  }

  // Extract trade-in vehicle info
  const tradeInVehicle = extractTradeInVehicle(userMessage);
  const hasTradeIn = tradeInVehicle !== null || /troca|meu\s*carro|tenho\s*um/i.test(normalized);

  logger.info(
    {
      vehicleName,
      vehiclePrice,
      downPayment,
      tradeInVehicle,
      hasTradeIn,
    },
    'Processing financing with entry and/or trade-in'
  );

  // Build updated preferences with trade-in info
  const updatedPreferences: Record<string, any> = {
    ...extracted.extracted,
    wantsFinancing: true,
    financingDownPayment: downPayment,
    _showedRecommendation: true,
    _lastShownVehicles: lastShownVehicles,
    _awaitingFinancingDetails: false,
  };

  if (hasTradeIn) {
    updatedPreferences.hasTradeIn = true;

    if (tradeInVehicle) {
      if (tradeInVehicle.model) {
        updatedPreferences.tradeInModel = tradeInVehicle.model;
      }
      if (tradeInVehicle.year) {
        updatedPreferences.tradeInYear = tradeInVehicle.year;
      }
      if (tradeInVehicle.brand) {
        updatedPreferences.tradeInBrand = tradeInVehicle.brand;
      }
    }
  }

  // Format trade-in vehicle name for display
  const tradeInName = tradeInVehicle
    ? `${tradeInVehicle.brand || ''} ${tradeInVehicle.model || ''} ${tradeInVehicle.year || ''}`.trim() ||
      'seu veículo'
    : 'seu veículo';

  // Build response based on what info we have
  let response: string;

  if (hasTradeIn && downPayment > 0) {
    // User provided both entry AND trade-in
    // NÃO fazemos simulação porque o valor do carro de troca depende da avaliação
    response = `Perfeito! Anotei as informações: 💰🚗

• *Entrada em dinheiro:* R$ ${downPayment.toLocaleString('pt-BR')}
• *Carro na troca:* ${tradeInName}

⚠️ O valor final do ${tradeInName} na troca depende de uma avaliação presencial.

Vou conectar você com um consultor para:
• Avaliar o ${tradeInName}
• Calcular a proposta final com entrada + troca
• Finalizar a negociação

_Digite "vendedor" para falar com nossa equipe!_`;

    return {
      handled: true,
      response: {
        response,
        extractedPreferences: updatedPreferences,
        needsMoreInfo: [],
        canRecommend: false,
        nextMode: 'negotiation',
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0.95,
          llmUsed: 'rule-based',
        },
      },
    };
  } else if (hasTradeIn && downPayment === 0) {
    // User provided only trade-in (no cash entry)
    // NÃO fazemos simulação - encaminhar para vendedor
    response = `Entendido! O ${tradeInName} entra na negociação do ${firstVehicle.model}! 🚗🔄

⚠️ O valor do seu carro na troca depende de uma avaliação presencial.

Vou conectar você com um consultor para:
• Avaliar o ${tradeInName}
• Apresentar a proposta final
• Tirar suas dúvidas sobre financiamento

_Digite "vendedor" para falar com nossa equipe!_`;

    return {
      handled: true,
      response: {
        response,
        extractedPreferences: updatedPreferences,
        needsMoreInfo: [],
        canRecommend: false,
        nextMode: 'negotiation',
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0.95,
          llmUsed: 'rule-based',
        },
      },
    };
  }

  // Run simulation (no trade-in value since we don't know it yet)
  const simulation = simulateFinancing(vehiclePrice, downPayment, 0);
  const simulationMessage = formatFinancingSimulation(simulation, vehicleName);

  // Build response with simulation
  response = simulationMessage;

  // Add follow-up based on entry percentage
  const entryPercent = (downPayment / vehiclePrice) * 100;

  if (entryPercent >= 30) {
    response += `\n\n🎯 Ótima entrada! Com ${entryPercent.toFixed(0)}% você consegue as melhores taxas.`;
  } else if (entryPercent > 0) {
    response += `\n\n💡 Dica: Aumentando a entrada para 30%, as parcelas ficam ainda menores!`;
  }

  response += `\n\n*Tem interesse?* Posso te passar para um vendedor dar continuidade! 🚗`;
  response += `\n_Digite "vendedor" para falar com nossa equipe._`;

  return {
    handled: true,
    response: {
      response,
      extractedPreferences: updatedPreferences,
      needsMoreInfo: [],
      canRecommend: false,
      nextMode: 'negotiation',
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.95,
        llmUsed: 'rule-based',
      },
    },
  };
};
