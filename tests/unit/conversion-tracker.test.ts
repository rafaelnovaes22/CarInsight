import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock privacy
vi.mock('../../src/lib/privacy', () => ({
  maskPhoneNumber: vi.fn((phone: string) => phone.substring(0, 8) + '****'),
}));

import { conversionTracker } from '../../src/services/conversion-tracker.service';

describe('ConversionTrackerService', () => {
  // Use daytime dates to avoid late_night bonus affecting isolated tests
  const daytimeStart = new Date('2026-03-01T10:00:00');
  const daytimeEnd = new Date('2026-03-01T10:06:00'); // 6 minutes
  const daytimeShort = new Date('2026-03-01T10:01:00'); // 1 minute (no duration bonus)

  const baseMetadata = {
    startedAt: daytimeStart,
    lastMessageAt: daytimeEnd,
    flags: [] as string[],
    messageCount: 5,
  };

  describe('calculateScore', () => {
    it('should return 0 for empty profile and no signals', () => {
      const score = conversionTracker.calculateScore(
        {},
        { ...baseMetadata, startedAt: daytimeStart, lastMessageAt: daytimeShort }
      );
      expect(score).toBe(0);
    });

    it('should add 10 for having a name', () => {
      const score = conversionTracker.calculateScore(
        { customerName: 'João' },
        { ...baseMetadata, startedAt: daytimeStart, lastMessageAt: daytimeShort }
      );
      expect(score).toBe(10);
    });

    it('should add 15 for having a budget', () => {
      const score = conversionTracker.calculateScore(
        { budget: 50000 },
        { ...baseMetadata, startedAt: daytimeStart, lastMessageAt: daytimeShort }
      );
      expect(score).toBe(15);
    });

    it('should add 20 for specific model', () => {
      const score = conversionTracker.calculateScore(
        { model: 'Civic' },
        { ...baseMetadata, startedAt: daytimeStart, lastMessageAt: daytimeShort }
      );
      expect(score).toBe(20);
    });

    it('should add 15 for viewed vehicle details', () => {
      const score = conversionTracker.calculateScore(
        {},
        {
          ...baseMetadata,
          flags: ['viewed_vehicle_123'],
          startedAt: daytimeStart,
          lastMessageAt: daytimeShort,
        }
      );
      expect(score).toBe(15);
    });

    it('should add 20 for financing interest', () => {
      const score = conversionTracker.calculateScore(
        { wantsFinancing: true },
        { ...baseMetadata, startedAt: daytimeStart, lastMessageAt: daytimeShort }
      );
      expect(score).toBe(20);
    });

    it('should add 15 for trade-in mention', () => {
      const score = conversionTracker.calculateScore(
        { hasTradeIn: true },
        { ...baseMetadata, startedAt: daytimeStart, lastMessageAt: daytimeShort }
      );
      expect(score).toBe(15);
    });

    it('should add 15 for returning customer', () => {
      const score = conversionTracker.calculateScore(
        {},
        {
          ...baseMetadata,
          flags: ['returning_customer'],
          startedAt: daytimeStart,
          lastMessageAt: daytimeShort,
        }
      );
      expect(score).toBe(15);
    });

    it('should add 10 for session > 5 minutes', () => {
      const score = conversionTracker.calculateScore({}, baseMetadata); // 6 min session
      expect(score).toBe(10);
    });

    it('should calculate composite score correctly', () => {
      const score = conversionTracker.calculateScore(
        {
          customerName: 'Maria', // +10
          budget: 80000, // +15
          model: 'Compass', // +20
          wantsFinancing: true, // +20
          hasTradeIn: true, // +15
        },
        {
          ...baseMetadata, // +10 (session > 5min)
          flags: ['viewed_vehicle_abc'], // +15
        }
      );
      // 10 + 15 + 20 + 15 + 20 + 15 + 10 = 105 → capped at 100
      expect(score).toBe(100);
    });

    it('should cap at 100', () => {
      const score = conversionTracker.calculateScore(
        {
          customerName: 'Test',
          budget: 100000,
          model: 'Corolla',
          wantsFinancing: true,
          hasTradeIn: true,
        },
        {
          ...baseMetadata,
          flags: ['viewed_vehicle_x', 'returning_customer'],
        }
      );
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('shouldScheduleFollowUp', () => {
    it('should return true for score >= 30 with recommendations', () => {
      expect(conversionTracker.shouldScheduleFollowUp(30, true)).toBe(true);
      expect(conversionTracker.shouldScheduleFollowUp(50, true)).toBe(true);
    });

    it('should return false for score < 30', () => {
      expect(conversionTracker.shouldScheduleFollowUp(29, true)).toBe(false);
      expect(conversionTracker.shouldScheduleFollowUp(10, true)).toBe(false);
    });

    it('should return false without recommendations', () => {
      expect(conversionTracker.shouldScheduleFollowUp(50, false)).toBe(false);
    });
  });
});
