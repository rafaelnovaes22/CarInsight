import { IGraphState } from '../../types/graph.types';
import { CustomerProfile } from '../../types/state.types';
import { createNodeTimer } from '../../lib/node-metrics';
import { logger } from '../../lib/logger';
import { AIMessage } from '@langchain/core/messages';
import {
  getRandomVariation,
  getVehicleIntroMessage,
  getVehicleClosingMessage,
  getHandoffMessage,
} from '../../config/conversation-style';

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
  profile?: Partial<CustomerProfile>
): { link: string; formattedPhone: string } | null {
  const salesPhone = process.env.SALES_PHONE_NUMBER;
  if (!salesPhone) return null;

  let prefilledText = 'Olá! Vim do bot do CarInsight';

  if (profile?.customerName) {
    prefilledText = `Olá! Sou ${profile.customerName}, vim do bot do CarInsight`;
  }

  // Use _lastShownVehicles logic if maintained in profile, or fetch from recommendations directly
  // For now, simplified
  prefilledText += '!';
  const encodedText = encodeURIComponent(prefilledText);
  return {
    link: `https://wa.me/${salesPhone}?text=${encodedText}`,
    formattedPhone: formatPhoneNumber(salesPhone),
  };
}

/**
 * Formata preço de forma amigável
 */
function formatPrice(price: number | string | null): string {
  if (!price) return 'Consulte';
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return 'Consulte';

  // Formato mais curto: R$ 89.900
  return numPrice.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Format recommendations into WhatsApp message - ESTILO NATURAL
 */
function formatRecommendations(recommendations: any[]): string {
  if (recommendations.length === 0) {
    return getRandomVariation([
      'Poxa, não encontrei nada disponível agora. Quer que eu chame um vendedor pra te ajudar?',
      'Hmm, não achei opções no momento. Posso te passar pra nossa equipe!',
      'Não tem nada assim agora, mas posso procurar algo parecido ou chamar um vendedor.',
    ]);
  }

  // Intro natural (sem emoji excessivo)
  let message = `${getVehicleIntroMessage()}\n\n`;

  recommendations.forEach((rec, index) => {
    const vehicle = rec.vehicle;
    if (!vehicle) return;

    const num = index + 1;
    const ano = vehicle.ano || '';
    const km = vehicle.km ? `${Math.round(vehicle.km / 1000)}mil km` : '';
    const price = formatPrice(vehicle.preco);

    // Formato compacto e natural
    message += `*${num}. ${vehicle.marca} ${vehicle.modelo}* ${ano}\n`;
    message += `   ${km} • R$ ${price}`;

    // Cor só se relevante
    if (vehicle.cor && vehicle.cor.toLowerCase() !== 'não informada') {
      message += ` • ${vehicle.cor}`;
    }
    message += `\n`;

    // Reasoning curto e natural
    if (rec.reasoning) {
      message += `   _${rec.reasoning}_\n`;
    }

    message += `\n`;
  });

  // Fechamento natural (sem menu estruturado)
  message += getVehicleClosingMessage();

  return message;
}

/**
 * RecommendationNode - Present recommendations to customer
 */
export async function recommendationNode(state: IGraphState): Promise<Partial<IGraphState>> {
  const timer = createNodeTimer('recommendation');

  // Check if messages exist
  if (!state.messages.length) {
    timer.logSuccess(state, {});
    return {};
  }

  const lastMessage = state.messages[state.messages.length - 1];

  if (typeof lastMessage.content !== 'string') {
    timer.logSuccess(state, {});
    return {};
  }

  const lowerMessage = lastMessage.content.toLowerCase();

  // Handle "agendar" / schedule visit
  if (
    lowerMessage.includes('agendar') ||
    lowerMessage.includes('visita') ||
    lowerMessage.includes('test drive')
  ) {
    logger.info('RecommendationNode: Visit requested');
    const waInfo = generateWhatsAppLink(state.profile ?? undefined);
    const linkMessage = waInfo
      ? `\n\n📱 *Fale com nosso consultor:*\n👉 ${waInfo.link}\n_ou salve o número: ${waInfo.formattedPhone}_`
      : '';

    return {
      messages: [
        new AIMessage(
          `${getRandomVariation(['Ótimo!', 'Maravilha!', 'Excelente!'])} 🎉\n\nVou pedir pro nosso consultor agendar sua visita rapidinho.${linkMessage}\n\n_Ele confirma o horário com você, tá bom?_\n\nObrigado por escolher o CarInsight! 🚗`
        ),
      ],
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
        // Check if flag already exists to avoid duplicates
        flags: state.metadata.flags.includes('visit_requested')
          ? state.metadata.flags
          : [...state.metadata.flags, 'visit_requested'],
      },
    };
  }

  // Handle "vendedor" / talk to human
  if (
    lowerMessage.includes('vendedor') ||
    lowerMessage.includes('humano') ||
    lowerMessage.includes('atendente')
  ) {
    logger.info('RecommendationNode: Human handoff requested');
    const waInfo = generateWhatsAppLink(state.profile ?? undefined);
    const linkMessage = waInfo
      ? `\n\n📱 *Fale com nosso consultor:*\n👉 ${waInfo.link}\n_ou salve o número: ${waInfo.formattedPhone}_`
      : '';

    return {
      messages: [
        new AIMessage(
          `${getHandoffMessage()}${linkMessage}\n\n_Já passei suas informações pra ele!_`
        ),
      ],
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
        flags: state.metadata.flags.includes('handoff_requested')
          ? state.metadata.flags
          : [...state.metadata.flags, 'handoff_requested'],
      },
    };
  }

  // Post-recommendation routing (go straight to negotiation/financing/trade-in)
  // Keep this deterministic and BEFORE re-showing recommendations.
  if (/financ|parcel|entrada|presta[çc]/i.test(lowerMessage)) {
    logger.info('RecommendationNode: Financing intent detected');
    return {
      next: 'financing',
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
      },
    };
  }

  if (/troca|meu carro|tenho um|minha|dar na troca/i.test(lowerMessage)) {
    logger.info('RecommendationNode: Trade-in intent detected');
    return {
      next: 'trade_in',
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
      },
    };
  }

  if (/gostei|interessei|quero esse|quero o|vou levar|fechar|comprar/i.test(lowerMessage)) {
    logger.info('RecommendationNode: Interest intent detected -> negotiation');
    return {
      next: 'negotiation',
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
      },
    };
  }

  // Handle vehicle number selection (1, 2, 3)
  if (/^[1-3]$/.test(lowerMessage.trim())) {
    const vehicleIndex = parseInt(lowerMessage.trim()) - 1;
    if (vehicleIndex >= 0 && vehicleIndex < state.recommendations.length) {
      const rec = state.recommendations[vehicleIndex];
      const vehicle = rec.vehicle;

      let detailsMessage = `📋 *${vehicle.marca} ${vehicle.modelo} ${vehicle.versao || ''}*\n\n`;
      detailsMessage += `📅 Ano: ${vehicle.ano}\n`;
      detailsMessage += `🛣️ ${vehicle.km.toLocaleString('pt-BR')} km\n`;
      detailsMessage += `💰 R$ ${parseFloat(vehicle.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      detailsMessage += `🎨 Cor: ${vehicle.cor}\n`;

      if (vehicle.combustivel) detailsMessage += `⛽ ${vehicle.combustivel}`;
      if (vehicle.cambio) detailsMessage += ` • 🔧 ${vehicle.cambio}`;
      detailsMessage += `\n`;

      if (vehicle.descricao) {
        detailsMessage += `\n_${vehicle.descricao}_\n`;
      }

      detailsMessage += `\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      detailsMessage += `${getRandomVariation(['Curtiu o carro? Você pode:', 'Se gostou, me diz:'])}`;
      detailsMessage += `\n• "Agendar visita" pra ver de perto`;
      detailsMessage += `\n• "Falar com vendedor" pra negociar`;

      return {
        messages: [new AIMessage(detailsMessage)],
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
          flags: state.metadata.flags.includes(`viewed_vehicle_${rec.vehicleId}`)
            ? state.metadata.flags
            : [...state.metadata.flags, `viewed_vehicle_${rec.vehicleId}`],
        },
      };
    }
  }

  // First time showing recommendations OR user asking for more
  // Check if the last message was NOT from us showing recommendations (to avoid infinite loop of showing them)
  // Or if recommendations are fresh from search (handled by router usually, but here guard)

  if (state.recommendations.length > 0) {
    const recommendationsMessage = formatRecommendations(state.recommendations);

    // We only send recommendations if we haven't JUST sent them, unless user asked.
    // For now, assuming this node is entered when recommendations should be shown.

    return {
      messages: [new AIMessage(recommendationsMessage)],
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
      },
    };
  }

  // Fallback
  return {
    messages: [
      new AIMessage(
        getRandomVariation([
          'Posso te ajudar com algo mais? Se quiser, chamo um vendedor!',
          'Quer ver mais alguma coisa? Ou prefere falar com alguém da equipe?',
          'Tô por aqui se precisar de algo mais, ou posso chamar um atendente humano.',
        ])
      ),
    ],
    metadata: {
      ...state.metadata,
      lastMessageAt: Date.now(),
    },
  };
}
