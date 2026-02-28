/**
 * Recommendation Formatter
 *
 * Formats vehicle recommendations into natural language messages.
 */

import { logger } from '../../../lib/logger';
import { CustomerProfile, VehicleRecommendation } from '../../../types/state.types';
import { capitalizeWords } from '../constants';

/**
 * Search type for formatting purposes
 */
export type SearchType = 'specific' | 'similar' | 'recommendation';

const VEHICLE_SITE_BASE_URL = (
  process.env.VEHICLE_SITE_BASE_URL || 'https://www.renatinhuscars.com.br'
).replace(/\/+$/, '');

function extractSiteVehicleIdFromPhoto(photoUrl?: string | null): string | null {
  if (!photoUrl || typeof photoUrl !== 'string') return null;
  const match = photoUrl.match(/_(\d+)_\d+-\d+\./);
  return match?.[1] || null;
}

function buildFallbackVehicleLink(vehicle: any): string | null {
  if (!vehicle) return null;

  const parts = [vehicle.brand, vehicle.model, vehicle.version, vehicle.year]
    .map(part => (typeof part === 'string' ? part.trim() : String(part ?? '').trim()))
    .filter(Boolean);

  if (parts.length === 0) return null;

  const queryValue = encodeURIComponent(parts.join(' ')).replace(/%20/g, '+');
  const siteVehicleId = extractSiteVehicleIdFromPhoto(vehicle.imageUrl || vehicle.fotoUrl);
  const idParam = siteVehicleId ? `&id=${siteVehicleId}` : '';

  return `${VEHICLE_SITE_BASE_URL}/?veiculo=${queryValue}${idParam}`;
}

function normalizeVehicleLink(rawLink: string): string | null {
  const link = rawLink.trim();
  if (!link) return null;

  if (/^https?:\/\//i.test(link)) {
    return link;
  }

  if (link.startsWith('//')) {
    return `https:${link}`;
  }

  if (link.startsWith('www.')) {
    return `https://${link}`;
  }

  if (link.startsWith('/')) {
    return `${VEHICLE_SITE_BASE_URL}${link}`;
  }

  if (link.startsWith('?')) {
    return `${VEHICLE_SITE_BASE_URL}/${link}`;
  }

  if (/^[\w.-]+\.[a-z]{2,}(?:\/|$|\?)/i.test(link)) {
    return `https://${link}`;
  }

  return null;
}

function getVehicleLink(vehicle: any): string | null {
  if (!vehicle) return null;
  const candidates = [vehicle.url, vehicle.detailsUrl, vehicle.detailUrl, vehicle.link];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const link = normalizeVehicleLink(raw);
    if (link) {
      return link;
    }
  }
  return buildFallbackVehicleLink(vehicle);
}

/**
 * Format recommendations into natural language message
 *
 * @param recommendations - Vehicle recommendations to format
 * @param profile - Customer profile for context
 * @param searchType - Type of search performed
 * @returns Formatted message string
 */
export async function formatRecommendations(
  recommendations: VehicleRecommendation[],
  profile: Partial<CustomerProfile>,
  searchType: SearchType = 'recommendation'
): Promise<string> {
  if (recommendations.length === 0) {
    const wantsAppTransport = profile.usoPrincipal === 'uber';
    if (wantsAppTransport) {
      const appName =
        profile.appMencionado === '99'
          ? '99'
          : profile.appMencionado === 'uber'
            ? 'Uber'
            : 'Uber/99';
      const category =
        profile.tipoUber === 'black' ? 'Black' : profile.tipoUber === 'comfort' ? 'Comfort' : 'X';
      return `No momento não temos veículos *aptos para ${appName} ${category}* disponíveis no estoque.\n\nSe quiser, posso te ajudar a buscar um carro para outro perfil (família, viagem, trabalho) ou você pode ajustar algum critério (orçamento/ano).`;
    }

    return `Hmm, não encontrei veículos que atendam exatamente suas preferências. 🤔

Posso ajustar os critérios? Por exemplo:
- Aumentar o orçamento em 10-20%?
- Considerar anos um pouco mais antigos?
- Ver outras categorias (SUV, sedan, hatch, pickup)?

Me diz o que prefere!`;
  }

  const isSpecificSearch = searchType === 'specific';
  const showMatchScore = searchType === 'recommendation';

  try {
    // Show all recommendations (up to 5)
    const vehiclesToShow = recommendations.slice(0, 5);

    const vehiclesList = vehiclesToShow
      .map((rec, i) => {
        const v = rec.vehicle;
        const link = getVehicleLink(v);

        // Só mostrar % match em recomendações personalizadas
        const matchScore = showMatchScore && rec.matchScore ? `${Math.round(rec.matchScore)}%` : '';

        // Em busca específica com 1 resultado, não numerar
        const prefix =
          isSpecificSearch && vehiclesToShow.length === 1
            ? '🚗 '
            : `${i + 1}. ${i === 0 ? '🏆 ' : ''}`;

        let item = `${prefix}*${v.brand} ${v.model} ${v.year}*${matchScore ? ` (${matchScore} match)` : ''}
   💰 R$ ${v.price.toLocaleString('pt-BR')}
   🛣️ ${v.mileage?.toLocaleString('pt-BR') || '?'} km
   🚗 ${v.bodyType || 'N/A'}${v.transmission ? ` | ${v.transmission}` : ''}`;

        if (link) {
          item += `\n   🔗 ${link}\n`;
        }

        const explanationReasons = rec.explanation?.selectedBecause?.slice(0, 2) || [];
        const explanationConcern = rec.explanation?.notIdealBecause?.[0];
        if (explanationReasons.length > 0) {
          item += `   _Por que combina: ${explanationReasons.join(' • ')}_\n`;
        } else if (rec.reasoning) {
          item += `   _${rec.reasoning}_\n`;
        }
        if (explanationConcern) {
          item += `   _Ponto de atenção: ${explanationConcern}_\n`;
        }

        return item;
      })
      .join('\n\n');

    const intro = generateRecommendationIntro(
      profile,
      vehiclesToShow.length,
      searchType,
      vehiclesToShow[0]?.vehicle
    );

    // Outro diferente para busca específica vs recomendação
    let outro: string;
    if (vehiclesToShow.length === 1) {
      // Apenas 1 carro encontrado - mensagem direta
      if (profile.hasTradeIn && profile.tradeInModel) {
        const tradeInInfo = profile.tradeInYear
          ? `${capitalizeWords(profile.tradeInModel)} ${profile.tradeInYear}`
          : capitalizeWords(profile.tradeInModel);
        outro = `\n\nGostou? 😊 Já anotei seu ${tradeInInfo} para a troca! 🚗🔄\n\nMe conta como pretende pagar o restante:\n• À vista\n• Financiamento`;
      } else {
        outro = `\n\nGostou? 😊 Me conta como pretende pagar:\n• À vista\n• Financiamento\n• Tem carro na troca?`;
      }
    } else {
      // Vários carros - perguntar qual gostou
      if (isSpecificSearch) {
        outro = `\n\nAlgum te interessou? Me conta qual você curtiu mais que posso dar mais detalhes! 😊\n\n_Digite "reiniciar" para nova busca ou "vendedor" para falar com nossa equipe._`;
      } else {
        outro = `\n\nQual desses te interessou mais? 😊\n\nMe conta qual você curtiu que posso dar mais detalhes sobre ele!\n\n_Digite "reiniciar" para nova busca ou "vendedor" para falar com nossa equipe._`;
      }
    }

    return `${intro}\n\n${vehiclesList}${outro}`;
  } catch (error) {
    logger.error({ error }, 'Failed to format recommendations');

    // Fallback simple format
    return (
      `Encontrei ${recommendations.length} veículos para você!\n\n` +
      recommendations
        .slice(0, 5)
        .map(
          (r, i) =>
            `${i + 1}. ${r.vehicle.brand} ${r.vehicle.model} - R$ ${r.vehicle.price.toLocaleString('pt-BR')}`
        )
        .join('\n')
    );
  }
}

/**
 * Generate intro for recommendations based on profile and search type
 *
 * @param profile - Customer profile
 * @param count - Number of recommendations
 * @param searchType - Type of search
 * @param firstVehicle - First vehicle in results (for context)
 * @returns Intro message string
 */
export function generateRecommendationIntro(
  profile: Partial<CustomerProfile>,
  count: number,
  searchType: SearchType = 'recommendation',
  firstVehicle?: { brand: string; model: string; year: number }
): string {
  // Para busca específica, usar mensagem direta
  if (searchType === 'specific') {
    if (count === 1 && firstVehicle) {
      return `Encontramos o ${firstVehicle.brand} ${firstVehicle.model} ${firstVehicle.year} que você procurava! ✅`;
    } else if (firstVehicle) {
      return `Encontramos ${count} opções de ${firstVehicle.brand} ${firstVehicle.model} disponíveis:`;
    }
    return `Encontramos ${count} opção${count > 1 ? 'ões' : ''} para você:`;
  }

  // Para busca de similares
  if (searchType === 'similar') {
    return `Encontrei ${count} opção${count > 1 ? 'ões similares' : ' similar'}:`;
  }

  // Para recomendações personalizadas, usar mensagem com critérios
  const parts: string[] = [];

  if (profile.usage) {
    const usageMap: Record<string, string> = {
      cidade: 'uso urbano',
      viagem: 'viagens',
      trabalho: 'trabalho',
      misto: 'uso variado',
    };
    parts.push(usageMap[profile.usage] || profile.usage);
  }

  // Não mostrar "X pessoas" se o cliente aceitou alternativa de 5 lugares
  // (quando pediu 7 lugares e não tínhamos disponível)
  if (profile.people && !(profile as any)._acceptedFiveSeaterAlternative) {
    parts.push(`${profile.people} pessoas`);
  }

  if (profile.budget) {
    parts.push(`até R$ ${profile.budget.toLocaleString('pt-BR')}`);
  }

  const criteria = parts.length > 0 ? ` para ${parts.join(', ')}` : '';

  return `Perfeito! Encontrei ${count} veículo${count > 1 ? 's IDEAIS' : ' IDEAL'}${criteria}:`;
}
