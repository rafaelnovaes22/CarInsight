/**
 * Uber Handler
 *
 * Handles Uber Black/X category questions and searches.
 */

import { logger } from '../../../lib/logger';
import { exactSearchParser } from '../../../services/exact-search-parser.service';
import { vehicleSearchAdapter } from '../../../services/vehicle-search-adapter.service';
import { CustomerProfile } from '../../../types/state.types';
import { ConversationContext, ConversationResponse } from '../../../types/conversation.types';

export interface UberHandlerResult {
  handled: boolean;
  response?: ConversationResponse;
}

// Lazy imports to avoid DB/env setup during unit tests (many tests run without DATABASE_URL)
let prismaClient: any | null = null;
async function getPrisma() {
  if (!prismaClient) {
    const prismaModule = await import('../../../lib/prisma');
    prismaClient = prismaModule.prisma;
  }
  return prismaClient;
}

let uberValidator: any | null = null;
async function getUberEligibilityValidator() {
  if (!uberValidator) {
    const module = await import('../../../services/uber-eligibility-validator.service');
    uberValidator = module.uberEligibilityValidator;
  }
  return uberValidator;
}

function isUberEligibilityQuestion(message: string): boolean {
  const m = message.toLowerCase();

  // Must mention the app (Uber/99) to avoid false positives
  const mentionsApp =
    /\buber\b/.test(m) ||
    /\b99\b/.test(m) ||
    m.includes('99pop') ||
    m.includes('99 pop') ||
    m.includes('99top') ||
    m.includes('99 top') ||
    m.includes('app de transporte') ||
    /\bapp\b/.test(m);

  if (!mentionsApp) return false;

  // Eligibility framing
  return (
    /\bserve\b/.test(m) ||
    /\bapto\b/.test(m) ||
    /\broda(r)?\b/.test(m) ||
    /\bentra\b/.test(m) ||
    /\baceita\b/.test(m) ||
    /\bpode\b/.test(m) ||
    /\bcategoria\b/.test(m) ||
    /\b(uber\s*)?x\b/.test(m) ||
    m.includes('comfort') ||
    m.includes('black') ||
    m.includes('99pop') ||
    m.includes('99top')
  );
}

/**
 * Handle Uber Black specific questions
 */
export async function handleUberBlackQuestion(
  userMessage: string,
  context: ConversationContext,
  updatedProfile: Partial<CustomerProfile>,
  extracted: { extracted: Partial<CustomerProfile> },
  startTime: number,
  getAppCategoryName: (
    profile: Partial<CustomerProfile>,
    category: 'x' | 'black' | 'comfort'
  ) => string
): Promise<UberHandlerResult> {
  const lowerMessage = userMessage.toLowerCase();

  if (!lowerMessage.includes('uber black') && !lowerMessage.includes('uberblack')) {
    return { handled: false };
  }

  logger.info('UberHandler: Processing Uber Black question');

  // Search for Uber Black eligible vehicles
  const uberBlackVehicles = await vehicleSearchAdapter.search('', {
    aptoUberBlack: true,
    limit: 10,
  });

  let response = `🚖 *Critérios para Uber Black:*\n\n`;
  response += `• Ano: 2018 ou mais recente\n`;
  response += `• Tipo: APENAS Sedan PREMIUM\n`;
  response += `• Portas: 4\n`;
  response += `• Ar-condicionado: Obrigatório\n`;
  response += `• Interior: Couro (preferencial)\n`;
  response += `• Cor: Preto (preferencial)\n\n`;

  if (uberBlackVehicles.length > 0) {
    response += `✅ *Temos ${uberBlackVehicles.length} veículos aptos para Uber Black:*\n\n`;
    uberBlackVehicles.slice(0, 5).forEach((rec, i) => {
      const v = rec.vehicle;
      response += `${i + 1}. ${v.brand} ${v.model} ${v.year}\n`;
      response += `   💰 R$ ${v.price.toLocaleString('pt-BR')}\n`;
      response += `   📍 ${v.mileage.toLocaleString('pt-BR')}km\n\n`;
    });
    response += `_Quer saber mais sobre algum?_`;
  } else {
    const altCategory = getAppCategoryName(updatedProfile, 'x');
    response += `❌ No momento não temos veículos aptos para Uber Black no estoque.\n\n`;
    response += `Mas temos veículos aptos para ${altCategory}. Quer ver?`;
  }

  return {
    handled: true,
    response: {
      response,
      extractedPreferences: {
        ...extracted.extracted,
        _waitingForUberXAlternatives: true,
      },
      needsMoreInfo: [],
      canRecommend: false,
      nextMode: context.mode,
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 1.0,
        llmUsed: 'rule-based',
      },
    },
  };
}

/**
 * Handle "serve pra Uber/99?" eligibility questions without assuming purchase/choice.
 *
 * This intentionally avoids the "Ótima escolha / pagamento" flow.
 */
export async function handleUberEligibilityQuestion(
  userMessage: string,
  context: ConversationContext,
  updatedProfile: Partial<CustomerProfile>,
  extracted: { extracted: Partial<CustomerProfile> },
  startTime: number
): Promise<UberHandlerResult> {
  if (!isUberEligibilityQuestion(userMessage)) {
    return { handled: false };
  }

  const lower = userMessage.toLowerCase();
  const is99 =
    /\b99\b/.test(lower) ||
    lower.includes('99pop') ||
    lower.includes('99 pop') ||
    lower.includes('99top');

  // Try to resolve the target vehicle: (1) from last shown vehicles, (2) from exact model/year in text
  const lastShown = context.profile?._lastShownVehicles || [];
  const mentionedShown = lastShown.find(
    v => lower.includes(v.model.toLowerCase()) || lower.includes(v.brand.toLowerCase())
  );

  let dbVehicle: {
    marca: string;
    modelo: string;
    ano: number;
    carroceria: string;
    portas: number;
    arCondicionado: boolean;
  } | null = null;

  if (mentionedShown?.vehicleId) {
    const prisma = await getPrisma();
    dbVehicle = await prisma.vehicle.findUnique({
      where: { id: mentionedShown.vehicleId },
      select: {
        marca: true,
        modelo: true,
        ano: true,
        carroceria: true,
        portas: true,
        arCondicionado: true,
      },
    });
  }

  if (!dbVehicle) {
    const exact = await exactSearchParser.parse(userMessage);
    const model = exact.model || updatedProfile.model || extracted.extracted.model || null;
    const year = exact.year || null;

    if (model) {
      // Try to find in-stock instance for more accurate validation.
      // If not found, we'll still answer generically (rules vary by city).
      const prisma = await getPrisma();
      const candidates = await prisma.vehicle.findMany({
        where: {
          disponivel: true,
          modelo: { contains: model, mode: 'insensitive' },
          ...(year ? { ano: year } : {}),
        },
        select: {
          marca: true,
          modelo: true,
          ano: true,
          carroceria: true,
          portas: true,
          arCondicionado: true,
        },
        take: 1,
        orderBy: [{ ano: 'desc' }],
      });
      dbVehicle = candidates[0] || null;
    }
  }

  if (!dbVehicle) {
    const parsed = await exactSearchParser.parse(userMessage);
    const askedModel = parsed.model || extracted.extracted.model || updatedProfile.model;
    const modelText = askedModel ? ` do ${askedModel}` : '';
    const appName = is99 ? '99' : 'Uber';

    return {
      handled: true,
      response: {
        response:
          `Entendi — é uma dúvida${modelText}, sem assumir escolha. 👍\n\n` +
          `A resposta varia por *cidade* e pela *categoria* (${appName} X/Comfort/Black), porque as regras mudam por local e por ano do carro.\n\n` +
          `Me diga sua *cidade/UF* e qual categoria você quer rodar (X, Comfort ou Black) que eu confirmo certinho.`,
        extractedPreferences: {
          ...extracted.extracted,
        },
        needsMoreInfo: [],
        canRecommend: false,
        nextMode: context.mode,
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0.9,
          llmUsed: 'rule-based',
        },
      },
    };
  }

  logger.info(
    { vehicle: `${dbVehicle.marca} ${dbVehicle.modelo} ${dbVehicle.ano}` },
    'UberHandler: Answering eligibility question for specific vehicle'
  );

  const validator = await getUberEligibilityValidator();
  const eligibility = await validator.validateEligibility({
    marca: dbVehicle.marca,
    modelo: dbVehicle.modelo,
    ano: dbVehicle.ano,
    carroceria: dbVehicle.carroceria,
    portas: dbVehicle.portas,
    arCondicionado: dbVehicle.arCondicionado,
  });

  const explanation = validator.getExplanation(
    {
      marca: dbVehicle.marca,
      modelo: dbVehicle.modelo,
      ano: dbVehicle.ano,
      carroceria: dbVehicle.carroceria,
      portas: dbVehicle.portas,
      arCondicionado: dbVehicle.arCondicionado,
    },
    eligibility
  );

  const caveat =
    `\n\n⚠️ Observação: as regras podem variar por cidade e mudam com o tempo.` +
    ` Se você me disser sua *cidade/UF* e a categoria (X/Comfort/Black), eu ajusto a orientação pra sua realidade.`;

  return {
    handled: true,
    response: {
      response: `Entendi — é uma dúvida, sem assumir que você já escolheu. 👍\n\n${explanation}${caveat}`,
      extractedPreferences: {
        ...extracted.extracted,
      },
      needsMoreInfo: [],
      canRecommend: false,
      nextMode: context.mode,
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.95,
        llmUsed: 'mixed',
      },
    },
  };
}
