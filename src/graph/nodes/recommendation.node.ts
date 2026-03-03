import { IGraphState } from '../../types/graph.types';
import { CustomerProfile } from '../../types/state.types';
import { createNodeTimer } from '../../lib/node-metrics';
import { logger } from '../../lib/logger';
import { AIMessage } from '@langchain/core/messages';
import { vehicleSearchAdapter } from '../../services/vehicle-search-adapter.service';
import {
  getRandomVariation,
  getVehicleIntroMessage,
  getVehicleClosingMessage,
  getHandoffMessage,
} from '../../config/conversation-style';
import { getTimeSlot } from '../../config/time-context';
import { getRecommendationFraming, getEmotionalClosing } from '../../config/emotional-copy';
import { featureFlags } from '../../lib/feature-flags';

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
  if (link.startsWith('http://') || link.startsWith('https://')) return link;
  if (link.startsWith('//')) return `https:${link}`;
  if (link.startsWith('www.')) return `https://${link}`;
  if (link.startsWith('/')) return `${VEHICLE_SITE_BASE_URL}${link}`;
  if (link.startsWith('?')) return `${VEHICLE_SITE_BASE_URL}/${link}`;
  if (/^[\w.-]+\.[a-z]{2,}(?:\/|$|\?)/i.test(link)) return `https://${link}`;
  return null;
}

function getVehicleLink(vehicle: any): string | null {
  if (!vehicle) return null;
  const candidates = [vehicle.url, vehicle.detailUrl, vehicle.detailsUrl, vehicle.link];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const link = normalizeVehicleLink(raw);
    if (link) {
      return link;
    }
  }
  return buildFallbackVehicleLink(vehicle);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isRecommendationRejectionMessage(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    /nao\s+gostei/.test(normalized) ||
    /nao\s+quero/.test(normalized) ||
    /nao\s+curti/.test(normalized) ||
    /prefiro\s+outro/.test(normalized) ||
    /mostra\s+outro/.test(normalized) ||
    /tem\s+outro/.test(normalized) ||
    /quero\s+outro/.test(normalized)
  );
}

function extractRejectedRecommendationIds(message: string, recommendations: any[]): string[] {
  if (!isRecommendationRejectionMessage(message) || recommendations.length === 0) {
    return [];
  }

  const normalizedMessage = normalizeText(message);
  const explicitMatches = recommendations
    .filter(rec => {
      const vehicle = rec?.vehicle;
      const brand = normalizeText(vehicle?.marca || vehicle?.brand || '');
      const model = normalizeText(vehicle?.modelo || vehicle?.model || '');
      const fullName = `${brand} ${model}`.trim();

      if (fullName && normalizedMessage.includes(fullName)) return true;
      if (model && normalizedMessage.includes(model)) return true;
      return false;
    })
    .map(rec => rec.vehicleId);

  if (explicitMatches.length > 0) {
    return Array.from(new Set(explicitMatches));
  }

  if (/\bprimeir[oa]\b|\b1\b/.test(normalizedMessage) && recommendations[0]?.vehicleId) {
    return [recommendations[0].vehicleId];
  }
  if (/\bsegund[oa]\b|\b2\b/.test(normalizedMessage) && recommendations[1]?.vehicleId) {
    return [recommendations[1].vehicleId];
  }
  if (/\bterceir[oa]\b|\b3\b/.test(normalizedMessage) && recommendations[2]?.vehicleId) {
    return [recommendations[2].vehicleId];
  }

  // Generic rejection without explicit model: replace the top recommendation.
  return recommendations[0]?.vehicleId ? [recommendations[0].vehicleId] : [];
}

function profileToSearchFilters(
  profile?: Partial<CustomerProfile>,
  fallbackBodyType?: string
): any {
  const budget = profile?.budget ?? profile?.orcamento ?? profile?.budgetMax;
  const bodyType = (profile?.bodyType || fallbackBodyType || '').trim();

  const filters: any = {
    limit: 8,
    excludeMotorcycles: true,
  };

  if (budget) filters.maxPrice = budget;
  if (profile?.minYear) filters.minYear = profile.minYear;
  if (profile?.maxKm) filters.maxKm = profile.maxKm;
  if (profile?.transmission) filters.transmission = profile.transmission;
  if (bodyType) filters.bodyType = bodyType;
  if (profile?.brand) filters.brand = profile.brand;

  return filters;
}

function getVehicleName(rec: any): string {
  const vehicle = rec?.vehicle || {};
  const brand = vehicle.marca || vehicle.brand || '';
  const model = vehicle.modelo || vehicle.model || '';
  return `${brand} ${model}`.trim();
}

function toShownVehicles(recommendations: any[]) {
  return recommendations.map(rec => {
    const vehicle = rec?.vehicle || {};
    return {
      vehicleId: rec.vehicleId,
      brand: vehicle.marca || vehicle.brand || '',
      model: vehicle.modelo || vehicle.model || '',
      year: vehicle.ano || vehicle.year || 0,
      price: Number(vehicle.preco ?? vehicle.price ?? 0) || 0,
      bodyType: vehicle.carroceria || vehicle.bodyType,
    };
  });
}

/**
 * Format recommendations into WhatsApp message - ESTILO NATURAL
 * When emotional selling is enabled, adds emotional framing based on time slot.
 */
function formatRecommendations(recommendations: any[]): string {
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

  // Intro natural (sem emoji excessivo)
  let message = `${getVehicleIntroMessage()}\n\n`;

  // Badges for best match and best value
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

    // Badge (only when emotional selling is on)
    let badge = '';
    if (useEmotional) {
      if (index === 0 && recommendations.length > 1) badge = ' ⭐ Mais popular';
      else if (index === bestValueIndex && recommendations.length > 1)
        badge = ' 💰 Melhor custo-benefício';
    }

    // Formato compacto e natural
    message += `*${num}. ${brand} ${model}* ${ano}${badge}\n`;
    message += `   ${km} • R$ ${price}`;

    // Cor só se relevante
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

    // Emotional framing after each vehicle (late_night/evening only)
    if (useEmotional) {
      const vehicleName = `${brand} ${model}`.trim();
      const framing = getRecommendationFraming(vehicleName, timeSlot);
      if (framing) {
        message += `   _${framing}_\n`;
      }
    }

    message += `\n`;
  });

  // Fechamento: emocional ou natural
  if (useEmotional) {
    message += getEmotionalClosing(timeSlot);
  } else {
    message += getVehicleClosingMessage();
  }

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

  // Handle recommendation rejection and replacement request
  if (state.recommendations.length > 0 && isRecommendationRejectionMessage(lowerMessage)) {
    const rejectedIds = extractRejectedRecommendationIds(lowerMessage, state.recommendations);

    if (rejectedIds.length > 0) {
      const rejectedSet = new Set(rejectedIds);
      const keptRecommendations = state.recommendations.filter(
        rec => !rejectedSet.has(rec.vehicleId)
      );
      const targetCount = Math.max(state.recommendations.length, 1);
      const replacementsNeeded = Math.max(targetCount - keptRecommendations.length, 0);
      const previouslyExcluded = state.profile?._excludeVehicleIds || [];
      const excludeIds = Array.from(
        new Set([...previouslyExcluded, ...state.recommendations.map(rec => rec.vehicleId)])
      );

      let replacements: any[] = [];
      if (replacementsNeeded > 0) {
        const firstRejected = state.recommendations.find(rec => rejectedSet.has(rec.vehicleId));
        const fallbackBodyType =
          firstRejected?.vehicle?.carroceria || firstRejected?.vehicle?.bodyType || '';
        const filters = profileToSearchFilters(state.profile, fallbackBodyType);
        filters.excludeIds = excludeIds;
        filters.limit = Math.max(replacementsNeeded * 3, 8);

        const replacementQuery = [
          state.profile?.bodyType,
          state.profile?.usage || state.profile?.usoPrincipal,
        ]
          .filter(Boolean)
          .join(' ')
          .trim();

        try {
          const searchResults = await vehicleSearchAdapter.search(replacementQuery, filters);
          replacements = searchResults
            .filter(rec => !excludeIds.includes(rec.vehicleId))
            .slice(0, replacementsNeeded);
        } catch (error) {
          logger.warn({ error }, 'RecommendationNode: Failed to fetch replacement recommendations');
        }
      }

      const updatedRecommendations = [...keptRecommendations, ...replacements].slice(
        0,
        targetCount
      );

      if (updatedRecommendations.length > 0) {
        const rejectedNames = state.recommendations
          .filter(rec => rejectedSet.has(rec.vehicleId))
          .map(getVehicleName)
          .filter(Boolean);
        const removedText =
          rejectedNames.length > 0
            ? rejectedNames.join(', ')
            : getRandomVariation(['essa opção', 'esse carro', 'essa recomendação']);
        const intro = `Perfeito, tirei ${removedText} da lista. Separei novas opções para você:`;

        return {
          messages: [new AIMessage(`${intro}\n\n${formatRecommendations(updatedRecommendations)}`)],
          recommendations: updatedRecommendations,
          profile: {
            ...state.profile,
            _excludeVehicleIds: Array.from(new Set([...previouslyExcluded, ...rejectedIds])),
            _showedRecommendation: true,
            _lastSearchType: 'recommendation',
            _lastShownVehicles: toShownVehicles(updatedRecommendations),
          },
          metadata: {
            ...state.metadata,
            lastMessageAt: Date.now(),
          },
        };
      }

      return {
        messages: [
          new AIMessage(
            'Sem problemas! Tirei essa opção, mas não encontrei outra com os mesmos critérios agora. Quer ajustar orçamento, ano ou tipo de carro para eu buscar de novo?'
          ),
        ],
        profile: {
          ...state.profile,
          _excludeVehicleIds: Array.from(new Set([...previouslyExcluded, ...rejectedIds])),
          _showedRecommendation: false,
        },
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
        },
      };
    }
  }

  const hasNegativePreference = /\bn[ãa]o\s+(gostei|quero|curti)\b/i.test(lowerMessage);
  if (
    !hasNegativePreference &&
    /gostei|interessei|quero esse|quero o|vou levar|fechar|comprar/i.test(lowerMessage)
  ) {
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
        detailsMessage += `💰 R$ ${parseFloat(String(price)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
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

  // Handle questions about criteria / collected profile
  const isCriteriaQuestion =
    /crit[eé]rio/i.test(lowerMessage) ||
    /prefer[eê]ncia/i.test(lowerMessage) ||
    /que (voc[eê]|vc) (sabe|tem|coletou)/i.test(lowerMessage) ||
    /quais (s[aã]o|eram) (os|as)/i.test(lowerMessage);

  if (isCriteriaQuestion) {
    const profile = state.profile || {};
    const collected: string[] = [];
    const missing: string[] = [];

    if (profile.budget)
      collected.push(`💰 Orçamento: até R$ ${profile.budget.toLocaleString('pt-BR')}`);
    else missing.push('orçamento');

    if (profile.usage || profile.usoPrincipal)
      collected.push(`🎯 Uso: ${profile.usage || profile.usoPrincipal}`);
    else missing.push('uso principal');

    if (profile.bodyType) collected.push(`🚗 Tipo: ${profile.bodyType}`);
    if (profile.minYear) collected.push(`📅 Ano mínimo: ${profile.minYear}`);
    if (profile.transmission) collected.push(`⚙️ Câmbio: ${profile.transmission}`);

    let response = '';
    if (collected.length > 0) {
      response += `Até agora, tenho essas informações:\n${collected.join('\n')}`;
    }
    if (missing.length > 0) {
      response += `\n\nAinda preciso saber: *${missing.join('* e *')}*`;
      response += '\n\nPode me contar?';
    }

    logger.info(
      { collected: collected.length, missing },
      'RecommendationNode: Criteria question detected, redirecting to discovery'
    );

    return {
      messages: [new AIMessage(response)],
      next: 'discovery',
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
