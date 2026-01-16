/**
 * Unit Tests for Metrics Service
 *
 * Tests the aggregation logic for business metrics using mocks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMetrics } from '../../../src/services/metrics.service';

// Mock Prisma
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
        },
        vehicle: {
            findMany: vi.fn(),
        },
    },
}));

import { prisma } from '../../../src/lib/prisma';

describe('Metrics Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getMetrics', () => {
        it('should return metrics for 24h period by default', async () => {
            // Arrange: Setup mocks
            vi.mocked(prisma.conversation.count).mockResolvedValue(10);
            vi.mocked(prisma.lead.count).mockResolvedValue(5);
            vi.mocked(prisma.recommendation.findMany).mockResolvedValue([]);
            vi.mocked(prisma.message.count).mockResolvedValue(50);
            vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);

            // Act
            const metrics = await getMetrics();

            // Assert
            expect(metrics.period).toBe('24h');
            expect(metrics.generatedAt).toBeDefined();
            expect(metrics.conversations.total).toBe(10);
            expect(metrics.leads.total).toBe(5);
            expect(metrics.messages.total).toBe(50);
        });

        it('should calculate lead conversion rate correctly', async () => {
            // Arrange: 10 total leads, 3 converted = 30%
            vi.mocked(prisma.conversation.count).mockResolvedValue(5);
            vi.mocked(prisma.lead.count)
                .mockResolvedValueOnce(10) // total
                .mockResolvedValueOnce(5) // new
                .mockResolvedValueOnce(2) // contacted
                .mockResolvedValueOnce(3); // converted
            vi.mocked(prisma.recommendation.findMany).mockResolvedValue([]);
            vi.mocked(prisma.message.count).mockResolvedValue(20);
            vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);

            // Act
            const metrics = await getMetrics('24h');

            // Assert
            expect(metrics.leads.total).toBe(10);
            expect(metrics.leads.converted).toBe(3);
            expect(metrics.leads.conversionRate).toBe(30);
        });

        it('should calculate average recommendation score', async () => {
            // Arrange
            vi.mocked(prisma.conversation.count).mockResolvedValue(2);
            vi.mocked(prisma.lead.count).mockResolvedValue(0);
            vi.mocked(prisma.recommendation.findMany).mockResolvedValue([
                { matchScore: 80, vehicleId: 'v1' },
                { matchScore: 90, vehicleId: 'v2' },
                { matchScore: 70, vehicleId: 'v1' },
            ] as any);
            vi.mocked(prisma.vehicle.findMany).mockResolvedValue([
                { id: 'v1', marca: 'Toyota', modelo: 'Corolla' },
                { id: 'v2', marca: 'Honda', modelo: 'Civic' },
            ] as any);
            vi.mocked(prisma.message.count).mockResolvedValue(10);
            vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);

            // Act
            const metrics = await getMetrics('7d');

            // Assert
            expect(metrics.period).toBe('7d');
            expect(metrics.recommendations.total).toBe(3);
            expect(metrics.recommendations.avgScore).toBe(80); // (80+90+70)/3 = 80
        });

        it('should support different time periods', async () => {
            // Setup mocks
            vi.mocked(prisma.conversation.count).mockResolvedValue(0);
            vi.mocked(prisma.lead.count).mockResolvedValue(0);
            vi.mocked(prisma.recommendation.findMany).mockResolvedValue([]);
            vi.mocked(prisma.message.count).mockResolvedValue(0);
            vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);

            // Test 7d period
            const metrics7d = await getMetrics('7d');
            expect(metrics7d.period).toBe('7d');

            // Test 30d period
            const metrics30d = await getMetrics('30d');
            expect(metrics30d.period).toBe('30d');
        });

        it('should return zero values when no data exists', async () => {
            // Arrange
            vi.mocked(prisma.conversation.count).mockResolvedValue(0);
            vi.mocked(prisma.lead.count).mockResolvedValue(0);
            vi.mocked(prisma.recommendation.findMany).mockResolvedValue([]);
            vi.mocked(prisma.message.count).mockResolvedValue(0);
            vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);

            // Act
            const metrics = await getMetrics('24h');

            // Assert
            expect(metrics.conversations.total).toBe(0);
            expect(metrics.leads.total).toBe(0);
            expect(metrics.leads.conversionRate).toBe(0);
            expect(metrics.recommendations.total).toBe(0);
            expect(metrics.messages.total).toBe(0);
        });

        it('should calculate average messages per conversation', async () => {
            // Arrange: 100 messages, 10 conversations = 10 avg
            vi.mocked(prisma.conversation.count)
                .mockResolvedValueOnce(10) // total
                .mockResolvedValueOnce(5) // active
                .mockResolvedValueOnce(5); // completed
            vi.mocked(prisma.lead.count).mockResolvedValue(0);
            vi.mocked(prisma.recommendation.findMany).mockResolvedValue([]);
            vi.mocked(prisma.message.count).mockResolvedValue(100);
            vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);

            // Act
            const metrics = await getMetrics('24h');

            // Assert
            expect(metrics.messages.total).toBe(100);
            expect(metrics.messages.avgPerConversation).toBe(10);
        });

        it('should calculate average conversation duration', async () => {
            // Arrange
            const now = new Date();
            const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

            vi.mocked(prisma.conversation.count).mockResolvedValue(1);
            vi.mocked(prisma.lead.count).mockResolvedValue(0);
            vi.mocked(prisma.recommendation.findMany).mockResolvedValue([]);
            vi.mocked(prisma.message.count).mockResolvedValue(0);
            vi.mocked(prisma.conversation.findMany).mockResolvedValue([
                { startedAt: thirtyMinutesAgo, lastMessageAt: now },
            ] as any);

            // Act
            const metrics = await getMetrics('24h');

            // Assert
            expect(metrics.conversations.avgDurationMinutes).toBeGreaterThanOrEqual(29);
            expect(metrics.conversations.avgDurationMinutes).toBeLessThanOrEqual(31);
        });

        it('should return top recommended models', async () => {
            // Arrange
            vi.mocked(prisma.conversation.count).mockResolvedValue(5);
            vi.mocked(prisma.lead.count).mockResolvedValue(0);
            vi.mocked(prisma.recommendation.findMany).mockResolvedValue([
                { matchScore: 85, vehicleId: 'v1' },
                { matchScore: 80, vehicleId: 'v1' },
                { matchScore: 75, vehicleId: 'v2' },
            ] as any);
            vi.mocked(prisma.vehicle.findMany).mockResolvedValue([
                { id: 'v1', marca: 'Toyota', modelo: 'Corolla' },
                { id: 'v2', marca: 'Honda', modelo: 'Civic' },
            ] as any);
            vi.mocked(prisma.message.count).mockResolvedValue(25);
            vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);

            // Act
            const metrics = await getMetrics('24h');

            // Assert
            expect(metrics.recommendations.topModels.length).toBeGreaterThan(0);
            expect(metrics.recommendations.topModels[0].model).toBe('Toyota Corolla');
            expect(metrics.recommendations.topModels[0].count).toBe(2);
        });
    });
});
