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
  VehicleSearchQuery
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
import {
  extractTradeInInfo,
  inferBrandFromModel,
} from './vehicle-expert/extractors';

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
  type PostRecommendationContext,
  type ShownVehicle,
} from './vehicle-expert/handlers';

export class VehicleExpertAgent {

  private readonly SYSTEM_PROMPT = SYSTEM_PROMPT;

  /**
   * Extract trade-in vehicle info from message
   * @deprecated Use extractTradeInInfo from './vehicle-expert/extractors' instead
   */
  private extractTradeInInfo(message: string) {
    return extractTradeInInfo(message);
  }

  /**
   * Infer brand from model name
   * @deprecated Use inferBrandFromModel from './vehicle-expert/extractors' instead
   */
  private inferBrandFromModel(model: string): string | undefined {
    return inferBrandFromModel(model);
  }

  /**
   * Main chat interface - processes user message and generates response
   */
  async chat(
    userMessage: string,
    context: ConversationContext
  ): Promise<ConversationResponse> {
    const startTime = Date.now();

    try {
      logger.info({
        mode: context.mode,
        messageCount: context.metadata.messageCount
      }, 'VehicleExpert processing message');

      // 1. Extract preferences from current message
      const extracted = await preferenceExtractor.extract(userMessage, {
        currentProfile: context.profile,
        conversationHistory: context.messages.slice(-3).map(m => m.content)
      });

      // 2. Merge with existing profile
      const updatedProfile = preferenceExtractor.mergeWithProfile(
        context.profile,
        extracted.extracted
      );

      // 2.0. Check for Uber Black question
      const lowerMessage = userMessage.toLowerCase();
      if (lowerMessage.includes('uber black') || lowerMessage.includes('uberblack')) {
        // Search for Uber Black eligible vehicles
        const uberBlackVehicles = await vehicleSearchAdapter.search('', {
          aptoUberBlack: true,
          limit: 10
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
          response += `❌ No momento não temos veículos aptos para Uber Black no estoque.\n\n`;
          response += `Mas temos veículos aptos para Uber X/99Pop. Quer ver?`;
        }

        return {
          response,
          extractedPreferences: { 
            ...extracted.extracted,
            _waitingForUberXAlternatives: true
          },
          needsMoreInfo: [],
          canRecommend: false,
          nextMode: context.mode,
          metadata: {
            processingTime: Date.now() - startTime,
            confidence: 1.0,
            llmUsed: 'rule-based'
          }
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

      if (isTradeInContext && exactMatch.model && exactMatch.year) {
        // User mentioned a vehicle they OWN - extract as trade-in and ask what they want
        logger.info({
          tradeInModel: exactMatch.model,
          tradeInYear: exactMatch.year
        }, 'VehicleExpert: Detected trade-in vehicle from initial message');

        return {
          response: `Entendi! Você tem um ${exactMatch.model} ${exactMatch.year} para dar na troca. 🚗🔄\n\nPra te ajudar a encontrar o carro ideal, me conta:\n\n• Qual tipo de carro você está procurando? (SUV, sedan, hatch...)\n• Tem um orçamento em mente?\n\n_Ou me fala um modelo específico se já sabe o que quer!_`,
          extractedPreferences: {
            ...extracted.extracted,
            hasTradeIn: true,
            tradeInBrand: this.inferBrandFromModel(exactMatch.model),
            tradeInModel: exactMatch.model.toLowerCase(),
            tradeInYear: exactMatch.year,
            // Clear any model/year that might have been extracted as desired vehicle
            model: undefined,
            minYear: undefined,
          },
          needsMoreInfo: ['bodyType', 'budget'],
          canRecommend: false,
          nextMode: 'discovery',
          metadata: {
            processingTime: Date.now() - startTime,
            confidence: 0.95,
            llmUsed: 'rule-based',
            tradeInDetected: true
          } as any
        };
      }

      if (targetModel && targetYear) {
        // Ignorar se estivermos no meio de um fluxo de negociação ou se for menção de troca
        const isTradeInMention = isTradeInContext ||
          (/tenho|minha|meu|troca|possuo/i.test(userMessage) && !updatedProfile.model);

        // IMPORTANTE: Pular se já estamos esperando resposta de sugestão de anos alternativos
        // Porque senão o bloco vai re-executar a busca quando o usuário responde "sim"
        const isWaitingForSuggestion = context.profile?._waitingForSuggestionResponse;

        // IMPORTANTE: Pular se estamos aguardando detalhes de financiamento (entrada, carro de troca)
        // Se o usuário disse "10 mil de entrada e um Fiesta 2016", o Fiesta é o carro DE TROCA, não uma nova busca
        const isAwaitingFinancingDetails = context.profile?._awaitingFinancingDetails ||
          context.profile?._awaitingTradeInDetails;

        // IMPORTANTE: Pular se já mostramos uma recomendação e o usuário está respondendo sobre ela
        // (financiamento, troca, agendamento, etc.) - NÃO RE-FAZER A BUSCA
        const alreadyShowedRecommendation = context.profile?._showedRecommendation;
        const lastShownVehicles = context.profile?._lastShownVehicles || [];

        // Verifica se o modelo mencionado está entre os veículos já mostrados
        // Se sim, é interesse no veículo, não nova busca
        const msgLower = userMessage.toLowerCase();
        const mentionedShownVehicleModel = lastShownVehicles.some((v: { model: string; brand: string }) => {
          const modelLower = v.model.toLowerCase();
          const brandLower = v.brand.toLowerCase();
          return msgLower.includes(modelLower) || msgLower.includes(brandLower);
        });

        const isPostRecommendationIntent = alreadyShowedRecommendation && (
          // Financiamento
          extracted.extracted.wantsFinancing ||
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
          /mais (info|detalhe)|quilometr|km|opcional|documento/i.test(userMessage)
        );

        if (!isTradeInMention && !isWaitingForSuggestion && !isPostRecommendationIntent && !isAwaitingFinancingDetails) {
          logger.info({ model: targetModel, year: targetYear }, 'Intercepting Exact Search intent');

          // 1. Tentar busca exata
          const exactResults = await vehicleSearchAdapter.search(userMessage.length > 3 ? userMessage : targetModel, {
            limit: 5,
            model: targetModel,
            minYear: targetYear
          });

          // Verificamos se o PRIMEIRO resultado bate com o ano solicitado
          const foundExact = exactResults.length > 0 && exactResults[0].vehicle.year === targetYear;

          if (foundExact) {
            // Encontrou exatamente o que queria
            logger.info('Exact match found - returning recommendation immediately');

            // Extrair anos disponíveis
            const availableYears = [...new Set(exactResults.map(r => r.vehicle.year))].sort((a, b) => b - a);

            const formattedResponse = await this.formatRecommendations(
              exactResults,
              updatedProfile,
              context,
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
                  bodyType: r.vehicle.bodyType
                }))
              },
              needsMoreInfo: [],
              canRecommend: true,
              recommendations: exactResults,
              nextMode: 'recommendation',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 1.0,
                llmUsed: 'rule-based',
                exactMatch: true
              } as any
            };
          } else {
            // Não encontrou o ano exato - verificar se O MODELO existe em outros anos
            const modelResults = await vehicleSearchAdapter.search(targetModel, {
              model: targetModel,
              limit: 20
            });

            if (modelResults.length > 0) {
              const availableYears = [...new Set(modelResults.map(r => r.vehicle.year))].sort((a, b) => b - a);
              logger.info({ availableYears }, 'Exact year not found, but model exists in other years');

              const yearsText = availableYears.length === 1
                ? `no ano: ${availableYears[0]}`
                : `nos anos: ${availableYears.join(', ')}`;

              const questionText = availableYears.length === 1
                ? 'Quer ver essa opção?'
                : 'Quer ver alguma dessas opções?';

              return {
                response: `Não encontrei o ${capitalize(targetModel)} ${targetYear} no estoque agora. 😕\n\nMas tenho esse modelo ${yearsText}.\n\n${questionText}`,
                extractedPreferences: {
                  ...updatedProfile,
                  _searchedItem: targetModel,
                  _availableYears: availableYears,
                  _waitingForSuggestionResponse: true
                },
                needsMoreInfo: [],
                canRecommend: false,
                nextMode: 'clarification',
                metadata: {
                  processingTime: Date.now() - startTime,
                  confidence: 0.9,
                  llmUsed: 'rule-based',
                  alternativeYears: true
                } as any
              };
            }
          }
        }
      }

      // 2.2. Intercept Hard Constraints (FAIL FAST) - 7 seats
      if (updatedProfile.minSeats && updatedProfile.minSeats >= 7 && !context.profile?._waitingForSuggestionResponse) {
        // Search specifically for 7 seaters to check availability
        const results = await vehicleSearchAdapter.search('7 lugares', {
          limit: 20
        });

        // Filter strictly for 7 seaters
        const sevenSeaters = results.filter(r => isSevenSeater(r.vehicle.model || ''));

        if (sevenSeaters.length === 0) {
          const seatsText = updatedProfile.minSeats === 7 ? '7 lugares' : `${updatedProfile.minSeats} lugares`;
          logger.info({ minSeats: updatedProfile.minSeats }, 'Intercepting flow: 7-seater request with no inventory');

          return {
            response: `No momento não temos veículos de ${seatsText} disponíveis no estoque. 🚗\n\nQuer que eu mostre opções de SUVs ou sedans espaçosos de 5 lugares como alternativa?`,
            extractedPreferences: {
              ...extracted.extracted,
              _waitingForSuggestionResponse: true,
              _searchedItem: `veículo de ${seatsText}`
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'clarification',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 1.0,
              llmUsed: 'rule-based',
              noSevenSeaters: true
            } as any
          };
        }
      }

      // 2.3. Intercept Pending Similar Vehicles Approval
      if (context.profile?._waitingForSimilarApproval) {
        const isYes = /sim|claro|pode|quero|manda|gostaria|ok|beleza|sim pode|com certeza/i.test(userMessage);
        const isNo = /n[ãa]o|agora n[ãa]o|depois|nenhum|parar|cancela|deixa/i.test(userMessage);

        if (isYes) {
          const pending = context.profile._pendingSimilarResults || [];
          if (pending.length > 0) {
            const formattedResponse = await this.formatRecommendations(
              pending,
              updatedProfile,
              context,
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
                  bodyType: r.vehicle?.bodyType
                }))
              },
              needsMoreInfo: [],
              canRecommend: true,
              recommendations: pending,
              nextMode: 'recommendation',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.95,
                llmUsed: 'rule-based'
              }
            };
          }
        } else if (isNo || detectUserQuestion(userMessage)) {
          // If user says no or asks something else, clear flag and continue
          updatedProfile._waitingForSimilarApproval = false;

          if (isNo) {
            return {
              response: "Entendido. O que você gostaria de buscar então?",
              extractedPreferences: { ...extracted.extracted, _waitingForSimilarApproval: false },
              canRecommend: false,
              needsMoreInfo: [],
              nextMode: 'discovery',
              metadata: { processingTime: Date.now() - startTime, confidence: 0.9, llmUsed: 'rule-based' }
            }
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
        const tradeInInfo = this.extractTradeInInfo(userMessage);

        if (tradeInInfo.model || tradeInInfo.km) {
          logger.info({ userMessage, tradeInInfo }, 'Processing trade-in vehicle details');

          const vehicleName = `${lastShownVehicles[0].brand} ${lastShownVehicles[0].model} ${lastShownVehicles[0].year}`;
          const tradeInText = [
            tradeInInfo.brand,
            tradeInInfo.model,
            tradeInInfo.year,
            tradeInInfo.km ? `(${tradeInInfo.km.toLocaleString('pt-BR')} km)` : null
          ].filter(Boolean).join(' ');

          return {
            response: `Perfeito! Anotei o ${tradeInText} como carro de troca. 🚗🔄\n\n⚠️ O valor do seu carro depende de uma avaliação presencial.\n\nVou conectar você com um consultor para:\n• Avaliar o ${tradeInText}\n• Apresentar a proposta final para o ${vehicleName}\n• Tirar suas dúvidas\n\n_Digite "vendedor" para falar com nossa equipe!_`,
            extractedPreferences: {
              ...extracted.extracted,
              hasTradeIn: true,
              tradeInBrand: tradeInInfo.brand,
              tradeInModel: tradeInInfo.model,
              tradeInYear: tradeInInfo.year,
              tradeInKm: tradeInInfo.km,
              _awaitingTradeInDetails: false,
              _showedRecommendation: true,
              _lastShownVehicles: lastShownVehicles,
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'negotiation',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.95,
              llmUsed: 'rule-based'
            }
          };
        }
      }

      // 2.53. Handle financing response when awaiting financing details (no trade-in)
      const awaitingFinancingDetails = context.profile?._awaitingFinancingDetails;

      // Only process as financing if NOT waiting for trade-in details
      if (awaitingFinancingDetails && !awaitingTradeInDetails && lastShownVehicles && lastShownVehicles.length > 0) {
        // Check if this message is a financing response (contains entry value)
        if (isFinancingResponse(userMessage, true)) {
          logger.info({ userMessage, awaitingFinancingDetails }, 'Processing financing response with entry value');

          const handlerContext: PostRecommendationContext = {
            userMessage,
            lastShownVehicles: lastShownVehicles as ShownVehicle[],
            lastSearchType,
            extracted,
            updatedProfile,
            context,
            startTime,
          };

          const result = handleFinancingResponse(handlerContext);
          if (result.handled && result.response) {
            return result.response;
          }
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

            return {
              response: `Show! Ter um carro na troca ajuda muito na negociação do ${lastShownVehicles[0].brand} ${lastShownVehicles[0].model} ${lastShownVehicles[0].year}! 🚗🔄\n\nMe conta sobre o seu veículo:\n\n• *Qual carro é?* (ex: Fiat Argo 2019, VW Polo 2020)\n• *Km aproximado*\n\n_Exemplo: "Gol 2018 com 80 mil km"_`,
              extractedPreferences: {
                ...extracted.extracted,
                hasTradeIn: true,
                _awaitingTradeInDetails: true,  // Flag to capture trade-in car details
                _showedRecommendation: true,
                _lastShownVehicles: lastShownVehicles,
              },
              needsMoreInfo: ['tradeInModel', 'tradeInYear'],
              canRecommend: false,
              nextMode: 'negotiation',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.95,
                llmUsed: 'rule-based'
              }
            };
          }

          // Se JÁ TEMOS os dados do carro de troca, encaminhar para vendedor avaliar
          // NÃO fazemos simulação porque o valor do carro de troca depende da avaliação presencial
          const tradeInCar = updatedProfile.tradeInModel
            ? `${capitalizeWords(updatedProfile.tradeInBrand || '')} ${capitalizeWords(updatedProfile.tradeInModel)} ${updatedProfile.tradeInYear || ''}`.trim()
            : `${capitalizeWords(extracted.extracted.tradeInModel || '')} ${extracted.extracted.tradeInYear || ''}`.trim();

          logger.info({ tradeInCar }, 'User provided trade-in car details - routing to seller');

          return {
            response: `Perfeito! O ${tradeInCar} pode entrar na negociação do ${lastShownVehicles[0].brand} ${lastShownVehicles[0].model} ${lastShownVehicles[0].year}! 🚗🔄\n\n⚠️ O valor do seu carro na troca depende de uma avaliação presencial pela nossa equipe.\n\nVou conectar você com um consultor para:\n• Avaliar o ${tradeInCar}\n• Apresentar a proposta final\n• Tirar todas as suas dúvidas\n\n_Digite "vendedor" para falar com nossa equipe!_`,
            extractedPreferences: {
              ...extracted.extracted,
              hasTradeIn: true,
              _awaitingTradeInDetails: false,
              _showedRecommendation: true,
              _lastShownVehicles: lastShownVehicles,
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'negotiation',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.95,
              llmUsed: 'rule-based'
            }
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
                llmUsed: 'rule-based'
              }
            };
          }

          // Se NÃO informou entrada ainda, verificar se tem troca
          // Verificar se usuário já informou carro de troca
          const hasTradeInInfo = updatedProfile.hasTradeIn && updatedProfile.tradeInModel;
          const tradeInText = hasTradeInInfo
            ? (updatedProfile.tradeInYear 
                ? `${capitalizeWords(updatedProfile.tradeInModel)} ${updatedProfile.tradeInYear}` 
                : capitalizeWords(updatedProfile.tradeInModel))
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
                llmUsed: 'rule-based'
              }
            };
          }

          // Se não tem troca, perguntar sobre entrada em dinheiro ou troca
          return {
            response: `Ótimo! Financiamento do ${lastConfig.brand} ${modelName} ${lastConfig.year}! 🏦\n\n💰 *Valor:* R$ ${vehiclePrice.toLocaleString('pt-BR')}\n\nPra encaminhar pro nosso consultor, me conta:\n• Tem algum valor de *entrada*?\n• Ou tem algum *carro pra dar na troca*?\n\n_Exemplo: "10 mil de entrada" ou "tenho um Gol 2018 pra trocar"_`,
            extractedPreferences: {
              ...extracted.extracted,
              wantsFinancing: true,
              _awaitingFinancingDetails: true,  // Flag to catch next message with entry/trade-in
              _showedRecommendation: true,
              _lastShownVehicles: lastShownVehicles,
            },
            needsMoreInfo: ['financingDownPayment', 'tradeIn'],
            canRecommend: false,
            nextMode: 'negotiation',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.95,
              llmUsed: 'rule-based'
            }
          };
        }

        const postRecommendationIntent = detectPostRecommendationIntent(userMessage, lastShownVehicles);

        logger.info({
          userMessage,
          postRecommendationIntent,
          lastSearchType,
          lastShownCount: lastShownVehicles.length
        }, 'Post-recommendation intent detection');

        // PRIORITY: Check if user is asking for a SPECIFIC MODEL not in the shown list
        // e.g., "Não tem HB20?", "Tem Onix?", "E o Civic?"
        const specificModelMatch = exactSearchParser.parse(userMessage);
        if (specificModelMatch.model) {
          // Check if this model was NOT in the shown vehicles
          const modelInShown = lastShownVehicles.some(v => 
            v.model.toLowerCase().includes(specificModelMatch.model!.toLowerCase()) ||
            specificModelMatch.model!.toLowerCase().includes(v.model.toLowerCase())
          );
          
          if (!modelInShown) {
            // User is asking for a different model - do a new search
            logger.info({ 
              requestedModel: specificModelMatch.model, 
              year: specificModelMatch.year,
              shownModels: lastShownVehicles.map(v => v.model)
            }, 'User asking for specific model not in shown list - doing new search');
            
            // Continue to the main search logic below (don't return here, let it fall through)
            // The search logic will handle this as a new model search
          }
        }

        if (postRecommendationIntent === 'want_others' && !(specificModelMatch.model && !lastShownVehicles.some(v => 
            v.model.toLowerCase().includes(specificModelMatch.model!.toLowerCase()) ||
            specificModelMatch.model!.toLowerCase().includes(v.model.toLowerCase())
          ))) {
          // User wants to see other options - search for similar vehicles directly
          logger.info({ userMessage, lastShownVehicles, extractedBudget: extracted.extracted.budget }, 'User wants other options after seeing recommendation');

          const firstVehicle = lastShownVehicles[0];
          const wasSpecificSearch = lastSearchType === 'specific';

          // Get vehicle characteristics
          const referencePrice = firstVehicle.price;
          const userBudget = extracted.extracted.budget || extracted.extracted.budgetMax;
          // Use user budget if provided, otherwise stay within 30% of original price
          let searchMaxPrice = userBudget || Math.round(referencePrice * 1.3);
          let searchMinPrice = Math.round(referencePrice * 0.7); // At least 30% cheaper

          // Check for price adjustment intent
          const msgLower = userMessage.toLowerCase();
          const isCheaper = /barato|em conta|menos|menor|acess[íi]vel|abaixo/i.test(msgLower) && !msgLower.includes('menos caro de manter'); // avoid false positives
          const isExpensive = /caro|alto|melhor|maior|acima|top|premium/i.test(msgLower) && !msgLower.includes('muito caro'); // avoid "achei muito caro" interpreted as wanting expensive

          if (isCheaper) {
            logger.info('User specifically asked for CHEAPER options');
            searchMaxPrice = Math.min(referencePrice, userBudget || referencePrice); // Cap at current price
            searchMinPrice = Math.round(referencePrice * 0.5); // Allow much lower
          } else if (isExpensive) {
            logger.info('User specifically asked for BETTER/MORE EXPENSIVE options');
            searchMinPrice = referencePrice; // Start at current price
            searchMaxPrice = userBudget || Math.round(referencePrice * 1.8); // Allow higher
          }

          const referenceBrand = firstVehicle.brand;
          const referenceModel = firstVehicle.model;
          const referenceYear = firstVehicle.year;
          const referenceBodyType = (firstVehicle as any).bodyType?.toLowerCase() || '';

          // Determine body type for search based on vehicle type or infer from model
          let bodyTypeKeyword = '';
          let vehicleCategory = ''; // compacto, medio, etc.

          if (referenceBodyType.includes('sedan')) {
            bodyTypeKeyword = 'sedan';
          } else if (referenceBodyType.includes('hatch')) {
            bodyTypeKeyword = 'hatch';
          } else if (referenceBodyType.includes('suv')) {
            bodyTypeKeyword = 'suv';
          } else if (referenceBodyType.includes('pickup')) {
            bodyTypeKeyword = 'pickup';
          } else {
            // Infer from known models
            const sedanModels = ['voyage', 'prisma', 'onix plus', 'cronos', 'virtus', 'hb20s', 'city', 'civic', 'corolla', 'yaris sedan', 'logan', 'versa', 'sentra'];
            const hatchModels = ['gol', 'fox', 'up', 'polo', 'onix', 'argo', 'mobi', 'uno', 'hb20', 'kwid', 'sandero', 'march', 'fit', 'ka', 'celta', 'palio'];
            const suvModels = ['tcross', 't-cross', 'nivus', 'tracker', 'creta', 'hrv', 'hr-v', 'kicks', 'duster', 'captur', 'renegade', 'compass', 'tucson', 'tiggo'];

            const modelLower = referenceModel.toLowerCase();
            if (sedanModels.some(m => modelLower.includes(m))) {
              bodyTypeKeyword = 'sedan';
            } else if (hatchModels.some(m => modelLower.includes(m))) {
              bodyTypeKeyword = 'hatch';
            } else if (suvModels.some(m => modelLower.includes(m))) {
              bodyTypeKeyword = 'suv';
            }
          }

          // Determine vehicle category based on price range for more specific search
          // Sedans compactos: Voyage, Prisma, Logan, Versa, HB20S (~35-55k)
          // Sedans médios: Cruze, Focus, Civic, Corolla, Sentra (~55-90k)
          const sedanCompactModels = ['voyage', 'prisma', 'logan', 'versa', 'hb20s', 'cronos', 'virtus', 'onix plus'];
          const sedanMediumModels = ['cruze', 'focus', 'civic', 'corolla', 'sentra', 'jetta', 'city'];
          const modelLower = referenceModel.toLowerCase();

          if (bodyTypeKeyword === 'sedan') {
            if (sedanCompactModels.some(m => modelLower.includes(m)) || referencePrice <= 60000) {
              vehicleCategory = 'compacto';
            } else if (sedanMediumModels.some(m => modelLower.includes(m)) || referencePrice > 60000) {
              vehicleCategory = 'medio';
            }
          } else if (bodyTypeKeyword === 'hatch') {
            if (referencePrice <= 40000) {
              vehicleCategory = 'popular';
            } else {
              vehicleCategory = 'compacto';
            }
          }

          // Build search query focused on same TYPE and CATEGORY of vehicle
          let searchQuery = '';
          if (bodyTypeKeyword && vehicleCategory) {
            searchQuery = `${bodyTypeKeyword} ${vehicleCategory} usado`;
          } else if (bodyTypeKeyword) {
            searchQuery = `${bodyTypeKeyword} usado`;
          } else {
            searchQuery = `carro usado`;
          }

          logger.info({
            searchQuery,
            searchMaxPrice,
            searchMinPrice,
            userBudget,
            referencePrice,
            bodyTypeKeyword,
            referenceBodyType
          }, 'Searching for similar vehicles by type');

          // Search for similar vehicles with same body type
          const similarResults = await vehicleSearchAdapter.search(
            searchQuery,
            {
              maxPrice: searchMaxPrice,
              minYear: referenceYear - 5,
              bodyType: bodyTypeKeyword || undefined,
              limit: 20
            }
          );

          // Filter results to match same body type and exclude already shown
          const shownVehicleIds = lastShownVehicles.map(v => v.vehicleId);
          let newResults = similarResults.filter(r => {
            // Exclude already shown
            if (shownVehicleIds.includes(r.vehicleId)) return false;

            // If we know the body type, filter by it
            if (bodyTypeKeyword && r.vehicle.bodyType) {
              const resultBodyType = r.vehicle.bodyType.toLowerCase();
              if (!resultBodyType.includes(bodyTypeKeyword)) return false;
            }

            return true;
          });

          // Sort by price (most expensive first - benefits dealership)
          newResults.sort((a, b) => b.vehicle.price - a.vehicle.price);

          if (newResults.length > 0) {
            // Found similar vehicles - show them directly
            const formattedResponse = await this.formatRecommendations(
              newResults.slice(0, 5),
              updatedProfile,
              context,
              'similar' // Tipo 'similar' não mostra % match
            );

            const intro = wasSpecificSearch
              ? `Entendi! Aqui estão outras opções similares ao ${referenceBrand} ${referenceModel}:\n\n`
              : `Sem problemas! Encontrei outras opções para você:\n\n`;

            return {
              response: intro + formattedResponse.replace(/^.*?\n\n/, ''), // Remove intro duplicada
              extractedPreferences: {
                ...extracted.extracted,
                _showedRecommendation: true,
                _lastSearchType: 'recommendation' as const,
                _lastShownVehicles: newResults.slice(0, 5).map(r => ({
                  vehicleId: r.vehicleId,
                  brand: r.vehicle.brand,
                  model: r.vehicle.model,
                  year: r.vehicle.year,
                  price: r.vehicle.price
                }))
              },
              needsMoreInfo: [],
              canRecommend: true,
              recommendations: newResults.slice(0, 5),
              nextMode: 'recommendation',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.9,
                llmUsed: 'gpt-4o-mini'
              }
            };
          } else {
            // No similar vehicles found - ask for preferences but KEEP lastShownVehicles to exclude later
            const hasBudget = !!(updatedProfile.budget || updatedProfile.budgetMax);
            const nextQuestion = hasBudget
              ? `Prefere algum tipo específico (SUV, sedan, hatch) ou tem outra marca em mente?`
              : `Qual seu orçamento máximo?`;

            const missingInfo = hasBudget ? ['bodyType', 'brand'] : ['budget', 'bodyType'];

            const noSimilarResponse = `Não encontrei mais opções similares ao ${referenceBrand} ${referenceModel} com esses critérios. 🤔\n\n📋 Me conta: ${nextQuestion}`;

            return {
              response: noSimilarResponse,
              extractedPreferences: {
                ...extracted.extracted,
                _showedRecommendation: false,
                _lastShownVehicles: lastShownVehicles, // MANTER para excluir depois
                _lastSearchType: undefined,
                _waitingForSuggestionResponse: true,
                _excludeVehicleIds: lastShownVehicles.map(v => v.vehicleId) // IDs a excluir
              },
              needsMoreInfo: missingInfo,
              canRecommend: false,
              nextMode: 'discovery',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.8,
                llmUsed: 'gpt-4o-mini'
              }
            };
          }
        }

        // Route to handlers for: want_details, want_schedule, want_financing, want_tradein, acknowledgment
        if (['want_details', 'want_schedule', 'want_financing', 'want_tradein', 'acknowledgment'].includes(postRecommendationIntent)) {
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

            logger.info({
              selectedYear,
              searchedModel,
              availableYears
            }, 'User selected alternative year - returning vehicle directly');

            // Search for the model with selected year
            const results = await vehicleSearchAdapter.search(searchedModel || '', {
              model: searchedModel,
              minYear: selectedYear,
              limit: 5
            });

            // Filter for exact year match
            const matchingResults = results.filter(r => r.vehicle.year === selectedYear);

            if (matchingResults.length > 0) {
              const formattedResponse = await this.formatRecommendations(
                matchingResults,
                { ...updatedProfile, _availableYears: undefined, _waitingForSuggestionResponse: false, _searchedItem: undefined },
                context,
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
                    price: r.vehicle.price
                  }))
                },
                needsMoreInfo: [],
                canRecommend: true,
                recommendations: matchingResults,
                nextMode: 'recommendation',
                metadata: {
                  processingTime: Date.now() - startTime,
                  confidence: 0.95,
                  llmUsed: 'gpt-4o-mini'
                }
              };
            }
          }
        }
      }

      if (wasWaitingForSuggestionResponse) {
        // First, check if user is asking a NEW question or making a new request
        const isNewQuestion = detectUserQuestion(userMessage);
        const hasNewPreferences = Object.keys(extracted.extracted).length > 0 &&
          (extracted.extracted.bodyType || extracted.extracted.brand || extracted.extracted.model || extracted.extracted.budget);

        // Check if user is responding to Uber X/99Pop alternative offer
        const waitingForUberXAlternatives = context.profile?._waitingForUberXAlternatives;
        const userAccepts = detectAffirmativeResponse(userMessage);
        const userDeclines = detectNegativeResponse(userMessage);

        if (waitingForUberXAlternatives && userAccepts) {
          // User accepted Uber X/99Pop alternatives - search for Uber X eligible vehicles
          logger.info('User accepted Uber X/99Pop alternatives - searching Uber X vehicles');
          
          const uberXVehicles = await vehicleSearchAdapter.search('', {
            aptoUber: true,
            limit: 10
          });

          if (uberXVehicles.length > 0) {
            const formattedResponse = await this.formatRecommendations(
              uberXVehicles,
              updatedProfile,
              context,
              'recommendation'
            );

            const intro = `Perfeito! Encontrei ${uberXVehicles.length} veículos aptos para Uber X/99Pop:\n\n`;

            return {
              response: intro + formattedResponse,
              extractedPreferences: {
                ...extracted.extracted,
                _waitingForUberXAlternatives: false,
                _showedRecommendation: true,
                _lastSearchType: 'recommendation' as const,
                _lastShownVehicles: uberXVehicles.map(r => ({
                  vehicleId: r.vehicleId,
                  brand: r.vehicle.brand,
                  model: r.vehicle.model,
                  year: r.vehicle.year,
                  price: r.vehicle.price,
                  bodyType: r.vehicle.bodyType
                }))
              },
              needsMoreInfo: [],
              canRecommend: true,
              recommendations: uberXVehicles,
              nextMode: 'recommendation',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.9,
                llmUsed: 'rule-based'
              }
            };
          } else {
            return {
              response: `Desculpe, no momento também não temos veículos aptos para Uber X/99Pop disponíveis. 😕\n\nPosso te ajudar a encontrar outro tipo de veículo?`,
              extractedPreferences: { ...extracted.extracted, _waitingForUberXAlternatives: false },
              needsMoreInfo: ['budget', 'usage'],
              canRecommend: false,
              nextMode: 'discovery',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.9,
                llmUsed: 'gpt-4o-mini'
              }
            };
          }
        }

        // If user is asking a question or has new preferences, process normally (don't treat as yes/no)
        if (isNewQuestion || hasNewPreferences) {
          logger.info({
            userMessage,
            isNewQuestion,
            hasNewPreferences,
            extracted: extracted.extracted
          }, 'User asked new question while waiting for suggestion response, processing normally');

          // Clear the waiting flag and continue to normal processing
          updatedProfile._waitingForSuggestionResponse = false;
          updatedProfile._searchedItem = undefined;
          updatedProfile._availableYears = undefined;
          updatedProfile._waitingForUberXAlternatives = false;
          // Don't return here - let the flow continue to handle the new question/request
        } else if (userAccepts) {
          const searchedItem = context.profile?._searchedItem;
          const wasLookingForSevenSeater = searchedItem?.includes('lugares') || context.profile?.minSeats;
          const hasAvailableYears = availableYears && availableYears.length > 0;

          logger.info({ userMessage, searchedItem, wasLookingForSevenSeater, hasAvailableYears, availableYears }, 'User accepted suggestion');

          // Se temos anos alternativos disponíveis, mostrar o carro do primeiro ano diretamente
          if (hasAvailableYears && searchedItem) {
            const firstAvailableYear = availableYears[0]; // Ano mais recente

            logger.info({ searchedItem, firstAvailableYear }, 'User accepted to see alternative year - showing vehicle directly');

            // Buscar o veículo do ano alternativo
            const results = await vehicleSearchAdapter.search(searchedItem, {
              model: searchedItem,
              minYear: firstAvailableYear,
              limit: 5
            });

            // Filtrar para o ano específico
            const matchingResults = results.filter(r => r.vehicle.year === firstAvailableYear);

            if (matchingResults.length > 0) {
              const formattedResponse = await this.formatRecommendations(
                matchingResults,
                { ...updatedProfile, _availableYears: undefined, _waitingForSuggestionResponse: false, _searchedItem: undefined },
                context,
                'specific' // Busca específica do ano alternativo
              );

              return {
                response: formattedResponse,
                extractedPreferences: {
                  ...updatedProfile,
                  minYear: firstAvailableYear,
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
                    price: r.vehicle.price
                  }))
                },
                needsMoreInfo: [],
                canRecommend: true,
                recommendations: matchingResults,
                nextMode: 'recommendation',
                metadata: {
                  processingTime: Date.now() - startTime,
                  confidence: 0.95,
                  llmUsed: 'gpt-4o-mini'
                }
              };
            }
          }

          // Se estava procurando 7 lugares, oferecer alternativas espaçosas
          if (wasLookingForSevenSeater) {
            const existingBudget = extracted.extracted.budget || context.profile?.budget;

            // Se já temos orçamento, realizar a busca imediatamente
            if (existingBudget) {
              const altProfile = {
                ...extracted.extracted,
                budget: existingBudget,
                _waitingForSuggestionResponse: false,
                _searchedItem: undefined,
                minSeats: undefined,
                bodyType: 'suv' as const
              };

              const results = await vehicleSearchAdapter.search('suv espaçoso', {
                bodyType: 'suv',
                limit: 5,
                maxPrice: existingBudget
              });

              if (results.length > 0) {
                const formattedResponse = await this.formatRecommendations(results, altProfile, context, 'recommendation');
                return {
                  response: `Entendido! Considerando seu orçamento de R$ ${existingBudget.toLocaleString('pt-BR')}, encontrei estas opções de SUVs espaçosos:\n\n` + formattedResponse,
                  extractedPreferences: altProfile,
                  needsMoreInfo: [],
                  canRecommend: true,
                  recommendations: results,
                  nextMode: 'recommendation',
                  metadata: { processingTime: Date.now() - startTime, confidence: 0.9, llmUsed: 'rule-based' }
                };
              }
            }

            // Caso contrário, pede orçamento
            const altProfile = {
              ...extracted.extracted,
              _waitingForSuggestionResponse: false,
              _searchedItem: undefined,
              minSeats: undefined, // Remover requisito de lugares
              bodyType: 'suv' as const, // Mostrar SUVs espaçosos como alternativa
              priorities: [...(extracted.extracted.priorities || []), 'espaco']
            };

            return {
              response: `Ótimo! Vou te mostrar SUVs e opções espaçosas que temos disponíveis! 🚗\n\n💰 Até quanto você pretende investir?`,
              extractedPreferences: altProfile,
              needsMoreInfo: ['budget'],
              canRecommend: false,
              nextMode: 'clarification',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.9,
                llmUsed: 'gpt-4o-mini'
              }
            };
          }

          // Start asking questions to build profile for suggestions
          return {
            response: `Ótimo! Vou te fazer algumas perguntas rápidas para encontrar o carro ideal pra você. 🚗\n\n💰 Até quanto você pretende investir no carro?`,
            extractedPreferences: { ...extracted.extracted, _waitingForSuggestionResponse: false, _searchedItem: undefined },
            needsMoreInfo: ['budget', 'usage'],
            canRecommend: false,
            nextMode: 'discovery',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.9,
              llmUsed: 'gpt-4o-mini'
            }
          };
        } else if (userDeclines) {
          // User explicitly declined
          return {
            response: `Sem problemas! 🙂 Se mudar de ideia ou quiser ver outros veículos, é só me chamar!`,
            extractedPreferences: { ...extracted.extracted, _waitingForSuggestionResponse: false, _searchedItem: undefined },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'discovery',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.8,
              llmUsed: 'gpt-4o-mini'
            }
          };
        }
        // If neither yes nor no, continue processing normally
        updatedProfile._waitingForSuggestionResponse = false;
        updatedProfile._searchedItem = undefined;
        updatedProfile._waitingForUberXAlternatives = false;
      }

      // 3. Check if user mentioned specific model (e.g., "Spin", "Civic") or brand (e.g., "Jeep")
      // Also check for model+year using exactSearchParser for precise matching
      const hasSpecificModel = !!(extracted.extracted.model || extracted.extracted.brand);

      // Parse user message for exact model+year search
      const exactFilters = exactSearchParser.parse(userMessage);
      const hasExactModelYear = !!(exactFilters.model && (exactFilters.year || exactFilters.yearRange));

      if ((hasSpecificModel || hasExactModelYear) && !userMessage.match(/parecid|similar|tipo\s|estilo|como\s|igual/i)) {
        const requestedBrand = extracted.extracted.brand?.toLowerCase();
        const requestedModel = (exactFilters.model || extracted.extracted.model)?.toLowerCase();
        const requestedYear = exactFilters.year;
        const requestedYearRange = exactFilters.yearRange;

        logger.info({
          brand: requestedBrand,
          model: requestedModel,
          year: requestedYear,
          yearRange: requestedYearRange,
          hasExactModelYear
        }, 'VehicleExpert: Specific model/brand/year mentioned, searching directly');

        // Search for specific model/brand - the adapter will use ExactSearchService if year is detected
        const result = await this.getRecommendations(updatedProfile);

        // Filter results to only include vehicles that ACTUALLY match the requested brand/model/year
        const matchingResults = result.recommendations.filter(rec => {
          const vehicleBrand = rec.vehicle.brand?.toLowerCase() || '';
          const vehicleModel = rec.vehicle.model?.toLowerCase() || '';
          const vehicleYear = rec.vehicle.year;

          // If user requested a specific brand, vehicle must match that brand
          if (requestedBrand && !vehicleBrand.includes(requestedBrand)) {
            return false;
          }

          // If user requested a specific model, vehicle must match that model
          if (requestedModel && !vehicleModel.includes(requestedModel)) {
            return false;
          }

          // If user requested a specific year, vehicle must match that year EXACTLY
          if (requestedYear && vehicleYear !== requestedYear) {
            return false;
          }

          // If user requested a year range, vehicle must be within range
          if (requestedYearRange && (vehicleYear < requestedYearRange.min || vehicleYear > requestedYearRange.max)) {
            return false;
          }

          return true;
        });

        logger.info({
          totalResults: result.recommendations.length,
          matchingResults: matchingResults.length,
          requestedBrand,
          requestedModel,
          requestedYear
        }, 'VehicleExpert: Filtered results for specific brand/model/year');

        if (matchingResults.length > 0) {
          const formattedResponse = await this.formatRecommendations(
            matchingResults,
            updatedProfile,
            context,
            'specific' // Usuário pediu modelo/ano específico
          );

          return {
            response: formattedResponse,
            extractedPreferences: {
              ...extracted.extracted,
              _showedRecommendation: true,
              _lastSearchType: 'specific' as const,
              _lastShownVehicles: matchingResults.map(r => ({
                vehicleId: r.vehicleId,
                brand: r.vehicle.brand,
                model: r.vehicle.model,
                year: r.vehicle.year,
                price: r.vehicle.price
              }))
            },
            needsMoreInfo: [],
            canRecommend: true,
            recommendations: matchingResults,
            nextMode: 'recommendation',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.9,
              llmUsed: 'gpt-4o-mini'
            }
          };
        } else {
          // Model/brand/year not found in inventory
          // Try to get model from various sources, with fallback to extracting from user message
          let searchedItem = requestedModel || extracted.extracted.model || extracted.extracted.brand;

          // If still no model found, try to extract from user message (words that aren't years)
          if (!searchedItem) {
            const wordsFromMessage = userMessage.toLowerCase()
              .replace(/\d{4}/g, '') // Remove 4-digit years
              .replace(/\b(um|uma|o|a|de|do|da|para|pra|quero|tem|tenho|busco|procuro)\b/gi, '') // Remove common words
              .trim()
              .split(/\s+/)
              .filter(w => w.length > 2)[0]; // Get first meaningful word
            searchedItem = wordsFromMessage ? capitalize(wordsFromMessage) : null;
          }

          const yearText = requestedYear ? ` ${requestedYear}` : (requestedYearRange ? ` ${requestedYearRange.min}-${requestedYearRange.max}` : '');

          // Check if we have the model but not the year - offer year alternatives
          if (requestedYear && requestedModel) {
            const sameModelResults = result.recommendations.filter(rec => {
              const vehicleModel = rec.vehicle.model?.toLowerCase() || '';
              return vehicleModel.includes(requestedModel);
            });

            if (sameModelResults.length > 0) {
              const availableYears = [...new Set(sameModelResults.map(r => r.vehicle.year))].sort((a, b) => b - a);
              const yearsText = availableYears.slice(0, 5).join(', ');
              const isPlural = availableYears.length > 1;

              const yearAlternativeResponse = `Não encontramos ${capitalize(searchedItem)}${yearText} disponível. 😕

Temos ${capitalize(searchedItem)} ${isPlural ? 'dos anos' : 'do ano'}: ${yearsText}

Gostaria de ver ${isPlural ? 'algum desses' : 'esse'}?`;

              return {
                response: yearAlternativeResponse,
                extractedPreferences: { ...extracted.extracted, _waitingForSuggestionResponse: true, _searchedItem: searchedItem, _availableYears: availableYears },
                needsMoreInfo: [],
                canRecommend: false,
                nextMode: 'clarification',
                metadata: {
                  processingTime: Date.now() - startTime,
                  confidence: 0.8,
                  llmUsed: 'gpt-4o-mini'
                }
              };
            }
          }
          // Build response message with proper fallback
          const vehicleDescription = searchedItem
            ? `${capitalize(searchedItem)}${yearText}`
            : `esse modelo${yearText}`;

          // Before saying "not found", try to find similar vehicles of the same type
          // Infer body type from model name for pickup models like Saveiro, Strada, S10
          const pickupModels = ['saveiro', 'strada', 's10', 'montana', 'hilux', 'ranger', 'toro', 'amarok', 'l200', 'frontier', 'triton', 'oroch'];
          const sedanModels = ['voyage', 'prisma', 'cronos', 'virtus', 'hb20s', 'city', 'civic', 'corolla', 'logan', 'versa', 'sentra', 'cruze', 'focus'];
          const suvModels = ['tcross', 't-cross', 'nivus', 'tracker', 'creta', 'hrv', 'hr-v', 'kicks', 'duster', 'captur', 'renegade', 'compass', 'ecosport'];
          const hatchModels = ['gol', 'polo', 'onix', 'argo', 'mobi', 'uno', 'hb20', 'kwid', 'sandero', 'ka', 'celta', 'palio', 'fox', 'up'];

          const modelLower = (searchedItem || '').toLowerCase();
          let inferredBodyType = '';
          let bodyTypeName = '';

          if (pickupModels.some(m => modelLower.includes(m))) {
            inferredBodyType = 'pickup';
            bodyTypeName = 'pickups';
          } else if (sedanModels.some(m => modelLower.includes(m))) {
            inferredBodyType = 'sedan';
            bodyTypeName = 'sedans';
          } else if (suvModels.some(m => modelLower.includes(m))) {
            inferredBodyType = 'suv';
            bodyTypeName = 'SUVs';
          } else if (hatchModels.some(m => modelLower.includes(m))) {
            inferredBodyType = 'hatch';
            bodyTypeName = 'hatches';
          }

          // If we inferred a body type, search for similar vehicles
          if (inferredBodyType) {
            logger.info({ searchedItem, inferredBodyType }, 'Searching for similar vehicles of same type');

            const similarResults = await vehicleSearchAdapter.search(
              `${inferredBodyType} usado`,
              {
                bodyType: inferredBodyType,
                limit: 10
              }
            );

            if (similarResults.length > 0) {
              // Sort by price (cheapest first) to be friendly to budget-conscious buyers
              similarResults.sort((a, b) => a.vehicle.price - b.vehicle.price);

              const firstPrice = similarResults[0].vehicle.price.toLocaleString('pt-BR', { minimumFractionDigits: 0 });

              const intro = `Não temos ${vehicleDescription} disponível no momento. 😕\n\nMas encontrei algumas opções de ${bodyTypeName || inferredBodyType} similares (a partir de R$ ${firstPrice}).\n\nGostaria de ver essas opções?`;

              return {
                response: intro,
                extractedPreferences: {
                  ...extracted.extracted,
                  _waitingForSimilarApproval: true,
                  _pendingSimilarResults: similarResults.slice(0, 5) // Store pending results
                },
                needsMoreInfo: [],
                canRecommend: false,
                nextMode: 'clarification',
                metadata: {
                  processingTime: Date.now() - startTime,
                  confidence: 0.85,
                  llmUsed: 'gpt-4o-mini'
                }
              };
            }
          }

          // If no similar vehicles found, fall back to asking for preferences
          const notFoundResponse = `Não temos ${vehicleDescription} disponível no estoque no momento. 😕

Quer responder algumas perguntas rápidas para eu te dar sugestões personalizadas?`;

          return {
            response: notFoundResponse,
            extractedPreferences: { ...extracted.extracted, _waitingForSuggestionResponse: true, _searchedItem: searchedItem },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'clarification',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.8,
              llmUsed: 'gpt-4o-mini'
            }
          };
        }
      }

      // 4. Detect if user asked a question (vs just answering)
      const isUserQuestion = detectUserQuestion(userMessage);

      // 5. Route based on question detection
      if (isUserQuestion) {
        // Check if it's a question about vehicle availability (e.g., "qual pickup você tem?")
        const availabilityKeywords = ['tem', 'têm', 'disponível', 'disponivel', 'estoque', 'vocês', 'voces'];
        const vehicleTypeKeywords = ['pickup', 'picape', 'suv', 'sedan', 'hatch', 'caminhonete'];
        const messageLower = userMessage.toLowerCase();

        const isAvailabilityQuestion = availabilityKeywords.some(kw => messageLower.includes(kw)) &&
          vehicleTypeKeywords.some(kw => messageLower.includes(kw));

        if (isAvailabilityQuestion) {
          // Detect which vehicle type user is asking about
          const askedBodyType = vehicleTypeKeywords.find(kw => messageLower.includes(kw));
          const normalizedBodyType = (askedBodyType === 'picape' || askedBodyType === 'caminhonete' ? 'pickup' : askedBodyType) as 'sedan' | 'hatch' | 'suv' | 'pickup' | 'minivan' | undefined;

          logger.info({ userMessage, askedBodyType: normalizedBodyType }, 'User asking about vehicle availability');

          // Para perguntas de disponibilidade, buscar DIRETO por categoria (sem filtros extras)
          const categoryResults = await vehicleSearchAdapter.search(`${normalizedBodyType}`, {
            bodyType: normalizedBodyType,
            limit: 5,  // Retornar até 5 veículos da categoria
          });

          if (categoryResults.length === 0) {
            const categoryName = askedBodyType === 'pickup' || askedBodyType === 'picape' ? 'picapes' :
              askedBodyType === 'suv' ? 'SUVs' :
                askedBodyType === 'sedan' ? 'sedans' :
                  askedBodyType === 'hatch' ? 'hatches' :
                    `${askedBodyType}s`;

            return {
              response: `No momento não temos ${categoryName} disponíveis no estoque. 😕\n\nQuer que eu busque outras opções para você?`,
              extractedPreferences: { ...extracted.extracted, bodyType: normalizedBodyType, _waitingForSuggestionResponse: true },
              needsMoreInfo: [],
              canRecommend: false,
              nextMode: 'clarification',
              metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.9,
                llmUsed: 'gpt-4o-mini'
              }
            };
          }

          // Found vehicles - format for category availability response
          const categoryName = askedBodyType === 'pickup' || askedBodyType === 'picape' ? 'picapes' :
            askedBodyType === 'suv' ? 'SUVs' :
              askedBodyType === 'sedan' ? 'sedans' :
                askedBodyType === 'hatch' ? 'hatches' :
                  `${askedBodyType}s`;

          const intro = `Temos ${categoryResults.length} ${categoryName} disponíveis! 🚗\n\n`;
          const vehicleList = categoryResults.map((rec, i) => {
            const v = rec.vehicle;
            const emoji = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : '⭐';
            return `${emoji} ${v.brand} ${v.model} ${v.year}\n` +
              `   💰 R$ ${v.price.toLocaleString('pt-BR')}\n` +
              `   📍 ${v.mileage.toLocaleString('pt-BR')}km`;
          }).join('\n\n');

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
                price: r.vehicle.price
              }))
            },
            needsMoreInfo: [],
            canRecommend: true,
            recommendations: categoryResults,
            nextMode: 'recommendation',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.9,
              llmUsed: 'gpt-4o-mini'
            }
          };
        }

        // Regular question - Answer using RAG
        const answer = await this.answerQuestion(userMessage, context, updatedProfile);

        return {
          response: answer,
          extractedPreferences: extracted.extracted,
          needsMoreInfo: this.identifyMissingInfo(updatedProfile),
          canRecommend: false,
          nextMode: context.mode, // Stay in current mode
          metadata: {
            processingTime: Date.now() - startTime,
            confidence: extracted.confidence,
            llmUsed: 'gpt-4o-mini'
          }
        };
      }

      // 6. Assess if we're ready to recommend
      const readiness = this.assessReadiness(updatedProfile, context);

      if (readiness.canRecommend) {
        // Check recent messages for pickup keywords before recommendations
        const pickupKeywords = ['pickup', 'picape', 'caminhonete', 'caçamba', 'cacamba', 'carga', 'obra', 'material', 'construção', 'construcao', 'carregar', 'entulho'];
        const recentMessages = context.messages.slice(-5).map(m => m.content.toLowerCase()).join(' ');
        const hasPickupInMessages = pickupKeywords.some(kw => recentMessages.includes(kw));

        // If pickup detected in messages but not in profile, add it
        if (hasPickupInMessages && !updatedProfile.bodyType) {
          logger.info({ recentMessages: recentMessages.substring(0, 100) }, 'Pickup detected in recent messages, adding to profile');
          updatedProfile.bodyType = 'pickup';
          if (!updatedProfile.priorities) {
            updatedProfile.priorities = ['pickup'];
          } else if (!updatedProfile.priorities.includes('pickup')) {
            updatedProfile.priorities.push('pickup');
          }
        }

        // Generate recommendations
        const result = await this.getRecommendations(updatedProfile);

        // Se não encontrou pickups, oferecer sugestões alternativas
        if (result.noPickupsFound) {
          const noPickupResponse = `No momento não temos pickups disponíveis no estoque. 🛻

Quer responder algumas perguntas rápidas para eu te dar sugestões personalizadas?`;

          return {
            response: noPickupResponse,
            extractedPreferences: { ...extracted.extracted, _waitingForSuggestionResponse: true, _searchedItem: 'pickup' },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'clarification',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.9,
              llmUsed: 'gpt-4o-mini',
              noPickupsFound: true
            }
          };
        }

        // Se não encontrou veículos de 7 lugares, informar e perguntar se quer alternativas
        if (result.noSevenSeaters) {
          const seatsText = result.requiredSeats === 7 ? '7 lugares' : `${result.requiredSeats} lugares`;
          const noSevenSeaterResponse = `No momento não temos veículos de ${seatsText} disponíveis no estoque. 🚗

Quer que eu mostre opções de SUVs ou sedans espaçosos de 5 lugares como alternativa?`;

          return {
            response: noSevenSeaterResponse,
            extractedPreferences: { ...extracted.extracted, _waitingForSuggestionResponse: true, _searchedItem: `veículo de ${seatsText}` },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'clarification',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.9,
              llmUsed: 'gpt-4o-mini',
              noSevenSeaters: true
            }
          };
        }

        // Filter out previously shown vehicles if we have exclusion list
        let filteredRecommendations = result.recommendations;

        // Combine exclusion sources: explicit excludeIds + lastShownVehicles
        const excludeFromList = context.profile?._excludeVehicleIds || [];
        const excludeFromShown = (context.profile?._lastShownVehicles || []).map(v => v.vehicleId);
        const allExcludeIds = [...new Set([...excludeFromList, ...excludeFromShown])];

        if (allExcludeIds.length > 0) {
          logger.info({ allExcludeIds, excludeFromList, excludeFromShown }, 'Excluding previously shown vehicles from recommendations');
          filteredRecommendations = result.recommendations.filter(
            r => !allExcludeIds.includes(r.vehicleId)
          );
        }

        // If all recommendations were filtered out, try to get more without the exclusion
        if (filteredRecommendations.length === 0 && result.recommendations.length > 0) {
          filteredRecommendations = result.recommendations; // Use original if nothing left
          logger.warn({ allExcludeIds }, 'All recommendations were excluded, showing original results');
        }

        const formattedResponse = await this.formatRecommendations(
          filteredRecommendations,
          updatedProfile,
          context,
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
              price: r.vehicle.price
            })),
            _excludeVehicleIds: undefined // Limpar após usar
          },
          needsMoreInfo: [],
          canRecommend: true,
          recommendations: filteredRecommendations,
          nextMode: 'recommendation',
          metadata: {
            processingTime: Date.now() - startTime,
            confidence: readiness.confidence,
            llmUsed: 'gpt-4o-mini'
          }
        };
      }

      // 7. Continue conversation - ask next contextual question
      const nextQuestion = await this.generateNextQuestion({
        profile: updatedProfile,
        missingFields: readiness.missingRequired,
        context: this.summarizeContext(context)
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
          llmUsed: 'gpt-4o-mini'
        }
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
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  // NOTE: Intent detection methods (detectSearchIntent, detectUserQuestion,
  // detectAffirmativeResponse, detectNegativeResponse, detectPostRecommendationIntent)
  // have been moved to ./vehicle-expert/intent-detector.ts

  /**
   * Answer user's question using RAG
   * @deprecated Use answerQuestion from './vehicle-expert/processors' instead
   */
  private async answerQuestion(
    question: string,
    context: ConversationContext,
    profile: Partial<CustomerProfile>
  ): Promise<string> {
    return answerQuestionUtil(question, context, profile);
  }

  /**
   * Generate next contextual question to ask the user
   * @deprecated Use generateNextQuestion from './vehicle-expert/processors' instead
   */
  private async generateNextQuestion(
    options: QuestionGenerationOptions
  ): Promise<string> {
    return generateNextQuestionUtil(options);
  }

  /**
   * Get vehicle recommendations based on profile
   * Returns { recommendations, noPickupsFound, noSevenSeaters } to indicate if category was not found
   */
  private async getRecommendations(
    profile: Partial<CustomerProfile>
  ): Promise<{ recommendations: VehicleRecommendation[], noPickupsFound?: boolean, wantsPickup?: boolean, noSevenSeaters?: boolean, requiredSeats?: number }> {
    try {
      // Build search query
      const query = this.buildSearchQuery(profile);

      // Detect Uber requirements from profile
      const isUberBlack = profile.usoPrincipal === 'uber' &&
        (profile.priorities?.includes('uber_black') ||
          profile.priorities?.includes('black') ||
          profile.tipoUber === 'black');

      const isUberX = profile.usoPrincipal === 'uber' && !isUberBlack;

      // Detect family requirements (only if explicitly mentioned, not just by people count)
      const isFamily = profile.usoPrincipal === 'familia' ||
        profile.priorities?.includes('familia') ||
        profile.priorities?.includes('cadeirinha') ||
        profile.priorities?.includes('crianca');

      // Detect pickup/work requirements - check profile, search text AND context messages
      const pickupKeywords = ['pickup', 'picape', 'caminhonete', 'caçamba', 'cacamba', 'carga', 'obra', 'material', 'construção', 'construcao', 'carregar', 'entulho'];
      const searchTextLower = query.searchText.toLowerCase();
      const hasPickupInText = pickupKeywords.some(kw => searchTextLower.includes(kw));

      // Also check profile usoPrincipal and usage for work-related terms
      const usageText = `${profile.usoPrincipal || ''} ${profile.usage || ''}`.toLowerCase();
      const hasWorkUsage = usageText.includes('trabalho') || usageText.includes('obra');

      // Check priorities array for any pickup-related terms
      const prioritiesText = (profile.priorities || []).join(' ').toLowerCase();
      const hasPickupInPriorities = pickupKeywords.some(kw => prioritiesText.includes(kw));

      const wantsPickup = profile.bodyType === 'pickup' ||
        hasPickupInText ||
        hasPickupInPriorities ||
        (hasWorkUsage && pickupKeywords.some(kw => usageText.includes(kw)));

      logger.info({
        wantsPickup,
        bodyType: profile.bodyType,
        searchTextLower,
        hasPickupInText,
        usageText,
        hasWorkUsage
      }, 'Pickup detection check');

      const isWork = profile.usoPrincipal === 'trabalho' ||
        profile.usage === 'trabalho' ||
        profile.priorities?.includes('trabalho');

      // Search vehicles - include brand/model filter for specific requests
      const results = await vehicleSearchAdapter.search(query.searchText, {
        maxPrice: query.filters.maxPrice,
        minYear: query.filters.minYear,
        bodyType: wantsPickup ? 'pickup' : query.filters.bodyType?.[0],
        brand: query.filters.brand?.[0], // Filtrar por marca quando especificada
        model: query.filters.model?.[0], // Filtrar por modelo quando especificado
        limit: 10, // Get more to filter
        // Apply Uber filters
        aptoUber: isUberX || undefined,
        aptoUberBlack: isUberBlack || undefined,
        // Apply family filter (only if family, not for pickup/work)
        aptoFamilia: (isFamily && !wantsPickup) || undefined,
        // Apply work filter
        aptoTrabalho: isWork || undefined,
      });

      // Se não encontrou pickups e o usuário quer pickup, informar
      if (wantsPickup && results.length === 0) {
        logger.info({ profile }, 'No pickups found in inventory');
        return { recommendations: [], noPickupsFound: true, wantsPickup: true };
      }

      // Post-filter: apply minimum seats requirement (RIGOROSO)
      const requiredSeats = profile.minSeats;
      if (requiredSeats && requiredSeats >= 7) {
        logger.info({ requiredSeats, resultsBeforeFilter: results.length }, 'Filtering for 7+ seat vehicles');

        // Filtrar APENAS veículos de 7 lugares
        const sevenSeaterResults = results.filter(rec => {
          const modelLower = (rec.vehicle.model || '').toLowerCase();
          return isSevenSeater(modelLower);
        });

        logger.info({
          requiredSeats,
          sevenSeaterResults: sevenSeaterResults.length,
          filteredModels: sevenSeaterResults.map(r => r.vehicle.model)
        }, 'Seven seater filter results');

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
        const hasCadeirinha = profile.priorities?.includes('cadeirinha') ||
          profile.priorities?.includes('crianca');
        const peopleCount = profile.people || 4;

        filteredResults = results.filter(rec => {
          const model = rec.vehicle.model?.toLowerCase() || '';
          const bodyType = rec.vehicle.bodyType?.toLowerCase() || '';

          // NUNCA para família: hatch compactos/subcompactos
          const neverForFamily = ['mobi', 'kwid', 'up!', 'uno', 'ka', 'march', 'sandero'];
          if (neverForFamily.some(n => model.includes(n))) {
            return false;
          }

          // Com cadeirinha: precisa de mais espaço
          if (hasCadeirinha) {
            // Ideais para 2 cadeirinhas: SUVs, Sedans médios/grandes, Minivans
            const idealForCadeirinha = [
              // SUVs compactos bons
              'creta', 'kicks', 't-cross', 'tcross', 'tracker', 'hr-v', 'hrv', 'renegade',
              // SUVs médios (excelentes)
              'tucson', 'compass', 'corolla cross', 'tiguan', 'sw4', 'trailblazer', 'commander',
              // Sedans médios/grandes (muito bons)
              'corolla', 'civic', 'cruze', 'sentra', 'jetta', 'virtus',
              // Sedans compactos (aceitáveis)
              'hb20s', 'onix plus', 'cronos', 'voyage', 'prisma',
              // Minivans (excelentes)
              'spin', 'livina', 'zafira'
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
            return bodyType.includes('suv') || bodyType.includes('sedan') || bodyType.includes('minivan');
          });

          if (filteredResults.length < 3) {
            filteredResults = results.slice(0, 5);
          }
        }
      }

      logger.info({
        profileKeys: Object.keys(profile),
        resultsCount: filteredResults.length,
        isUberBlack,
        isUberX,
        isFamily,
        wantsPickup
      }, 'Generated recommendations');

      return { recommendations: filteredResults.slice(0, 5), wantsPickup };

    } catch (error) {
      logger.error({ error, profile }, 'Failed to get recommendations');
      return { recommendations: [] };
    }
  }

  /**
   * Format recommendations into natural language message
   * @deprecated Use formatRecommendations from './vehicle-expert/formatters' instead
   */
  private async formatRecommendations(
    recommendations: VehicleRecommendation[],
    profile: Partial<CustomerProfile>,
    context: ConversationContext,
    searchType: 'specific' | 'similar' | 'recommendation' = 'recommendation'
  ): Promise<string> {
    return formatRecommendationsUtil(recommendations, profile, searchType);
  }

  /**
   * Generate intro for recommendations based on profile and search type
   * @deprecated Use generateRecommendationIntro from './vehicle-expert/formatters' instead
   */
  private generateRecommendationIntro(
    profile: Partial<CustomerProfile>,
    count: number,
    searchType: 'specific' | 'similar' | 'recommendation' = 'recommendation',
    firstVehicle?: { brand: string; model: string; year: number }
  ): string {
    return generateRecommendationIntroUtil(profile, count, searchType, firstVehicle);
  }

  /**
   * Build search query from profile
   * @deprecated Use buildSearchQuery from './vehicle-expert/builders' instead
   */
  private buildSearchQuery(profile: Partial<CustomerProfile>): VehicleSearchQuery {
    return buildSearchQueryUtil(profile);
  }

  /**
   * Assess if we have enough information to recommend vehicles
   * @deprecated Use assessReadiness from './vehicle-expert/assessors' instead
   */
  private assessReadiness(
    profile: Partial<CustomerProfile>,
    context: ConversationContext
  ): ReadinessAssessment {
    return assessReadinessUtil(profile, context);
  }

  /**
   * Identify what information is still missing
   * @deprecated Use identifyMissingInfo from './vehicle-expert/assessors' instead
   */
  private identifyMissingInfo(profile: Partial<CustomerProfile>): string[] {
    return identifyMissingInfoUtil(profile);
  }

  /**
   * Summarize conversation context for LLM
   * @deprecated Use summarizeContext from './vehicle-expert/assessors' instead
   */
  private summarizeContext(context: ConversationContext): string {
    return summarizeContextUtil(context);
  }
}

// Singleton export
export const vehicleExpert = new VehicleExpertAgent();
