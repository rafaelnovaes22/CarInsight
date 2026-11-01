import { describe, it, expect } from 'vitest';
import { hasFlag, addFlag, removeFlag, addFlagIf } from '../../../src/utils/state-flags';

describe('state-flags', () => {
  describe('hasFlag', () => {
    it('should return true when flag exists', () => {
      expect(hasFlag(['handoff_requested', 'visit_requested'], 'handoff_requested')).toBe(true);
    });

    it('should return false when flag does not exist', () => {
      expect(hasFlag(['visit_requested'], 'handoff_requested')).toBe(false);
    });

    it('should handle undefined flags', () => {
      expect(hasFlag(undefined, 'handoff_requested')).toBe(false);
    });

    it('should handle empty array', () => {
      expect(hasFlag([], 'handoff_requested')).toBe(false);
    });
  });

  describe('addFlag', () => {
    it('should add flag when not present', () => {
      const result = addFlag(['visit_requested'], 'handoff_requested');
      expect(result).toEqual(['visit_requested', 'handoff_requested']);
    });

    it('should not duplicate existing flag', () => {
      const result = addFlag(['handoff_requested'], 'handoff_requested');
      expect(result).toEqual(['handoff_requested']);
    });

    it('should handle undefined flags', () => {
      const result = addFlag(undefined, 'handoff_requested');
      expect(result).toEqual(['handoff_requested']);
    });

    it('should handle dynamic flags like viewed_vehicle_123', () => {
      const result = addFlag([], 'viewed_vehicle_abc123');
      expect(result).toEqual(['viewed_vehicle_abc123']);
    });
  });

  describe('removeFlag', () => {
    it('should remove existing flag', () => {
      const result = removeFlag(['handoff_requested', 'visit_requested'], 'handoff_requested');
      expect(result).toEqual(['visit_requested']);
    });

    it('should return same array when flag not found', () => {
      const result = removeFlag(['visit_requested'], 'handoff_requested');
      expect(result).toEqual(['visit_requested']);
    });

    it('should handle undefined flags', () => {
      const result = removeFlag(undefined, 'handoff_requested');
      expect(result).toEqual([]);
    });
  });

  describe('addFlagIf', () => {
    it('should add flag when condition is true', () => {
      const result = addFlagIf([], 'handoff_requested', true);
      expect(result).toEqual(['handoff_requested']);
    });

    it('should not add flag when condition is false', () => {
      const result = addFlagIf([], 'handoff_requested', false);
      expect(result).toEqual([]);
    });

    it('should not duplicate when condition is true but flag exists', () => {
      const result = addFlagIf(['handoff_requested'], 'handoff_requested', true);
      expect(result).toEqual(['handoff_requested']);
    });

    it('should handle undefined flags with condition false', () => {
      const result = addFlagIf(undefined, 'handoff_requested', false);
      expect(result).toEqual([]);
    });
  });
});
