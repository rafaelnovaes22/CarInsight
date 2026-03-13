/**
 * ISO 42001 Compliance - AI Disclosure Messages
 * Mensagens de transparência sobre uso de IA
 */

const ASSISTANT_INTRO = 'Sou a assistente virtual do *CarInsight*.';
const AI_DISCLOSURE_NOTICE =
  '🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas ou dúvidas complexas, posso transferir você para nossa equipe humana.';
const DATA_NOTICE =
  '📋 *Seus dados:* Usamos suas mensagens apenas para atendê-lo melhor. Você pode solicitar a exclusão dos seus dados a qualquer momento.';
const EXIT_HINT = '💡 _A qualquer momento, digite *sair* para encerrar a conversa._';

function joinSections(sections: Array<string | undefined | null | false>): string {
  return sections
    .filter((section): section is string => Boolean(section && section.trim()))
    .join('\n\n');
}

function getGreetingSections(opener?: string): string[] {
  if (opener?.trim()) {
    return [opener.trim(), ASSISTANT_INTRO];
  }

  return [`👋 Olá! ${ASSISTANT_INTRO}`];
}

interface GreetingBuilderOptions {
  opener?: string;
  includeDataNotice?: boolean;
  includeExitHint?: boolean;
  question: string;
}

function buildGreetingMessage(options: GreetingBuilderOptions): string {
  return joinSections([
    ...getGreetingSections(options.opener),
    AI_DISCLOSURE_NOTICE,
    options.includeDataNotice ? DATA_NOTICE : '',
    options.includeExitHint ? EXIT_HINT : '',
    options.question,
  ]);
}

export const DISCLOSURE_MESSAGES = {
  /**
   * Primeira mensagem - Aviso obrigatório de IA
   */
  INITIAL_GREETING: buildGreetingMessage({
    includeDataNotice: true,
    includeExitHint: true,
    question: 'Como posso ajudar você hoje?',
  }),

  /**
   * Rodapé para respostas com informações críticas
   */
  DISCLAIMERS: {
    PRICE: '\n\n⚠️ _Valores sujeitos a confirmação. Consulte nossa equipe para cotação exata._',

    RECOMMENDATION:
      '\n\n💡 _Estas são sugestões baseadas em IA. Recomendamos avaliação presencial antes da decisão._',

    TECHNICAL_INFO:
      '\n\n🔍 _Informação gerada automaticamente. Para detalhes técnicos precisos, consulte nossa equipe._',

    AVAILABILITY: '\n\n📦 _Disponibilidade sujeita a confirmação em tempo real._',
  },

  /**
   * Mensagens de erro com transparência
   */
  ERRORS: {
    AI_UNCERTAINTY:
      'Desculpe, não tenho certeza sobre isso. Vou transferir você para um especialista que pode ajudar melhor! 👨‍💼',

    COMPLEX_QUERY:
      'Essa é uma ótima pergunta! Para garantir a melhor resposta, vou conectar você com nossa equipe. 🤝',

    TECHNICAL_ERROR:
      'Ops, tive um problema técnico. 🤖⚙️ Vou transferir você para atendimento humano.',
  },

  /**
   * Opções de privacidade
   */
  PRIVACY: {
    DATA_DELETION:
      'Você pode solicitar a exclusão dos seus dados digitando *"quero deletar meus dados"*.',

    DATA_EXPORT: 'Para exportar suas conversas, digite *"exportar meus dados"*.',

    POLICY_LINK: 'Nossa política de privacidade: https://www.carinsight.com.br/privacy-policy',
  },

  /**
   * Transferência para humano
   */
  HUMAN_HANDOFF: {
    INITIATED: '🤝 Transferindo você para um atendente humano...\n\n_Um momento, por favor._',

    CONFIRMATION:
      '✅ Conectado com nossa equipe! A partir de agora, você está falando com uma pessoa real.',

    UNAVAILABLE:
      '⏰ No momento nossa equipe está indisponível. Horário de atendimento: Segunda a Sexta, 9h às 18h.\n\nPosso ajudar com algo mais enquanto isso?',
  },

  /**
   * Contexto de IA para logs/auditoria
   */
  AUDIT: {
    AI_INTERACTION: 'Interação com IA',
    HUMAN_INTERACTION: 'Interação com humano',
    AI_CONFIDENCE_LOW: 'IA com baixa confiança - handoff recomendado',
  },

  BASE: {
    ASSISTANT_INTRO,
    AI_DISCLOSURE_NOTICE,
    DATA_NOTICE,
    EXIT_HINT,
  },
} as const;

export function buildDisclosurePrefix(opener?: string): string {
  return joinSections([...getGreetingSections(opener), AI_DISCLOSURE_NOTICE]);
}

export function buildNamedDisclosurePrefix(name: string): string {
  return joinSections([`👋 Olá, ${name}! ${ASSISTANT_INTRO}`, AI_DISCLOSURE_NOTICE]);
}

export function buildInitialGreeting(options?: {
  opener?: string;
  includeDataNotice?: boolean;
  includeExitHint?: boolean;
}): string {
  return buildGreetingMessage({
    opener: options?.opener,
    includeDataNotice: options?.includeDataNotice ?? true,
    includeExitHint: options?.includeExitHint ?? true,
    question: 'Como posso ajudar você hoje?',
  });
}

export function buildAskNameGreeting(options?: {
  opener?: string;
  includeDataNotice?: boolean;
  includeExitHint?: boolean;
}): string {
  return buildGreetingMessage({
    opener: options?.opener,
    includeDataNotice: options?.includeDataNotice ?? false,
    includeExitHint: options?.includeExitHint ?? true,
    question: 'Para começar, qual é o seu nome?',
  });
}

export function buildRestartGreeting(): string {
  return joinSections(['🔄 Conversa reiniciada!', buildAskNameGreeting()]);
}

export function buildVehicleInquiryGreeting(vehicleText: string): string {
  return joinSections([
    buildDisclosurePrefix(),
    `Vi que você busca um *${vehicleText}*. Ótima escolha! 🚗`,
    'Qual é o seu nome?',
  ]);
}

/**
 * Helper para adicionar disclaimer baseado no tipo de resposta
 */
export function addDisclaimer(
  message: string,
  type: keyof typeof DISCLOSURE_MESSAGES.DISCLAIMERS
): string {
  const disclaimer = DISCLOSURE_MESSAGES.DISCLAIMERS[type];
  return message + disclaimer;
}

/**
 * Verifica se mensagem precisa de disclaimer de preço
 */
export function needsPriceDisclaimer(message: string): boolean {
  const priceKeywords = [
    'preço',
    'valor',
    'custa',
    'custo',
    'r$',
    'reais',
    'parcela',
    'financiamento',
  ];
  return priceKeywords.some(keyword => message.toLowerCase().includes(keyword));
}

/**
 * Verifica se mensagem é uma recomendação
 */
export function needsRecommendationDisclaimer(message: string): boolean {
  const recommendKeywords = ['recomendo', 'sugiro', 'ideal para', 'melhor opção', 'indicado'];
  return recommendKeywords.some(keyword => message.toLowerCase().includes(keyword));
}

/**
 * Adiciona disclaimers automaticamente baseado no conteúdo
 */
export function autoAddDisclaimers(message: string): string {
  let result = message;

  if (needsPriceDisclaimer(message)) {
    result = addDisclaimer(result, 'PRICE');
  }

  if (needsRecommendationDisclaimer(message)) {
    result = addDisclaimer(result, 'RECOMMENDATION');
  }

  return result;
}
