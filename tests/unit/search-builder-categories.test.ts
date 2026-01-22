import { describe, it, expect } from 'vitest';
import { buildSearchQuery } from '../../src/agents/vehicle-expert/builders/search-builder';
import { CustomerProfile } from '../../src/types/state.types';

describe('SearchBuilder - Category Mapping', () => {
  it('should map "entrega" intent to aptoEntrega filter', () => {
    const profile: Partial<CustomerProfile> = {
      usoPrincipal: 'entrega',
      budget: 50000,
    };

    const query = buildSearchQuery(profile);
    expect(query.filters.aptoEntrega).toBe(true);
    expect(query.filters.aptoCarga).toBe(false); // Should not be confused
  });

  it('should map "carga" intent to aptoCarga filter', () => {
    const profile: Partial<CustomerProfile> = {
      usoPrincipal: 'carga',
      budget: 80000,
    };

    const query = buildSearchQuery(profile);
    expect(query.filters.aptoCarga).toBe(true);
    expect(query.filters.aptoEntrega).toBe(false);
  });

  it('should map "diario" intent to aptoUsoDiario filter', () => {
    const profile: Partial<CustomerProfile> = {
      usoPrincipal: 'diario',
      budget: 40000,
    };

    const query = buildSearchQuery(profile);
    expect(query.filters.aptoUsoDiario).toBe(true);
  });

  it('should map "familia" intent to aptoFamilia filter', () => {
    const profile: Partial<CustomerProfile> = {
      usoPrincipal: 'familia',
      minSeats: 5,
    };

    const query = buildSearchQuery(profile);
    expect(query.filters.aptoFamilia).toBe(true);
  });

  it('should map priorities describing CARGA to aptoCarga filter', () => {
    const profile: Partial<CustomerProfile> = {
      // usoPrincipal undefined but priority set
      priorities: ['economico', 'carga'],
    };

    const query = buildSearchQuery(profile);
    expect(query.filters.aptoCarga).toBe(true);
  });
});
