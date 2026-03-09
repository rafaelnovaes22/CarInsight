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
  _context: ConversationContext
): ReadinessAssessment {
  // BUDGET IS MANDATORY - Always check first before any recommendation
  if (!profile.budget) {
    return {
      canRecommend: false,
      confidence: 30,
      missingRequired: ['budget'],
      missingOptional: ['usage', 'bodyType', 'minYear'].filter(field => !(profile as any)[field]),
      action: 'continue_asking',
      reasoning: 'Orçamento é obrigatório antes de recomendar veículos',
    };
  }

  // SPECIAL CASE: If user specified bodyType (moto, pickup, SUV, etc.), we can recommend immediately
  // This prevents loops where we keep asking for budget/usage when user just wants to see what's available
  const hasSpecificBodyType =
    profile.bodyType &&
    ['moto', 'pickup', 'suv', 'sedan', 'hatch', 'minivan'].includes(profile.bodyType);

  if (hasSpecificBodyType) {
    return {
      canRecommend: true,
      confidence: 80, // Good confidence with specific body type + budget
      missingRequired: [],
      missingOptional: ['usage', 'minYear'].filter(field => !(profile as any)[field]),
      action: 'recommend_now',
      reasoning: `Tipo de veículo especificado (${profile.bodyType}) com orçamento - suficiente para mostrar opções`,
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

  // Required fields for general searches (budget is already checked above)
  // Check both 'usage' and 'usoPrincipal' — extraction may set either depending on phrasing
  const hasUsage = !!(profile.usage || profile.usoPrincipal);
  const required = ['usage'];
  const missingRequired = hasUsage ? [] : required;

  // Optional but helpful fields
  const optional = ['bodyType', 'minYear', 'transmission'];
  const missingOptional = optional.filter(field => !(profile as any)[field]);

  // Calculate confidence (budget is already confirmed present)
  const hasBudget = 100; // Budget is guaranteed at this point
  const requiredScore = ((required.length - missingRequired.length) / required.length) * 70;
  const optionalScore = ((optional.length - missingOptional.length) / optional.length) * 30;
  const confidence = Math.min(100, hasBudget + requiredScore + optionalScore);

  // Decision logic - BUDGET IS MANDATORY (already checked above)
  let canRecommend = false;
  let action: 'continue_asking' | 'recommend_now' | 'ask_confirmation' = 'continue_asking';
  let reasoning = '';

  if (missingRequired.length === 0) {
    // Has budget (guaranteed) AND usage
    canRecommend = true;
    action = 'recommend_now';
    reasoning = 'Orçamento e uso definidos - pode recomendar';
  } else {
    // Has budget but missing usage - ask for it
    canRecommend = false;
    action = 'continue_asking';
    reasoning = `Orçamento definido, mas preciso saber o uso principal`;
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
  return important.filter(field => {
    if (field === 'usage') return !(profile.usage || profile.usoPrincipal);
    return !(profile as any)[field];
  });
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
