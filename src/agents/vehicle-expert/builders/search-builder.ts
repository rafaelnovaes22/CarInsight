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

  return {
    searchText: searchParts.join(' ') || 'carro usado',
    filters: {
      maxPrice: profile.budget || profile.budgetMax,
      minPrice: profile.budgetMin,
      minYear: profile.minYear,
      maxKm: profile.maxKm,
      minSeats: profile.minSeats,
      bodyType: profile.bodyType ? [profile.bodyType] : undefined,
      transmission: profile.transmission ? [profile.transmission] : undefined,
      brand: profile.brand ? [profile.brand] : undefined,
      model: profile.model ? [profile.model] : undefined,
      // Uber filters
      aptoUber: profile.usoPrincipal === 'uber' || (profile.usage as string) === 'uber' || profile.appMencionado === 'uber' || profile.appMencionado === '99',
      aptoUberBlack: profile.tipoUber === 'black' || (profile.priorities && profile.priorities.some(p => p.toLowerCase().includes('black'))),
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
