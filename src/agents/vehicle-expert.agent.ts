/**
 * VehicleExpertAgent
 *
 * AI agent specialized in vehicle sales conversations.
 * Knows the entire inventory, answers questions, guides conversation,
 * and generates personalized recommendations.
 */

import { chatCompletion } from '../lib/llm-router';
import { logger } from '../lib/logger';
import { vehicleSearchAdapter } from '../services/vehicle-search-adapter.service';
import { preferenceExtractor } from './preference-extractor.agent';
import { exactSearchParser } from '../services/exact-search-parser.service';
import { CustomerProfile, VehicleRecommendation } from '../types/state.types';
import {
  ConversationContext,
  ConversationResponse,
  ConversationMode,
  ReadinessAssessment,
  QuestionGenerationOptions,
  VehicleSearchQuery,
} from '../types/conversation.types';

// Import constants from refactored module
import {
  SYSTEM_PROMPT,
  isSevenSeater,
  isFiveSeater,
  capitalize,
  capitalizeWords,
  SEDAN_COMPACT_MODELS,
  SEDAN_MEDIUM_MODELS,
  detectBodyTypeFromModel,
  detectVehicleCategory,
} from './vehicle-expert/constants';

// Import extractors
import { extractTradeInInfo, inferBrandFromModel } from './vehicle-expert/extractors';

// Import formatters
import {
  formatRecommendations as formatRecommendationsUtil,
  generateRecommendationIntro as generateRecommendationIntroUtil,
  type SearchType,
} from './vehicle-expert/formatters';

// Import builders
import { buildSearchQuery as buildSearchQueryUtil } from './vehicle-expert/builders';

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
  handleTradeInInitial,
  handleTradeInAfterSelection,
  handleSuggestionResponse,
  handleSpecificModel,
  type SuggestionResponseContext,
  type SpecificModelContext,
} from './vehicle-expert/processors';

// Import intent detection functions
import {
  detectUserQuestion,
  detectAffirmativeResponse,
  detectNegativeResponse,
  detectSearchIntent,
  detectPostRecommendationIntent,
  isPostRecommendationResponse,
  type SearchIntent,
  type PostRecommendationIntent,
} from './vehicle-expert/intent-detector';

// Import post-recommendation handlers
import {
  routePostRecommendationIntent,
  isFinancingResponse,
  handleFinancingResponse,
  handleWantOthers,
  type PostRecommendationContext,
  type ShownVehicle,
  type WantOthersContext,
} from './vehicle-expert/handlers';

/**
 * Helper function to get the correct app name based on user's mention
 * Returns the name the user actually used (99, Uber, or generic "app")
 */
function getAppName(profile: Partial<CustomerProfile>): string {
  if (profile.appMencionado === '99') return '99';
  if (profile.appMencionado === 'uber') return 'Uber';
  if (profile.appMencionado === 'app') return 'app de transporte';
  return 'Uber/99'; // Default when not specified
}

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
      const exactMatch = exactSearchParser.parse(userMessage);

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

          // 1. Tentar busca exata
          const exactResults = await vehicleSearchAdapter.search(
            userMessage.length > 3 ? userMessage : targetModel,
            {
              limit: 5,
              model: targetModel,
              minYear: targetYear,
            }
          );

          // Verificamos se o PRIMEIRO resultado bate com o ano solicitado
          const foundExact = exactResults.length > 0 && exactResults[0].vehicle.year === targetYear;

          if (foundExact) {
            // Encontrou exatamente o que queria
            logger.info('Exact match found - returning recommendation immediately');

            // Extrair anos disponíveis
            const availableYears = [...new Set(exactResults.map(r => r.vehicle.year))].sort(
              (a, b) => b - a
            );

            const formattedResponse = await formatRecommendationsUtil(
              exactResults,
              updatedProfile,
              'specific'
            );

            return {
              response: formattedResponse,
              extractedPreferences: {
                ...updatedProfile,
                minYear: targetYear,
                model: targetModel,
                _availableYears: availableYears,
                _showedRecommendation: true,
                _lastSearchType: 'specific',
                _searchedItem: targetModel,
                _lastShownVehicles: exactResults.map(r => ({
                  vehicleId: r.vehicleId,
                  brand: r.vehicle.brand,
                  model: r.vehicle.model,
                  year: r.vehicle.year,
                  price: r.vehicle.price,
                  bodyType: r.vehicle.bodyType,
                })),
              },
              needsMoreInfo: [],
              canRecommend: true,
              recommendations: exactResults,
              nextMode: 'recommendation',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 1.0,
                llmUsed: 'rule-based',
                exactMatch: true,
              } as any,
            };
          } else {
            // Não encontrou o ano exato - verificar se O MODELO existe em outros anos
            const modelResults = await vehicleSearchAdapter.search(targetModel, {
              model: targetModel,
              limit: 20,
            });

            if (modelResults.length > 0) {
              const availableYears = [...new Set(modelResults.map(r => r.vehicle.year))].sort(
                (a, b) => b - a
              );
              logger.info(
                { availableYears },
                'Exact year not found, but model exists in other years'
              );

              const yearsText =
                availableYears.length === 1
                  ? `no ano: ${availableYears[0]}`
                  : `nos anos: ${availableYears.join(', ')}`;

              const questionText =
                availableYears.length === 1
                  ? 'Quer ver essa opção?'
                  : 'Quer ver alguma dessas opções?';

              return {
                response: `Não encontrei o ${capitalize(targetModel)} ${targetYear} no estoque agora. 😕\n\nMas tenho esse modelo ${yearsText}.\n\n${questionText}`,
                extractedPreferences: {
                  ...updatedProfile,
                  _searchedItem: targetModel,
                  _availableYears: availableYears,
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
      }

      // 2.2. Intercept Hard Constraints (FAIL FAST) - Moto
      if (
        (updatedProfile.bodyType === 'moto' ||
          userMessage.toLowerCase().includes('moto') ||
          updatedProfile.priorities?.includes('moto')) &&
        !context.profile?._waitingForSuggestionResponse
      ) {
        logger.info('Intercepting flow: Moto request');

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

      // 2.2. Intercept Hard Constraints (FAIL FAST) - 7 seats
      if (
        updatedProfile.minSeats &&
        updatedProfile.minSeats >= 7 &&
        !context.profile?._waitingForSuggestionResponse
      ) {
        // Search specifically for 7 seaters to check availability
        const results = await vehicleSearchAdapter.search('7 lugares', {
          limit: 20,
        });

        // Filter strictly for 7 seaters
        const sevenSeaters = results.filter(r => isSevenSeater(r.vehicle.model || ''));

        if (sevenSeaters.length === 0) {
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
                  price: r.vehicle?.price || 0,
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

          const vehicleName = `${lastShownVehicles[0].brand} ${lastShownVehicles[0].model} ${lastShownVehicles[0].year}`;
          const tradeInText = [
            tradeInInfo.brand,
            tradeInInfo.model,
            tradeInInfo.year,
            tradeInInfo.km ? `(${tradeInInfo.km.toLocaleString('pt-BR')} km)` : null,
          ]
            .filter(Boolean)
            .join(' ');

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
        const specificModelMatch = exactSearchParser.parse(userMessage);
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

      // 2.6. Check if user selected an alternative year (direct return without questions)
      if (availableYears && availableYears.length > 0) {
        const yearMatch = userMessage.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          const selectedYear = parseInt(yearMatch[1]);
          if (availableYears.includes(selectedYear)) {
            const searchedModel = context.profile?._searchedItem;

            logger.info(
              {
                selectedYear,
                searchedModel,
                availableYears,
              },
              'User selected alternative year - returning vehicle directly'
            );

            // Search for the model with selected year
            const results = await vehicleSearchAdapter.search(searchedModel || '', {
              model: searchedModel,
              minYear: selectedYear,
              limit: 5,
            });

            // Filter for exact year match
            const matchingResults = results.filter(r => r.vehicle.year === selectedYear);

            if (matchingResults.length > 0) {
              const formattedResponse = await formatRecommendationsUtil(
                matchingResults,
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
                  minYear: selectedYear,
                  _availableYears: undefined,
                  _waitingForSuggestionResponse: false,
                  _searchedItem: undefined,
                  _showedRecommendation: true,
                  _lastSearchType: 'specific' as const,
                  _lastShownVehicles: matchingResults.map(r => ({
                    vehicleId: r.vehicleId,
                    brand: r.vehicle.brand,
                    model: r.vehicle.model,
                    year: r.vehicle.year,
                    price: r.vehicle.price,
                  })),
                },
                needsMoreInfo: [],
                canRecommend: true,
                recommendations: matchingResults,
                nextMode: 'recommendation',
                metadata: {
                  processingTime: Date.now() - startTime,
                  confidence: 0.95,
                  llmUsed: 'gpt-4o-mini',
                },
              };
            }
          }
        }
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
      if (isUserQuestion) {
        // Check if it's a question about vehicle availability (e.g., "qual pickup você tem?")
        const availabilityKeywords = [
          'tem',
          'têm',
          'disponível',
          'disponivel',
          'estoque',
          'vocês',
          'voces',
        ];
        const vehicleTypeKeywords = [
          'pickup',
          'picape',
          'suv',
          'sedan',
          'hatch',
          'caminhonete',
          'moto',
          'motocicleta',
          'scooter',
        ];
        const messageLower = userMessage.toLowerCase();

        const isAvailabilityQuestion =
          availabilityKeywords.some(kw => messageLower.includes(kw)) &&
          vehicleTypeKeywords.some(kw => messageLower.includes(kw));

        if (isAvailabilityQuestion) {
          // Detect which vehicle type user is asking about
          const askedBodyType = vehicleTypeKeywords.find(kw => messageLower.includes(kw));
          const normalizedBodyType = (
            askedBodyType === 'picape' || askedBodyType === 'caminhonete'
              ? 'pickup'
              : askedBodyType === 'moto' ||
                askedBodyType === 'motocicleta' ||
                askedBodyType === 'scooter'
                ? 'moto'
                : askedBodyType
          ) as 'sedan' | 'hatch' | 'suv' | 'pickup' | 'minivan' | 'moto' | undefined;

          logger.info(
            { userMessage, askedBodyType: normalizedBodyType },
            'User asking about vehicle availability'
          );

          // Para perguntas de disponibilidade, buscar DIRETO por categoria (sem filtros extras)
          const categoryResults = await vehicleSearchAdapter.search(`${normalizedBodyType}`, {
            bodyType: normalizedBodyType,
            limit: 5, // Retornar até 5 veículos da categoria
          });

          if (categoryResults.length === 0) {
            const categoryName =
              askedBodyType === 'pickup' || askedBodyType === 'picape'
                ? 'picapes'
                : askedBodyType === 'moto' ||
                  askedBodyType === 'motocicleta' ||
                  askedBodyType === 'scooter'
                  ? 'motos'
                  : askedBodyType === 'suv'
                    ? 'SUVs'
                    : askedBodyType === 'sedan'
                      ? 'sedans'
                      : askedBodyType === 'hatch'
                        ? 'hatches'
                        : `${askedBodyType}s`;

            return {
              response: `No momento não temos ${categoryName} disponíveis no estoque. 😕\n\nQuer que eu busque outras opções para você?`,
              extractedPreferences: {
                ...extracted.extracted,
                bodyType: normalizedBodyType,
                _waitingForSuggestionResponse: true,
              },
              needsMoreInfo: [],
              canRecommend: false,
              nextMode: 'clarification',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.9,
                llmUsed: 'gpt-4o-mini',
              },
            };
          }

          // Found vehicles - format for category availability response
          const categoryName =
            askedBodyType === 'pickup' || askedBodyType === 'picape'
              ? 'picapes'
              : askedBodyType === 'suv'
                ? 'SUVs'
                : askedBodyType === 'sedan'
                  ? 'sedans'
                  : askedBodyType === 'hatch'
                    ? 'hatches'
                    : `${askedBodyType}s`;

          const intro = `Temos ${categoryResults.length} ${categoryName} disponíveis! 🚗\n\n`;
          const vehicleList = categoryResults
            .map((rec, i) => {
              const v = rec.vehicle;
              const emoji = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : '⭐';
              return (
                `${emoji} ${v.brand} ${v.model} ${v.year}\n` +
                `   💰 R$ ${v.price.toLocaleString('pt-BR')}\n` +
                `   📍 ${v.mileage.toLocaleString('pt-BR')}km`
              );
            })
            .join('\n\n');

          const footer = '\n\n💬 Quer saber mais detalhes de algum? Me diz qual te interessou!';

          // Update profile with the asked bodyType
          if (normalizedBodyType) {
            updatedProfile.bodyType = normalizedBodyType;
          }

          return {
            response: intro + vehicleList + footer,
            extractedPreferences: {
              ...extracted.extracted,
              bodyType: normalizedBodyType,
              _showedRecommendation: true,
              _lastSearchType: 'recommendation' as const,
              _lastShownVehicles: categoryResults.map(r => ({
                vehicleId: r.vehicleId,
                brand: r.vehicle.brand,
                model: r.vehicle.model,
                year: r.vehicle.year,
                price: r.vehicle.price,
              })),
            },
            needsMoreInfo: [],
            canRecommend: true,
            recommendations: categoryResults,
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
        const motoKeywords = [
          'moto',
          'motocicleta',
          'scooter',
          'biz',
          'titan',
          'fan',
          'bros',
        ];
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
              brand: r.vehicle.brand,
              model: r.vehicle.model,
              year: r.vehicle.year,
              price: r.vehicle.price,
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
  private async getRecommendations(profile: Partial<CustomerProfile>): Promise<{
    recommendations: VehicleRecommendation[];
    noPickupsFound?: boolean;
    wantsPickup?: boolean;
    noMotosFound?: boolean;
    wantsMoto?: boolean;
    noSevenSeaters?: boolean;
    requiredSeats?: number;
  }> {
    try {
      // Build search query
      const query = buildSearchQueryUtil(profile);

      // Detect Uber requirements from profile
      const isUberBlack =
        profile.usoPrincipal === 'uber' &&
        (profile.priorities?.includes('uber_black') ||
          profile.priorities?.includes('black') ||
          profile.tipoUber === 'black');

      const isUberX = profile.usoPrincipal === 'uber' && !isUberBlack;

      // Detect family requirements (only if explicitly mentioned, not just by people count)
      const isFamily =
        profile.usoPrincipal === 'familia' ||
        profile.priorities?.includes('familia') ||
        profile.priorities?.includes('cadeirinha') ||
        profile.priorities?.includes('crianca');

      // Detect pickup/work requirements - check profile, search text AND context messages
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
      const searchTextLower = query.searchText.toLowerCase();
      const hasPickupInText = pickupKeywords.some(kw => searchTextLower.includes(kw));

      // Also check profile usoPrincipal and usage for work-related terms
      const usageText = `${profile.usoPrincipal || ''} ${profile.usage || ''}`.toLowerCase();
      const hasWorkUsage = usageText.includes('trabalho') || usageText.includes('obra');

      // Check priorities array for any pickup-related terms
      const prioritiesText = (profile.priorities || []).join(' ').toLowerCase();
      const hasPickupInPriorities = pickupKeywords.some(kw => prioritiesText.includes(kw));

      const wantsPickup =
        profile.bodyType === 'pickup' ||
        hasPickupInText ||
        hasPickupInPriorities ||
        (hasWorkUsage && pickupKeywords.some(kw => usageText.includes(kw)));

      // Detect moto requirements
      const motoKeywords = [
        'moto',
        'motocicleta',
        'scooter',
        'biz',
        'titan',
        'fan',
        'bros',
        'pcx',
        'fazer',
        'cb',
        'xre',
        'yamaha',
        'honda',
      ];
      const hasMotoInText = motoKeywords.some(kw => searchTextLower.includes(kw));
      const hasMotoInPriorities = motoKeywords.some(kw => prioritiesText.includes(kw));

      const wantsMoto =
        profile.bodyType === 'moto' || hasMotoInText || hasMotoInPriorities;

      logger.info(
        {
          wantsPickup,
          wantsMoto,
          bodyType: profile.bodyType,
          searchTextLower,
          hasPickupInText,
          hasMotoInText,
          usageText,
          hasWorkUsage,
        },
        'Vehicle type detection check'
      );

      const isWork =
        profile.usoPrincipal === 'trabalho' ||
        profile.usage === 'trabalho' ||
        profile.priorities?.includes('trabalho');

      // Search vehicles - include brand/model filter for specific requests
      const results = await vehicleSearchAdapter.search(query.searchText, {
        maxPrice: query.filters.maxPrice,
        minYear: query.filters.minYear,
        bodyType: wantsMoto
          ? 'moto'
          : wantsPickup
            ? 'pickup'
            : query.filters.bodyType?.[0],
        brand: query.filters.brand?.[0], // Filtrar por marca quando especificada
        model: query.filters.model?.[0], // Filtrar por modelo quando especificado
        limit: 10, // Get more to filter
        // Apply Uber filters
        aptoUber: isUberX || undefined,
        aptoUberBlack: isUberBlack || undefined,
        // Apply family filter (only if family, not for pickup/work/moto)
        aptoFamilia: (isFamily && !wantsPickup && !wantsMoto) || undefined,
        // Apply work filter
        aptoTrabalho: isWork || undefined,
      });

      // Se não encontrou motos e o usuário quer moto, informar
      if (wantsMoto && results.length === 0) {
        logger.info({ profile }, 'No motos found in inventory');
        return { recommendations: [], noMotosFound: true, wantsMoto: true };
      }

      // Se não encontrou pickups e o usuário quer pickup, informar
      if (wantsPickup && results.length === 0) {
        logger.info({ profile }, 'No pickups found in inventory');
        return { recommendations: [], noPickupsFound: true, wantsPickup: true };
      }

      // Post-filter: apply minimum seats requirement (RIGOROSO)
      const requiredSeats = profile.minSeats;
      if (requiredSeats && requiredSeats >= 7) {
        logger.info(
          { requiredSeats, resultsBeforeFilter: results.length },
          'Filtering for 7+ seat vehicles'
        );

        // Filtrar APENAS veículos de 7 lugares
        const sevenSeaterResults = results.filter(rec => {
          const modelLower = (rec.vehicle.model || '').toLowerCase();
          return isSevenSeater(modelLower);
        });

        logger.info(
          {
            requiredSeats,
            sevenSeaterResults: sevenSeaterResults.length,
            filteredModels: sevenSeaterResults.map(r => r.vehicle.model),
          },
          'Seven seater filter results'
        );

        if (sevenSeaterResults.length === 0) {
          // Não encontrou veículos de 7 lugares - NÃO retornar alternativas automaticamente
          return { recommendations: [], noSevenSeaters: true, requiredSeats };
        }

        // Retornar APENAS os veículos de 7 lugares
        return { recommendations: sevenSeaterResults.slice(0, 5), requiredSeats };
      }

      // Post-filter: apply family-specific rules
      let filteredResults = results;
      if (isFamily) {
        const hasCadeirinha =
          profile.priorities?.includes('cadeirinha') || profile.priorities?.includes('crianca');
        const peopleCount = profile.people || 4;

        filteredResults = results.filter(rec => {
          const model = rec.vehicle.model?.toLowerCase() || '';
          const bodyType = rec.vehicle.bodyType?.toLowerCase() || '';

          // NUNCA para família: hatch compactos/subcompactos
          const neverForFamily = ['mobi', 'kwid', 'up!', 'uno', 'ka', 'march', 'sandero'];
          if (neverForFamily.some(n => model.includes(n))) {
            return false;
          }

          // Para família: pickups GRANDES de cabine dupla são OK (espaço similar a SUVs)
          // Pickups COMPACTAS devem ser excluídas (cabine menor, menos conforto)
          const isPickup =
            bodyType.includes('pickup') ||
            bodyType.includes('picape') ||
            bodyType.includes('cabine');
          if (isPickup) {
            // Pickups grandes de cabine dupla - PERMITIDAS para família
            const largePickups = [
              'ranger',
              'amarok',
              's10',
              'hilux',
              'frontier',
              'l200',
              'triton',
              'toro',
            ];
            const isLargePickup = largePickups.some(p => model.includes(p));

            // Se for pickup compacta (Strada, Saveiro, Montana), excluir para família
            if (!isLargePickup) {
              return false;
            }
            // Pickups grandes passam no filtro (são adequadas para família)
          }

          // Com cadeirinha: precisa de mais espaço
          if (hasCadeirinha) {
            // Ideais para 2 cadeirinhas: SUVs, Sedans médios/grandes, Minivans
            const idealForCadeirinha = [
              // SUVs compactos bons
              'creta',
              'kicks',
              't-cross',
              'tcross',
              'tracker',
              'hr-v',
              'hrv',
              'renegade',
              // SUVs médios (excelentes)
              'tucson',
              'compass',
              'corolla cross',
              'tiguan',
              'sw4',
              'trailblazer',
              'commander',
              // Sedans médios/grandes (muito bons)
              'corolla',
              'civic',
              'cruze',
              'sentra',
              'jetta',
              'virtus',
              // Sedans compactos (aceitáveis)
              'hb20s',
              'onix plus',
              'cronos',
              'voyage',
              'prisma',
              // Minivans (excelentes)
              'spin',
              'livina',
              'zafira',
            ];

            // Se é hatch, só aceita se for espaçoso
            if (bodyType.includes('hatch')) {
              const hatchOkForFamily = ['fit', 'golf', 'polo', 'argo'];
              return hatchOkForFamily.some(h => model.includes(h));
            }

            // SUV e Sedan são sempre ok (exceto os já filtrados)
            if (bodyType.includes('suv') || bodyType.includes('sedan')) {
              return true;
            }

            // Minivan é excelente
            if (bodyType.includes('minivan') || model.includes('spin')) {
              return true;
            }

            // Verifica se está na lista ideal
            return idealForCadeirinha.some(ideal => model.includes(ideal));
          }

          // Família sem cadeirinha (mais flexível)
          // Exclui apenas os muito pequenos
          if (bodyType.includes('hatch')) {
            const smallHatch = ['mobi', 'kwid', 'up', 'uno', 'ka', 'march'];
            return !smallHatch.some(s => model.includes(s));
          }

          return true;
        });

        // Se filtrou demais, relaxa os critérios
        if (filteredResults.length < 3 && results.length >= 3) {
          // Tenta pegar pelo menos sedans e SUVs
          filteredResults = results.filter(rec => {
            const bodyType = rec.vehicle.bodyType?.toLowerCase() || '';
            return (
              bodyType.includes('suv') || bodyType.includes('sedan') || bodyType.includes('minivan')
            );
          });

          if (filteredResults.length < 3) {
            filteredResults = results.slice(0, 5);
          }
        }
      }

      logger.info(
        {
          profileKeys: Object.keys(profile),
          resultsCount: filteredResults.length,
          isUberBlack,
          isUberX,
          isFamily,
          wantsPickup,
        },
        'Generated recommendations'
      );

      // Fallback para busca de apps de transporte: se não encontrou com filtro aptoUber,
      // tentar buscar veículos compatíveis (sedans/hatches de 2012+) sem o filtro rigoroso
      if ((isUberX || isUberBlack) && filteredResults.length === 0) {
        logger.info(
          { isUberX, isUberBlack },
          'App transport search found no results, trying fallback without aptoUber filter'
        );

        // Buscar veículos que seriam aptos para apps (sedan/hatch, 2012+, com ar)
        // mas que podem não ter o campo aptoUber marcado no banco
        const fallbackResults = await vehicleSearchAdapter.search('sedan hatch carro', {
          maxPrice: query.filters.maxPrice,
          minYear: isUberBlack ? 2018 : 2012, // Uber Black precisa ser 2018+
          limit: 10,
          // NÃO usar filtro aptoUber/aptoUberBlack aqui
        });

        // Filtrar manualmente por carroceria adequada
        const compatibleResults = fallbackResults.filter(rec => {
          const bodyType = (rec.vehicle.bodyType || '').toLowerCase();
          // Para apps: apenas sedan, hatch ou minivan
          return (
            bodyType.includes('sedan') ||
            bodyType.includes('hatch') ||
            bodyType.includes('minivan') ||
            bodyType === ''
          );
        });

        if (compatibleResults.length > 0) {
          logger.info(
            { count: compatibleResults.length },
            'Fallback found compatible vehicles for app transport'
          );
          return { recommendations: compatibleResults.slice(0, 5), wantsPickup: false };
        }
      }

      return { recommendations: filteredResults.slice(0, 5), wantsPickup };
    } catch (error) {
      logger.error({ error, profile }, 'Failed to get recommendations');
      return { recommendations: [] };
    }
  }
}

// Singleton export
export const vehicleExpert = new VehicleExpertAgent();
