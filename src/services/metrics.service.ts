/**
 * Metrics Service
 *
 * Provides aggregated business metrics for the CarInsight dashboard.
 * Includes conversation stats, lead conversion, and recommendation performance.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Time period for metrics aggregation
 */
export type MetricsPeriod = '24h' | '7d' | '30d';

/**
 * Metrics response structure
 */
export interface MetricsResponse {
  period: MetricsPeriod;
  generatedAt: string;
  conversations: {
    total: number;
    active: number;
    completed: number;
    avgDurationMinutes: number;
  };
  leads: {
    total: number;
    new: number;
    contacted: number;
    converted: number;
    conversionRate: number;
  };
  recommendations: {
    total: number;
    avgScore: number;
    topModels: { model: string; count: number }[];
  };
  messages: {
    total: number;
    avgPerConversation: number;
  };
}

/**
 * Calculate start date based on period
 */
function getStartDate(period: MetricsPeriod): Date {
  const now = new Date();

  switch (period) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

/**
 * Get aggregated metrics for dashboard
 */
export async function getMetrics(period: MetricsPeriod = '24h'): Promise<MetricsResponse> {
  const startDate = getStartDate(period);

  logger.info({ period, startDate }, 'MetricsService: Generating metrics');

  // Conversations metrics (use startedAt, not createdAt)
  const [totalConversations, activeConversations, completedConversations] = await Promise.all([
    prisma.conversation.count({
      where: { startedAt: { gte: startDate } },
    }),
    prisma.conversation.count({
      where: {
        startedAt: { gte: startDate },
        status: 'active',
      },
    }),
    prisma.conversation.count({
      where: {
        startedAt: { gte: startDate },
        status: 'completed',
      },
    }),
  ]);

  // Leads metrics
  const [totalLeads, newLeads, contactedLeads, convertedLeads] = await Promise.all([
    prisma.lead.count({
      where: { createdAt: { gte: startDate } },
    }),
    prisma.lead.count({
      where: {
        createdAt: { gte: startDate },
        status: 'new',
      },
    }),
    prisma.lead.count({
      where: {
        createdAt: { gte: startDate },
        status: 'contacted',
      },
    }),
    prisma.lead.count({
      where: {
        createdAt: { gte: startDate },
        status: 'converted',
      },
    }),
  ]);

  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

  // Recommendations metrics
  const recommendations = await prisma.recommendation.findMany({
    where: { createdAt: { gte: startDate } },
    select: {
      matchScore: true,
      vehicleId: true,
    },
  });

  const avgScore =
    recommendations.length > 0
      ? recommendations.reduce((sum, r) => sum + (r.matchScore || 0), 0) / recommendations.length
      : 0;

  // Top recommended models (by vehicle ID frequency)
  const vehicleIdCounts: Record<string, number> = {};
  recommendations.forEach(r => {
    if (r.vehicleId) {
      vehicleIdCounts[r.vehicleId] = (vehicleIdCounts[r.vehicleId] || 0) + 1;
    }
  });

  // Get top 5 vehicles
  const topVehicleIds = Object.entries(vehicleIdCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  // Fetch vehicle details for top models
  let topModels: { model: string; count: number }[] = [];
  if (topVehicleIds.length > 0) {
    const topVehicles = await prisma.vehicle.findMany({
      where: { id: { in: topVehicleIds } },
      select: { id: true, modelo: true, marca: true },
    });

    topModels = topVehicleIds.map(id => {
      const vehicle = topVehicles.find(v => v.id === id);
      const name = vehicle ? `${vehicle.marca} ${vehicle.modelo}` : 'Unknown';
      return { model: name, count: vehicleIdCounts[id] };
    });
  }

  // Messages metrics (use timestamp instead of createdAt)
  const messageCount = await prisma.message.count({
    where: { timestamp: { gte: startDate } },
  });

  const avgMessagesPerConversation = totalConversations > 0 ? messageCount / totalConversations : 0;

  // Calculate average conversation duration (in minutes)
  // Use startedAt and lastMessageAt instead of createdAt/updatedAt
  const conversationsWithDuration = await prisma.conversation.findMany({
    where: {
      startedAt: { gte: startDate },
    },
    select: {
      startedAt: true,
      lastMessageAt: true,
    },
  });

  const avgDuration =
    conversationsWithDuration.length > 0
      ? conversationsWithDuration.reduce((sum, c) => {
          const duration = (c.lastMessageAt.getTime() - c.startedAt.getTime()) / (1000 * 60);
          return sum + duration;
        }, 0) / conversationsWithDuration.length
      : 0;

  const metrics: MetricsResponse = {
    period,
    generatedAt: new Date().toISOString(),
    conversations: {
      total: totalConversations,
      active: activeConversations,
      completed: completedConversations,
      avgDurationMinutes: Math.round(avgDuration * 10) / 10,
    },
    leads: {
      total: totalLeads,
      new: newLeads,
      contacted: contactedLeads,
      converted: convertedLeads,
      conversionRate: Math.round(conversionRate * 10) / 10,
    },
    recommendations: {
      total: recommendations.length,
      avgScore: Math.round(avgScore * 10) / 10,
      topModels,
    },
    messages: {
      total: messageCount,
      avgPerConversation: Math.round(avgMessagesPerConversation * 10) / 10,
    },
  };

  logger.info(
    { period, conversations: metrics.conversations.total, leads: metrics.leads.total },
    'MetricsService: Metrics generated'
  );

  return metrics;
}

/**
 * Export metrics service singleton
 */
export const metricsService = {
  getMetrics,
};
