/**
 * LangGraph Conversation System - Integrated with VehicleExpertAgent
 *
 * Grafo de estados para conversação:
 *
 * START → GREETING → DISCOVERY → CLARIFICATION → RECOMMENDATION → END
 *              ↑           ↓           ↓              ↓
 *              └───────────┴───────────┴──────────────┘
 *                    (pode voltar em qualquer ponto)
 */

import { logger } from '../lib/logger';
import { vehicleExpert } from '../agents/vehicle-expert.agent';
import { exactSearchParser } from '../services/exact-search-parser.service';
import {
  CustomerProfile,
  ConversationState,
  BotMessage,
  VehicleRecommendation,
} from '../types/state.types';
import {
  ConversationContext,
  ConversationMode,
  ConversationResponse,
} from '../types/conversation.types';

// Import from refactored modules
import {
  GraphState,
  StateTransition,
  TransitionConditions,
  isValidGraphState,
} from './langgraph/types';
import { extractName } from './langgraph/extractors';

// Re-export types for backwards compatibility
export { GraphState, StateTransition, TransitionConditions } from './langgraph/types';

/**
 * Formata número de telefone para exibição
 * Ex: 5511949105033 -> (11) 94910-5033
 */
function formatPhoneNumber(phone: string): string {
  const withoutCountry = phone.startsWith('55') ? phone.slice(2) : phone;

  if (withoutCountry.length === 11) {
    const ddd = withoutCountry.slice(0, 2);
    const firstPart = withoutCountry.slice(2, 7);
    const secondPart = withoutCountry.slice(7);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }

  return phone;
}

/**
 * Gera link wa.me e número formatado para redirecionamento ao vendedor
 */
function generateWhatsAppLink(
  profile?: CustomerProfile
): { link: string; formattedPhone: string } | null {
  const salesPhone = process.env.SALES_PHONE_NUMBER;
  if (!salesPhone) return null;

  // Construir texto pré-preenchido
  let prefilledText = 'Olá! Vim do bot da FaciliAuto';

  if (profile?.customerName) {
    prefilledText = `Olá! Sou ${profile.customerName}, vim do bot da FaciliAuto`;
  }

  // Adicionar interesse do veículo se disponível
  const lastVehicle = profile?._lastShownVehicles?.[0];
  if (lastVehicle) {
    prefilledText += ` e tenho interesse no ${lastVehicle.brand} ${lastVehicle.model} ${lastVehicle.year}`;
  }

  prefilledText += '!';

  // Encode para URL
  const encodedText = encodeURIComponent(prefilledText);
  return {
    link: `https://wa.me/${salesPhone}?text=${encodedText}`,
    formattedPhone: formatPhoneNumber(salesPhone),
  };
}

/**
 * LangGraph Conversation Manager
 * Gerencia o fluxo de estados da conversa
 */
export class LangGraphConversation {
  /**
   * Processa uma mensagem e retorna o novo estado
   */
  async processMessage(
    message: string,
    state: ConversationState
  ): Promise<{ response: string; newState: ConversationState }> {
    const startTime = Date.now();

    try {
      // 1. Identificar estado atual
      const currentState = this.identifyCurrentState(state);

      logger.info(
        {
          conversationId: state.conversationId,
          currentState,
          messageCount: state.messages.length,
          hasProfile: !!state.profile,
        },
        'LangGraph: Processing message'
      );

      // 2. Adicionar mensagem do usuário ao estado
      const userMessage: BotMessage = {
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      const stateWithMessage: ConversationState = {
        ...state,
        messages: [...state.messages, userMessage],
        graph: {
          ...state.graph,
          loopCount: (state.graph.loopCount || 0) + 1,
        },
      };

      // 3. Verificar comandos especiais (handoff, restart)
      const specialResponse = this.handleSpecialCommands(message, stateWithMessage);
      if (specialResponse) {
        return specialResponse;
      }

      // 4. Processar no estado atual
      const transition = await this.processInState(currentState, message, stateWithMessage);

      // 5. Construir novo estado
      const newState: ConversationState = {
        ...stateWithMessage,
        profile: {
          ...stateWithMessage.profile,
          ...transition.profile,
        },
        recommendations: transition.recommendations || stateWithMessage.recommendations,
        graph: {
          ...stateWithMessage.graph,
          currentNode: transition.nextState,
          previousNode: currentState,
          nodeHistory: [...stateWithMessage.graph.nodeHistory, currentState],
        },
        messages: [
          ...stateWithMessage.messages,
          {
            role: 'assistant',
            content: transition.response,
            timestamp: new Date(),
          },
        ],
        metadata: {
          ...stateWithMessage.metadata,
          lastMessageAt: new Date(),
          ...transition.metadata,
        },
      };

      logger.info(
        {
          conversationId: state.conversationId,
          previousState: currentState,
          nextState: transition.nextState,
          processingTime: Date.now() - startTime,
        },
        'LangGraph: State transition completed'
      );

      return {
        response: transition.response,
        newState,
      };
    } catch (error) {
      logger.error(
        { error, conversationId: state.conversationId },
        'LangGraph: Error processing message'
      );

      return {
        response: 'Desculpe, tive um problema ao processar sua mensagem. Pode reformular? 🤔',
        newState: {
          ...state,
          graph: {
            ...state.graph,
            errorCount: (state.graph.errorCount || 0) + 1,
          },
        },
      };
    }
  }

  /**
   * Identifica o estado atual baseado no ConversationState
   */
  private identifyCurrentState(state: ConversationState): GraphState {
    // Se não tem mensagens, está no início
    if (state.messages.length === 0) {
      return 'START';
    }

    // Se tem node definido no graph, usar
    const nodeState = state.graph.currentNode;
    if (nodeState && this.isValidState(nodeState)) {
      return nodeState as GraphState;
    }

    // Inferir estado baseado no perfil e recomendações
    const conditions = this.evaluateConditions(state);

    if (conditions.hasRecommendations) {
      return 'FOLLOW_UP';
    }

    if (conditions.hasMinimalProfile) {
      return 'RECOMMENDATION';
    }

    if (conditions.hasContext) {
      return 'CLARIFICATION';
    }

    if (conditions.hasName) {
      return 'DISCOVERY';
    }

    return 'GREETING';
  }

  /**
   * Valida se é um estado válido do grafo
   */
  private isValidState(state: string): boolean {
    const validStates: GraphState[] = [
      'START',
      'GREETING',
      'DISCOVERY',
      'CLARIFICATION',
      'SEARCH',
      'RECOMMENDATION',
      'NEGOTIATION',
      'FOLLOW_UP',
      'HANDOFF',
      'END',
    ];
    return validStates.includes(state as GraphState);
  }

  /**
   * Avalia as condições de transição
   */
  private evaluateConditions(state: ConversationState): TransitionConditions {
    const profile = state.profile || {};

    return {
      hasName: !!profile.customerName,
      hasContext: !!(
        profile.usoPrincipal ||
        profile.usage ||
        profile.bodyType ||
        profile.brand ||
        profile.model
      ),
      hasMinimalProfile: !!(
        profile.budget &&
        (profile.usage || profile.usoPrincipal) &&
        profile.people
      ),
      hasCompleteProfile: !!(profile.budget && profile.usage && profile.people && profile.bodyType),
      hasRecommendations: state.recommendations.length > 0,
      wantsHandoff: false, // será verificado no handleSpecialCommands
      wantsRestart: false,
    };
  }

  /**
   * Verifica e trata comandos especiais
   */
  private handleSpecialCommands(
    message: string,
    state: ConversationState
  ): { response: string; newState: ConversationState } | null {
    const lower = message.toLowerCase().trim();

    // Handoff para vendedor
    if (lower.includes('vendedor') || lower.includes('humano') || lower.includes('atendente')) {
      const waInfo = generateWhatsAppLink(state.profile ?? undefined);
      const linkMessage = waInfo
        ? `\n\n📱 *Fale com nosso consultor:*\n👉 ${waInfo.link}\n_ou salve o número: ${waInfo.formattedPhone}_`
        : '';

      return {
        response: `Entendi! 👍\n\nVou conectar você com um de nossos vendedores especialistas.${linkMessage}\n\n_Ele já recebeu todas as informações sobre seu interesse!_`,
        newState: {
          ...state,
          graph: {
            ...state.graph,
            currentNode: 'HANDOFF',
          },
          metadata: {
            ...state.metadata,
            flags: [...state.metadata.flags, 'handoff_requested'],
          },
        },
      };
    }

    // Agendar visita
    if (lower.includes('agendar') || lower.includes('visita') || lower.includes('test drive')) {
      const waInfo = generateWhatsAppLink(state.profile ?? undefined);
      const linkMessage = waInfo
        ? `\n\n📱 *Fale com nosso consultor:*\n👉 ${waInfo.link}\n_ou salve o número: ${waInfo.formattedPhone}_`
        : '';

      return {
        response: `Ótimo! 🎉\n\nVou transferir você para nossa equipe de vendas para agendar sua visita.${linkMessage}\n\n_Nosso consultor confirmará o dia e horário com você!_\n\nObrigado por escolher a FaciliAuto! 🚗`,
        newState: {
          ...state,
          graph: {
            ...state.graph,
            currentNode: 'HANDOFF',
          },
          metadata: {
            ...state.metadata,
            leadQuality: 'hot',
            flags: [...state.metadata.flags, 'visit_requested'],
          },
        },
      };
    }

    return null;
  }

  /**
   * Processa mensagem no estado atual
   */
  private async processInState(
    currentState: GraphState,
    message: string,
    state: ConversationState
  ): Promise<StateTransition> {
    switch (currentState) {
      case 'START':
      case 'GREETING':
        return this.processGreeting(message, state);

      case 'DISCOVERY':
        return this.processDiscovery(message, state);

      case 'CLARIFICATION':
        return this.processClarification(message, state);

      case 'SEARCH':
      case 'RECOMMENDATION':
        return this.processRecommendation(message, state);

      case 'FOLLOW_UP':
        return this.processFollowUp(message, state);

      case 'NEGOTIATION':
        return this.processNegotiation(message, state);

      default:
        return this.processWithVehicleExpert(message, state);
    }
  }

  /**
   * Estado GREETING: Boas-vindas e coleta de nome
   */
  private async processGreeting(
    message: string,
    state: ConversationState
  ): Promise<StateTransition> {
    // Primeira mensagem do usuário - provavelmente é o nome ou uma saudação
    const isGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hello|hi|e aí|eai)/i.test(
      message.trim()
    );

    // Verificar se já tem nome no perfil
    if (state.profile?.customerName) {
      // Já tem nome, perguntar o que procura
      return {
        nextState: 'DISCOVERY',
        response: `${state.profile.customerName}, o que você está procurando hoje? 🚗\n\nPode me contar:\n• Tipo de carro (SUV, sedan, hatch, pickup...)\n• Para que vai usar (família, trabalho, app de transporte...)\n• Ou um modelo específico que tem em mente`,
        profile: {},
      };
    }

    // Se é uma saudação, perguntar o nome
    if (isGreeting || state.messages.length <= 2) {
      // PRIMEIRO: Tentar extrair intenção de carro (busca exata) na saudação
      // Ex: "Oi, tudo bem? Quero um Civic 2017"
      const exactMatch = exactSearchParser.parse(message);
      const earlyProfileUpdate: Partial<CustomerProfile> = {};

      // IMPORTANTE: Verificar se é contexto de trade-in ANTES de salvar como veículo desejado
      // Ex: "Quero trocar meu Polo 2020 por um carro mais novo" -> Polo é TROCA, não desejo!
      const isTradeInContext = exactSearchParser.isTradeInContext(message);

      // DEBUG: Log para entender por que não está detectando o modelo
      logger.info(
        {
          message,
          isGreeting,
          messageCount: state.messages.length,
          exactMatch,
          hasModel: !!exactMatch?.model,
          hasYear: !!exactMatch?.year,
          isTradeInContext,
        },
        'processGreeting: parsing for early vehicle intent'
      );

      if (exactMatch.model) {
        if (isTradeInContext) {
          // TRADE-IN: O veículo mencionado é o que o usuário TEM, não o que ele QUER
          earlyProfileUpdate.hasTradeIn = true;
          earlyProfileUpdate.tradeInModel = exactMatch.model.toLowerCase();
          if (exactMatch.year) earlyProfileUpdate.tradeInYear = exactMatch.year;

          logger.info(
            {
              tradeInModel: earlyProfileUpdate.tradeInModel,
              tradeInYear: earlyProfileUpdate.tradeInYear,
            },
            'processGreeting: detected TRADE-IN vehicle, NOT desired vehicle!'
          );
        } else {
          // DESEJO: O veículo mencionado é o que o usuário QUER comprar
          earlyProfileUpdate.model = exactMatch.model;
          if (exactMatch.year) earlyProfileUpdate.minYear = exactMatch.year;

          logger.info(
            {
              model: earlyProfileUpdate.model,
              year: earlyProfileUpdate.minYear,
            },
            'processGreeting: early vehicle intent detected!'
          );
        }
      }

      // Tentar extrair nome da mensagem (pode estar junto com saudação)
      // Ex: "oi, me chamo Rafael, você tem Civic 2017?"
      const possibleName = extractName(message);

      logger.debug(
        {
          possibleName,
          isGreeting,
          hasModel: !!earlyProfileUpdate.model,
        },
        'processGreeting: name extraction attempt'
      );

      // Se encontrou NOME E CARRO na mesma mensagem, fazer busca IMEDIATAMENTE
      // Isso funciona mesmo para saudações como "oi, me chamo Rafael, quero Civic 2017"
      // EXCEÇÃO: Se é trade-in, NÃO fazemos busca - perguntamos o que o usuário quer
      if (possibleName && earlyProfileUpdate.model && !isTradeInContext) {
        const carText = earlyProfileUpdate.minYear
          ? `${earlyProfileUpdate.model} ${earlyProfileUpdate.minYear}`
          : earlyProfileUpdate.model;

        logger.info(
          {
            name: possibleName,
            model: earlyProfileUpdate.model,
            year: earlyProfileUpdate.minYear,
          },
          'processGreeting: captured both name AND vehicle - initiating immediate search!'
        );

        // Construir perfil para busca
        const searchProfile: Partial<CustomerProfile> = {
          customerName: possibleName,
          ...earlyProfileUpdate,
        };

        // Construir contexto para o VehicleExpert fazer a busca
        const searchContext: ConversationContext = {
          conversationId: state.conversationId,
          phoneNumber: state.phoneNumber,
          mode: 'discovery',
          profile: searchProfile,
          messages: state.messages,
          metadata: {
            startedAt: state.metadata.startedAt,
            lastMessageAt: new Date(),
            messageCount: state.messages.filter(m => m.role === 'user').length,
            extractionCount: 0,
            questionsAsked: 0,
            userQuestions: 0,
          },
        };

        // Fazer a busca imediatamente
        const searchResult = await vehicleExpert.chat(message, searchContext);

        // Se encontrou resultados, formatar resposta com saudação + apresentação IA + resultados
        if (searchResult.recommendations && searchResult.recommendations.length > 0) {
          const greetingPart = `👋 Olá, ${possibleName}! Sou a assistente virtual da *FaciliAuto*.\n\n🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.\n\n`;
          return {
            nextState: 'RECOMMENDATION',
            response: greetingPart + searchResult.response,
            profile: {
              ...searchProfile,
              ...searchResult.extractedPreferences,
            },
            recommendations: searchResult.recommendations,
          };
        }

        // Se não encontrou, ainda assim retornar a resposta do VehicleExpert (pode ter alternativas)
        const greetingPart = `👋 Olá, ${possibleName}! Sou a assistente virtual da *FaciliAuto*.\n\n🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.\n\n`;
        return {
          nextState: searchResult.canRecommend ? 'RECOMMENDATION' : 'DISCOVERY',
          response: greetingPart + searchResult.response,
          profile: {
            ...searchProfile,
            ...searchResult.extractedPreferences,
          },
          recommendations: searchResult.recommendations,
        };
      }

      // Se encontrou NOME E TRADE-IN na mesma mensagem, informar que anotamos o trade-in e perguntar o que quer
      if (possibleName && isTradeInContext && earlyProfileUpdate.tradeInModel) {
        const tradeInText = earlyProfileUpdate.tradeInYear
          ? `${earlyProfileUpdate.tradeInModel.toUpperCase()} ${earlyProfileUpdate.tradeInYear}`
          : earlyProfileUpdate.tradeInModel.toUpperCase();

        logger.info(
          {
            name: possibleName,
            tradeInModel: earlyProfileUpdate.tradeInModel,
            tradeInYear: earlyProfileUpdate.tradeInYear,
          },
          'processGreeting: captured name AND trade-in vehicle - asking what user wants!'
        );

        return {
          nextState: 'DISCOVERY',
          response: `👋 Olá, ${possibleName}! Sou a assistente virtual da *FaciliAuto*.\n\n🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.\n\nEntendi! Você tem um *${tradeInText}* para dar na troca. 🚗🔄\n\nPra te ajudar a encontrar o carro ideal, me conta:\n\n• Qual tipo de carro você está procurando? (SUV, sedan, hatch...)\n• Tem um orçamento em mente?\n\n_Ou me fala um modelo específico se já sabe o que quer!_`,
          profile: {
            customerName: possibleName,
            ...earlyProfileUpdate,
          },
        };
      }

      // Se só encontrou nome (sem carro)
      // Removemos !isGreeting para permitir que "Oi, sou Rafael" funcione
      if (possibleName) {
        // Use only first name for greeting
        const firstName = possibleName.split(' ')[0];

        // Se já fizemos a apresentação (tem mensagens anteriores), usar resposta curta
        const alreadyGreeted = state.messages.length > 2;

        if (alreadyGreeted) {
          // Resposta curta pois já fizemos a apresentação
          return {
            nextState: 'DISCOVERY',
            response: `Prazer, ${firstName}! 😊\n\nMe conta, o que você está procurando? 🚗\n\nPode ser:\n• Um tipo de carro (SUV, sedan, pickup...)\n• Para que vai usar (família, trabalho, app de transporte...)\n• Ou um modelo específico`,
            profile: { customerName: possibleName },
          };
        }

        // Primeira interação - apresentação completa
        return {
          nextState: 'DISCOVERY',
          response: `👋 Olá, ${firstName}! Sou a assistente virtual da *FaciliAuto*.\n\n🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.\n\nMe conta, o que você está procurando? 🚗\n\nPode ser:\n• Um tipo de carro (SUV, sedan, pickup...)\n• Para que vai usar (família, trabalho, app de transporte...)\n• Ou um modelo específico`,
          profile: { customerName: possibleName },
        };
      }

      // Se detectou APENAS carro (sem nome) na saudação, salvar e perguntar nome
      if (earlyProfileUpdate.model) {
        const carText = earlyProfileUpdate.minYear
          ? `${earlyProfileUpdate.model} ${earlyProfileUpdate.minYear}`
          : earlyProfileUpdate.model;

        return {
          nextState: 'GREETING',
          response: `👋 Olá! Sou a assistente virtual da *FaciliAuto*.\n\n🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.\n\nVi que você busca um *${carText}*. Ótima escolha! 🚗\n\nQual é o seu nome?`,
          profile: earlyProfileUpdate,
        };
      }

      // Ainda não tem nome nem carro detectado
      return {
        nextState: 'GREETING',
        response: `👋 Olá! Sou a assistente virtual da *FaciliAuto*.\n\n🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.\n\n💡 _A qualquer momento, digite *sair* para encerrar a conversa._\n\nPara começar, qual é o seu nome?`,
        profile: {},
      };
    }

    // Tentar extrair nome da resposta
    const name = extractName(message);

    // Também tentar extrair intenção de carro (busca exata) na saudação
    // Ex: "Oi, meu nome é Rafael e quero um Civic 2017"
    // Feature: exact-vehicle-search - capture intent early
    const exactMatch = exactSearchParser.parse(message);
    const earlyProfileUpdate: Partial<CustomerProfile> = {};

    // IMPORTANTE: Verificar se é contexto de trade-in ANTES de salvar como veículo desejado
    const isTradeInContext = exactSearchParser.isTradeInContext(message);

    // Usar modelo da mensagem atual OU do profile já existente (capturado anteriormente)
    // MAS: Se é trade-in, NÃO usar como modelo desejado!
    const model = isTradeInContext ? null : exactMatch.model || state.profile?.model;
    const year = isTradeInContext ? null : exactMatch.year || state.profile?.minYear;

    // Se é trade-in, salvar como tradeIn ao invés de modelo desejado
    if (isTradeInContext && exactMatch.model) {
      earlyProfileUpdate.hasTradeIn = true;
      earlyProfileUpdate.tradeInModel = exactMatch.model.toLowerCase();
      if (exactMatch.year) earlyProfileUpdate.tradeInYear = exactMatch.year;

      logger.info(
        {
          tradeInModel: earlyProfileUpdate.tradeInModel,
          tradeInYear: earlyProfileUpdate.tradeInYear,
        },
        'processGreeting: detected TRADE-IN vehicle in name response'
      );
    } else if (model) {
      earlyProfileUpdate.model = model;
      if (year) earlyProfileUpdate.minYear = year;

      // Se encontramos modelo na saudação, já marcamos para pular perguntas genéricas
      // O VehicleExpertAgent vai usar isso para buscar direto
    }

    if (name) {
      // Se detectou TRADE-IN (carro de troca), informar que anotamos e perguntar o que quer
      if (earlyProfileUpdate.hasTradeIn && earlyProfileUpdate.tradeInModel) {
        const tradeInText = earlyProfileUpdate.tradeInYear
          ? `${earlyProfileUpdate.tradeInModel.toUpperCase()} ${earlyProfileUpdate.tradeInYear}`
          : earlyProfileUpdate.tradeInModel.toUpperCase();

        logger.info(
          {
            name,
            tradeInModel: earlyProfileUpdate.tradeInModel,
            tradeInYear: earlyProfileUpdate.tradeInYear,
          },
          'processGreeting: user provided name with trade-in vehicle - asking what they want!'
        );

        return {
          nextState: 'DISCOVERY',
          response: `Prazer, ${name}! 😊\n\nEntendi! Você tem um *${tradeInText}* para dar na troca. 🚗🔄\n\nPra te ajudar a encontrar o carro ideal, me conta:\n\n• Qual tipo de carro você está procurando? (SUV, sedan, hatch...)\n• Tem um orçamento em mente?\n\n_Ou me fala um modelo específico se já sabe o que quer!_`,
          profile: {
            customerName: name,
            ...earlyProfileUpdate,
          },
        };
      }

      // Se detectou carro DESEJADO na saudação OU no profile, fazer busca IMEDIATA
      if (earlyProfileUpdate.model) {
        const carText = earlyProfileUpdate.minYear
          ? `${earlyProfileUpdate.model} ${earlyProfileUpdate.minYear}`
          : earlyProfileUpdate.model;

        logger.info(
          {
            name,
            model: earlyProfileUpdate.model,
            year: earlyProfileUpdate.minYear,
          },
          'processGreeting: user provided name, vehicle already in profile - doing immediate search!'
        );

        // Construir perfil para busca
        const searchProfile: Partial<CustomerProfile> = {
          customerName: name,
          ...earlyProfileUpdate,
        };

        // Construir contexto para o VehicleExpert fazer a busca
        const searchContext: ConversationContext = {
          conversationId: state.conversationId,
          phoneNumber: state.phoneNumber,
          mode: 'discovery',
          profile: searchProfile,
          messages: state.messages,
          metadata: {
            startedAt: state.metadata.startedAt,
            lastMessageAt: new Date(),
            messageCount: state.messages.filter(m => m.role === 'user').length,
            extractionCount: 0,
            questionsAsked: 0,
            userQuestions: 0,
          },
        };

        // Fazer a busca imediatamente (passando uma mensagem que indica busca do veículo)
        const searchMessage = `Quero ver o ${carText}`;
        const searchResult = await vehicleExpert.chat(searchMessage, searchContext);

        // Formatar resposta com saudação + resultados
        const greetingPart = `Prazer, ${name}! 😊\n\n`;
        return {
          nextState: searchResult.canRecommend ? 'RECOMMENDATION' : 'DISCOVERY',
          response: greetingPart + searchResult.response,
          profile: {
            ...searchProfile,
            ...searchResult.extractedPreferences,
          },
          recommendations: searchResult.recommendations,
        };
      }

      return {
        nextState: 'DISCOVERY',
        response: `Prazer, ${name}! 😊\n\nMe conta, o que você está procurando? 🚗\n\nPode ser:\n• Um tipo de carro (SUV, sedan, pickup...)\n• Para que vai usar (família, trabalho, Uber...)\n• Ou um modelo específico`,
        profile: { customerName: name },
      };
    }

    // Se detectou carro mas NÃO detectou nome
    if (earlyProfileUpdate.model) {
      // Salva o interesse no perfil mesmo sem nome, e pergunta o nome contextualizado
      const carText = earlyProfileUpdate.minYear
        ? `${earlyProfileUpdate.model} ${earlyProfileUpdate.minYear}`
        : earlyProfileUpdate.model;

      return {
        nextState: 'GREETING',
        response: `👋 Olá! Sou a assistente virtual da *FaciliAuto*.\n\n🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.\n\nVi que você busca um *${carText}*. Ótima escolha! 🚗\n\nQual é o seu nome?`,
        profile: earlyProfileUpdate,
      };
    }

    // Não conseguiu extrair nome nem carro
    return {
      nextState: 'GREETING',
      response: `Desculpe, não entendi seu nome. 😅\n\nPode me dizer como posso te chamar?`,
      profile: {},
    };
  }

  // NOTE: Name extraction is now handled by the imported extractName function from './langgraph/extractors'
  // The COMMON_BRAZILIAN_NAMES, TRANSCRIPTION_FIXES, ENGLISH_WORDS_NOT_NAMES, and
  // RESERVED_WORDS_NOT_NAMES constants are defined in './langgraph/constants/brazilian-names.ts'

  /**
   * Estado DISCOVERY: Descoberta inicial do que o cliente busca
   */
  private async processDiscovery(
    message: string,
    state: ConversationState
  ): Promise<StateTransition> {
    // Usar VehicleExpert para processar
    const context = this.buildContext(state, 'discovery');
    const response = await vehicleExpert.chat(message, context);

    // Verificar se extraiu informações suficientes para avançar
    const updatedProfile = {
      ...state.profile,
      ...response.extractedPreferences,
    };

    // Determinar próximo estado
    let nextState: GraphState = 'DISCOVERY';

    if (response.canRecommend && response.recommendations && response.recommendations.length > 0) {
      nextState = 'RECOMMENDATION';
    } else if (updatedProfile.budget || updatedProfile.usage || updatedProfile.bodyType) {
      nextState = 'CLARIFICATION';
    }

    return {
      nextState,
      response: response.response,
      profile: response.extractedPreferences,
      recommendations: response.recommendations,
    };
  }

  /**
   * Estado CLARIFICATION: Perguntas para refinar perfil
   */
  private async processClarification(
    message: string,
    state: ConversationState
  ): Promise<StateTransition> {
    const context = this.buildContext(state, 'clarification');
    const response = await vehicleExpert.chat(message, context);

    // Verificar se pode recomendar
    let nextState: GraphState = 'CLARIFICATION';

    if (response.canRecommend && response.recommendations && response.recommendations.length > 0) {
      nextState = 'RECOMMENDATION';
    } else if (response.needsMoreInfo.length === 0) {
      // Tem todas as informações mas não conseguiu gerar recomendações
      nextState = 'RECOMMENDATION';
    }

    return {
      nextState,
      response: response.response,
      profile: response.extractedPreferences,
      recommendations: response.recommendations,
    };
  }

  /**
   * Estado RECOMMENDATION: Apresentação de recomendações
   */
  private async processRecommendation(
    message: string,
    state: ConversationState
  ): Promise<StateTransition> {
    const context = this.buildContext(state, 'recommendation');
    const response = await vehicleExpert.chat(message, context);

    // Se tem novas recomendações, atualizar
    let nextState: GraphState = state.recommendations.length > 0 ? 'FOLLOW_UP' : 'RECOMMENDATION';

    if (response.recommendations && response.recommendations.length > 0) {
      nextState = 'FOLLOW_UP';
    }

    return {
      nextState,
      response: response.response,
      profile: response.extractedPreferences,
      recommendations: response.recommendations || state.recommendations,
    };
  }

  /**
   * Estado FOLLOW_UP: Acompanhamento pós-recomendação
   */
  private async processFollowUp(
    message: string,
    state: ConversationState
  ): Promise<StateTransition> {
    const context = this.buildContext(state, 'recommendation');
    const response = await vehicleExpert.chat(message, context);

    // Verificar se o usuário quer refinar a busca
    const wantsNewSearch = /nova busca|outro|diferente|mudar|alterar/i.test(message);

    let nextState: GraphState = 'FOLLOW_UP';

    if (wantsNewSearch) {
      nextState = 'DISCOVERY';
    } else if (response.recommendations && response.recommendations.length > 0) {
      // Novas recomendações geradas
      nextState = 'FOLLOW_UP';
    }

    return {
      nextState,
      response: response.response,
      profile: response.extractedPreferences,
      recommendations: response.recommendations || state.recommendations,
    };
  }

  /**
   * Estado NEGOTIATION: Negociação de troca e financiamento
   */
  private async processNegotiation(
    message: string,
    state: ConversationState
  ): Promise<StateTransition> {
    const context = this.buildContext(state, 'negotiation');
    const response = await vehicleExpert.chat(message, context);

    let nextState: GraphState = 'NEGOTIATION';

    // Seguir instrução do agente se mudar de modo
    if (response.nextMode && response.nextMode !== 'negotiation') {
      nextState = this.modeToState(response.nextMode);
    }

    return {
      nextState,
      response: response.response,
      profile: response.extractedPreferences,
      recommendations: response.recommendations || state.recommendations,
    };
  }

  /**
   * Fallback: Processa com VehicleExpert genérico
   */
  private async processWithVehicleExpert(
    message: string,
    state: ConversationState
  ): Promise<StateTransition> {
    const mode = this.stateToMode(state.graph.currentNode as GraphState);
    const context = this.buildContext(state, mode);
    const response = await vehicleExpert.chat(message, context);

    // Inferir próximo estado
    let nextState: GraphState = (state.graph.currentNode as GraphState) || 'DISCOVERY';

    if (response.nextMode) {
      nextState = this.modeToState(response.nextMode);
    }

    return {
      nextState,
      response: response.response,
      profile: response.extractedPreferences,
      recommendations: response.recommendations,
    };
  }

  /**
   * Constrói contexto para o VehicleExpertAgent
   */
  private buildContext(state: ConversationState, mode: ConversationMode): ConversationContext {
    return {
      conversationId: state.conversationId,
      phoneNumber: state.phoneNumber,
      mode,
      profile: state.profile || {},
      messages: state.messages,
      metadata: {
        startedAt: state.metadata.startedAt,
        lastMessageAt: state.metadata.lastMessageAt,
        messageCount: state.messages.filter(m => m.role === 'user').length,
        extractionCount: 0,
        questionsAsked: state.messages.filter(
          m => m.role === 'assistant' && m.content.includes('?')
        ).length,
        userQuestions: state.messages.filter(m => m.role === 'user' && m.content.includes('?'))
          .length,
      },
    };
  }

  /**
   * Converte estado do grafo para modo de conversação
   */
  private stateToMode(state: GraphState): ConversationMode {
    const stateToModeMap: Record<GraphState, ConversationMode> = {
      START: 'discovery',
      GREETING: 'discovery',
      DISCOVERY: 'discovery',
      CLARIFICATION: 'clarification',
      SEARCH: 'ready_to_recommend',
      RECOMMENDATION: 'recommendation',
      NEGOTIATION: 'negotiation',
      FOLLOW_UP: 'refinement', // Mapeado para refinement para o agente saber que é feedback
      HANDOFF: 'recommendation',
      END: 'recommendation',
    };
    return stateToModeMap[state] || 'discovery';
  }

  /**
   * Converte modo de conversação para estado do grafo
   */
  private modeToState(mode: ConversationMode): GraphState {
    const modeToStateMap: Record<ConversationMode, GraphState> = {
      discovery: 'DISCOVERY',
      clarification: 'CLARIFICATION',
      ready_to_recommend: 'RECOMMENDATION',
      recommendation: 'RECOMMENDATION',
      negotiation: 'NEGOTIATION',
      refinement: 'FOLLOW_UP',
    };
    return modeToStateMap[mode] || 'DISCOVERY';
  }

  /**
   * Obtém a última resposta do estado
   */
  getLastResponse(state: ConversationState): string {
    const assistantMessages = state.messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length > 0) {
      return assistantMessages[assistantMessages.length - 1].content;
    }
    return 'Desculpe, não consegui processar sua mensagem.';
  }
}

// Singleton export
export const langGraphConversation = new LangGraphConversation();
