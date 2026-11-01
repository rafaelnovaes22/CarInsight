/**
 * Unit Tests for Metrics Service
 *
 * Tests the aggregation logic for business metrics using mocks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMetrics } from '../../../src/services/metrics.service';

// Mock logger
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Prisma - must cover ALL tables and methods used by getMetrics
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    conversation: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    lead: {
      count: vi.fn(),
    },
    recommendation: {
      findMany: vi.fn(),
    },
    message: {
      count: vi.fn(),
      findMany: vi.fn(), // Used for latency/cost queries
    },
    vehicle: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../../../src/lib/prisma';

/**
 * Helper: setup default mocks for all Prisma calls in getMetrics.
 * getMetrics makes these calls in order:
 * 1. conversation.count x4 (total, active, completed, resolved)
 * 2. lead.count x4 (total, new, contacted, converted)
 * 3. recommendation.findMany x1
 * 4. message.count x1 + message.findMany x1
 * 5. conversation.findMany x1 (duration)
 */
function setupDefaultMocks(
  overrides: {
    conversationCounts?: number[];
    leadCounts?: number[];
    recommendations?: any[];
    messageCount?: number;
    messagesWithLatency?: any[];
    conversationsWithDuration?: any[];
    vehicles?: any[];
  } = {}
) {
  const cc = overrides.conversationCounts ?? [0, 0, 0, 0];
  const mock = vi.mocked(prisma.conversation.count);
  cc.forEach(val => mock.mockResolvedValueOnce(val));

  const lc = overrides.leadCounts ?? [0, 0, 0, 0];
  const leadMock = vi.mocked(prisma.lead.count);
  lc.forEach(val => leadMock.mockResolvedValueOnce(val));

  vi.mocked(prisma.recommendation.findMany).mockResolvedValue(overrides.recommendations ?? []);

  vi.mocked(prisma.message.count).mockResolvedValue(overrides.messageCount ?? 0);
  vi.mocked(prisma.message.findMany).mockResolvedValue(overrides.messagesWithLatency ?? []);

  vi.mocked(prisma.conversation.findMany).mockResolvedValue(
    overrides.conversationsWithDuration ?? []
  );

  if (overrides.vehicles) {
    vi.mocked(prisma.vehicle.findMany).mockResolvedValue(overrides.vehicles);
  }
}

describe('Metrics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMetrics', () => {
    it('should return metrics for 24h period by default', async () => {
      setupDefaultMocks({
        conversationCounts: [10, 3, 5, 2],
        leadCounts: [5, 2, 1, 2],
        messageCount: 50,
      });

      const metrics = await getMetrics();

      expect(metrics.period).toBe('24h');
      expect(metrics.generatedAt).toBeDefined();
      expect(metrics.conversations.total).toBe(10);
      expect(metrics.leads.total).toBe(5);
      expect(metrics.messages.total).toBe(50);
    });

    it('should calculate lead conversion rate correctly', async () => {
      // 10 total leads, 3 converted = 30%
      setupDefaultMocks({
        conversationCounts: [5, 2, 3, 0],
        leadCounts: [10, 5, 2, 3],
        messageCount: 20,
      });

      const metrics = await getMetrics('24h');

      expect(metrics.leads.total).toBe(10);
      expect(metrics.leads.converted).toBe(3);
      expect(metrics.leads.conversionRate).toBe(30);
    });

    it('should calculate average recommendation score', async () => {
      setupDefaultMocks({
        conversationCounts: [2, 1, 1, 0],
        recommendations: [
          { matchScore: 80, vehicleId: 'v1' },
          { matchScore: 90, vehicleId: 'v2' },
          { matchScore: 70, vehicleId: 'v1' },
        ],
        vehicles: [
          { id: 'v1', marca: 'Toyota', modelo: 'Corolla' },
          { id: 'v2', marca: 'Honda', modelo: 'Civic' },
        ],
        messageCount: 10,
      });

      const metrics = await getMetrics('7d');

      expect(metrics.period).toBe('7d');
      expect(metrics.recommendations.total).toBe(3);
      expect(metrics.recommendations.avgScore).toBe(80); // (80+90+70)/3 = 80
    });

    it('should support different time periods', async () => {
      // Test 7d period
      setupDefaultMocks();
      const metrics7d = await getMetrics('7d');
      expect(metrics7d.period).toBe('7d');

      vi.clearAllMocks();

      // Test 30d period
      setupDefaultMocks();
      const metrics30d = await getMetrics('30d');
      expect(metrics30d.period).toBe('30d');
    });

    it('should return zero values when no data exists', async () => {
      setupDefaultMocks();

      const metrics = await getMetrics('24h');

      expect(metrics.conversations.total).toBe(0);
      expect(metrics.leads.total).toBe(0);
      expect(metrics.leads.conversionRate).toBe(0);
      expect(metrics.recommendations.total).toBe(0);
      expect(metrics.messages.total).toBe(0);
    });

    it('should calculate average messages per conversation', async () => {
      // 100 messages, 10 conversations = 10 avg
      setupDefaultMocks({
        conversationCounts: [10, 5, 5, 0],
        messageCount: 100,
      });

      const metrics = await getMetrics('24h');

      expect(metrics.messages.total).toBe(100);
      expect(metrics.messages.avgPerConversation).toBe(10);
    });

    it('should calculate average conversation duration', async () => {
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      setupDefaultMocks({
        conversationCounts: [1, 0, 1, 0],
        conversationsWithDuration: [{ startedAt: thirtyMinutesAgo, lastMessageAt: now }],
      });

      const metrics = await getMetrics('24h');

      expect(metrics.conversations.avgDurationMinutes).toBeGreaterThanOrEqual(29);
      expect(metrics.conversations.avgDurationMinutes).toBeLessThanOrEqual(31);
    });

    it('should return top recommended models', async () => {
      setupDefaultMocks({
        conversationCounts: [5, 2, 3, 0],
        recommendations: [
          { matchScore: 85, vehicleId: 'v1' },
          { matchScore: 80, vehicleId: 'v1' },
          { matchScore: 75, vehicleId: 'v2' },
        ],
        vehicles: [
          { id: 'v1', marca: 'Toyota', modelo: 'Corolla' },
          { id: 'v2', marca: 'Honda', modelo: 'Civic' },
        ],
        messageCount: 25,
      });

      const metrics = await getMetrics('24h');

      expect(metrics.recommendations.topModels.length).toBeGreaterThan(0);
      expect(metrics.recommendations.topModels[0].model).toBe('Toyota Corolla');
      expect(metrics.recommendations.topModels[0].count).toBe(2);
    });
  });
});
