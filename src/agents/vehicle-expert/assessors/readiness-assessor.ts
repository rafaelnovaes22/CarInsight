/**
 * Readiness Assessor
 *
 * Assesses if we have enough information to recommend vehicles.
 */

import { CustomerProfile } from '../../../types/state.types';
import { ConversationContext, ReadinessAssessment } from '../../../types/conversation.types';

/**
 * Assess if we have enough information to recommend vehicles
 *
 * @param profile - Customer profile to assess
 * @param context - Conversation context
 * @returns Assessment result with recommendations
 */
export function assessReadiness(
  profile: Partial<CustomerProfile>,
  context: ConversationContext
): ReadinessAssessment {
  // SPECIAL CASE: If user specified bodyType (moto, pickup, SUV, etc.), we can recommend immediately
  // This prevents loops where we keep asking for budget/usage when user just wants to see what's available
  const hasSpecificBodyType =
    profile.bodyType &&
    ['moto', 'pickup', 'suv', 'sedan', 'hatch', 'minivan'].includes(profile.bodyType);

  if (hasSpecificBodyType) {
    return {
      canRecommend: true,
      confidence: 80, // Good confidence with specific body type
      missingRequired: [],
      missingOptional: ['budget', 'usage'].filter(field => !(profile as any)[field]),
      action: 'recommend_now',
      reasoning: `Tipo de veículo especificado (${profile.bodyType}) - suficiente para mostrar opções`,
    };
  }

  // SPECIAL CASE: Uber (X, Comfort, Black) - only need budget to recommend
  // Quantity of people is irrelevant because all Uber-eligible vehicles are 5-seaters
  // Exception: only ask about seats if user explicitly requests:
  //   - 7+ seats (minivan, SUV grande)
  //   - 2 seats (esportivo/cupê, pickup cabine simples)
  const isUberSearch = profile.usoPrincipal === 'uber';
  const hasExtremeSeatsRequest = profile.people && (profile.people >= 7 || profile.people <= 2);

  if (isUberSearch && profile.budget && !hasExtremeSeatsRequest) {
    const uberType = profile.tipoUber || 'X';
    return {
      canRecommend: true,
      confidence: 90, // High confidence - Uber has clear criteria
      missingRequired: [],
      missingOptional: ['minYear'].filter(f => !(profile as any)[f]),
      action: 'recommend_now',
      reasoning: `Uber ${uberType} com orçamento definido - ir direto para recomendações`,
    };
  }

  // SPECIAL CASE: User explicitly accepted suggestions (responded "sugestões" when asked about preference)
  // This allows recommending without bodyType when user says "envie sugestões", "pode sugerir", etc.
  if (profile._acceptsSuggestions && profile.budget) {
    return {
      canRecommend: true,
      confidence: 85,
      missingRequired: [],
      missingOptional: ['bodyType', 'minYear'].filter(f => !(profile as any)[f]),
      action: 'recommend_now',
      reasoning: 'Usuário aceitou receber sugestões',
    };
  }

  // Required fields for general searches
  const required = ['budget', 'usage'];
  const missingRequired = required.filter(field => !(profile as any)[field]);

  // Optional but helpful fields
  const optional = ['bodyType', 'minYear', 'transmission'];
  const missingOptional = optional.filter(field => !(profile as any)[field]);

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
    reasoning,
  };
}

/**
 * Identify what information is still missing
 *
 * @param profile - Customer profile
 * @returns Array of missing field names
 */
export function identifyMissingInfo(profile: Partial<CustomerProfile>): string[] {
  const important = ['budget', 'usage', 'bodyType'];
  return important.filter(field => !(profile as any)[field]);
}

/**
 * Summarize conversation context for LLM
 *
 * @param context - Conversation context
 * @returns Summary string
 */
export function summarizeContext(context: ConversationContext): string {
  const recentMessages = context.messages.slice(-4);
  const summary = recentMessages
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Você'}: ${m.content}`)
    .join('\n');

  return `Modo: ${context.mode}\nMensagens trocadas: ${context.metadata.messageCount}\n\nÚltimas mensagens:\n${summary}`;
}
