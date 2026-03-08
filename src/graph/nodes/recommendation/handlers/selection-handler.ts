import { IntentHandler, HandlerContext, HandlerResult } from './base-handler';
import { AIMessage } from '@langchain/core/messages';
import { getRandomVariation } from '../../../../config/conversation-style';
import { addFlag } from '../../../../utils/state-flags';
import { getVehicleLink } from '../utils/vehicle-helpers';
import { formatPrice } from '../utils/formatters';

export const selectionHandler: IntentHandler = {
  name: 'selection',
  priority: 50,

  canHandle({ lowerMessage }: HandlerContext): boolean {
    return /^[1-3]$/.test(lowerMessage.trim());
  },

  handle({ state, lowerMessage }: HandlerContext): HandlerResult {
    const vehicleIndex = parseInt(lowerMessage.trim()) - 1;
    if (vehicleIndex < 0 || vehicleIndex >= state.recommendations.length) {
      return { handled: false };
    }

    const rec = state.recommendations[vehicleIndex];
    const vehicle = rec.vehicle;
    const brand = vehicle.marca || vehicle.brand || '';
    const model = vehicle.modelo || vehicle.model || '';
    const year = vehicle.ano || vehicle.year || 'N/A';
    const mileage = vehicle.km ?? vehicle.mileage;
    const price = vehicle.preco ?? vehicle.price;
    const color = vehicle.cor || vehicle.color || 'N/A';
    const fuel = vehicle.combustivel || vehicle.fuelType;
    const transmission = vehicle.cambio || vehicle.transmission;
    const description = vehicle.descricao || vehicle.description;
    const link = getVehicleLink(vehicle);

    let detailsMessage = `📋 *${brand} ${model} ${vehicle.versao || ''}*\n\n`;
    detailsMessage += `📅 Ano: ${year}\n`;
    if (typeof mileage === 'number') {
      detailsMessage += `🛣️ ${mileage.toLocaleString('pt-BR')} km\n`;
    } else {
      detailsMessage += `🛣️ Consulte km\n`;
    }
    if (price != null && !Number.isNaN(parseFloat(String(price)))) {
      detailsMessage += `💰 R$ ${formatPrice(price)}\n`;
    } else {
      detailsMessage += `💰 Consulte valor\n`;
    }
    detailsMessage += `🎨 Cor: ${color}\n`;

    if (fuel) detailsMessage += `⛽ ${fuel}`;
    if (transmission) detailsMessage += ` • 🔧 ${transmission}`;
    detailsMessage += `\n`;

    if (link) {
      detailsMessage += `🔗 ${link}\n`;
    }

    if (description) {
      detailsMessage += `\n_${description}_\n`;
    }

    detailsMessage += `\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
    detailsMessage += `${getRandomVariation(['Curtiu o carro? Você pode:', 'Se gostou, me diz:'])}`;
    detailsMessage += `\n• "Agendar visita" pra ver de perto`;
    detailsMessage += `\n• "Falar com vendedor" pra negociar`;

    return {
      handled: true,
      result: {
        messages: [new AIMessage(detailsMessage)],
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
          flags: addFlag(state.metadata.flags, `viewed_vehicle_${rec.vehicleId}`),
        },
      },
    };
  },
};
