/**
 * Conversation Style Module
 *
 * Provides natural language variations to avoid robotic-sounding responses.
 * Use these instead of hardcoded strings to make conversations feel more human.
 */

// ============================================================================
// Helper Function
// ============================================================================

export function getRandomVariation<T>(variations: T[]): T {
  return variations[Math.floor(Math.random() * variations.length)];
}

// ============================================================================
// Time-based Greetings
// ============================================================================

export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function getTimeEmoji(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '☀️';
  if (hour < 18) return '🌤️';
  return '🌙';
}

// ============================================================================
// Response Variations
// ============================================================================

export const CONVERSATION_STYLE = {
  // Confirmações naturais
  CONFIRMATIONS: [
    'Show!',
    'Beleza!',
    'Pode deixar!',
    'Boa!',
    'Entendi!',
    'Legal!',
    'Ótimo!',
    'Perfeito!',
    'Certo!',
  ],

  // Transições naturais
  TRANSITIONS: ['Então,', 'Olha só,', 'Vou te falar,', 'Pois é,', 'Bom,', 'Enfim,'],

  // Perguntas sobre orçamento
  BUDGET_QUESTIONS: [
    'E aí, tem um valor mais ou menos em mente?',
    'Quanto você tá pensando em investir?',
    'Qual sua faixa de preço?',
    'Tá pensando em gastar quanto mais ou menos?',
    'Tem uma ideia de valor?',
  ],

  // Perguntas sobre uso
  USAGE_QUESTIONS: [
    'E pra que você vai usar mais o carro?',
    'Qual vai ser o uso principal?',
    'Vai usar no dia a dia, viagens, trabalho...?',
    'Me conta, que uso você tem em mente?',
  ],

  // Introduções para mostrar veículos
  SHOWING_VEHICLES: [
    'Olha só o que encontrei pra você!',
    'Achei umas opções bem legais, olha só:',
    'Separei esses aqui que combinam com o que você pediu:',
    'Dá uma olhada nesses:',
    'Encontrei opções interessantes:',
  ],

  // Pedindo mais informações
  ASKING_MORE: [
    'Só mais uma coisinha...',
    'E outra coisa...',
    'Ah, e me fala também:',
    'Só pra eu entender melhor:',
  ],

  // Quando não encontra
  NOT_FOUND: [
    'Poxa, não achei nada exatamente assim no momento.',
    'Hmm, esse modelo específico não temos agora.',
    'Olha, esse aí não temos disponível no momento.',
  ],

  // Oferecendo alternativas
  ALTERNATIVES: [
    'Mas olha, tenho umas opções parecidas que podem te interessar:',
    'Posso te mostrar uns similares?',
    'Quer que eu procure algo parecido?',
    'Tenho outras opções que podem funcionar pra você:',
  ],

  // Fechamento/despedida
  CLOSING_POSITIVE: [
    'Quer saber mais de algum? Me fala!',
    'Gostou de algum? Me diz qual!',
    'Qual te interessou mais?',
    'Me conta o que achou!',
  ],

  // Handoff para humano
  HANDOFF: [
    'Vou te passar pra um dos nossos vendedores, ele já tá por dentro do que você precisa!',
    'Deixa eu te conectar com nossa equipe, beleza?',
    'Vou chamar um consultor pra te ajudar melhor!',
  ],

  // Reconhecimento de emoção positiva
  POSITIVE_REACTIONS: [
    'Que bom que gostou!',
    'Esse é muito bom mesmo!',
    'Boa escolha!',
    'Esse aí é sucesso!',
  ],

  // Empáticos quando há objeção
  EMPATHY_PRICE: [
    'Entendo, realmente é um investimento.',
    'Pois é, o mercado tá assim mesmo.',
    'Sim, entendo sua preocupação com o valor.',
  ],

  // Emojis por contexto (usar com moderação)
  EMOJI_POSITIVE: ['😊', '👍', '🚗', '✨'],
  EMOJI_THINKING: ['🤔', ''],
  EMOJI_CONFIRM: ['👌', '✅', ''],

  // Late-night openers (madrugada)
  LATE_NIGHT_OPENERS: [
    'Pesquisando carro a essa hora? Isso sim é dedicação! 😊',
    'Boa noite! Bom te ver por aqui nesse horário!',
    'E aí, noite de pesquisa? Tô aqui pra ajudar!',
    'Opa! Não dorme quem tá atrás do carro certo, né?',
  ],

  // Aspirational closings (fechamentos aspiracionais)
  ASPIRATION_CLOSINGS: [
    'Esse carro vai transformar seu dia a dia!',
    'Imagina a sensação de dirigir esse aí...',
    'Você merece um carro que combine com você!',
    'O carro certo faz toda a diferença, né?',
  ],

  // Late-night empathy phrases
  EMPATHY_LATE_NIGHT: [
    'Tô aqui pra te ajudar, sem pressa nenhuma.',
    'Pode perguntar o que quiser, tô junto!',
    'Seu tempo vale — vamos com calma.',
    'Decisão importante merece atenção. Tô aqui!',
  ],
};

// ============================================================================
// Composed Messages
// ============================================================================

/**
 * Get a natural confirmation + transition
 */
export function getConfirmAndTransition(): string {
  const confirm = getRandomVariation(CONVERSATION_STYLE.CONFIRMATIONS);
  const transition = getRandomVariation(CONVERSATION_STYLE.TRANSITIONS);
  return `${confirm} ${transition}`;
}

/**
 * Get budget question in natural way
 */
export function getNaturalBudgetQuestion(): string {
  return getRandomVariation(CONVERSATION_STYLE.BUDGET_QUESTIONS);
}

/**
 * Get usage question in natural way
 */
export function getNaturalUsageQuestion(): string {
  return getRandomVariation(CONVERSATION_STYLE.USAGE_QUESTIONS);
}

/**
 * Get vehicle intro message
 */
export function getVehicleIntroMessage(): string {
  return getRandomVariation(CONVERSATION_STYLE.SHOWING_VEHICLES);
}

/**
 * Get closing message after showing vehicles
 */
export function getVehicleClosingMessage(): string {
  return getRandomVariation(CONVERSATION_STYLE.CLOSING_POSITIVE);
}

/**
 * Get handoff message
 */
export function getHandoffMessage(): string {
  return getRandomVariation(CONVERSATION_STYLE.HANDOFF);
}

/**
 * Get not found message with alternative offer
 */
export function getNotFoundWithAlternative(): string {
  const notFound = getRandomVariation(CONVERSATION_STYLE.NOT_FOUND);
  const alternative = getRandomVariation(CONVERSATION_STYLE.ALTERNATIVES);
  return `${notFound}\n\n${alternative}`;
}

// ============================================================================
// Message Builders
// ============================================================================

/**
 * Build a natural follow-up question
 */
export function buildNaturalFollowUp(context: 'budget' | 'usage' | 'more_info'): string {
  const transition =
    Math.random() > 0.5 ? getRandomVariation(CONVERSATION_STYLE.TRANSITIONS) + ' ' : '';

  switch (context) {
    case 'budget':
      return `${transition}${getNaturalBudgetQuestion()}`;
    case 'usage':
      return `${transition}${getNaturalUsageQuestion()}`;
    case 'more_info':
      return getRandomVariation(CONVERSATION_STYLE.ASKING_MORE);
    default:
      return '';
  }
}

/**
 * Add optional emoji based on probability
 */
export function maybeAddEmoji(text: string, probability: number = 0.3): string {
  if (Math.random() < probability) {
    const emoji = getRandomVariation(CONVERSATION_STYLE.EMOJI_POSITIVE);
    return `${text} ${emoji}`;
  }
  return text;
}

// ============================================================================
// Time-Aware Variations
// ============================================================================

type TimeAwareCategory = 'LATE_NIGHT_OPENERS' | 'ASPIRATION_CLOSINGS' | 'EMPATHY_LATE_NIGHT';

/**
 * Get a time-aware variation based on category and time slot.
 * Falls back to default categories when not in the target time slot.
 */
export function getTimeAwareVariation(
  category: TimeAwareCategory,
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'late_night'
): string {
  // Late-night specific categories only apply during late_night
  if (category === 'LATE_NIGHT_OPENERS') {
    if (timeSlot === 'late_night') {
      return getRandomVariation(CONVERSATION_STYLE.LATE_NIGHT_OPENERS);
    }
    // Fallback to time greeting for non-late-night
    return `${getTimeGreeting()}! 😊`;
  }

  if (category === 'ASPIRATION_CLOSINGS') {
    if (timeSlot === 'late_night' || timeSlot === 'evening') {
      return getRandomVariation(CONVERSATION_STYLE.ASPIRATION_CLOSINGS);
    }
    return getVehicleClosingMessage();
  }

  if (category === 'EMPATHY_LATE_NIGHT') {
    if (timeSlot === 'late_night') {
      return getRandomVariation(CONVERSATION_STYLE.EMPATHY_LATE_NIGHT);
    }
    return '';
  }

  return '';
}
