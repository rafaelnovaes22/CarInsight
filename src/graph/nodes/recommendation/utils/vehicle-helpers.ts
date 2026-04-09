import { CustomerProfile } from '../../../../types/state.types';

const VEHICLE_SITE_BASE_URL = (
  process.env.VEHICLE_SITE_BASE_URL || 'https://www.renatinhuscars.com.br'
).replace(/\/+$/, '');

export function extractSiteVehicleIdFromPhoto(photoUrl?: string | null): string | null {
  if (!photoUrl || typeof photoUrl !== 'string') return null;
  const match = photoUrl.match(/_(\d+)_\d+-\d+\./);
  return match?.[1] || null;
}

export function buildFallbackVehicleLink(vehicle: any): string | null {
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

export function normalizeVehicleLink(rawLink: string): string | null {
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

export function getVehicleLink(vehicle: any): string | null {
  if (!vehicle) return null;
  const candidates = [vehicle.url, vehicle.detailUrl, vehicle.detailsUrl, vehicle.link];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const link = normalizeVehicleLink(raw);
    if (link) return link;
  }
  return buildFallbackVehicleLink(vehicle);
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function getVehicleName(rec: any): string {
  const vehicle = rec?.vehicle || {};
  const brand = vehicle.marca || vehicle.brand || '';
  const model = vehicle.modelo || vehicle.model || '';
  return `${brand} ${model}`.trim();
}

export function toShownVehicles(recommendations: any[]) {
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

export function profileToSearchFilters(
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

/**
 * Formata número de telefone para exibição
 */
export function formatPhoneNumber(phone: string): string {
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
export function generateWhatsAppLink(
  profile?: Partial<CustomerProfile>
): { link: string; formattedPhone: string } | null {
  const salesPhone = process.env.SALES_PHONE_NUMBER;
  if (!salesPhone) return null;

  let prefilledText = 'Olá! Vim do bot da Inovais';

  if (profile?.customerName) {
    prefilledText = `Olá! Sou ${profile.customerName}, vim do bot da Inovais`;
  }

  prefilledText += '!';
  const encodedText = encodeURIComponent(prefilledText);
  return {
    link: `https://wa.me/${salesPhone}?text=${encodedText}`,
    formattedPhone: formatPhoneNumber(salesPhone),
  };
}

export function isRecommendationRejectionMessage(message: string): boolean {
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

export function extractRejectedRecommendationIds(
  message: string,
  recommendations: any[]
): string[] {
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

  return recommendations[0]?.vehicleId ? [recommendations[0].vehicleId] : [];
}
