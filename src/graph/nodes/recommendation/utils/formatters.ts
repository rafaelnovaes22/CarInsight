import { featureFlags } from '../../../../lib/feature-flags';
import { getTimeSlot } from '../../../../config/time-context';
import {
  getRandomVariation,
  getVehicleIntroMessage,
  getVehicleClosingMessage,
} from '../../../../config/conversation-style';
import { getRecommendationFraming, getEmotionalClosing } from '../../../../config/emotional-copy';
import { getVehicleLink } from './vehicle-helpers';

/**
 * Formata preço de forma amigável
 */
export function formatPrice(price: number | string | null): string {
  if (!price) return 'Consulte';
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return 'Consulte';

  return numPrice.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Format recommendations into WhatsApp message - ESTILO NATURAL
 * When emotional selling is enabled, adds emotional framing based on time slot.
 */
export function formatRecommendations(recommendations: any[]): string {
  if (recommendations.length === 0) {
    return getRandomVariation([
      'Poxa, não encontrei nada disponível agora. Quer que eu chame um vendedor pra te ajudar?',
      'Hmm, não achei opções no momento. Posso te passar pra nossa equipe!',
      'Não tem nada assim agora, mas posso procurar algo parecido ou chamar um vendedor.',
    ]);
  }

  const emotionalEnabled = featureFlags.isEnabled('ENABLE_EMOTIONAL_SELLING');
  const timeSlot = getTimeSlot();
  const useEmotional = emotionalEnabled && (timeSlot === 'late_night' || timeSlot === 'evening');

  let message = `${getVehicleIntroMessage()}\n\n`;

  const bestValueIndex = recommendations.reduce((best: number, rec: any, i: number) => {
    const score = rec.vehicle?.scoreCustoBeneficio ?? 0;
    const bestScore = recommendations[best]?.vehicle?.scoreCustoBeneficio ?? 0;
    return score > bestScore ? i : best;
  }, 0);

  recommendations.forEach((rec, index) => {
    const vehicle = rec.vehicle;
    if (!vehicle) return;

    const brand = vehicle.marca || vehicle.brand || '';
    const model = vehicle.modelo || vehicle.model || '';
    const num = index + 1;
    const ano = vehicle.ano || vehicle.year || '';
    const mileage = vehicle.km ?? vehicle.mileage;
    const km = mileage ? `${Math.round(mileage / 1000)}mil km` : '';
    const price = formatPrice(vehicle.preco ?? vehicle.price ?? null);
    const color = vehicle.cor || vehicle.color;
    const link = getVehicleLink(vehicle);

    let badge = '';
    if (useEmotional) {
      if (index === 0 && recommendations.length > 1) badge = ' ⭐ Mais popular';
      else if (index === bestValueIndex && recommendations.length > 1)
        badge = ' 💰 Melhor custo-benefício';
    }

    message += `*${num}. ${brand} ${model}* ${ano}${badge}\n`;
    message += `   ${km} • R$ ${price}`;

    if (color && typeof color === 'string' && color.toLowerCase() !== 'não informada') {
      message += ` • ${color}`;
    }
    message += `\n`;

    if (link) {
      message += `   🔗 ${link}\n`;
    }

    const explanationReasons = rec.explanation?.selectedBecause?.slice(0, 2) || [];
    const explanationConcern = rec.explanation?.notIdealBecause?.[0];

    if (explanationReasons.length > 0) {
      message += `   _Por que combina: ${explanationReasons.join(' • ')}_\n`;
    } else if (rec.reasoning) {
      message += `   _${rec.reasoning}_\n`;
    }

    if (explanationConcern) {
      message += `   _Ponto de atenção: ${explanationConcern}_\n`;
    }

    if (useEmotional) {
      const vehicleName = `${brand} ${model}`.trim();
      const framing = getRecommendationFraming(vehicleName, timeSlot);
      if (framing) {
        message += `   _${framing}_\n`;
      }
    }

    message += `\n`;
  });

  if (useEmotional) {
    message += getEmotionalClosing(timeSlot);
  } else {
    message += getVehicleClosingMessage();
  }

  return message;
}
