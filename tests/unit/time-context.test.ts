import { describe, it, expect } from 'vitest';
import {
  getTimeSlot,
  getEmotionalMode,
  isLateNight,
  isQuietHours,
  getNextSendTime,
} from '../../src/config/time-context';

describe('time-context', () => {
  describe('getTimeSlot', () => {
    it('should return morning for 06:00-11:59', () => {
      expect(getTimeSlot(new Date('2026-03-01T06:00:00'))).toBe('morning');
      expect(getTimeSlot(new Date('2026-03-01T09:30:00'))).toBe('morning');
      expect(getTimeSlot(new Date('2026-03-01T11:59:00'))).toBe('morning');
    });

    it('should return afternoon for 12:00-17:59', () => {
      expect(getTimeSlot(new Date('2026-03-01T12:00:00'))).toBe('afternoon');
      expect(getTimeSlot(new Date('2026-03-01T14:00:00'))).toBe('afternoon');
      expect(getTimeSlot(new Date('2026-03-01T17:59:00'))).toBe('afternoon');
    });

    it('should return evening for 18:00-23:59', () => {
      expect(getTimeSlot(new Date('2026-03-01T18:00:00'))).toBe('evening');
      expect(getTimeSlot(new Date('2026-03-01T20:00:00'))).toBe('evening');
      expect(getTimeSlot(new Date('2026-03-01T21:59:00'))).toBe('evening');
      expect(getTimeSlot(new Date('2026-03-01T22:00:00'))).toBe('evening');
      expect(getTimeSlot(new Date('2026-03-01T23:59:00'))).toBe('evening');
    });

    it('should return late_night for 00:00-05:59', () => {
      expect(getTimeSlot(new Date('2026-03-01T00:00:00'))).toBe('late_night');
      expect(getTimeSlot(new Date('2026-03-01T03:30:00'))).toBe('late_night');
      expect(getTimeSlot(new Date('2026-03-01T05:59:00'))).toBe('late_night');
    });

    it('should handle edge cases at boundaries', () => {
      // 5:59 → late_night, 6:00 → morning
      expect(getTimeSlot(new Date('2026-03-01T05:59:00'))).toBe('late_night');
      expect(getTimeSlot(new Date('2026-03-01T06:00:00'))).toBe('morning');

      // 11:59 → morning, 12:00 → afternoon
      expect(getTimeSlot(new Date('2026-03-01T11:59:00'))).toBe('morning');
      expect(getTimeSlot(new Date('2026-03-01T12:00:00'))).toBe('afternoon');

      // 23:59 → evening, 00:00 → late_night
      expect(getTimeSlot(new Date('2026-03-01T23:59:00'))).toBe('evening');
      expect(getTimeSlot(new Date('2026-03-01T00:00:00'))).toBe('late_night');
    });
  });

  describe('getEmotionalMode', () => {
    it('should return rational for morning', () => {
      expect(getEmotionalMode(new Date('2026-03-01T09:00:00'))).toBe('rational');
    });

    it('should return balanced for afternoon', () => {
      expect(getEmotionalMode(new Date('2026-03-01T14:00:00'))).toBe('balanced');
    });

    it('should return aspirational for evening', () => {
      expect(getEmotionalMode(new Date('2026-03-01T19:00:00'))).toBe('aspirational');
    });

    it('should return emotional for late_night', () => {
      expect(getEmotionalMode(new Date('2026-03-01T02:00:00'))).toBe('emotional');
    });
  });

  describe('isLateNight', () => {
    it('should return true during late_night hours', () => {
      expect(isLateNight(new Date('2026-03-01T00:30:00'))).toBe(true);
      expect(isLateNight(new Date('2026-03-01T02:00:00'))).toBe(true);
    });

    it('should return false during other hours', () => {
      expect(isLateNight(new Date('2026-03-01T10:00:00'))).toBe(false);
      expect(isLateNight(new Date('2026-03-01T18:00:00'))).toBe(false);
    });
  });

  describe('isQuietHours', () => {
    // Dates use explicit UTC (Z suffix) so tests pass in any server timezone.
    // Brazil (America/Sao_Paulo) is UTC-3 in March 2026.
    it('should return true during quiet hours (22h-09h BRT)', () => {
      expect(isQuietHours(new Date('2026-03-02T01:00:00Z'))).toBe(true); // 22:00 BRT
      expect(isQuietHours(new Date('2026-03-01T06:00:00Z'))).toBe(true); // 03:00 BRT
      expect(isQuietHours(new Date('2026-03-01T11:59:00Z'))).toBe(true); // 08:59 BRT (< 09h)
    });

    it('should return false during allowed hours (09h-22h BRT)', () => {
      expect(isQuietHours(new Date('2026-03-01T12:00:00Z'))).toBe(false); // 09:00 BRT
      expect(isQuietHours(new Date('2026-03-01T17:00:00Z'))).toBe(false); // 14:00 BRT
      expect(isQuietHours(new Date('2026-03-02T00:59:00Z'))).toBe(false); // 21:59 BRT
    });
  });

  describe('getNextSendTime', () => {
    // Assertions use toISOString() so they are timezone-agnostic.
    // Brazil is UTC-3 in March 2026, so 09:00 BRT = 12:00 UTC.
    it('should return same time if not in quiet hours', () => {
      const date = new Date('2026-03-01T17:30:00Z'); // 14:30 BRT — allowed
      expect(getNextSendTime(date)).toEqual(date);
    });

    it('should return 09:00 BRT next day if past 22h BRT', () => {
      // 23:30 BRT March 1 = 02:30 UTC March 2
      const date = new Date('2026-03-02T02:30:00Z');
      const next = getNextSendTime(date);
      // Expected: 09:00 BRT March 2 = 12:00 UTC March 2
      expect(next.toISOString()).toBe('2026-03-02T12:00:00.000Z');
    });

    it('should return 09:00 BRT same day if early morning BRT', () => {
      // 03:00 BRT March 1 = 06:00 UTC March 1
      const date = new Date('2026-03-01T06:00:00Z');
      const next = getNextSendTime(date);
      // Expected: 09:00 BRT March 1 = 12:00 UTC March 1
      expect(next.toISOString()).toBe('2026-03-01T12:00:00.000Z');
    });
  });
});
