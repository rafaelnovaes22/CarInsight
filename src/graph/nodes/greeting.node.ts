import { logger } from '../../lib/logger';
import { vehicleExpert } from '../../agents/vehicle-expert.agent';
import { exactSearchParser } from '../../services/exact-search-parser.service';
import { extractName } from '../langgraph/extractors';
import { CustomerProfile } from '../../types/state.types';
import { ConversationContext } from '../../types/conversation.types';
import { IGraphState } from '../../types/graph.types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

/**
 * Greeting Node
 * Handles initial interaction, name extraction, and early intent detection
 */
export async function greetingNode(state: IGraphState): Promise<Partial<IGraphState>> {
  const lastMessage = state.messages[state.messages.length - 1];

  // Guard clause: ensure we have a message to process
  if (!lastMessage || typeof lastMessage.content !== 'string') {
    logger.warn('GreetingNode: No valid last message found');
    return {};
  }

  const message = lastMessage.content;

  logger.info({ messageCount: state.messages.length }, 'GreetingNode: Processing message');

  // Check if it's a greeting
  const isGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hello|hi|e aí|eai)/i.test(
    message.trim()
  );

  // 1. If we already have a name, we shouldn't be here ideally, but if we are, move to discovery
  // 1. If we already have a name, we shouldn't be here ideally, but if we are, move to discovery
  if (state.profile?.customerName) {
    logger.info('GreetingNode: Name exists, passing to discovery');
    return {
      next: 'discovery'
    };
  }

  // 2. Early Intent Detection (Exact Search & Trade-in)
  const exactMatch = exactSearchParser.parse(message);
  const earlyProfileUpdate: Partial<CustomerProfile> = {};
  const isTradeInContext = exactSearchParser.isTradeInContext(message);

  if (exactMatch.model) {
    if (isTradeInContext) {
      // TRADE-IN detected
      earlyProfileUpdate.hasTradeIn = true;
      earlyProfileUpdate.tradeInModel = exactMatch.model.toLowerCase();
      if (exactMatch.year) earlyProfileUpdate.tradeInYear = exactMatch.year;
    } else {
      // DESIRED vehicle detected
      earlyProfileUpdate.model = exactMatch.model;
      if (exactMatch.year) earlyProfileUpdate.minYear = exactMatch.year;
    }
  }

  // 3. Name Extraction
  const possibleName = extractName(message);

  // SCENARIO A: Name AND Vehicle Desired (Immediate Search)
  if (possibleName && earlyProfileUpdate.model && !isTradeInContext) {
    const carText = earlyProfileUpdate.minYear
      ? `${earlyProfileUpdate.model} ${earlyProfileUpdate.minYear}`
      : earlyProfileUpdate.model;

    logger.info({ name: possibleName, model: earlyProfileUpdate.model }, 'GreetingNode: Immediate search');

    // Build temp profile for search
    const searchProfile: Partial<CustomerProfile> = {
      customerName: possibleName,
      ...earlyProfileUpdate,
    };

    // Execute search via VehicleExpert
    // We need to construct a context. In real LangGraph, we might pass the state directly or adapt it.
    const searchContext: ConversationContext = {
      conversationId: 'temp-id', // We might need to fetch this from config if available, or it doesnt matter for search
      phoneNumber: 'temp-phone',
      mode: 'discovery',
      profile: searchProfile,
      messages: [], // We don't need full history for this immediate search
      metadata: {
        startedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: 1,
        extractionCount: 0,
        questionsAsked: 0,
        userQuestions: 0
      },
    };

    const searchResult = await vehicleExpert.chat(message, searchContext);

    // Greeting + AI Disclosure
    const greetingPart = `👋 Olá, ${possibleName}! Sou a assistente virtual da *FaciliAuto*.\n\n🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.\n\n`;

    return {
      next: searchResult.canRecommend ? 'recommendation' : 'discovery', // Route based on result
      profile: {
        ...state.profile,
        ...searchProfile,
        ...searchResult.extractedPreferences,
      },
      recommendations: searchResult.recommendations || [],
      messages: [
        new AIMessage(greetingPart + searchResult.response)
      ]
    };
  }

  // SCENARIO B: Name AND Trade-in
  if (possibleName && isTradeInContext && earlyProfileUpdate.tradeInModel) {
    const tradeInText = earlyProfileUpdate.tradeInYear
      ? `${earlyProfileUpdate.tradeInModel.toUpperCase()} ${earlyProfileUpdate.tradeInYear}`
      : earlyProfileUpdate.tradeInModel.toUpperCase();

    return {
      next: 'discovery',
      profile: {
        ...state.profile,
        customerName: possibleName,
        ...earlyProfileUpdate,
      },
      messages: [
        new AIMessage(`Prazer, ${possibleName}! 😊\n\nEntendi! Você tem um *${tradeInText}* para dar na troca. 🚗🔄\n\nPra te ajudar a encontrar o carro ideal, me conta:\n\n• Qual tipo de carro você está procurando? (SUV, sedan, hatch...)\n• Tem um orçamento em mente?\n\n_Ou me fala um modelo específico se já sabe o que quer!_`)
      ]
    };
  }

  // SCENARIO C: Only Name
  if (possibleName) {
    const firstName = possibleName.split(' ')[0];
    const alreadyGreeted = state.messages.length > 2;

    let responseText = '';
    if (alreadyGreeted) {
      responseText = `Prazer, ${firstName}! 😊\n\nMe conta, o que você está procurando? 🚗\n\nPode ser:\n• Um tipo de carro (SUV, sedan, pickup...)\n• Para que vai usar (família, trabalho, app de transporte...)\n• Ou um modelo específico`;
    } else {
      responseText = `👋 Olá, ${firstName}! Sou a assistente virtual da *FaciliAuto*.\n\n🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.\n\nMe conta, o que você está procurando? 🚗\n\nPode ser:\n• Um tipo de carro (SUV, sedan, pickup...)\n• Para que vai usar (família, trabalho, app de transporte...)\n• Ou um modelo específico`;
    }

    return {
      next: 'discovery',
      profile: {
        ...state.profile,
        customerName: possibleName
      },
      messages: [
        new AIMessage(responseText)
      ]
    };
  }

  // SCENARIO D: Only Vehicle (No name)
  if (earlyProfileUpdate.model) {
    const carText = earlyProfileUpdate.minYear
      ? `${earlyProfileUpdate.model} ${earlyProfileUpdate.minYear}`
      : earlyProfileUpdate.model;

    return {
      next: 'greeting', // Loop back to get name
      profile: {
        ...state.profile,
        ...earlyProfileUpdate
      },
      messages: [
        new AIMessage(`👋 Olá! Sou a assistente virtual da *FaciliAuto*.\n\n🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.\n\nVi que você busca um *${carText}*. Ótima escolha! 🚗\n\nQual é o seu nome?`)
      ]
    };
  }

  // SCENARIO E: Confused / No info
  return {
    next: 'greeting',
    messages: [
      new AIMessage(`👋 Olá! Sou a assistente virtual da *FaciliAuto*.\n\n🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.\n\n💡 _A qualquer momento, digite *sair* para encerrar a conversa._\n\nPara começar, qual é o seu nome?`)
    ]
  };
}
