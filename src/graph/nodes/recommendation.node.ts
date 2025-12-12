import { ConversationState, StateUpdate, CustomerProfile } from '../../types/state.types';
import { logger } from '../../lib/logger';

/**
 * Gera link wa.me para redirecionamento ao vendedor
 */
function generateWhatsAppLink(profile?: CustomerProfile): string {
  const salesPhone = process.env.SALES_PHONE_NUMBER;
  if (!salesPhone) return '';

  let prefilledText = 'Olá! Vim do bot da FaciliAuto';

  if (profile?.customerName) {
    prefilledText = `Olá! Sou ${profile.customerName}, vim do bot da FaciliAuto`;
  }

  const lastVehicle = profile?._lastShownVehicles?.[0];
  if (lastVehicle) {
    prefilledText += ` e tenho interesse no ${lastVehicle.brand} ${lastVehicle.model} ${lastVehicle.year}`;
  }

  prefilledText += '!';
  const encodedText = encodeURIComponent(prefilledText);
  return `https://wa.me/${salesPhone}?text=${encodedText}`;
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
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `${index + 1}️⃣ Match Score: ${rec.matchScore}/100 ⭐\n\n`;
    message += `🚗 ${vehicle.marca} ${vehicle.modelo} ${vehicle.versao || ''}\n`;
    message += `📅 Ano: ${vehicle.ano} | 🛣️ ${vehicle.km.toLocaleString('pt-BR')} km\n`;
    message += `💰 R$ ${parseFloat(vehicle.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    message += `🎨 Cor: ${vehicle.cor}\n`;

    if (vehicle.combustivel) {
      message += `⛽ ${vehicle.combustivel}`;
      if (vehicle.cambio) {
        message += ` | 🔧 ${vehicle.cambio}`;
      }
      message += `\n`;
    }

    message += `\n💡 ${rec.reasoning}\n\n`;
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
export async function recommendationNode(state: ConversationState): Promise<StateUpdate> {
  logger.info({
    conversationId: state.conversationId,
    recommendationsCount: state.recommendations.length
  }, 'RecommendationNode: Formatting recommendations');

  // Check if user is asking to schedule or talk to human
  const lastMessage = state.messages[state.messages.length - 1];
  const lowerMessage = lastMessage.content.toLowerCase();

  // Handle "agendar" / schedule visit
  if (lowerMessage.includes('agendar') || lowerMessage.includes('visita') || lowerMessage.includes('test drive')) {
    logger.info({ conversationId: state.conversationId }, 'RecommendationNode: Visit requested');
    const waLink = generateWhatsAppLink(state.profile);
    const linkMessage = waLink ? `\n\n📱 *Clique para falar com nosso consultor:*\n👉 ${waLink}` : '';

    return {
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content: `Ótimo! 🎉\n\nVou transferir você para nossa equipe de vendas para agendar sua visita.${linkMessage}\n\n_Nosso consultor confirmará o dia e horário com você!_\n\nObrigado por escolher a FaciliAuto! 🚗`,
          timestamp: new Date(),
        },
      ],
      metadata: {
        ...state.metadata,
        lastMessageAt: new Date(),
        leadQuality: 'hot',
        flags: [...state.metadata.flags, 'visit_requested'],
      },
    };
  }

  // Handle "vendedor" / talk to human
  if (lowerMessage.includes('vendedor') || lowerMessage.includes('humano') || lowerMessage.includes('atendente')) {
    logger.info({ conversationId: state.conversationId }, 'RecommendationNode: Human handoff requested');
    const waLink = generateWhatsAppLink(state.profile);
    const linkMessage = waLink ? `\n\n📱 *Clique para falar com nosso consultor:*\n👉 ${waLink}` : '';

    return {
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content: `Entendi! 👍\n\nVou conectar você com um de nossos vendedores especialistas.${linkMessage}\n\n_Ele já recebeu todas as informações sobre seu interesse!_`,
          timestamp: new Date(),
        },
      ],
      metadata: {
        ...state.metadata,
        lastMessageAt: new Date(),
        flags: [...state.metadata.flags, 'handoff_requested'],
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
          ...state.messages,
          {
            role: 'assistant',
            content: detailsMessage,
            timestamp: new Date(),
          },
        ],
        metadata: {
          ...state.metadata,
          lastMessageAt: new Date(),
          flags: [...state.metadata.flags, `viewed_vehicle_${rec.vehicleId}`],
        },
      };
    }
  }

  // First time showing recommendations OR user asking for more
  if (state.recommendations.length > 0) {
    const recommendationsMessage = formatRecommendations(state.recommendations);

    return {
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content: recommendationsMessage,
          timestamp: new Date(),
        },
      ],
      metadata: {
        ...state.metadata,
        lastMessageAt: new Date(),
        leadQuality: state.recommendations[0].matchScore >= 85 ? 'hot' : 'warm',
      },
    };
  }

  // Fallback
  return {
    messages: [
      ...state.messages,
      {
        role: 'assistant',
        content: 'Como posso ajudar mais?\n\nDigite "vendedor" para falar com nossa equipe.',
        timestamp: new Date(),
      },
    ],
    metadata: {
      ...state.metadata,
      lastMessageAt: new Date(),
    },
  };
}
