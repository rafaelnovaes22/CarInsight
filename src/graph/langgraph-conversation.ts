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
import { CustomerProfile, ConversationState, BotMessage, VehicleRecommendation } from '../types/state.types';
import { ConversationContext, ConversationMode, ConversationResponse } from '../types/conversation.types';

/**
 * Estados do grafo de conversação
 */
export type GraphState =
  | 'START'
  | 'GREETING'        // Boas-vindas e coleta de nome
  | 'DISCOVERY'       // Descoberta inicial: o que o cliente busca
  | 'CLARIFICATION'   // Perguntas para refinar perfil
  | 'SEARCH'          // Busca de veículos (transição interna)
  | 'RECOMMENDATION'  // Apresentação de recomendações
  | 'NEGOTIATION'     // Negociação (trade-in, financiamento)
  | 'FOLLOW_UP'       // Acompanhamento pós-recomendação
  | 'HANDOFF'         // Transferência para vendedor
  | 'END';

/**
 * Resultado de transição de estado
 */
interface StateTransition {
  nextState: GraphState;
  response: string;
  profile: Partial<CustomerProfile>;
  recommendations?: VehicleRecommendation[];
  metadata?: Record<string, any>;
}

/**
 * Condições de transição entre estados
 */
interface TransitionConditions {
  hasName: boolean;
  hasContext: boolean;        // Sabe o que o cliente busca
  hasMinimalProfile: boolean; // budget + usage + people
  hasCompleteProfile: boolean;
  hasRecommendations: boolean;
  wantsHandoff: boolean;
  wantsRestart: boolean;
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

      logger.info({
        conversationId: state.conversationId,
        currentState,
        messageCount: state.messages.length,
        hasProfile: !!state.profile,
      }, 'LangGraph: Processing message');

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

      logger.info({
        conversationId: state.conversationId,
        previousState: currentState,
        nextState: transition.nextState,
        processingTime: Date.now() - startTime,
      }, 'LangGraph: State transition completed');

      return {
        response: transition.response,
        newState,
      };

    } catch (error) {
      logger.error({ error, conversationId: state.conversationId }, 'LangGraph: Error processing message');

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
      'START', 'GREETING', 'DISCOVERY', 'CLARIFICATION',
      'SEARCH', 'RECOMMENDATION', 'NEGOTIATION', 'FOLLOW_UP', 'HANDOFF', 'END'
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
      hasContext: !!(profile.usoPrincipal || profile.usage || profile.bodyType || profile.brand || profile.model),
      hasMinimalProfile: !!(profile.budget && (profile.usage || profile.usoPrincipal) && profile.people),
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
      return {
        response: `Entendi! 👍\n\nVou conectar você com um de nossos vendedores especialistas.\n\nUm momento, por favor. ⏳`,
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
      return {
        response: `Ótimo! 🎉\n\nVou transferir você para nossa equipe de vendas para agendar sua visita.\n\nUm vendedor entrará em contato em breve para confirmar dia e horário.\n\nObrigado por escolher a FaciliAuto! 🚗`,
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
    const isGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hello|hi|e aí|eai)/i.test(message.trim());

    // Verificar se já tem nome no perfil
    if (state.profile?.customerName) {
      // Já tem nome, perguntar o que procura
      return {
        nextState: 'DISCOVERY',
        response: `${state.profile.customerName}, o que você está procurando hoje? 🚗\n\nPode me contar:\n• Tipo de carro (SUV, sedan, hatch, pickup...)\n• Para que vai usar (família, trabalho, Uber...)\n• Ou um modelo específico que tem em mente`,
        profile: {},
      };
    }

    // Se é uma saudação, perguntar o nome
    if (isGreeting || state.messages.length <= 2) {
      // PRIMEIRO: Tentar extrair intenção de carro (busca exata) na saudação
      // Ex: "Oi, tudo bem? Quero um Civic 2017"
      const exactMatch = exactSearchParser.parse(message);
      const earlyProfileUpdate: Partial<CustomerProfile> = {};

      if (exactMatch.model) {
        earlyProfileUpdate.model = exactMatch.model;
        if (exactMatch.year) earlyProfileUpdate.minYear = exactMatch.year;
      }

      // Tentar extrair nome se a mensagem parecer um nome
      const possibleName = this.extractName(message);

      if (possibleName && !isGreeting) {
        // Parece ser um nome - verificar se também tem carro
        if (earlyProfileUpdate.model) {
          const carText = earlyProfileUpdate.minYear
            ? `${earlyProfileUpdate.model} ${earlyProfileUpdate.minYear}`
            : earlyProfileUpdate.model;

          return {
            nextState: 'DISCOVERY',
            response: `Prazer, ${possibleName}! 😊\n\nVi que você tem interesse em um *${carText}*.\n\nVou verificar nosso estoque agora mesmo! 🚗`,
            profile: {
              customerName: possibleName,
              ...earlyProfileUpdate
            },
          };
        }

        return {
          nextState: 'DISCOVERY',
          response: `Prazer, ${possibleName}! 😊\n\nMe conta, o que você está procurando? 🚗\n\nPode ser:\n• Um tipo de carro (SUV, sedan, pickup...)\n• Para que vai usar (família, trabalho, Uber...)\n• Ou um modelo específico`,
          profile: { customerName: possibleName },
        };
      }

      // Se detectou carro na saudação, salvar e perguntar nome contextualizado
      if (earlyProfileUpdate.model) {
        const carText = earlyProfileUpdate.minYear
          ? `${earlyProfileUpdate.model} ${earlyProfileUpdate.minYear}`
          : earlyProfileUpdate.model;

        return {
          nextState: 'GREETING',
          response: `Olá! Vi que você busca um *${carText}*. Ótima escolha! 🚗\n\nAntes de eu buscar as melhores opções para você, qual é o seu nome?`,
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
    const name = this.extractName(message);

    // Também tentar extrair intenção de carro (busca exata) na saudação
    // Ex: "Oi, meu nome é Rafael e quero um Civic 2017"
    // Feature: exact-vehicle-search - capture intent early
    const exactMatch = exactSearchParser.parse(message);
    const earlyProfileUpdate: Partial<CustomerProfile> = {};

    if (exactMatch.model) {
      earlyProfileUpdate.model = exactMatch.model;
      if (exactMatch.year) earlyProfileUpdate.minYear = exactMatch.year;

      // Se encontramos modelo na saudação, já marcamos para pular perguntas genéricas
      // O VehicleExpertAgent vai usar isso para buscar direto
    }

    if (name) {
      // Se detectou carro na saudação, muda a resposta para confirmar
      if (earlyProfileUpdate.model) {
        const carText = earlyProfileUpdate.minYear
          ? `${earlyProfileUpdate.model} ${earlyProfileUpdate.minYear}`
          : earlyProfileUpdate.model;

        return {
          nextState: 'DISCOVERY', // Vai para discovery, mas com perfil já populado
          response: `Prazer, ${name}! 😊\n\nVi que você tem interesse em um *${carText}*.\n\nVou verificar nosso estoque agora mesmo! 🚗`,
          profile: {
            customerName: name,
            ...earlyProfileUpdate
          },
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
        response: `Olá! Vi que você busca um *${carText}*. Ótima escolha! 🚗\n\nAntes de eu buscar as melhores opções para você, qual é o seu nome?`,
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

  /**
   * Lista de nomes brasileiros comuns para validação de transcrição
   * Usada para melhorar a acurácia do STT e detectar erros óbvios
   */
  private static readonly COMMON_BRAZILIAN_NAMES = new Set([
    // Nomes masculinos
    'rafael', 'joao', 'jose', 'pedro', 'paulo', 'lucas', 'mateus', 'gabriel', 'miguel', 'felipe',
    'bruno', 'marcos', 'carlos', 'daniel', 'fernando', 'rodrigo', 'andre', 'eduardo', 'diego', 'ricardo',
    'gustavo', 'leonardo', 'thiago', 'tiago', 'vinicius', 'henrique', 'caio', 'leandro', 'marcelo', 'fabio',
    'renato', 'alex', 'alexandre', 'anderson', 'antonio', 'arthur', 'bernardo', 'cesar', 'claudio', 'cristiano',
    'david', 'denis', 'douglas', 'enzo', 'fabiano', 'fabricio', 'francisco', 'george', 'gilberto', 'guilherme',
    'heitor', 'hugo', 'igor', 'ivan', 'jean', 'jefferson', 'jorge', 'julio', 'junior', 'luan',
    'luciano', 'luis', 'luiz', 'marcio', 'mario', 'matheus', 'mauricio', 'max', 'michael', 'nathan',
    'nelson', 'nicolas', 'otavio', 'patrick', 'rafael', 'renan', 'roberto', 'rogerio', 'ronaldo', 'samuel',
    'sergio', 'silvio', 'victor', 'vitor', 'wagner', 'walter', 'washington', 'wellington', 'wesley', 'william',
    // Nomes femininos
    'maria', 'ana', 'juliana', 'fernanda', 'camila', 'amanda', 'bruna', 'carolina', 'patricia', 'isabela',
    'leticia', 'mariana', 'beatriz', 'larissa', 'aline', 'priscila', 'gabriela', 'vanessa', 'renata', 'natalia',
    'adriana', 'claudia', 'sandra', 'lucia', 'debora', 'simone', 'cristina', 'jessica', 'michele', 'carla',
    'alice', 'andreia', 'angelica', 'barbara', 'bianca', 'carina', 'catarina', 'cecilia', 'celia', 'clara',
    'daniela', 'denise', 'diana', 'elaine', 'elisa', 'erica', 'fabiana', 'fatima', 'flavia', 'francesca',
    'giovanna', 'helena', 'heloisa', 'ingrid', 'iris', 'isadora', 'ivone', 'joana', 'julia', 'karen',
    'karina', 'kelly', 'laura', 'lilian', 'livia', 'lorena', 'luana', 'luciana', 'luiza', 'madalena',
    'manuela', 'marcia', 'marta', 'melissa', 'monica', 'nadia', 'nicole', 'paloma', 'pamela', 'rafaela',
    'raquel', 'rebeca', 'regina', 'roberta', 'rosa', 'samantha', 'sara', 'silvana', 'sofia', 'sonia',
    'stella', 'suzana', 'taina', 'tatiana', 'tereza', 'valentina', 'valeria', 'vera', 'vitoria', 'viviane'
  ]);

  /**
   * Extrai nome de uma mensagem
   */
  private extractName(message: string): string | null {
    const cleaned = message.trim();

    // Remover prefixos comuns
    const prefixes = ['meu nome é', 'me chamo', 'sou o', 'sou a', 'pode me chamar de', 'é', 'sou'];
    let name = cleaned;

    for (const prefix of prefixes) {
      if (cleaned.toLowerCase().startsWith(prefix)) {
        name = cleaned.substring(prefix.length).trim();
        break;
      }
    }

    // Validar: não muito curto, não muito longo, não parece comando
    if (name.length < 2 || name.length > 50) return null;
    if (/^\d+$/.test(name)) return null; // Apenas números
    if (name.includes('?')) return null; // Pergunta

    // Pegar apenas primeira palavra (ignorar sobrenome ou texto adicional)
    const firstWord = name.split(/\s+/)[0].toLowerCase();

    // Validar se parece um nome real usando a lista de nomes comuns
    // ou se começa com letra maiúscula sem caracteres estranhos
    const looksLikeName = LangGraphConversation.COMMON_BRAZILIAN_NAMES.has(firstWord) ||
      /^[A-ZÀ-Ú][a-zà-ú]+$/.test(name.split(/\s+/)[0]);

    // Se não parece nome E tem menos de 4 letras, provavelmente é erro de transcrição
    if (!looksLikeName && firstWord.length < 4) {
      return null;
    }

    // Capitalizar primeira letra de cada palavra
    return name.split(/\s+/)
      .slice(0, 2) // Máximo 2 palavras (nome e sobrenome)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

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
    let nextState: GraphState = state.graph.currentNode as GraphState || 'DISCOVERY';

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
        questionsAsked: state.messages.filter(m => m.role === 'assistant' && m.content.includes('?')).length,
        userQuestions: state.messages.filter(m => m.role === 'user' && m.content.includes('?')).length,
      },
    };
  }

  /**
   * Converte estado do grafo para modo de conversação
   */
  private stateToMode(state: GraphState): ConversationMode {
    const stateToModeMap: Record<GraphState, ConversationMode> = {
      'START': 'discovery',
      'GREETING': 'discovery',
      'DISCOVERY': 'discovery',
      'CLARIFICATION': 'clarification',
      'SEARCH': 'ready_to_recommend',
      'RECOMMENDATION': 'recommendation',
      'NEGOTIATION': 'negotiation',
      'FOLLOW_UP': 'refinement', // Mapeado para refinement para o agente saber que é feedback
      'HANDOFF': 'recommendation',
      'END': 'recommendation',
    };
    return stateToModeMap[state] || 'discovery';
  }

  /**
   * Converte modo de conversação para estado do grafo
   */
  private modeToState(mode: ConversationMode): GraphState {
    const modeToStateMap: Record<ConversationMode, GraphState> = {
      'discovery': 'DISCOVERY',
      'clarification': 'CLARIFICATION',
      'ready_to_recommend': 'RECOMMENDATION',
      'recommendation': 'RECOMMENDATION',
      'negotiation': 'NEGOTIATION',
      'refinement': 'FOLLOW_UP',
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

