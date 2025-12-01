/**
 * ISO 42001 Compliance - AI Disclosure Messages
 * Mensagens de transparência sobre uso de IA
 */

export const DISCLOSURE_MESSAGES = {
  /**
   * Primeira mensagem - Aviso obrigatório de IA
   */
  INITIAL_GREETING: `👋 Olá! Sou a assistente virtual da *FaciliAuto*.

🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas ou dúvidas complexas, posso transferir você para nossa equipe humana.

📋 *Seus dados:* Usamos suas mensagens apenas para atendê-lo melhor. Você pode solicitar a exclusão dos seus dados a qualquer momento.

💡 _A qualquer momento, digite *sair* para encerrar a conversa._

Como posso ajudar você hoje?`,

  /**
   * Rodapé para respostas com informações críticas
   */
  DISCLAIMERS: {
    PRICE: '\n\n⚠️ _Valores sujeitos a confirmação. Consulte nossa equipe para cotação exata._',
    
    RECOMMENDATION: '\n\n💡 _Estas são sugestões baseadas em IA. Recomendamos avaliação presencial antes da decisão._',
    
    TECHNICAL_INFO: '\n\n🔍 _Informação gerada automaticamente. Para detalhes técnicos precisos, consulte nossa equipe._',
    
    AVAILABILITY: '\n\n📦 _Disponibilidade sujeita a confirmação em tempo real._',
  },

  /**
   * Mensagens de erro com transparência
   */
  ERRORS: {
    AI_UNCERTAINTY: 'Desculpe, não tenho certeza sobre isso. Vou transferir você para um especialista que pode ajudar melhor! 👨‍💼',
    
    COMPLEX_QUERY: 'Essa é uma ótima pergunta! Para garantir a melhor resposta, vou conectar você com nossa equipe. 🤝',
    
    TECHNICAL_ERROR: 'Ops, tive um problema técnico. 🤖⚙️ Vou transferir você para atendimento humano.',
  },

  /**
   * Opções de privacidade
   */
  PRIVACY: {
    DATA_DELETION: 'Você pode solicitar a exclusão dos seus dados digitando *"quero deletar meus dados"*.',
    
    DATA_EXPORT: 'Para exportar suas conversas, digite *"exportar meus dados"*.',
    
    POLICY_LINK: 'Nossa política de privacidade: [URL_DO_SISTEMA]/privacy-policy.html',
  },

  /**
   * Transferência para humano
   */
  HUMAN_HANDOFF: {
    INITIATED: '🤝 Transferindo você para um atendente humano...\n\n_Um momento, por favor._',
    
    CONFIRMATION: '✅ Conectado com nossa equipe! A partir de agora, você está falando com uma pessoa real.',
    
    UNAVAILABLE: '⏰ No momento nossa equipe está indisponível. Horário de atendimento: Segunda a Sexta, 9h às 18h.\n\nPosso ajudar com algo mais enquanto isso?',
  },

  /**
   * Contexto de IA para logs/auditoria
   */
  AUDIT: {
    AI_INTERACTION: 'Interação com IA',
    HUMAN_INTERACTION: 'Interação com humano',
    AI_CONFIDENCE_LOW: 'IA com baixa confiança - handoff recomendado',
  },
} as const;

/**
 * Helper para adicionar disclaimer baseado no tipo de resposta
 */
export function addDisclaimer(message: string, type: keyof typeof DISCLOSURE_MESSAGES.DISCLAIMERS): string {
  const disclaimer = DISCLOSURE_MESSAGES.DISCLAIMERS[type];
  return message + disclaimer;
}

/**
 * Verifica se mensagem precisa de disclaimer de preço
 */
export function needsPriceDisclaimer(message: string): boolean {
  const priceKeywords = ['preço', 'valor', 'custa', 'custo', 'r$', 'reais', 'parcela', 'financiamento'];
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
