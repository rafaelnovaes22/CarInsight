/**
 * Healthcare Search Adapter — Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { healthcareSearchAdapter } from '../../../../src/domains/healthcare/search-adapter';

describe('healthcareSearchAdapter', () => {
  describe('search', () => {
    it('returns results for a known specialty', async () => {
      const results = await healthcareSearchAdapter.search('cardiologia', {
        specialty: 'cardiologia',
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.specialty).toBe('cardiologia');
      expect(results[0].matchScore).toBe(1.0);
    });

    it('returns results by doctor name', async () => {
      const results = await healthcareSearchAdapter.search('Ana Silva', {});
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.name).toBe('Dra. Ana Silva');
    });

    it('falls back to clinico_geral for unknown queries', async () => {
      const results = await healthcareSearchAdapter.search('xyz_unknown', {});
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.specialty).toBe('clinico_geral');
    });

    it('includes slots in item data', async () => {
      const results = await healthcareSearchAdapter.search('', { specialty: 'dermatologia' });
      expect(results.length).toBeGreaterThan(0);
      const slots = results[0].item.slots as any[];
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toHaveProperty('date');
      expect(slots[0]).toHaveProperty('time');
      expect(slots[0]).toHaveProperty('doctorName');
    });

    it('includes highlights with available times', async () => {
      const results = await healthcareSearchAdapter.search('', { specialty: 'ortopedia' });
      expect(results[0].highlights.length).toBeGreaterThan(0);
    });
  });

  describe('getById', () => {
    it('returns professional by ID', async () => {
      const result = await healthcareSearchAdapter.getById('doc-001');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Dra. Ana Silva');
      expect(result?.specialty).toBe('clinico_geral');
    });

    it('returns null for unknown ID', async () => {
      const result = await healthcareSearchAdapter.getById('doc-999');
      expect(result).toBeNull();
    });

    it('includes slots in result', async () => {
      const result = await healthcareSearchAdapter.getById('doc-002');
      expect(result?.slots).toBeDefined();
      expect((result?.slots as any[]).length).toBeGreaterThan(0);
    });
  });
});
