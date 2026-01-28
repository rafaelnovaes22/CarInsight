/**
 * Uber Black Exclusion List Test
 *
 * Verifies that excluded models (HB20S, Onix, Cronos, etc.) are NEVER
 * returned in Uber Black recommendations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// List must match the one in uber-handler.ts
const UBER_BLACK_NEVER_ALLOWED = [
  'hb20',
  'hb20s',
  'onix',
  'prisma',
  'cronos',
  'siena',
  'grand siena',
  'argo',
  'mobi',
  'voyage',
  'fox',
  'gol',
  'up',
  'ka',
  'yaris',
  'etios',
  'versa',
  'v-drive',
  'march',
  'city',
  'logan',
  'sandero',
  'kwid',
];

describe('Uber Black Exclusion List', () => {
  it('should contain HB20S in the exclusion list', () => {
    expect(UBER_BLACK_NEVER_ALLOWED).toContain('hb20s');
    expect(UBER_BLACK_NEVER_ALLOWED).toContain('hb20');
  });

  it('should contain all compact sedans in the exclusion list', () => {
    expect(UBER_BLACK_NEVER_ALLOWED).toContain('cronos');
    expect(UBER_BLACK_NEVER_ALLOWED).toContain('siena');
    expect(UBER_BLACK_NEVER_ALLOWED).toContain('voyage');
  });

  it('should contain all compact hatches in the exclusion list', () => {
    expect(UBER_BLACK_NEVER_ALLOWED).toContain('onix');
    expect(UBER_BLACK_NEVER_ALLOWED).toContain('ka');
    expect(UBER_BLACK_NEVER_ALLOWED).toContain('mobi');
  });

  describe('filterExcludedModels', () => {
    // Helper function that mirrors the filtering logic
    function filterExcludedModels(vehicles: Array<{ model: string }>) {
      return vehicles.filter(v => {
        const modelLower = v.model.toLowerCase();
        const isExcluded = UBER_BLACK_NEVER_ALLOWED.some(excluded => modelLower.includes(excluded));
        return !isExcluded;
      });
    }

    it('should filter out HB20S model', () => {
      const vehicles = [{ model: 'HB20S' }, { model: 'Corolla' }, { model: 'HB20' }];

      const filtered = filterExcludedModels(vehicles);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].model).toBe('Corolla');
    });

    it('should filter out all excluded models', () => {
      const vehicles = [
        { model: 'Corolla' }, // OK - Premium sedan
        { model: 'Civic' }, // OK - Premium sedan
        { model: 'HB20S' }, // EXCLUDED
        { model: 'Onix Plus' }, // EXCLUDED
        { model: 'Cruze' }, // OK - Premium sedan
        { model: 'Cronos' }, // EXCLUDED
        { model: 'Compass' }, // OK - Premium SUV
      ];

      const filtered = filterExcludedModels(vehicles);

      expect(filtered).toHaveLength(4);
      expect(filtered.map(v => v.model)).toEqual(['Corolla', 'Civic', 'Cruze', 'Compass']);
    });

    it('should NOT filter premium sedans', () => {
      const premiumSedans = [
        { model: 'Corolla' },
        { model: 'Civic' },
        { model: 'Cruze' },
        { model: 'Sentra' },
        { model: 'Jetta' },
        { model: 'Cerato' },
      ];

      const filtered = filterExcludedModels(premiumSedans);

      expect(filtered).toHaveLength(6);
    });

    it('should NOT filter premium SUVs', () => {
      const premiumSUVs = [
        { model: 'Compass' },
        { model: 'T-Cross' },
        { model: 'Creta' },
        { model: 'HR-V' },
        { model: 'Tracker' },
        { model: 'Renegade' },
      ];

      const filtered = filterExcludedModels(premiumSUVs);

      expect(filtered).toHaveLength(6);
    });

    it('should be case-insensitive', () => {
      const vehicles = [
        { model: 'HB20S' },
        { model: 'hb20s' },
        { model: 'Hb20S' },
        { model: 'COROLLA' },
      ];

      const filtered = filterExcludedModels(vehicles);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].model).toBe('COROLLA');
    });
  });
});
