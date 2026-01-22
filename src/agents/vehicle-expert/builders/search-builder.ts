/**
 * Search Builder
 *
 * Builds search queries from customer profiles.
 */

import { CustomerProfile } from '../../../types/state.types';
import { VehicleSearchQuery } from '../../../types/conversation.types';

/**
 * Build search query from customer profile
 *
 * @param profile - Customer profile with preferences
 * @returns Search query object for vehicle search
 */
export function buildSearchQuery(profile: Partial<CustomerProfile>): VehicleSearchQuery {
  const searchParts: string[] = [];

  // Include model and year first for exact search detection
  if (profile.model) {
    searchParts.push(profile.model);
  }
  if (profile.minYear) {
    searchParts.push(profile.minYear.toString());
  }
  if (profile.bodyType) {
    searchParts.push(profile.bodyType);
  }
  if (profile.usage) {
    searchParts.push(profile.usage);
  }
  if (profile.priorities) {
    searchParts.push(...profile.priorities);
  }

  // Determine Uber context
  const isUber =
    profile.usoPrincipal === 'uber' ||
    (profile.usage as string) === 'uber' ||
    profile.appMencionado === 'uber' ||
    profile.appMencionado === '99';
  const isUberBlack =
    profile.tipoUber === 'black' ||
    (profile.priorities && profile.priorities.some(p => p.toLowerCase().includes('black')));

  // Calculate dynamic minYear based on Uber rules (2026 baseline)
  const currentYear = new Date().getFullYear();
  let calculatedMinYear = profile.minYear;

  if (isUberBlack) {
    // Uber Black: Max 6 years (e.g., in 2026 -> 2020+)
    const minBlackYear = currentYear - 6;
    calculatedMinYear = calculatedMinYear
      ? Math.max(calculatedMinYear, minBlackYear)
      : minBlackYear;
  } else if (isUber) {
    // Uber X: Max 10 years (e.g., in 2026 -> 2016+)
    const minXYear = currentYear - 10;
    calculatedMinYear = calculatedMinYear ? Math.max(calculatedMinYear, minXYear) : minXYear;
  }

  return {
    searchText: searchParts.join(' ') || 'carro usado',
    filters: {
      maxPrice: profile.budget || profile.budgetMax,
      minPrice: profile.budgetMin,
      minYear: calculatedMinYear,
      maxKm: profile.maxKm,
      minSeats: profile.minSeats,
      bodyType: profile.bodyType ? [profile.bodyType] : undefined,
      transmission: profile.transmission ? [profile.transmission] : undefined,
      brand: profile.brand ? [profile.brand] : undefined,
      model: profile.model ? [profile.model] : undefined,
      // Uber filters
      aptoUber: isUber,
      aptoUberBlack: isUberBlack,
      // Specific use-case filters
      aptoFamilia: profile.usoPrincipal === 'familia',
      aptoCarga:
        profile.usoPrincipal === 'carga' ||
        !!(profile.priorities && profile.priorities.includes('carga')),
      aptoEntrega: profile.usoPrincipal === 'entrega',
      aptoUsoDiario: profile.usoPrincipal === 'diario',
    },
    preferences: {
      usage: profile.usage,
      people: profile.people,
      priorities: profile.priorities,
      dealBreakers: profile.dealBreakers,
    },
    limit: 5,
    minMatchScore: 60,
  };
}
