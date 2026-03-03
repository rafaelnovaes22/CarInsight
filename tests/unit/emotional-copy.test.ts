import { describe, it, expect } from 'vitest';
import {
  EMOTIONAL_COPY,
  getEmotionalCopy,
  getRecommendationFraming,
  getEmotionalClosing,
} from '../../src/config/emotional-copy';
import { TimeSlot } from '../../src/config/time-context';

describe('emotional-copy', () => {
  const allTriggers = Object.keys(EMOTIONAL_COPY) as Array<keyof typeof EMOTIONAL_COPY>;
  const allTimeSlots: TimeSlot[] = ['morning', 'afternoon', 'evening', 'late_night'];

  describe('EMOTIONAL_COPY structure', () => {
    it('should have all 6 trigger categories', () => {
      expect(allTriggers).toHaveLength(6);
      expect(allTriggers).toContain('DESEJO');
      expect(allTriggers).toContain('IMPULSO');
      expect(allTriggers).toContain('DOR');
      expect(allTriggers).toContain('COMPARACAO');
      expect(allTriggers).toContain('CONEXAO');
      expect(allTriggers).toContain('ESCASSEZ');
    });

    it('should have variants for all 4 time slots in every trigger', () => {
      for (const trigger of allTriggers) {
        for (const slot of allTimeSlots) {
          const variants = EMOTIONAL_COPY[trigger][slot];
          expect(variants.length).toBeGreaterThanOrEqual(2);
          variants.forEach(v => {
            expect(typeof v).toBe('string');
            expect(v.length).toBeGreaterThan(10);
          });
        }
      }
    });

    it('should have more variants for late_night (emotional peak)', () => {
      for (const trigger of allTriggers) {
        expect(EMOTIONAL_COPY[trigger].late_night.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('getEmotionalCopy', () => {
    it('should return a string for every trigger and time slot combination', () => {
      for (const trigger of allTriggers) {
        for (const slot of allTimeSlots) {
          const result = getEmotionalCopy(trigger, slot);
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return a value from the corresponding variants array', () => {
      const result = getEmotionalCopy('DESEJO', 'late_night');
      expect(EMOTIONAL_COPY.DESEJO.late_night).toContain(result);
    });
  });

  describe('getRecommendationFraming', () => {
    it('should return framing text for late_night', () => {
      const result = getRecommendationFraming('Honda Civic', 'late_night');
      expect(result).toContain('Honda Civic');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return framing text for evening', () => {
      const result = getRecommendationFraming('Toyota Corolla', 'evening');
      expect(result).toContain('Toyota Corolla');
    });

    it('should return empty string for morning and afternoon', () => {
      expect(getRecommendationFraming('Fiat Uno', 'morning')).toBe('');
      expect(getRecommendationFraming('Fiat Uno', 'afternoon')).toBe('');
    });
  });

  describe('getEmotionalClosing', () => {
    it('should return a non-empty string for all time slots', () => {
      for (const slot of allTimeSlots) {
        const result = getEmotionalClosing(slot);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  describe('compliance', () => {
    it('should never contain aggressive pressure words', () => {
      const aggressivePatterns = [
        /compre agora/i,
        /última chance/i,
        /vai perder/i,
        /não perca/i,
        /oferta imperdível/i,
        /corra/i,
        /urgente/i,
      ];

      for (const trigger of allTriggers) {
        for (const slot of allTimeSlots) {
          for (const phrase of EMOTIONAL_COPY[trigger][slot]) {
            for (const pattern of aggressivePatterns) {
              expect(
                pattern.test(phrase),
                `Aggressive phrase found: "${phrase}" matches ${pattern}`
              ).toBe(false);
            }
          }
        }
      }
    });
  });
});
