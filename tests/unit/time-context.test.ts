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

    it('should return evening for 18:00-21:59', () => {
      expect(getTimeSlot(new Date('2026-03-01T18:00:00'))).toBe('evening');
      expect(getTimeSlot(new Date('2026-03-01T20:00:00'))).toBe('evening');
      expect(getTimeSlot(new Date('2026-03-01T21:59:00'))).toBe('evening');
    });

    it('should return late_night for 22:00-05:59', () => {
      expect(getTimeSlot(new Date('2026-03-01T22:00:00'))).toBe('late_night');
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

      // 21:59 → evening, 22:00 → late_night
      expect(getTimeSlot(new Date('2026-03-01T21:00:00'))).toBe('evening');
      expect(getTimeSlot(new Date('2026-03-01T22:00:00'))).toBe('late_night');
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
      expect(getEmotionalMode(new Date('2026-03-01T23:00:00'))).toBe('emotional');
    });
  });

  describe('isLateNight', () => {
    it('should return true during late_night hours', () => {
      expect(isLateNight(new Date('2026-03-01T23:00:00'))).toBe(true);
      expect(isLateNight(new Date('2026-03-01T02:00:00'))).toBe(true);
    });

    it('should return false during other hours', () => {
      expect(isLateNight(new Date('2026-03-01T10:00:00'))).toBe(false);
      expect(isLateNight(new Date('2026-03-01T18:00:00'))).toBe(false);
    });
  });

  describe('isQuietHours', () => {
    it('should return true between 22h and 08h', () => {
      expect(isQuietHours(new Date('2026-03-01T22:00:00'))).toBe(true);
      expect(isQuietHours(new Date('2026-03-01T03:00:00'))).toBe(true);
      expect(isQuietHours(new Date('2026-03-01T07:59:00'))).toBe(true);
    });

    it('should return false between 08h and 22h', () => {
      expect(isQuietHours(new Date('2026-03-01T08:00:00'))).toBe(false);
      expect(isQuietHours(new Date('2026-03-01T14:00:00'))).toBe(false);
      expect(isQuietHours(new Date('2026-03-01T21:59:00'))).toBe(false);
    });
  });

  describe('getNextSendTime', () => {
    it('should return same time if not in quiet hours', () => {
      const date = new Date('2026-03-01T14:30:00');
      expect(getNextSendTime(date)).toEqual(date);
    });

    it('should return 08:00 next day if past 22h', () => {
      const date = new Date('2026-03-01T23:30:00');
      const next = getNextSendTime(date);
      expect(next.getHours()).toBe(8);
      expect(next.getMinutes()).toBe(0);
      expect(next.getDate()).toBe(2); // next day
    });

    it('should return 08:00 same day if early morning', () => {
      const date = new Date('2026-03-01T03:00:00');
      const next = getNextSendTime(date);
      expect(next.getHours()).toBe(8);
      expect(next.getMinutes()).toBe(0);
      expect(next.getDate()).toBe(1); // same day
    });
  });
});
