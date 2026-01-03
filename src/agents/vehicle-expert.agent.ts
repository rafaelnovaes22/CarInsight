/**
 * VehicleExpertAgent
 *
 * AI agent specialized in vehicle sales conversations.
 * Knows the entire inventory, answers questions, guides conversation,
 * and generates personalized recommendations.
 */

// import { chatCompletion } from '../lib/llm-router';
import { logger } from '../lib/logger';
// import { vehicleSearchAdapter } from '../services/vehicle-search-adapter.service';
import { preferenceExtractor } from './preference-extractor.agent';
import { vehicleRecommendationService } from './vehicle-expert/services/vehicle-recommendation.service';
import { exactSearchParser } from '../services/exact-search-parser.service';
import { CustomerProfile, VehicleRecommendation } from '../types/state.types';
import {
  ConversationContext,
  ConversationResponse,
} from '../types/conversation.types';

// Import constants from refactored module
import {
  SYSTEM_PROMPT,
  capitalize,
  capitalizeWords,
} from './vehicle-expert/constants';

// Import extractors
import { extractTradeInInfo } from './vehicle-expert/extractors';

// Import formatters
import {
  formatRecommendations as formatRecommendationsUtil,
} from './vehicle-expert/formatters';

// Import builders
// import { buildSearchQuery as buildSearchQueryUtil } from './vehicle-expert/builders';

// Import assessors
import {
  assessReadiness as assessReadinessUtil,
  identifyMissingInfo as identifyMissingInfoUtil,
  summarizeContext as summarizeContextUtil,
} from './vehicle-expert/assessors';

// Import processors
import {
  answerQuestion as answerQuestionUtil,
  generateNextQuestion as generateNextQuestionUtil,
  handleUberBlackQuestion,
  handleUberEligibilityQuestion,
  handleSuggestionResponse,
  handleSpecificModel,
  type SuggestionResponseContext,
  type SpecificModelContext,
} from './vehicle-expert/processors';

// Import intent detection functions
import {
  detectUserQuestion,
  detectPostRecommendationIntent,
  isRecommendationRequest,
} from './vehicle-expert/intent-detector';

// Import post-recommendation handlers
import {
  routePostRecommendationIntent,
  isFinancingResponse,
  handleWantOthers,
  type PostRecommendationContext,
  type ShownVehicle,
  type WantOthersContext,
} from './vehicle-expert/handlers';



/**
 * Helper function to get the app category name (e.g., "99Pop" or "Uber X")
 */
function getAppCategoryName(
  profile: Partial<CustomerProfile>,
  category: 'x' | 'black' | 'comfort'
): string {
  const is99 = profile.appMencionado === '99';
  switch (category) {
    case 'x':
      return is99 ? '99Pop' : 'Uber X';
    case 'black':
      return is99 ? '99Black' : 'Uber Black';
    case 'comfort':
      return is99 ? '99TOP' : 'Uber Comfort';
    default:
      return is99 ? '99' : 'Uber';
  }
}

export class VehicleExpertAgent {
  private readonly SYSTEM_PROMPT = SYSTEM_PROMPT;

  /**
   * Main chat interface - processes user message and generates response
   */
  async chat(userMessage: string, context: ConversationContext): Promise<ConversationResponse> {
    const startTime = Date.now();

    try {
      logger.info(
        {
          mode: context.mode,
          messageCount: context.metadata.messageCount,
        },
        'VehicleExpert processing message'
      );

      // 1. Extract preferences from current message
      const extracted = await preferenceExtractor.extract(userMessage, {
        currentProfile: context.profile,
        conversationHistory: context.messages.slice(-3).map(m => m.content),
      });

      // 2. Merge with existing profile
      const updatedProfile = preferenceExtractor.mergeWithProfile(
        context.profile,
        extracted.extracted
      );

      // 2.0. Check for Uber Black question (delegated to handler)
      const uberResult = await handleUberBlackQuestion(
        userMessage,
        context,
        updatedProfile,
        extracted,
        startTime,
        getAppCategoryName
      );
      if (uberResult.handled && uberResult.response) {
        return uberResult.response;
      }

      // 2.0.1. Check for Uber/99 eligibility question ("serve pra Uber?") WITHOUT assuming choice
      const uberEligibilityResult = await handleUberEligibilityQuestion(
        userMessage,
        context,
        updatedProfile,
        extracted,
        startTime
      );
      if (uberEligibilityResult.handled && uberEligibilityResult.response) {
        return uberEligibilityResult.response;
      }

      // 2.0.2. If user corrects us ("não escolhi"), acknowledge and reset the assumption
      // This avoids keeping the conversation stuck in negotiation when it was only a doubt.
      const correctionLower = userMessage.toLowerCase();
      const isNotChosenCorrection =
        /\b(não|nao)\s+escolhi\b/.test(correctionLower) ||
        /\bs[óo]\s+uma\s+d[úu]vida\b/.test(correctionLower) ||
        /\bquis\s+t(i|í)rar\s+uma\s+d[úu]vida\b/.test(correctionLower);

      if (isNotChosenCorrection) {
        return {
          response:
            `Sem problemas — entendi que você *não escolheu* um carro ainda, era só uma dúvida.\n\n` +
            `Qual é a dúvida exatamente? Se for sobre *Uber/99*, me diga sua *cidade/UF* e a *categoria* (X/Comfort/Black) que eu te ajudo a confirmar.`,
          extractedPreferences: {
            ...extracted.extracted,
            _showedRecommendation: false,
          },
          needsMoreInfo: [],
          canRecommend: false,
          nextMode: context.mode,
          metadata: {
            processingTime: Date.now() - startTime,
            confidence: 0.95,
            llmUsed: 'rule-based',
          },
        };
      }

      // 2.1. Intercept Specific Model + Year Search (Exact Intent)
      // Requirements: Return immediately if user provides model and year OR if profile has it (from greeting)
      const exactMatch = await exactSearchParser.parse(userMessage);

      // Check if we have model+year in message OR in profile (captured in Greeting)
      const targetModel = exactMatch.model || updatedProfile.model;
      const targetYear = exactMatch.year || updatedProfile.minYear;

      // IMPORTANT: Check if user is mentioning a vehicle they OWN (for trade-in) vs. want to BUY
      // "Quero trocar meu polo 2020 em um carro mais novo" → Polo is TRADE-IN, not what they want
      const isTradeInContext = exactSearchParser.isTradeInContext(userMessage);

      // IMPORTANTE: Verificar se já mostramos uma recomendação e o cliente selecionou um veículo
      // Se sim, o trade-in deve ser processado como parte do fluxo de NEGOCIAÇÃO, não como busca inicial
      const alreadyHasSelectedVehicle =
        context.profile?._showedRecommendation &&
        context.profile?._lastShownVehicles &&
        context.profile._lastShownVehicles.length > 0;

      // 2.2. Handle trade-in from initial message (delegated to handler)
      // 2.2. Handle trade-in from initial message (delegated to handler)
      /* 
      const tradeInInitialResult = handleTradeInInitial(
        exactMatch,
        isTradeInContext,
        !!alreadyHasSelectedVehicle,
        extracted,
        startTime
      );
      if (tradeInInitialResult.handled && tradeInInitialResult.response) {
        return tradeInInitialResult.response;
      }
      */
      // DELEGATION: Check for trade-in in initial message -> Delegate to trade_in node
      if (isTradeInContext && exactMatch.model && exactMatch.year && !alreadyHasSelectedVehicle) {
        logger.info('VehicleExpert: Delegating initial trade-in to trade_in node');
        return {
          response: '',
          extractedPreferences: extracted.extracted,
          needsMoreInfo: [],
          canRecommend: false,
          nextMode: 'trade_in', // New mode
          metadata: { delegated: true } as any,
        };
      }

      // 2.3. Handle trade-in after vehicle selection (delegated to handler)
      // 2.3. Handle trade-in after vehicle selection (delegated to handler)
      /*
      const tradeInAfterResult = handleTradeInAfterSelection(
        exactMatch,
        isTradeInContext,
        !!alreadyHasSelectedVehicle,
        context.profile?._lastShownVehicles || [],
        extracted,
        startTime
      );
      if (tradeInAfterResult.handled && tradeInAfterResult.response) {
        return tradeInAfterResult.response;
      }
      */
      // DELEGATION: Check for trade-in after selection -> Delegate to trade_in node
      if (isTradeInContext && exactMatch.model && exactMatch.year && alreadyHasSelectedVehicle) {
        logger.info('VehicleExpert: Delegating post-selection trade-in to trade_in node');
        return {
          response: '',
          extractedPreferences: extracted.extracted,
          needsMoreInfo: [],
          canRecommend: false,
          nextMode: 'trade_in',
          metadata: { delegated: true } as any,
        };
      }

      if (targetModel && targetYear) {
        // Ignorar se estivermos no meio de um fluxo de negociação ou se for menção de troca
        const isTradeInMention =
          isTradeInContext ||
          (/tenho|minha|meu|troca|possuo/i.test(userMessage) && !updatedProfile.model);

        // IMPORTANTE: Pular se já estamos esperando resposta de sugestão de anos alternativos
        // Porque senão o bloco vai re-executar a busca quando o usuário responde "sim"
        const isWaitingForSuggestion = context.profile?._waitingForSuggestionResponse;

        // IMPORTANTE: Pular se estamos aguardando detalhes de financiamento (entrada, carro de troca)
        // Se o usuário disse "10 mil de entrada e um Fiesta 2016", o Fiesta é o carro DE TROCA, não uma nova busca
        const isAwaitingFinancingDetails =
          context.profile?._awaitingFinancingDetails || context.profile?._awaitingTradeInDetails;

        // IMPORTANTE: Pular se já mostramos uma recomendação e o usuário está respondendo sobre ela
        // (financiamento, troca, agendamento, etc.) - NÃO RE-FAZER A BUSCA
        const alreadyShowedRecommendation = context.profile?._showedRecommendation;
        const lastShownVehicles = context.profile?._lastShownVehicles || [];

        // Verifica se o modelo mencionado está entre os veículos já mostrados
        // Se sim, é interesse no veículo, não nova busca
        // FIX: Checar se ALGUMA parte importante do nome do modelo está na mensagem
        const msgLower = userMessage.toLowerCase();
        const mentionedShownVehicleModel = lastShownVehicles.some(
          (v: { model: string; brand: string }) => {
            const modelParts = v.model.toLowerCase().split(' ');
            const brandLower = v.brand.toLowerCase();
            const hasModelPart = modelParts.some(
              part => part.length >= 3 && msgLower.includes(part)
            );
            return hasModelPart || msgLower.includes(brandLower);
          }
        );

        const isPostRecommendationIntent =
          alreadyShowedRecommendation &&
          // Financiamento
          (extracted.extracted.wantsFinancing ||
            /financ|parcel|entrada|presta[çc]/i.test(userMessage) ||
            // Troca de veículo
            extracted.extracted.hasTradeIn ||
            /troca|meu carro|tenho um|minha/i.test(userMessage) ||
            // Agendamento / Vendedor
            /agendar|visita|vendedor|ver pessoal|ir a[íi]/i.test(userMessage) ||
            // Interesse / Gostei (agora inclui quando menciona modelo já mostrado)
            /gostei|interessei|curti|quero esse|esse (mesmo|a[íi])/i.test(userMessage) ||
            mentionedShownVehicleModel ||
            // Perguntas sobre o veículo mostrado
            /mais (info|detalhe)|quilometr|km|opcional|documento|vers[ãa]o|motor|diesel|turbo|combust[íi]vel|cor|ano|c[âa]mbio/i.test(
              userMessage
            ));

        if (
          !isTradeInMention &&
          !isWaitingForSuggestion &&
          !isPostRecommendationIntent &&
          !isAwaitingFinancingDetails
        ) {
          logger.info({ model: targetModel, year: targetYear }, 'Intercepting Exact Search intent');

          // 1. Tentar busca exata via service
          const exactResult = await vehicleRecommendationService.findExactMatch(
            targetModel,
            targetYear,
            userMessage
          );

          if (exactResult.exactMatch) {
            // Encontrou exatamente o que queria
            logger.info('Exact match found - returning recommendation immediately');

            const formattedResponse = await formatRecommendationsUtil(
              [exactResult.exactMatch],
              updatedProfile,
              'specific'
            );

            return {
              response: formattedResponse,
              extractedPreferences: {
                ...updatedProfile,
                minYear: targetYear,
                model: targetModel,
                _availableYears: exactResult.availableYears,
                _showedRecommendation: true,
                _lastSearchType: 'specific',
                _searchedItem: targetModel,
                _lastShownVehicles: [exactResult.exactMatch].map(r => ({
                  vehicleId: r.vehicleId,
                  brand: r.vehicle?.brand || 'N/A',
                  model: r.vehicle?.model || 'N/A',
                  year: r.vehicle?.year || 0,
                  price: r.vehicle?.price ?? 0,
                  bodyType: r.vehicle?.bodyType,
                })),
              },
              needsMoreInfo: [],
              canRecommend: true,
              recommendations: [exactResult.exactMatch],
              nextMode: 'recommendation',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 1.0,
                llmUsed: 'rule-based',
                exactMatch: true,
              } as any,
            };
          } else if (exactResult.alternatives.length > 0) {
            // Não encontrou o ano exato - mas O MODELO existe em outros anos
            logger.info(
              { availableYears: exactResult.availableYears },
              'Exact year not found, but model exists in other years'
            );

            const yearsText =
              exactResult.availableYears.length === 1
                ? `no ano: ${exactResult.availableYears[0]}`
                : `nos anos: ${exactResult.availableYears.join(', ')}`;

            const questionText =
              exactResult.availableYears.length === 1
                ? 'Quer ver essa opção?'
                : 'Quer ver alguma dessas opções?';

            return {
              response: `Não encontrei o ${capitalize(targetModel)} ${targetYear} no estoque agora. 😕\n\nMas tenho esse modelo ${yearsText}.\n\n${questionText}`,
              extractedPreferences: {
                ...updatedProfile,
                _searchedItem: targetModel,
                _availableYears: exactResult.availableYears,
                _waitingForSuggestionResponse: true,
              },
              needsMoreInfo: [],
              canRecommend: false,
              nextMode: 'clarification',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.9,
                llmUsed: 'rule-based',
                alternativeYears: true,
              } as any,
            };
          }
        }
      }

      // 2.2. Intercept Hard Constraints (FAIL FAST) - Moto
      if (
        (updatedProfile.bodyType === 'moto' ||
          userMessage.toLowerCase().includes('moto') ||
          updatedProfile.priorities?.includes('moto')) &&
        !context.profile?._waitingForSuggestionResponse
      ) {
        // CHECK INVENTORY BEFORE BLOCKING
        // Search specifically for motorcycles via service
        const hasMotoInStock = await vehicleRecommendationService.checkAvailability('moto');

        if (!hasMotoInStock) {
          logger.info('Intercepting flow: Moto request (No stock)');

          return {
            response: `No momento trabalhamos apenas com carros (sedans, hatches, SUVs e picapes). 🚗\n\nAinda não temos motos no estoque, mas se estiver procurando um carro econômico para o dia a dia, posso te mostrar algumas opções! O que acha?`,
            extractedPreferences: {
              ...extracted.extracted,
              _waitingForSuggestionResponse: true,
              bodyType: 'moto',
              _searchedItem: 'moto',
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'clarification',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 1.0,
              llmUsed: 'rule-based',
              noMotosFound: true,
            } as any,
          };
        }

        logger.info('Moto request detected but stock exists - Proceeding to recommendation');
      }

      // 2.2. Intercept Hard Constraints (FAIL FAST) - 7 seats
      if (
        updatedProfile.minSeats &&
        updatedProfile.minSeats >= 7 &&
        !context.profile?._waitingForSuggestionResponse
      ) {
        // Search specifically for 7 seaters to check availability via service
        const hasSevenSeaters = await vehicleRecommendationService.checkAvailability('7seats');

        if (!hasSevenSeaters) {
          const seatsText =
            updatedProfile.minSeats === 7 ? '7 lugares' : `${updatedProfile.minSeats} lugares`;
          logger.info(
            { minSeats: updatedProfile.minSeats },
            'Intercepting flow: 7-seater request with no inventory'
          );

          return {
            response: `No momento não temos veículos de ${seatsText} disponíveis no estoque. 🚗\n\nQuer que eu mostre opções de SUVs ou sedans espaçosos de 5 lugares como alternativa?`,
            extractedPreferences: {
              ...extracted.extracted,
              _waitingForSuggestionResponse: true,
              _searchedItem: `veículo de ${seatsText}`,
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'clarification',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 1.0,
              llmUsed: 'rule-based',
              noSevenSeaters: true,
            } as any,
          };
        }
      }

      // 2.3. Intercept Pending Similar Vehicles Approval
      if (context.profile?._waitingForSimilarApproval) {
        const isYes = /sim|claro|pode|quero|manda|gostaria|ok|beleza|sim pode|com certeza/i.test(
          userMessage
        );
        const isNo = /n[ãa]o|agora n[ãa]o|depois|nenhum|parar|cancela|deixa/i.test(userMessage);

        if (isYes) {
          const pending = context.profile._pendingSimilarResults || [];
          if (pending.length > 0) {
            const formattedResponse = await formatRecommendationsUtil(
              pending,
              updatedProfile,
              'similar'
            );

            const intro = `Ótimo! Aqui estão as opções similares que encontrei:\n\n`;

            return {
              response: intro + formattedResponse.replace(/^.*?\n\n/, ''),
              extractedPreferences: {
                ...extracted.extracted,
                _waitingForSimilarApproval: false,
                _pendingSimilarResults: undefined,
                _showedRecommendation: true,
                _lastShownVehicles: pending.map(r => ({
                  vehicleId: r.vehicleId,
                  brand: r.vehicle?.brand || '',
                  model: r.vehicle?.model || '',
                  year: r.vehicle?.year || 0,
                  price: r.vehicle?.price ?? 0,
                  bodyType: r.vehicle?.bodyType,
                })),
              },
              needsMoreInfo: [],
              canRecommend: true,
              recommendations: pending,
              nextMode: 'recommendation',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.95,
                llmUsed: 'rule-based',
              },
            };
          }
        } else if (isNo || detectUserQuestion(userMessage)) {
          // If user says no or asks something else, clear flag and continue
          updatedProfile._waitingForSimilarApproval = false;

          if (isNo) {
            return {
              response: 'Entendido. O que você gostaria de buscar então?',
              extractedPreferences: { ...extracted.extracted, _waitingForSimilarApproval: false },
              canRecommend: false,
              needsMoreInfo: [],
              nextMode: 'discovery',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.9,
                llmUsed: 'rule-based',
              },
            };
          }
        }
      }

      // 2.5. Check if we offered to ask questions for suggestions and user is responding
      const wasWaitingForSuggestionResponse = context.profile?._waitingForSuggestionResponse;
      const availableYears = context.profile?._availableYears;
      const showedRecommendation = context.profile?._showedRecommendation;
      const lastShownVehicles = context.profile?._lastShownVehicles;
      const lastSearchType = context.profile?._lastSearchType;

      // 2.52. PRIORITY: Handle trade-in response when awaiting trade-in details
      // When user says "Honda CRV 150 mil km" - the 150 mil is KM, not entry value!
      const awaitingTradeInDetails = context.profile?._awaitingTradeInDetails;

      if (awaitingTradeInDetails && lastShownVehicles && lastShownVehicles.length > 0) {
        // Extract trade-in vehicle info (model, year, km)
        const tradeInInfo = extractTradeInInfo(userMessage);

        if (tradeInInfo.model || tradeInInfo.km) {
          logger.info({ userMessage, tradeInInfo }, 'Processing trade-in vehicle details');

          // DELEGATION: Delegate detailed trade-in response to trade_in node
          logger.info('VehicleExpert: Delegating trade-in details to trade_in node');
          return {
            response: '',
            extractedPreferences: {
              ...extracted.extracted,
              _awaitingTradeInDetails: false, // Clear flag so next node handles it? Or keep it?
              // Actually the node will re-check or we pass raw data?
              // The tradeInNode uses extractTradeInInfo so we should let it handle it.
              // But we need to ensure the message is processed by tradeInNode.
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'trade_in',
            metadata: { delegated: true } as any,
          };
        }
      }

      // 2.53. Handle financing response when awaiting financing details (no trade-in)
      const awaitingFinancingDetails = context.profile?._awaitingFinancingDetails;

      // Only process as financing if NOT waiting for trade-in details
      if (
        awaitingFinancingDetails &&
        !awaitingTradeInDetails &&
        lastShownVehicles &&
        lastShownVehicles.length > 0
      ) {
        // Check if this message is a financing response (contains entry value)
        if (isFinancingResponse(userMessage, true)) {
          logger.info(
            { userMessage, awaitingFinancingDetails },
            'Processing financing response with entry value'
          );

          // DELEGATION: Financing logic moved to 'financing' node
          logger.info('VehicleExpert: Delegating financing processing to financing node');

          return {
            response: '', // Empty response to let the next node handle it
            extractedPreferences: {
              ...extracted.extracted,
              wantsFinancing: true,
              _awaitingFinancingDetails: false, // Clear flag so next node handles it fresh
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'financing',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 1.0,
              llmUsed: 'rule-based',
              delegated: true,
            } as any,
          };
        }
      }

      // 2.55. Check if user is responding after seeing a recommendation
      if (showedRecommendation && lastShownVehicles && lastShownVehicles.length > 0) {
        // AUTO-DETECTION: Trade-In Discussion (Post-Recommendation)
        // If user mentions trade-in, we need to know WHICH car they have
        if (extracted.extracted.hasTradeIn || /troca|meu carro|tenho um|minha/i.test(userMessage)) {
          const hasTradeInDetails = extracted.extracted.tradeInModel || updatedProfile.tradeInModel;

          // Se AINDA NÃO temos os dados do carro de troca, PERGUNTAR
          if (!hasTradeInDetails) {
            logger.info('User mentioned trade-in but no car details - asking which car');

            // DELEGATION: User wants trade-in but no details -> Send to trade_in node to ASK
            logger.info('VehicleExpert: Delegating trade-in request to trade_in node');
            return {
              response: '',
              extractedPreferences: {
                ...extracted.extracted,
                hasTradeIn: true,
                _awaitingTradeInDetails: true,
                _showedRecommendation: true,
                _lastShownVehicles: lastShownVehicles,
              },
              needsMoreInfo: ['tradeInModel', 'tradeInYear'],
              canRecommend: false,
              nextMode: 'trade_in',
              metadata: { delegated: true } as any,
            };
          }

          // Se JÁ TEMOS os dados do carro de troca, encaminhar para vendedor avaliar
          // NÃO fazemos simulação porque o valor do carro de troca depende da avaliação presencial
          const tradeInCar = updatedProfile.tradeInModel
            ? `${capitalizeWords(updatedProfile.tradeInBrand || '')} ${capitalizeWords(updatedProfile.tradeInModel)} ${updatedProfile.tradeInYear || ''}`.trim()
            : `${capitalizeWords(extracted.extracted.tradeInModel || '')} ${extracted.extracted.tradeInYear || ''}`.trim();

          logger.info({ tradeInCar }, 'User provided trade-in car details - routing to seller');

          // DELEGATION: User provided trade-in details -> Send to trade_in node
          logger.info('VehicleExpert: Delegating trade-in details to trade_in node');
          return {
            response: '',
            extractedPreferences: {
              ...extracted.extracted,
              hasTradeIn: true,
              _awaitingTradeInDetails: false,
              _showedRecommendation: true,
              _lastShownVehicles: lastShownVehicles,
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'trade_in',
            metadata: { delegated: true } as any,
          };
        }

        // AUTO-DETECTION: Financing Discussion (Post-Recommendation)
        if (extracted.extracted.wantsFinancing) {
          const lastConfig = lastShownVehicles[0];
          const modelName = lastConfig.model;
          const vehiclePrice = lastConfig.price;

          // Se o usuário JÁ informou o valor de entrada, podemos prosseguir
          if (extracted.extracted.financingDownPayment !== undefined) {
            const entry = `R$ ${extracted.extracted.financingDownPayment.toLocaleString('pt-BR')}`;

            return {
              response: `Excelente! Vamos avançar com o financiamento do ${modelName}. 🏦\n\nCom entrada de ${entry}, já consigo encaminhar para aprovação.\n\nPara finalizar essa simulação e garantir as melhores taxas, vou conectar você com nosso consultor agora. Pode ser?`,
              extractedPreferences: {
                ...extracted.extracted,
                wantsFinancing: true,
                _awaitingFinancingDetails: false,
                _showedRecommendation: true,
                _lastShownVehicles: lastShownVehicles,
              },
              needsMoreInfo: ['schedule'],
              canRecommend: false,
              nextMode: 'negotiation',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.95,
                llmUsed: 'rule-based',
              },
            };
          }

          // Se NÃO informou entrada ainda, verificar se tem troca
          // Verificar se usuário já informou carro de troca
          const hasTradeInInfo = updatedProfile.hasTradeIn && updatedProfile.tradeInModel;
          const tradeInText = hasTradeInInfo
            ? updatedProfile.tradeInYear
              ? `${capitalizeWords(updatedProfile.tradeInModel || '')} ${updatedProfile.tradeInYear}`
              : capitalizeWords(updatedProfile.tradeInModel || '')
            : null;

          // Se tem troca, o carro É a entrada - vai direto pro vendedor
          if (hasTradeInInfo) {
            return {
              response: `Perfeito! Vou encaminhar você para nosso consultor! 🏦\n\n📋 *Resumo:*\n🚗 *Veículo:* ${lastConfig.brand} ${modelName} ${lastConfig.year}\n💰 *Valor:* R$ ${vehiclePrice.toLocaleString('pt-BR')}\n🔄 *Entrada:* ${tradeInText} (troca)\n💳 *Pagamento:* Financiamento\n\nNosso consultor vai avaliar seu ${tradeInText} e apresentar a melhor proposta!\n\n_Digite "vendedor" para falar com nossa equipe!_`,
              extractedPreferences: {
                ...extracted.extracted,
                wantsFinancing: true,
                _awaitingFinancingDetails: false,
                _showedRecommendation: true,
                _lastShownVehicles: lastShownVehicles,
              },
              needsMoreInfo: [],
              canRecommend: false,
              nextMode: 'negotiation',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.95,
                llmUsed: 'rule-based',
              },
            };
          }

          // Se não tem troca, perguntar sobre entrada em dinheiro ou troca
          return {
            response: `Ótimo! Financiamento do ${lastConfig.brand} ${modelName} ${lastConfig.year}! 🏦\n\n💰 *Valor:* R$ ${vehiclePrice.toLocaleString('pt-BR')}\n\nPra encaminhar pro nosso consultor, me conta:\n• Tem algum valor de *entrada*?\n• Ou tem algum *carro pra dar na troca*?\n\n_Exemplo: "10 mil de entrada" ou "tenho um Gol 2018 pra trocar"_`,
            extractedPreferences: {
              ...extracted.extracted,
              wantsFinancing: true,
              _awaitingFinancingDetails: true, // Flag to catch next message with entry/trade-in
              _showedRecommendation: true,
              _lastShownVehicles: lastShownVehicles,
            },
            needsMoreInfo: ['financingDownPayment', 'tradeIn'],
            canRecommend: false,
            nextMode: 'negotiation',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.95,
              llmUsed: 'rule-based',
            },
          };
        }

        // PRIORIDADE: depois de mostrar recomendações, QUALQUER PERGUNTA do usuário é uma dúvida.
        // Devemos consultar e responder, sem assumir "escolha" nem entrar no fluxo de negociação.
        if (detectUserQuestion(userMessage)) {
          const answer = await answerQuestionUtil(userMessage, context, updatedProfile);

          return {
            response: answer,
            extractedPreferences: {
              ...extracted.extracted,
              _showedRecommendation: true,
              _lastShownVehicles: lastShownVehicles,
              _lastSearchType: lastSearchType,
            },
            needsMoreInfo: identifyMissingInfoUtil(updatedProfile),
            canRecommend: false,
            nextMode: context.mode,
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.9,
              llmUsed: 'gpt-4o-mini',
            },
          };
        }

        const postRecommendationIntent = detectPostRecommendationIntent(
          userMessage,
          lastShownVehicles
        );

        logger.info(
          {
            userMessage,
            postRecommendationIntent,
            lastSearchType,
            lastShownCount: lastShownVehicles.length,
          },
          'Post-recommendation intent detection'
        );

        // PRIORITY: Check if user is asking for a SPECIFIC MODEL not in the shown list
        // e.g., "Não tem HB20?", "Tem Onix?", "E o Civic?"
        const specificModelMatch = await exactSearchParser.parse(userMessage);
        if (specificModelMatch.model) {
          // Check if this model was NOT in the shown vehicles
          const modelInShown = lastShownVehicles.some(
            v =>
              v.model.toLowerCase().includes(specificModelMatch.model!.toLowerCase()) ||
              specificModelMatch.model!.toLowerCase().includes(v.model.toLowerCase())
          );

          if (!modelInShown) {
            // User is asking for a different model - do a new search
            logger.info(
              {
                requestedModel: specificModelMatch.model,
                year: specificModelMatch.year,
                shownModels: lastShownVehicles.map(v => v.model),
              },
              'User asking for specific model not in shown list - doing new search'
            );

            // Continue to the main search logic below (don't return here, let it fall through)
            // The search logic will handle this as a new model search
          }
        }

        if (
          postRecommendationIntent === 'want_others' &&
          !(
            specificModelMatch.model &&
            !lastShownVehicles.some(
              v =>
                v.model.toLowerCase().includes(specificModelMatch.model!.toLowerCase()) ||
                specificModelMatch.model!.toLowerCase().includes(v.model.toLowerCase())
            )
          )
        ) {
          // Delegate to want-others handler
          const wantOthersCtx: WantOthersContext = {
            userMessage,
            lastShownVehicles: lastShownVehicles as ShownVehicle[],
            lastSearchType,
            extracted,
            updatedProfile,
            startTime,
          };

          const wantOthersResult = await handleWantOthers(wantOthersCtx);
          if (wantOthersResult.handled && wantOthersResult.response) {
            return wantOthersResult.response;
          }
        }

        // Route to handlers for: want_details, want_schedule, want_financing, want_tradein, acknowledgment, want_interest
        if (
          [
            'want_details',
            'want_schedule',
            'want_financing',
            'want_tradein',
            'acknowledgment',
            'want_interest',
          ].includes(postRecommendationIntent)
        ) {
          const handlerContext: PostRecommendationContext = {
            userMessage,
            lastShownVehicles: lastShownVehicles as ShownVehicle[],
            lastSearchType,
            extracted,
            updatedProfile,
            context,
            startTime,
          };

          const result = routePostRecommendationIntent(postRecommendationIntent, handlerContext);
          if (result.handled && result.response) {
            return result.response;
          }
        }

        // If 'none', clear the recommendation state and continue normal processing
        // The user might be asking something else or making a new search
        updatedProfile._showedRecommendation = false;
      }

      // 2.6. Check if user selected an alternative year (delegated to service)
      const alternativeYearResult = await vehicleRecommendationService.processAlternativeYear(
        userMessage,
        availableYears,
        context.profile?._searchedItem
      );

      if (alternativeYearResult.handled && alternativeYearResult.recommendations) {
        const formattedResponse = await formatRecommendationsUtil(
          alternativeYearResult.recommendations,
          {
            ...updatedProfile,
            _availableYears: undefined,
            _waitingForSuggestionResponse: false,
            _searchedItem: undefined,
          },
          'specific' // Usuário escolheu um ano alternativo - busca específica
        );

        return {
          response: formattedResponse,
          extractedPreferences: {
            ...extracted.extracted,
            minYear: alternativeYearResult.selectedYear,
            _availableYears: undefined,
            _waitingForSuggestionResponse: false,
            _searchedItem: undefined,
            _showedRecommendation: true,
            _lastSearchType: 'specific' as const,
            _lastShownVehicles: alternativeYearResult.recommendations.map(r => ({
              vehicleId: r.vehicleId,
              brand: r.vehicle?.brand || 'N/A',
              model: r.vehicle?.model || 'N/A',
              year: r.vehicle?.year || 0,
              price: r.vehicle?.price ?? 0,
              bodyType: r.vehicle?.bodyType,
            })),
          },
          needsMoreInfo: [],
          canRecommend: true,
          recommendations: alternativeYearResult.recommendations,
          nextMode: 'recommendation',
          metadata: {
            processingTime: Date.now() - startTime,
            confidence: 0.95,
            llmUsed: 'gpt-4o-mini',
          },
        };
      }

      // 2.6. Handle suggestion response (delegated to handler)
      const suggestionCtx: SuggestionResponseContext = {
        userMessage,
        wasWaitingForSuggestionResponse: !!wasWaitingForSuggestionResponse,
        waitingForUberXAlternatives: !!context.profile?._waitingForUberXAlternatives,
        availableYears,
        searchedItem: context.profile?._searchedItem,
        extracted,
        updatedProfile,
        context,
        startTime,
        getAppCategoryName,
      };

      const suggestionResult = await handleSuggestionResponse(suggestionCtx);

      if (suggestionResult.handled) {
        // If handler returned a response, return it
        if (suggestionResult.response) {
          return suggestionResult.response;
        }

        // If handler says to continue processing, apply profile updates
        if (suggestionResult.continueProcessing && suggestionResult.profileUpdates) {
          Object.assign(updatedProfile, suggestionResult.profileUpdates);
        }
      }

      // 3. Handle specific model/brand search (delegated to handler)
      const specificModelCtx: SpecificModelContext = {
        userMessage,
        extracted,
        updatedProfile,
        startTime,
        getRecommendations: this.getRecommendations.bind(this),
      };

      const specificModelResult = await handleSpecificModel(specificModelCtx);
      if (specificModelResult.handled && specificModelResult.response) {
        return specificModelResult.response;
      }

      // 4. Detect if user asked a question (vs just answering)
      const isUserQuestion = detectUserQuestion(userMessage);

      // 5. Route based on question detection
      // IMPORTANT: Don't treat "recommendation" intents as generic questions, even if they have question marks.
      // e.g. "Pode me indicar um carro?" should go to recommendation flow (to check readiness/budget), not Q&A.
      // But: "Como funciona o financiamento?" IS a generic question and SHOULD be answered here.
      const isRecommendation = isRecommendationRequest(userMessage);

      if (isUserQuestion && !isRecommendation) {
        const availabilityCheck =
          await vehicleRecommendationService.processAvailabilityQuestion(userMessage);

        if (availabilityCheck.handled && availabilityCheck.response) {
          // Update profile with the asked bodyType
          if (availabilityCheck.category) {
            updatedProfile.bodyType = availabilityCheck.category as any;
          }

          return {
            response: availabilityCheck.response,
            extractedPreferences: {
              ...extracted.extracted,
              bodyType: availabilityCheck.category as any,
              _showedRecommendation: true,
              _lastSearchType: 'recommendation' as const,
              _lastShownVehicles: (availabilityCheck.vehicleList || []).map(r => ({
                vehicleId: r.vehicleId,
                brand: r.vehicle?.brand || 'N/A',
                model: r.vehicle?.model || 'N/A',
                year: r.vehicle?.year || 0,
                price: r.vehicle?.price ?? 0,
                bodyType: r.vehicle?.bodyType,
              })),
            },
            needsMoreInfo: [],
            canRecommend: true,
            recommendations: availabilityCheck.vehicleList || [],
            nextMode: 'recommendation',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.9,
              llmUsed: 'gpt-4o-mini',
            },
          };
        }

        // Regular question - Answer using RAG
        const answer = await answerQuestionUtil(userMessage, context, updatedProfile);

        return {
          response: answer,
          extractedPreferences: extracted.extracted,
          needsMoreInfo: identifyMissingInfoUtil(updatedProfile),
          canRecommend: false,
          nextMode: context.mode, // Stay in current mode
          metadata: {
            processingTime: Date.now() - startTime,
            confidence: extracted.confidence,
            llmUsed: 'gpt-4o-mini',
          },
        };
      }

      // 6. Assess if we're ready to recommend
      const readiness = assessReadinessUtil(updatedProfile, context);

      if (readiness.canRecommend) {
        // Check recent USER messages for pickup keywords before recommendations
        // IMPORTANT: Filter only user messages to avoid false positives from assistant examples like "SUV, sedan, pickup..."
        const pickupKeywords = [
          'pickup',
          'picape',
          'caminhonete',
          'caçamba',
          'cacamba',
          'carga',
          'obra',
          'material',
          'construção',
          'construcao',
          'carregar',
          'entulho',
        ];
        const motoKeywords = ['moto', 'motocicleta', 'scooter', 'biz', 'titan', 'fan', 'bros'];
        const recentUserMessages = context.messages
          .filter(m => m.role === 'user')
          .slice(-5)
          .map(m => m.content.toLowerCase())
          .join(' ');
        const hasPickupInMessages = pickupKeywords.some(kw => recentUserMessages.includes(kw));
        const hasMotoInMessages = motoKeywords.some(kw => recentUserMessages.includes(kw));

        // If pickup detected in messages but not in profile, add it
        if (hasPickupInMessages && !updatedProfile.bodyType) {
          logger.info(
            { recentMessages: recentUserMessages.substring(0, 100) },
            'Pickup detected in recent user messages, adding to profile'
          );
          updatedProfile.bodyType = 'pickup';
          if (!updatedProfile.priorities) {
            updatedProfile.priorities = ['pickup'];
          } else if (!updatedProfile.priorities.includes('pickup')) {
            updatedProfile.priorities.push('pickup');
          }
        }

        // If moto detected in messages but not in profile, add it
        if (hasMotoInMessages && !updatedProfile.bodyType) {
          logger.info(
            { recentMessages: recentUserMessages.substring(0, 100) },
            'Moto detected in recent user messages, adding to profile'
          );
          updatedProfile.bodyType = 'moto';
          if (!updatedProfile.priorities) {
            updatedProfile.priorities = ['moto'];
          } else if (!updatedProfile.priorities.includes('moto')) {
            updatedProfile.priorities.push('moto');
          }
        }

        // Generate recommendations
        const result = await this.getRecommendations(updatedProfile);

        // Se não encontrou motos, oferecer sugestões alternativas
        if (result.noMotosFound) {
          const noMotoResponse = `No momento não temos motos disponíveis no estoque. 🏍️\n\nQuer responder algumas perguntas rápidas para eu te dar sugestões de carros?`;

          return {
            response: noMotoResponse,
            extractedPreferences: {
              ...extracted.extracted,
              _waitingForSuggestionResponse: true,
              _searchedItem: 'moto',
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'clarification',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.9,
              llmUsed: 'gpt-4o-mini',
              noMotosFound: true,
            },
          };
        }

        // Se não encontrou pickups, oferecer sugestões alternativas
        if (result.noPickupsFound) {
          const noPickupResponse = `No momento não temos pickups disponíveis no estoque. 🛻

Quer responder algumas perguntas rápidas para eu te dar sugestões personalizadas?`;

          return {
            response: noPickupResponse,
            extractedPreferences: {
              ...extracted.extracted,
              _waitingForSuggestionResponse: true,
              _searchedItem: 'pickup',
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'clarification',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.9,
              llmUsed: 'gpt-4o-mini',
              noPickupsFound: true,
            },
          };
        }

        // Se não encontrou veículos de 7 lugares, informar e perguntar se quer alternativas
        if (result.noSevenSeaters) {
          const seatsText =
            result.requiredSeats === 7 ? '7 lugares' : `${result.requiredSeats} lugares`;
          const noSevenSeaterResponse = `No momento não temos veículos de ${seatsText} disponíveis no estoque. 🚗

Quer que eu mostre opções de SUVs ou sedans espaçosos de 5 lugares como alternativa?`;

          return {
            response: noSevenSeaterResponse,
            extractedPreferences: {
              ...extracted.extracted,
              _waitingForSuggestionResponse: true,
              _searchedItem: `veículo de ${seatsText}`,
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'clarification',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.9,
              llmUsed: 'gpt-4o-mini',
              noSevenSeaters: true,
            },
          };
        }

        // Filter out previously shown vehicles if we have exclusion list
        let filteredRecommendations = result.recommendations;

        // Combine exclusion sources: explicit excludeIds + lastShownVehicles
        const excludeFromList = context.profile?._excludeVehicleIds || [];
        const excludeFromShown = (context.profile?._lastShownVehicles || []).map(v => v.vehicleId);
        const allExcludeIds = [...new Set([...excludeFromList, ...excludeFromShown])];

        if (allExcludeIds.length > 0) {
          logger.info(
            { allExcludeIds, excludeFromList, excludeFromShown },
            'Excluding previously shown vehicles from recommendations'
          );
          filteredRecommendations = result.recommendations.filter(
            r => !allExcludeIds.includes(r.vehicleId)
          );
        }

        // If all recommendations were filtered out, try to get more without the exclusion
        if (filteredRecommendations.length === 0 && result.recommendations.length > 0) {
          filteredRecommendations = result.recommendations; // Use original if nothing left
          logger.warn(
            { allExcludeIds },
            'All recommendations were excluded, showing original results'
          );
        }

        const formattedResponse = await formatRecommendationsUtil(
          filteredRecommendations,
          updatedProfile,
          'recommendation' // Fluxo de recomendação personalizada
        );

        return {
          response: formattedResponse,
          extractedPreferences: {
            ...extracted.extracted,
            _showedRecommendation: true,
            _lastSearchType: 'recommendation' as const,
            _lastShownVehicles: filteredRecommendations.map(r => ({
              vehicleId: r.vehicleId,
              brand: r.vehicle?.brand || 'N/A',
              model: r.vehicle?.model || 'N/A',
              year: r.vehicle?.year || 0,
              price: r.vehicle?.price ?? 0,
            })),
            _excludeVehicleIds: undefined, // Limpar após usar
          },
          needsMoreInfo: [],
          canRecommend: true,
          recommendations: filteredRecommendations,
          nextMode: 'recommendation',
          metadata: {
            processingTime: Date.now() - startTime,
            confidence: readiness.confidence,
            llmUsed: 'gpt-4o-mini',
          },
        };
      }

      // 7. Continue conversation - ask next contextual question
      const nextQuestion = await generateNextQuestionUtil({
        profile: updatedProfile,
        missingFields: readiness.missingRequired,
        context: summarizeContextUtil(context),
      });

      return {
        response: nextQuestion,
        extractedPreferences: extracted.extracted,
        needsMoreInfo: readiness.missingRequired,
        canRecommend: false,
        nextMode: context.mode === 'discovery' ? 'clarification' : context.mode,
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: extracted.confidence,
          llmUsed: 'gpt-4o-mini',
        },
      };
    } catch (error) {
      logger.error({ error, userMessage }, 'VehicleExpert chat failed');

      // Fallback response
      return {
        response: 'Desculpe, tive um problema ao processar sua mensagem. Pode reformular?',
        extractedPreferences: {},
        needsMoreInfo: [],
        canRecommend: false,
        nextMode: context.mode,
        metadata: {
          processingTime: Date.now() - startTime,
        },
      };
    }
  }

  // NOTE: Intent detection methods (detectSearchIntent, detectUserQuestion,
  // detectAffirmativeResponse, detectNegativeResponse, detectPostRecommendationIntent)
  // have been moved to ./vehicle-expert/intent-detector.ts

  /**
   * Get vehicle recommendations based on profile
   * Returns { recommendations, noPickupsFound, noSevenSeaters } to indicate if category was not found
   */
  /**
   * Get vehicle recommendations based on profile
   * Returns { recommendations, noPickupsFound, noSevenSeaters } to indicate if category was not found
   */
  private async getRecommendations(profile: Partial<CustomerProfile>): Promise<{
    recommendations: VehicleRecommendation[];
    noPickupsFound?: boolean;
    wantsPickup?: boolean;
    noMotosFound?: boolean;
    wantsMoto?: boolean;
    noSevenSeaters?: boolean;
    requiredSeats?: number;
  }> {
    return vehicleRecommendationService.getRecommendations(profile);
  }
}

// Singleton export
export const vehicleExpert = new VehicleExpertAgent();
