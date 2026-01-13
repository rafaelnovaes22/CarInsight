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
import { formatRecommendations } from '../formatters/recommendation-formatter';

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

let uberEligibilityAgentRef: any | null = null;
async function getUberEligibilityAgent() {
  if (!uberEligibilityAgentRef) {
    const module = await import('../../../services/uber-eligibility-agent.service');
    uberEligibilityAgentRef = module.uberEligibilityAgent;
  }
  return uberEligibilityAgentRef;
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

  // CRITICAL: If the user explicitly says "quero", "comprar", "busco", "preciso", "interessa",
  // assume it's a SEARCH request, not just an eligibility question.
  // Exception: "quero saber se serve" (still eligibility)
  const searchKeywords = ['quero', 'comprar', 'busco', 'preciso', 'interessa', 'procura'];
  const isSearchIntent = searchKeywords.some(kw => m.includes(kw));
  const isQuestionAboutRule = m.includes('saber se') || m.includes('serve');

  if (isSearchIntent && !isQuestionAboutRule) {
    return false; // Let it fall through to VehicleExpertAgent main search flow
  }

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
  // ... existing check logic ...
  const lowerMessage = userMessage.toLowerCase();

  if (!lowerMessage.includes('uber black') && !lowerMessage.includes('uberblack')) {
    return { handled: false };
  }

  logger.info('UberHandler: Processing Uber Black question');

  const isSpecificVehicleRequest =
    lowerMessage.includes('esse') ||
    lowerMessage.includes('desse') ||
    lowerMessage.includes('este') ||
    lowerMessage.includes('deste') ||
    lowerMessage.includes('o carro') ||
    lowerMessage.includes('o veiculo') ||
    lowerMessage.includes('ele serve') ||
    (updatedProfile.model && lowerMessage.includes(updatedProfile.model.toLowerCase()));

  if (isSpecificVehicleRequest) {
    logger.info(
      'UberHandler: Specific vehicle request detected, delegating to eligibility handler'
    );
    return { handled: false };
  }

  // CRITICAL: Check for budget before searching
  // If user hasn't provided a budget, we should ask for it instead of showing random expensive cars.
  if (!updatedProfile.budget && !updatedProfile.budgetMax) {
    logger.info('UberHandler: No budget found, asking user for budget preference');

    let response = `🚖 *Critérios para Uber Black:*\n\n`;
    response += `• Ano: 2018 ou mais recente\n`;
    response += `• Tipo: Sedan Médio/Premium e SUVs\n`;
    response += `• Portas: 4\n`;
    response += `• Ar-condicionado: Obrigatório\n`;
    response += `• Interior: Couro (preferencial)\n`;
    response += `• Cor: Preto (preferencial)\n\n`;

    response += `Para selecionar as melhores opções no seu perfil, *qual seria seu orçamento aproximado?* 💰`;

    return {
      handled: true,
      response: {
        response,
        extractedPreferences: {
          ...extracted.extracted,
          // Mark that we are waiting for budget to avoid looping
          _waitingForBudget: true,
          usoPrincipal: 'uber',
          tipoUber: 'black',
        },
        needsMoreInfo: ['budget'],
        canRecommend: false,
        nextMode: 'discovery', // Stay in discovery to capture budget
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 1.0,
          llmUsed: 'rule-based',
        },
      },
    };
  }

  // Search for Uber Black eligible vehicles
  const uberBlackVehicles = await vehicleSearchAdapter.search('', {
    aptoUberBlack: true,
    limit: 10,
    maxPrice: updatedProfile.budget || updatedProfile.budgetMax,
    minYear: updatedProfile.minYear,
    maxKm: updatedProfile.maxKm,
    minSeats: updatedProfile.minSeats,
    useCase: 'uber', // Hint for sorting strategy
  });

  let criteriaText = `🚖 *Critérios para Uber Black:*\n\n`;
  criteriaText += `• Ano: 2018 ou mais recente\n`;
  criteriaText += `• Tipo: Sedan Médio/Premium e SUVs\n`;
  criteriaText += `• Portas: 4\n`;
  criteriaText += `• Ar-condicionado: Obrigatório\n`;
  criteriaText += `• Interior: Couro (preferencial)\n`;
  criteriaText += `• Cor: Preto (preferencial)\n\n`;

  let response: string;
  let canRecommend = false;
  let nextMode = context.mode;

  if (uberBlackVehicles.length > 0) {
    // Standard format for recommendations
    const recText = await formatRecommendations(
      uberBlackVehicles,
      updatedProfile,
      'recommendation'
    );

    // Combine criteria with standard recommendation text
    response = `${criteriaText}${recText}`;

    // Enable state transition to recommendation flow
    canRecommend = true;
    nextMode = 'recommendation';
  } else {
    const altCategory = getAppCategoryName(updatedProfile, 'x');
    response = `${criteriaText}❌ No momento não temos veículos aptos para Uber Black no estoque.\n\n`;
    response += `Mas temos veículos aptos para ${altCategory}. Quer ver?`;
  }

  return {
    handled: true,
    response: {
      response,
      extractedPreferences: {
        ...extracted.extracted,
        _waitingForUberXAlternatives: true,
        // Persist recommendation state if vehicles found
        ...(canRecommend
          ? {
              _showedRecommendation: true,
              _lastShownVehicles: uberBlackVehicles.slice(0, 5).map(r => ({
                vehicleId: r.vehicleId,
                brand: r.vehicle.brand,
                model: r.vehicle.model,
                year: r.vehicle.year,
                price: r.vehicle.price,
                bodyType: r.vehicle.bodyType,
              })),
            }
          : {}),
      },
      needsMoreInfo: [],
      canRecommend,
      recommendations: canRecommend ? uberBlackVehicles : [],
      nextMode,
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
    const exact = exactSearchParser.parse(userMessage);
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
    const askedModel =
      exactSearchParser.parse(userMessage).model ||
      extracted.extracted.model ||
      updatedProfile.model;
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

  const citySlug = updatedProfile.citySlug || context.profile?.citySlug || 'sao-paulo';

  const agent = await getUberEligibilityAgent();
  const eligibility = await agent.evaluate(
    {
      marca: dbVehicle.marca,
      modelo: dbVehicle.modelo,
      ano: dbVehicle.ano,
      carroceria: dbVehicle.carroceria,
      portas: dbVehicle.portas,
      arCondicionado: dbVehicle.arCondicionado,
    },
    citySlug
  );

  const validator = await getUberEligibilityValidator();
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
    `\n\n📍 Cidade considerada: *${citySlug}*.` +
    `\n⚠️ Observação: as regras podem variar por cidade e mudam com o tempo.`;

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
