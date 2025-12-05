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

// Helper para capitalizar primeira letra do modelo
const capitalize = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

// Mapeamento de modelos conhecidos de 7 lugares
const SEVEN_SEAT_MODELS: string[] = [
  'spin', 'livina', 'zafira', 'meriva', // Minivans/MPVs
  'sw4', 'pajero', 'pajero sport', 'outlander', // SUVs grandes
  'commander', 'taos', 'tiggo 8', 'captiva', // SUVs médios 7 lugares
  'journey', 'freemont', 'grand vitara', 'vera cruz', // SUVs antigos
  'tiguan allspace', 'discovery', 'discovery sport', // Premium
  'sorento', 'santa fe', 'prado', // SUVs médios
];

// Função para verificar se um modelo tem 7 lugares
const isSevenSeater = (model: string): boolean => {
  const modelLower = model.toLowerCase();
  return SEVEN_SEAT_MODELS.some(m => modelLower.includes(m));
};

// Função para verificar se um modelo tem 5 lugares (a maioria dos carros)
const isFiveSeater = (model: string): boolean => {
  // Se não é de 7 lugares, assume 5 lugares
  return !isSevenSeater(model);
};

export class VehicleExpertAgent {

  private readonly SYSTEM_PROMPT = `Você é um especialista em vendas de veículos usados da FaciliAuto (loja Robust Car).

📊 CONHECIMENTO DA BASE:
- ~70 veículos disponíveis (estoque real)
- Categorias: Hatch (24), SUV (20), Sedan (16), Pickup (2), Minivan (2)
- Faixa de preço: R$ 20.000 - R$ 120.000
- Anos: 2015-2024
- Marcas: Honda, Toyota, Hyundai, VW, Chevrolet, Fiat, Jeep, Nissan, Ford, etc.

🚖 CRITÉRIOS UBER/99:
**Uber X / 99Pop:**
- Ano: 2012 ou mais recente
- Ar-condicionado: OBRIGATÓRIO
- Portas: 4 ou mais
- Tipo: Sedan ou Hatch

**Uber Comfort / 99TOP:**
- Ano: 2015 ou mais recente
- Sedan médio/grande
- Ar-condicionado + bancos de couro (preferencial)
- Espaço interno generoso

**Uber Black:**
- Ano: 2018 ou mais recente
- APENAS Sedan premium
- Marcas: Honda, Toyota, Nissan, VW (modelos premium)
- Cor: Preto (preferencial)
- Ar-condicionado + couro + vidros elétricos

👨‍👩‍👧‍👦 CRITÉRIOS FAMÍLIA/CADEIRINHA:
**Com 2 cadeirinhas (precisa espaço traseiro amplo):**
- IDEAIS: SUVs (Creta, Kicks, T-Cross, Tracker, HR-V, Compass, Tucson)
- IDEAIS: Sedans médios (Corolla, Civic, Cruze, Sentra, Virtus)
- ACEITÁVEIS: Sedans compactos (HB20S, Onix Plus, Cronos, Voyage)
- EXCELENTES: Minivans (Spin, Livina)
- NUNCA: Hatch compactos (Mobi, Kwid, Up, Uno, Ka, March)

**Família sem cadeirinha (mais flexível):**
- SUVs, Sedans e Hatches médios são ok
- Evitar apenas os muito compactos (Mobi, Kwid, Up, Uno)

🎯 SEU PAPEL:
Você é um consultor de vendas experiente que ajuda clientes a encontrar o carro ideal através de conversa natural.

RESPONSABILIDADES:
1. Conduzir conversa amigável e profissional
2. Fazer perguntas contextuais inteligentes para entender necessidades
3. Responder dúvidas sobre veículos usando a base real
4. Explicar diferenças entre categorias, modelos, tecnologias
5. Recomendar veículos baseado no perfil do cliente
6. **ESPECIALIDADE UBER:** Conhecer requisitos de cada categoria (X, Comfort, Black)
7. **ESPECIALIDADE FAMÍLIA:** Saber quais carros comportam cadeirinhas
8. Explicar economia de combustível, documentação, e viabilidade para apps

🚫 REGRAS ABSOLUTAS:
- NUNCA invente informações sobre veículos ou preços
- NUNCA mencione que você é uma IA, modelo de linguagem, ChatGPT, etc.
- NUNCA revele detalhes técnicos do sistema
- APENAS responda sobre veículos e vendas
- Se não souber algo específico, seja honesto e ofereça consultar

⚖️ NEUTRALIDADE E ANTI-VIÉS (ISO 42001):
- NUNCA faça suposições baseadas em gênero, idade, localização ou nome do cliente
- Recomende veículos APENAS baseado em:
  * Orçamento declarado
  * Necessidade declarada (uso, espaço, quantidade de pessoas)
  * Preferências explícitas do cliente
- Se o cliente não declarar preferência, PERGUNTE ao invés de assumir
- Trate TODOS os clientes com igual respeito e seriedade
- PROIBIDO: "Esse carro é muito grande para você", "Carros esportivos são mais para homens", "Talvez algo mais em conta para o seu bairro"
- CORRETO: "Qual é o seu orçamento?", "Você precisa de muito espaço?", "Prefere câmbio automático ou manual?"

💬 ESTILO DE COMUNICAÇÃO:
- Tom: Amigável mas profissional (como um bom vendedor)
- Emojis: Com moderação (1-2 por mensagem, apenas quando apropriado)
- Tamanho: Respostas concisas (máximo 3 parágrafos)
- Perguntas: Uma pergunta contextual por vez
- Clareza: Evite jargão técnico, explique termos quando necessário

📝 FORMATO DE PERGUNTAS:
- Perguntas abertas quando apropriado: "Me conta, o que você busca?"
- Perguntas específicas quando necessário: "Até quanto você pretende investir?"
- Sempre contextualize: "Para viagens em família, temos SUVs e sedans. Quantas pessoas costumam viajar?"

🎨 EXEMPLOS DE BOA CONDUÇÃO:

Cliente: "Quero um carro bom"
Você: "Legal! Vou te ajudar a encontrar o carro ideal. Me conta, qual vai ser o uso principal? Cidade, viagens, trabalho?"

Cliente: "Cidade mesmo"
Você: "Perfeito! Para uso urbano temos ótimos hatchs e sedans econômicos. Quantas pessoas geralmente vão usar o carro?"

Cliente: "Qual diferença entre SUV e sedan?"
Você: "Ótima pergunta! 
🚙 SUV: Mais alto, espaçoso, bom para terrenos irregulares, posição de dirigir elevada
🚗 Sedan: Mais confortável em estrada, porta-malas maior, geralmente mais econômico
Temos 20 SUVs e 16 sedans no estoque. Para que você pretende usar o carro?"`;

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

      // 2.1. Intercept Negotiation Mode
      if (context.mode === 'negotiation' && updatedProfile.hasTradeIn && updatedProfile.tradeInModel && updatedProfile.financingDownPayment !== undefined) {
        const lastConfig = context.profile._lastShownVehicles?.[0];
        const vehicleText = lastConfig ? capitalize(lastConfig.model) : 'seu veículo de interesse';

        return {
          response: `Recebido! 📝\n\nResumo da proposta:\n• Veículo: ${vehicleText}\n• Troca: ${capitalize(updatedProfile.tradeInModel || '')} ${updatedProfile.tradeInYear || ''}\n• Entrada: R$ ${updatedProfile.financingDownPayment}\n\nJá registrei esses dados. Gostaria de agendar uma visita para avaliarmos seu carro e finalizarmos a proposta?`,
          extractedPreferences: extracted.extracted,
          needsMoreInfo: ['schedule'],
          canRecommend: false,
          nextMode: 'negotiation',
          metadata: {
            processingTime: Date.now() - startTime,
            confidence: 1.0,
            llmUsed: 'rule-based'
          }
        };
      }

      // 2.2. Intercept Trade-In context
      // If user indicated they have a trade-in, but we lack details, ASK IMMEDIATELY.
      // This priority overrides normal flow to capture the lead's vehicle details.
      if (updatedProfile.hasTradeIn && (!updatedProfile.tradeInModel || !updatedProfile.tradeInYear)) {
        logger.info('User has trade-in but missing details - Intercepting flow to ask about trade-in vehicle');
        return {
          response: 'Legal! Qual é o carro que você tem na troca? (Marca, modelo e ano, por favor) 🚗',
          extractedPreferences: extracted.extracted,
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
        } else if (isNo || this.detectUserQuestion(userMessage)) {
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

      // 2.55. Check if user is responding after seeing a recommendation
      if (showedRecommendation && lastShownVehicles && lastShownVehicles.length > 0) {

        // AUTO-DETECTION: Trade-In Discussion (Post-Recommendation)
        // If user mentions trade-in details here, prioritize responding to that over "similar search"
        if (extracted.extracted.tradeInModel || (extracted.extracted.hasTradeIn && /troca|meu carro|tenho um|minha/i.test(userMessage))) {
          const tradeInCar = updatedProfile.tradeInModel
            ? `${updatedProfile.tradeInBrand || ''} ${updatedProfile.tradeInModel} ${updatedProfile.tradeInYear || ''}`.trim()
            : 'seu veículo';

          logger.info('User discussing trade-in post-recommendation - Intercepting intent');

          return {
            response: `Perfeito! O ${tradeInCar} pode entrar na negociação e facilitar bastante a compra do ${lastShownVehicles[0].model}. 🚗\n\nVamos fazer uma conta rápida? Além do carro na troca, você pretende dar mais algum valor de entrada em dinheiro?`,
            extractedPreferences: extracted.extracted,
            needsMoreInfo: ['financingDownPayment'],
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
        if (extracted.extracted.wantsFinancing || (extracted.extracted.financingDownPayment !== undefined)) {
          const lastConfig = lastShownVehicles[0];
          const modelName = lastConfig.model;
          const entry = extracted.extracted.financingDownPayment
            ? `R$ ${extracted.extracted.financingDownPayment.toLocaleString('pt-BR')}`
            : 'o valor de entrada que preferir';

          return {
            response: `Excelente! Vamos avançar com o financiamento do ${modelName}. 🏦\n\nCom entrada de ${entry}, já consigo encaminhar para aprovação.\n\nPara finalizar essa simulação e garantir as melhores taxas, vou conectar você com nosso consultor agora. Pode ser?`,
            extractedPreferences: extracted.extracted,
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

        const postRecommendationIntent = this.detectPostRecommendationIntent(userMessage, lastShownVehicles);

        logger.info({
          userMessage,
          postRecommendationIntent,
          lastSearchType,
          lastShownCount: lastShownVehicles.length
        }, 'Post-recommendation intent detection');

        if (postRecommendationIntent === 'want_others') {
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

        if (postRecommendationIntent === 'want_details') {
          // User wants more details about shown vehicle
          const firstVehicle = lastShownVehicles[0];

          const detailsResponse = lastShownVehicles.length === 1
            ? `Claro! Sobre o ${firstVehicle.brand} ${firstVehicle.model} ${firstVehicle.year}:\n\n📋 Para informações detalhadas como quilometragem exata, opcionais, histórico e fotos, sugiro falar com nosso vendedor que pode te passar tudo em tempo real!\n\n_Digite "vendedor" para ser atendido por nossa equipe._`
            : `Qual dos veículos você gostaria de saber mais detalhes?\n\n${lastShownVehicles.map((v, i) => `${i + 1}. ${v.brand} ${v.model} ${v.year}`).join('\n')}\n\n_Ou digite "vendedor" para falar com nossa equipe._`;

          return {
            response: detailsResponse,
            extractedPreferences: {
              ...extracted.extracted,
              _showedRecommendation: true, // Mantém o estado
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'recommendation',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.9,
              llmUsed: 'gpt-4o-mini'
            }
          };
        }

        if (postRecommendationIntent === 'want_schedule') {
          // User wants to schedule/talk to seller
          const scheduleResponse = `Perfeito! 🙌\n\nPara agendar uma visita ou falar diretamente com nosso vendedor, me envia seu nome completo que já passo para a equipe te atender!\n\n📍 Estamos na Robust Car\n📞 Ou se preferir, digite "vendedor" para iniciar o atendimento.`;

          return {
            response: scheduleResponse,
            extractedPreferences: {
              ...extracted.extracted,
              _showedRecommendation: false,
              _lastShownVehicles: lastShownVehicles, // Mantém para referência
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'recommendation',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.95,
              llmUsed: 'gpt-4o-mini'
            }
          };
        }

        if (postRecommendationIntent === 'acknowledgment') {
          const nextStepResponse = `Gostou de alguma dessas opções? 😊\n\nPodemos:\n1️⃣ Simular um financiamento\n2️⃣ Agendar para você ver o carro\n\nO que prefere fazer agora?`;

          return {
            response: nextStepResponse,
            extractedPreferences: {
              ...extracted.extracted,
              _showedRecommendation: true, // Keep state so next message context is maintained
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'recommendation',
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.95,
              llmUsed: 'rule-based'
            }
          };
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
        const isNewQuestion = this.detectUserQuestion(userMessage);
        const hasNewPreferences = Object.keys(extracted.extracted).length > 0 &&
          (extracted.extracted.bodyType || extracted.extracted.brand || extracted.extracted.model || extracted.extracted.budget);

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
          // Don't return here - let the flow continue to handle the new question/request
        } else {
          const userAccepts = this.detectAffirmativeResponse(userMessage);
          const userDeclines = this.detectNegativeResponse(userMessage);

          if (userAccepts) {
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
                    ...extracted.extracted,
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
              // Limpar o requisito de minSeats para mostrar alternativas
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
              needsMoreInfo: ['budget', 'usage', 'people'],
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
        }
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
      const isUserQuestion = this.detectUserQuestion(userMessage);

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

  /**
   * Detect user's search intent to determine flow:
   * - 'specific': User wants a specific model (e.g., "Onix 2019", "Civic") -> Return directly
   * - 'recommendation': User wants help finding a car (e.g., "SUV para família") -> Recommendation flow
   * - 'category': User asks about category availability (e.g., "que pickups vocês têm?") -> List category
   */
  private detectSearchIntent(
    message: string,
    extracted: Partial<CustomerProfile>
  ): 'specific' | 'recommendation' | 'category' {
    const msgLower = message.toLowerCase();

    // Has specific model = direct search
    if (extracted.model) {
      logger.info({ model: extracted.model }, 'detectSearchIntent: specific model detected');
      return 'specific';
    }

    // Asking about category availability
    const categoryAskPatterns = [
      /que\s+(pickup|picape|suv|sedan|hatch|caminhonete)s?\s+(tem|vocês|voces|você)/i,
      /quais?\s+(pickup|picape|suv|sedan|hatch)s?\s+(tem|temos|disponíve)/i,
      /(tem|temos|vocês tem)\s+(pickup|picape|suv|sedan|hatch)/i,
    ];
    if (categoryAskPatterns.some(p => p.test(message))) {
      logger.info({ message }, 'detectSearchIntent: category question detected');
      return 'category';
    }

    // Has body type + usage/characteristics = wants recommendation
    const hasBodyType = !!extracted.bodyType;
    const hasUsage = !!(extracted.usage || extracted.usoPrincipal);
    const hasCharacteristic = msgLower.includes('econômico') ||
      msgLower.includes('economico') ||
      msgLower.includes('espaçoso') ||
      msgLower.includes('confortável') ||
      msgLower.includes('familia') ||
      msgLower.includes('família');

    if ((hasBodyType && !extracted.model) || hasUsage || hasCharacteristic) {
      logger.info({ hasBodyType, hasUsage, hasCharacteristic }, 'detectSearchIntent: recommendation flow');
      return 'recommendation';
    }

    // Default to recommendation if unsure
    return 'recommendation';
  }

  /**
   * Detect if user is asking a question (vs just answering our questions)
   */
  private detectUserQuestion(message: string): boolean {
    // Question indicators
    const questionPatterns = [
      /\?$/,                                    // Ends with ?
      /^(qual|quais|como|quando|onde|por que|quanto)/i,  // Question words
      /diferença entre/i,
      /o que [ée]/i,
      /tem (algum|alguma)/i,
      /pode (me )?(explicar|dizer|falar)/i,
      /gostaria de saber/i,
      /queria saber/i,
      /voc[êe]s?\s*tem/i,                       // "você tem", "vocês tem"
      /tem\s*(disponível|disponivel)/i,          // "tem disponível"
      /o que\s*(voc[êe]s?)?\s*tem/i,             // "o que você tem"
      /quais?\s*(carro|veículo|modelo|opç)/i,   // "qual carro", "quais opções"
    ];

    return questionPatterns.some(pattern => pattern.test(message.trim()));
  }

  /**
   * Detect if user response is affirmative (accepting a suggestion)
   */
  private detectAffirmativeResponse(message: string): boolean {
    const normalized = message.toLowerCase().trim();

    // Affirmative patterns
    const affirmativePatterns = [
      /^(sim|s|ss|sss|siiim|siim)$/i,
      /^(pode|podes|pode ser|pode sim)$/i,
      /^(quero|quero sim|quero ver)$/i,
      /^(ok|okay|beleza|blz|bora|vamos|show)$/i,
      /^(claro|com certeza|certeza)$/i,
      /^(tá|ta|tudo bem|tranquilo)$/i,
      /^(manda|manda aí|manda ver|mostra)$/i,
      /^(por favor|pfv|pf)$/i,
      /sim,?\s*(pode|quero|manda)/i,
      /pode\s*(me )?mostrar/i,
      /quero\s*(ver|saber)/i,
      /mostra\s*(aí|ai|pra mim)?/i,
      /(me )?mostra/i,
      /interessado/i,
      /tenho interesse/i,
    ];

    // Negative patterns (to avoid false positives)
    const negativePatterns = [
      /^(não|nao|n|nn|nope|nunca)$/i,
      /não\s*(quero|preciso|obrigado)/i,
      /deixa\s*(pra lá|quieto)/i,
      /sem\s*(interesse|necessidade)/i,
    ];

    // Check for negative first
    if (negativePatterns.some(pattern => pattern.test(normalized))) {
      return false;
    }

    return affirmativePatterns.some(pattern => pattern.test(normalized));
  }

  /**
   * Detect if user response is negative (declining a suggestion)
   */
  private detectNegativeResponse(message: string): boolean {
    const normalized = message.toLowerCase().trim();

    const negativePatterns = [
      /^(não|nao|n|nn|nope|nunca)$/i,
      /não\s*(quero|preciso|obrigado)/i,
      /deixa\s*(pra lá|quieto)/i,
      /sem\s*(interesse|necessidade)/i,
      /^(nada|deixa|esquece)$/i,
      /não,?\s*obrigado/i,
      /agora\s*não/i,
      /depois/i,
      /talvez\s*depois/i,
    ];

    return negativePatterns.some(pattern => pattern.test(normalized));
  }

  /**
   * Detect user intent after showing a recommendation
   * Returns: 'want_others' | 'want_details' | 'want_schedule' | 'new_search' | 'none'
   */
  private detectPostRecommendationIntent(
    message: string,
    lastShownVehicles?: Array<{ brand: string; model: string; year: number; price: number }>
  ): 'want_others' | 'want_details' | 'want_schedule' | 'new_search' | 'acknowledgment' | 'none' {
    const normalized = message.toLowerCase().trim();

    // Patterns for wanting OTHER options - comprehensive list
    const wantOthersPatterns = [
      // Explicit requests for others
      /tem\s*(outr[oa]s?|mais)/i,
      /quer[oi]?\s*(ver\s*)?(outr[oa]s?|mais)/i,
      /mostra\s*(outr[oa]s?|mais)/i,
      /mais\s*(opç|carros?|veículos?|alternativ)/i,
      /outras?\s*(opç|alternativ|sugest)/i,
      /^(outro|outra|outros|outras)$/i,
      /alguma?\s*(outr[oa]|alternativ|opç)/i,

      // Price/budget related
      /muito\s*(caro|cara)/i,
      /acima\s*do\s*(meu\s*)?(orçamento|budget)/i,
      /fora\s*do\s*(meu\s*)?(orçamento|budget)/i,
      /algo\s*(mais\s*)?(barato|em conta|acessível|econômico)/i,
      /tem\s*algo\s*(mais\s*)?(barato|em conta|caro)/i,
      /mais\s*(barato|caro|em conta)/i,
      /menos\s*(caro|cara)/i,

      // Negative about current option
      /não\s*(gost|curt)[eiao]/i,
      /não\s*(é|era)\s*(bem\s*)?(isso|esse|o\s*que)/i,
      /prefer[io]\s*outro/i,
      /não\s*me\s*interess/i,
      /não\s*(era|é)\s*(o\s*que)/i,
      /achei\s*(caro|ruim|feio)/i,

      // Asking for alternatives/options
      /ver\s*mais\s*opç/i,
      /ver\s*alternativ/i,
      /alternativ/i,
      /o\s*que\s*mais\s*tem/i,
      /que\s*mais\s*vocês?\s*tem/i,

      // Same type/profile/style requests
      /mesmo\s*(perfil|tipo|estilo|porte|tamanho|padrão|padrao|valor|preço|preco)/i,
      /opç.*(mesmo|parecid|similar|semelhant)/i,
      /parecid[oa]s?/i,
      /similar(es)?/i,
      /semelhant(es)?/i,
      /nesse\s*(estilo|perfil|valor|preço|padrão|porte)/i,
      /desse\s*(tipo|jeito|estilo|porte)/i,
      /nessa\s*(linha|faixa|categoria)/i,
      /dessa\s*(categoria|faixa)/i,
      /mesma\s*(linha|faixa|categoria)/i,
      /mesmo\s*(segmento|porte)/i,
      /na\s*mesma\s*(faixa|linha)/i,
      /do\s*mesmo\s*(tipo|jeito|estilo|porte|valor)/i,
      /assim/i, // "algo assim", "coisa assim"
      /esse\s*(estilo|tipo)\s*de\s*(carro|veículo)/i,
      /coisa\s*parecida/i,
      /algo\s*(parecido|similar|semelhante|assim|nessa linha)/i,

      // Competitor/equivalent requests
      /concorrent/i,
      /equivalent/i,
      /compara/i,

      // Budget with numbers
      /tem\s*(opç|algo|carro).*(até|ate)\s*\d/i,
      /(até|ate)\s*\d+\s*(mil|k|reais|r\$)?/i,
      /opç.*(até|ate)\s*\d/i,
      /na\s*faixa\s*de\s*\d/i,
      /entre\s*\d+\s*e\s*\d+/i,
      /por\s*(volta|cerca)\s*de\s*\d/i,
      /\d+\s*(mil|k)?\s*(reais|r\$)?/i, // just a number like "30000" or "30 mil"
    ];

    // Patterns for wanting MORE DETAILS about shown vehicle
    const wantDetailsPatterns = [
      /mais\s*detalhes?/i,
      /conta\s*mais/i,
      /fal[ae]\s*mais/i,
      /quero\s*saber\s*mais/i,
      /como\s*(é|está)\s*(esse|o)\s*(carro|veículo)/i,
      /quilometragem/i,
      /km\??$/i,
      /procedência/i,
      /histórico/i,
      /dono|proprietário/i,
      /ipva|documentação|documento/i,
      /opcional|opcionais/i,
      /cor\??$/i,
      /foto|imagem|vídeo/i,
      /interessei?\s*(nesse|nele|no\s*primeiro)/i,
      /gost[eiao]\s*(desse|dele|do\s*primeiro)/i,
    ];

    // Patterns for wanting to SCHEDULE/TALK
    const wantSchedulePatterns = [
      /vendedor/i,
      /atendente/i,
      /humano/i,
      /pessoa\s*real/i,
      /agendar/i,
      /visita/i,
      /ver\s*pessoalmente/i,
      /ir\s*até\s*(a\s*)?(loja|vocês)/i,
      /quero\s*(comprar|fechar|levar)/i,
      /vou\s*(levar|ficar\s*com)/i,
      /como\s*(faço|faz)\s*(pra|para)\s*(comprar|visitar)/i,
      /endereço/i,
      /onde\s*(fica|vocês\s*ficam)/i,
      /whatsapp|telefone|ligar/i,
    ];

    // Check patterns in order of priority
    if (wantSchedulePatterns.some(p => p.test(normalized))) {
      return 'want_schedule';
    }

    if (wantDetailsPatterns.some(p => p.test(normalized))) {
      return 'want_details';
    }

    if (wantOthersPatterns.some(p => p.test(normalized))) {
      return 'want_others';
    }

    const acknowledgmentPatterns = [
      /^ok$/i, /^entendi$/i, /^beleza$/i, /^legal$/i, /^certo$/i, /^tá bom$/i, /^ta bom$/i, /^show$/i, /^joia$/i, /^bacana$/i, /^obrigado$/i, /^valeu$/i
    ];

    if (acknowledgmentPatterns.some(p => p.test(normalized))) {
      return 'acknowledgment';
    }

    return 'none';
  }

  /**
   * Answer user's question using RAG (Retrieval Augmented Generation)
   */
  private async answerQuestion(
    question: string,
    context: ConversationContext,
    profile: Partial<CustomerProfile>
  ): Promise<string> {
    try {
      // Search relevant vehicles semantically
      const relevantVehicles = await vehicleSearchAdapter.search(question, {
        maxPrice: profile.budget,
        bodyType: profile.bodyType,
        minYear: profile.minYear,
        limit: 3
      });

      // Build context for LLM
      const vehicleContext = relevantVehicles.length > 0
        ? `VEÍCULOS RELEVANTES NO ESTOQUE:\n${relevantVehicles.map((v, i) =>
          `${i + 1}. ${v.vehicle.brand} ${v.vehicle.model} ${v.vehicle.year} - R$ ${v.vehicle.price.toLocaleString('pt-BR')}`
        ).join('\n')}`
        : 'Nenhum veículo específico encontrado para essa pergunta.';

      const conversationSummary = this.summarizeContext(context);

      const prompt = `${this.SYSTEM_PROMPT}

PERGUNTA DO CLIENTE: "${question}"

${vehicleContext}

CONTEXTO DA CONVERSA:
${conversationSummary}

PERFIL DO CLIENTE (até agora):
${JSON.stringify(profile, null, 2)}

Responda a pergunta de forma natural e útil, usando exemplos dos veículos quando apropriado.
Se a pergunta for sobre diferenças entre categorias, explique claramente.
Sempre mantenha o foco em ajudar o cliente a encontrar o carro ideal.`;

      const response = await chatCompletion([
        { role: 'system', content: prompt },
        { role: 'user', content: question }
      ], {
        temperature: 0.7,
        maxTokens: 350
      });

      return response.trim();

    } catch (error) {
      logger.error({ error, question }, 'Failed to answer question');
      return 'Desculpe, não consegui processar sua pergunta. Pode reformular de outra forma?';
    }
  }

  /**
   * Generate next contextual question to ask the user
   */
  private async generateNextQuestion(
    options: QuestionGenerationOptions
  ): Promise<string> {
    try {
      const { profile, missingFields, context } = options;

      const prompt = `${this.SYSTEM_PROMPT}

PERFIL ATUAL DO CLIENTE:
${JSON.stringify(profile, null, 2)}

INFORMAÇÕES QUE AINDA PRECISAMOS:
${missingFields.join(', ')}

CONTEXTO DA CONVERSA:
${context || 'Início da conversa'}

TAREFA:
Gere a PRÓXIMA MELHOR PERGUNTA para fazer ao cliente.

DIRETRIZES:
1. A pergunta deve ser contextual (baseada no que já sabemos)
2. Priorize informações essenciais: orçamento, uso, quantidade de pessoas
3. Seja natural, não robótico
4. Faça UMA pergunta por vez
5. Se apropriado, ofereça contexto antes de perguntar
6. Use emojis com moderação (apenas se natural)

EXEMPLO BOM:
"Legal! Para viagens em família, temos SUVs e sedans muito confortáveis. Quantas pessoas costumam viajar juntas?"

EXEMPLO RUIM:
"Quantas pessoas?"

Gere APENAS a pergunta, sem prefácio ou explicação:`;

      const response = await chatCompletion([
        { role: 'system', content: prompt },
        { role: 'user', content: 'Qual a próxima melhor pergunta?' }
      ], {
        temperature: 0.8,
        maxTokens: 150
      });

      return response.trim();

    } catch (error) {
      logger.error({ error }, 'Failed to generate question');

      // Fallback to basic question based on missing fields
      const { profile, missingFields } = options;

      if (missingFields.includes('budget') || !profile.budget) {
        return '💰 Até quanto você pretende investir no carro?';
      }
      if (missingFields.includes('usage') || !profile.usage) {
        return '🚗 Qual vai ser o uso principal? Cidade, viagens, trabalho?';
      }
      if (missingFields.includes('people') || !profile.people) {
        return '👥 Quantas pessoas geralmente vão usar o carro?';
      }

      return 'Me conta mais sobre o que você busca no carro ideal?';
    }
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
   * @param searchType - 'specific' for model/year searches, 'similar' for similar vehicles, 'recommendation' for personalized suggestions
   */
  private async formatRecommendations(
    recommendations: VehicleRecommendation[],
    profile: Partial<CustomerProfile>,
    context: ConversationContext,
    searchType: 'specific' | 'similar' | 'recommendation' = 'recommendation'
  ): Promise<string> {
    if (recommendations.length === 0) {
      return `Hmm, não encontrei veículos que atendam exatamente suas preferências. 🤔

Posso ajustar os critérios? Por exemplo:
- Aumentar o orçamento em 10-20%?
- Considerar anos um pouco mais antigos?
- Ver outras categorias de veículos?

Me diz o que prefere!`;
    }

    const isSpecificSearch = searchType === 'specific';
    const isSimilarSearch = searchType === 'similar';
    const showMatchScore = searchType === 'recommendation'; // Só mostra % em recomendações personalizadas

    try {
      // Show all recommendations (up to 5)
      const vehiclesToShow = recommendations.slice(0, 5);

      const vehiclesList = vehiclesToShow.map((rec, i) => {
        const v = rec.vehicle;
        const link = v.detailsUrl || v.url;

        // Só mostrar % match em recomendações personalizadas (não em buscas específicas ou similares)
        const matchScore = (showMatchScore && rec.matchScore) ? `${Math.round(rec.matchScore)}%` : '';

        // Em busca específica com 1 resultado, não numerar
        const prefix = (isSpecificSearch && vehiclesToShow.length === 1)
          ? '🚗 '
          : `${i + 1}. ${i === 0 ? '🏆 ' : ''}`;

        let item = `${prefix}*${v.brand} ${v.model} ${v.year}*${matchScore ? ` (${matchScore} match)` : ''}
   💰 R$ ${v.price.toLocaleString('pt-BR')}
   🛣️ ${v.mileage?.toLocaleString('pt-BR') || '?'} km
   🚗 ${v.bodyType || 'N/A'}${v.transmission ? ` | ${v.transmission}` : ''}`;

        if (link) {
          item += `\n   🔗 ${link}`;
        }

        return item;
      }).join('\n\n');

      const intro = this.generateRecommendationIntro(profile, vehiclesToShow.length, searchType, vehiclesToShow[0]?.vehicle);

      // Outro diferente para busca específica vs recomendação
      let outro: string;
      if (isSpecificSearch) {
        if (vehiclesToShow.length === 1) {
          outro = `\n\nQuer saber mais detalhes ou agendar uma visita? 😊

_Digite "reiniciar" para nova busca ou "vendedor" para falar com nossa equipe._`;
        } else {
          outro = `\n\nQuer mais detalhes de algum desses? 😊

_Digite "reiniciar" para nova busca ou "vendedor" para falar com nossa equipe._`;
        }
      } else {
        outro = `\n\nQual te interessou mais? Posso dar mais detalhes! 😊

_Digite "reiniciar" para nova busca ou "vendedor" para falar com nossa equipe._`;
      }

      return `${intro}\n\n${vehiclesList}${outro}`;

    } catch (error) {
      logger.error({ error }, 'Failed to format recommendations');

      // Fallback simple format
      return `Encontrei ${recommendations.length} veículos para você!\n\n` +
        recommendations.slice(0, 3).map((r, i) =>
          `${i + 1}. ${r.vehicle.brand} ${r.vehicle.model} - R$ ${r.vehicle.price.toLocaleString('pt-BR')}`
        ).join('\n');
    }
  }

  /**
   * Generate intro for recommendations based on profile and search type
   */
  private generateRecommendationIntro(
    profile: Partial<CustomerProfile>,
    count: number,
    searchType: 'specific' | 'similar' | 'recommendation' = 'recommendation',
    firstVehicle?: { brand: string; model: string; year: number }
  ): string {
    // Para busca específica, usar mensagem direta
    if (searchType === 'specific') {
      if (count === 1 && firstVehicle) {
        return `Encontramos o ${firstVehicle.brand} ${firstVehicle.model} ${firstVehicle.year} que você procurava! ✅`;
      } else if (firstVehicle) {
        return `Encontramos ${count} opções de ${firstVehicle.brand} ${firstVehicle.model} disponíveis:`;
      }
      return `Encontramos ${count} opção${count > 1 ? 'ões' : ''} para você:`;
    }

    // Para busca de similares, usar mensagem apropriada (não chega aqui pois usamos intro customizada)
    if (searchType === 'similar') {
      return `Encontrei ${count} opção${count > 1 ? 'ões similares' : ' similar'}:`;
    }

    // Para recomendações personalizadas, usar mensagem com critérios
    const parts: string[] = [];

    if (profile.usage) {
      const usageMap: Record<string, string> = {
        cidade: 'uso urbano',
        viagem: 'viagens',
        trabalho: 'trabalho',
        misto: 'uso variado'
      };
      parts.push(usageMap[profile.usage] || profile.usage);
    }

    if (profile.people) {
      parts.push(`${profile.people} pessoas`);
    }

    if (profile.budget) {
      parts.push(`até R$ ${profile.budget.toLocaleString('pt-BR')}`);
    }

    const criteria = parts.length > 0 ? ` para ${parts.join(', ')}` : '';

    return `Perfeito! Encontrei ${count} veículo${count > 1 ? 's IDEAIS' : ' IDEAL'}${criteria}:`;
  }

  /**
   * Build search query from profile
   */
  private buildSearchQuery(profile: Partial<CustomerProfile>): VehicleSearchQuery {
    const searchParts: string[] = [];

    // Include model and year first for exact search detection
    if (profile.model) {
      searchParts.push(profile.model);
    }
    if (profile.minYear) {
      searchParts.push(profile.minYear.toString());
    }
    if (profile.bodyType) {
      searchParts.push(profile.bodyType);
    }
    if (profile.usage) {
      searchParts.push(profile.usage);
    }
    if (profile.priorities) {
      searchParts.push(...profile.priorities);
    }

    return {
      searchText: searchParts.join(' ') || 'carro usado',
      filters: {
        maxPrice: profile.budget || profile.budgetMax,
        minPrice: profile.budgetMin,
        minYear: profile.minYear,
        maxKm: profile.maxKm,
        minSeats: profile.minSeats, // Número mínimo de lugares
        bodyType: profile.bodyType ? [profile.bodyType] : undefined,
        transmission: profile.transmission ? [profile.transmission] : undefined,
        brand: profile.brand ? [profile.brand] : undefined,
        model: profile.model ? [profile.model] : undefined  // Modelo específico
      },
      preferences: {
        usage: profile.usage,
        people: profile.people,
        priorities: profile.priorities,
        dealBreakers: profile.dealBreakers
      },
      limit: 5,
      minMatchScore: 60
    };
  }

  /**
   * Assess if we have enough information to recommend vehicles
   */
  private assessReadiness(
    profile: Partial<CustomerProfile>,
    context: ConversationContext
  ): ReadinessAssessment {
    // Required fields
    const required = ['budget', 'usage', 'people'];
    const missingRequired = required.filter(field => !profile[field]);

    // Optional but helpful fields
    const optional = ['bodyType', 'minYear', 'transmission'];
    const missingOptional = optional.filter(field => !profile[field]);

    // Calculate confidence
    const requiredScore = ((required.length - missingRequired.length) / required.length) * 100;
    const optionalScore = ((optional.length - missingOptional.length) / optional.length) * 30;
    const confidence = Math.min(100, requiredScore + optionalScore);

    // Decision logic
    let canRecommend = false;
    let action: 'continue_asking' | 'recommend_now' | 'ask_confirmation' = 'continue_asking';
    let reasoning = '';

    if (missingRequired.length === 0) {
      // Has all required fields
      canRecommend = true;
      action = 'recommend_now';
      reasoning = 'Informações essenciais coletadas';
    } else if (missingRequired.length === 1 && context.metadata.messageCount >= 5) {
      // Has most info and conversation is getting long
      canRecommend = true;
      action = 'recommend_now';
      reasoning = 'Informação suficiente após várias mensagens';
    } else if (context.metadata.messageCount >= 8) {
      // Conversation too long, recommend anyway
      canRecommend = true;
      action = 'recommend_now';
      reasoning = 'Conversa muito longa, recomendar com informações parciais';
    } else {
      canRecommend = false;
      action = 'continue_asking';
      reasoning = `Faltam campos essenciais: ${missingRequired.join(', ')}`;
    }

    return {
      canRecommend,
      confidence,
      missingRequired,
      missingOptional,
      action,
      reasoning
    };
  }

  /**
   * Identify what information is still missing
   */
  private identifyMissingInfo(profile: Partial<CustomerProfile>): string[] {
    const important = ['budget', 'usage', 'people', 'bodyType'];
    return important.filter(field => !profile[field]);
  }

  /**
   * Summarize conversation context for LLM
   */
  private summarizeContext(context: ConversationContext): string {
    const recentMessages = context.messages.slice(-4);
    const summary = recentMessages
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Você'}: ${m.content}`)
      .join('\n');

    return `Modo: ${context.mode}\nMensagens trocadas: ${context.metadata.messageCount}\n\nÚltimas mensagens:\n${summary}`;
  }
}

// Singleton export
export const vehicleExpert = new VehicleExpertAgent();
