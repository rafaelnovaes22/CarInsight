import { IGraphState } from '../../types/graph.types';
import { CustomerProfile } from '../../types/state.types';
import { logger } from '../../lib/logger';
import { AIMessage } from '@langchain/core/messages';

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

  let prefilledText = 'Olá! Vim do bot da FaciliAuto';

  if (profile?.customerName) {
    prefilledText = `Olá! Sou ${profile.customerName}, vim do bot da FaciliAuto`;
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
 * Format recommendations into WhatsApp message
 */
function formatRecommendations(recommendations: any[]): string {
  if (recommendations.length === 0) {
    return 'Desculpe, não encontrei veículos disponíveis no momento.\n\nDigite "vendedor" para falar com nossa equipe.';
  }

  let message = `🎯 Encontrei ${recommendations.length} veículos perfeitos para você!\n\n`;

  recommendations.forEach((rec, index) => {
    const vehicle = rec.vehicle;
    if (!vehicle) return;

    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `${index + 1}️⃣ Match Score: ${rec.matchScore}/100 ⭐\n\n`;
    message += `🚗 ${vehicle.marca || ''} ${vehicle.modelo || ''} ${vehicle.versao || ''}\n`;

    const ano = vehicle.ano || 'N/D';
    const km = vehicle.km !== undefined && vehicle.km !== null ? vehicle.km.toLocaleString('pt-BR') : 'N/D';
    message += `📅 Ano: ${ano} | 🛣️ ${km} km\n`;

    let priceFormatted = 'Consulte';
    if (vehicle.preco) {
      try {
        priceFormatted = `R$ ${parseFloat(vehicle.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } catch (e) {
        priceFormatted = 'R$ ' + vehicle.preco; // Fallback
      }
    }

    message += `💰 ${priceFormatted}\n`;
    message += `🎨 Cor: ${vehicle.cor || 'Não informada'}\n`;

    if (vehicle.combustivel) {
      message += `⛽ ${vehicle.combustivel}`;
      if (vehicle.cambio) {
        message += ` | 🔧 ${vehicle.cambio}`;
      }
      message += `\n`;
    }

    message += `\n💡 ${rec.reasoning || 'Recomendado para você.'}\n\n`;
  });

  message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `📱 O que você gostaria de fazer?\n\n`;
  message += `• Digite o número do carro para ver mais detalhes\n`;
  message += `• Digite "agendar" para marcar uma visita 📅\n`;
  message += `• Digite "vendedor" para falar com nossa equipe`;

  return message;
}

/**
 * RecommendationNode - Present recommendations to customer
 */
export async function recommendationNode(state: IGraphState): Promise<Partial<IGraphState>> {
  logger.info(
    {
      recommendationsCount: state.recommendations.length,
    },
    'RecommendationNode: Formatting recommendations'
  );

  // Check if messages exist
  if (!state.messages.length) return {};

  const lastMessage = state.messages[state.messages.length - 1];

  if (typeof lastMessage.content !== 'string') return {};

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
        new AIMessage(`Ótimo! 🎉\n\nVou transferir você para nossa equipe de vendas para agendar sua visita.${linkMessage}\n\n_Nosso consultor confirmará o dia e horário com você!_\n\nObrigado por escolher a FaciliAuto! 🚗`)
      ],
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
        // Check if flag already exists to avoid duplicates
        flags: state.metadata.flags.includes('visit_requested') ? state.metadata.flags : [...state.metadata.flags, 'visit_requested'],
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
        new AIMessage(`Entendi! 👍\n\nVou conectar você com um de nossos vendedores especialistas.${linkMessage}\n\n_Ele já recebeu todas as informações sobre seu interesse!_`)
      ],
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
        flags: state.metadata.flags.includes('handoff_requested') ? state.metadata.flags : [...state.metadata.flags, 'handoff_requested'],
      },
    };
  }

  // Handle vehicle number selection (1, 2, 3)
  if (/^[1-3]$/.test(lowerMessage.trim())) {
    const vehicleIndex = parseInt(lowerMessage.trim()) - 1;
    if (vehicleIndex >= 0 && vehicleIndex < state.recommendations.length) {
      const rec = state.recommendations[vehicleIndex];
      const vehicle = rec.vehicle;

      let detailsMessage = `📋 Detalhes completos:\n\n`;
      detailsMessage += `🚗 ${vehicle.marca} ${vehicle.modelo} ${vehicle.versao || ''}\n`;
      detailsMessage += `📅 Ano: ${vehicle.ano}\n`;
      detailsMessage += `🛣️ Quilometragem: ${vehicle.km.toLocaleString('pt-BR')} km\n`;
      detailsMessage += `💰 Preço: R$ ${parseFloat(vehicle.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      detailsMessage += `🎨 Cor: ${vehicle.cor}\n`;

      if (vehicle.combustivel) detailsMessage += `⛽ Combustível: ${vehicle.combustivel}\n`;
      if (vehicle.cambio) detailsMessage += `🔧 Câmbio: ${vehicle.cambio}\n`;
      if (vehicle.portas) detailsMessage += `🚪 Portas: ${vehicle.portas}\n`;

      if (vehicle.descricao) {
        detailsMessage += `\n📝 ${vehicle.descricao}\n`;
      }

      detailsMessage += `\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      detailsMessage += `Gostou? Digite:\n`;
      detailsMessage += `• "agendar" para visitar 📅\n`;
      detailsMessage += `• "vendedor" para tirar dúvidas`;

      return {
        messages: [
          new AIMessage(detailsMessage)
        ],
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
          flags: state.metadata.flags.includes(`viewed_vehicle_${rec.vehicleId}`) ? state.metadata.flags : [...state.metadata.flags, `viewed_vehicle_${rec.vehicleId}`],
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
      messages: [
        new AIMessage(recommendationsMessage)
      ],
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
      },
    };
  }

  // Fallback
  return {
    messages: [
      new AIMessage('Como posso ajudar mais?\n\nDigite "vendedor" para falar com nossa equipe.')
    ],
    metadata: {
      ...state.metadata,
      lastMessageAt: Date.now(),
    },
  };
}
