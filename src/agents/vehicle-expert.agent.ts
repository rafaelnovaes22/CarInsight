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

      // 2.5. Check if we offered to ask questions for suggestions and user is responding
      const wasWaitingForSuggestionResponse = context.profile?._waitingForSuggestionResponse;
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
          // Don't return here - let the flow continue to handle the new question/request
        } else {
          const userAccepts = this.detectAffirmativeResponse(userMessage);
          const userDeclines = this.detectNegativeResponse(userMessage);
          
          if (userAccepts) {
            logger.info({ userMessage, searchedItem: context.profile?._searchedItem }, 'User accepted to answer questions for suggestions');
            
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
      const hasSpecificModel = !!(extracted.extracted.model || extracted.extracted.brand);

      if (hasSpecificModel) {
        const requestedBrand = extracted.extracted.brand?.toLowerCase();
        const requestedModel = extracted.extracted.model?.toLowerCase();
        
        logger.info({
          brand: requestedBrand,
          model: requestedModel
        }, 'VehicleExpert: Specific model/brand mentioned, searching directly');

        // Search for specific model/brand
        const result = await this.getRecommendations(updatedProfile);

        // Filter results to only include vehicles that ACTUALLY match the requested brand/model
        const matchingResults = result.recommendations.filter(rec => {
          const vehicleBrand = rec.vehicle.brand?.toLowerCase() || '';
          const vehicleModel = rec.vehicle.model?.toLowerCase() || '';
          
          // If user requested a specific brand, vehicle must match that brand
          if (requestedBrand && !vehicleBrand.includes(requestedBrand)) {
            return false;
          }
          
          // If user requested a specific model, vehicle must match that model
          if (requestedModel && !vehicleModel.includes(requestedModel)) {
            return false;
          }
          
          return true;
        });

        logger.info({
          totalResults: result.recommendations.length,
          matchingResults: matchingResults.length,
          requestedBrand,
          requestedModel
        }, 'VehicleExpert: Filtered results for specific brand/model');

        if (matchingResults.length > 0) {
          const formattedResponse = await this.formatRecommendations(
            matchingResults,
            updatedProfile,
            context
          );

          return {
            response: formattedResponse,
            extractedPreferences: extracted.extracted,
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
          // Model/brand not found in inventory - ask if user wants to answer questions for suggestions
          const searchedItem = extracted.extracted.model || extracted.extracted.brand;
          const notFoundResponse = `Não temos ${capitalize(searchedItem)} disponível no estoque no momento. 😕

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
            extractedPreferences: { ...extracted.extracted, bodyType: normalizedBodyType },
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
        
        const formattedResponse = await this.formatRecommendations(
          result.recommendations,
          updatedProfile,
          context
        );

        return {
          response: formattedResponse,
          extractedPreferences: extracted.extracted,
          needsMoreInfo: [],
          canRecommend: true,
          recommendations: result.recommendations,
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
   * Returns { recommendations, noPickupsFound } to indicate if category was not found
   */
  private async getRecommendations(
    profile: Partial<CustomerProfile>
  ): Promise<{ recommendations: VehicleRecommendation[], noPickupsFound?: boolean, wantsPickup?: boolean }> {
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
   */
  private async formatRecommendations(
    recommendations: VehicleRecommendation[],
    profile: Partial<CustomerProfile>,
    context: ConversationContext
  ): Promise<string> {
    if (recommendations.length === 0) {
      return `Hmm, não encontrei veículos que atendam exatamente suas preferências. 🤔

Posso ajustar os critérios? Por exemplo:
- Aumentar o orçamento em 10-20%?
- Considerar anos um pouco mais antigos?
- Ver outras categorias de veículos?

Me diz o que prefere!`;
    }

    try {
      // Show all recommendations (up to 5)
      const vehiclesToShow = recommendations.slice(0, 5);

      const vehiclesList = vehiclesToShow.map((rec, i) => {
        const v = rec.vehicle;
        const link = v.detailsUrl || v.url;
        let item = `${i + 1}. ${i === 0 ? '🏆 ' : ''}*${v.brand} ${v.model} ${v.year}*
   💰 R$ ${v.price.toLocaleString('pt-BR')}
   🛣️ ${v.mileage?.toLocaleString('pt-BR') || '?'} km
   🚗 ${v.bodyType || 'N/A'}${v.transmission ? ` | ${v.transmission}` : ''}`;

        if (link) {
          item += `\n   🔗 ${link}`;
        }

        return item;
      }).join('\n\n');

      const intro = this.generateRecommendationIntro(profile, vehiclesToShow.length);

      const outro = `\n\nQual te interessou mais? Posso dar mais detalhes! 😊

_Digite "reiniciar" para nova busca ou "vendedor" para falar com nossa equipe._`;

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
   * Generate intro for recommendations based on profile
   */
  private generateRecommendationIntro(
    profile: Partial<CustomerProfile>,
    count: number
  ): string {
    const parts: string[] = [];

    if (profile.usage) {
      const usageMap = {
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
