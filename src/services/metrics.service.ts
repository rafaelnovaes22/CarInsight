/**
 * Metrics Service
 *
 * Exporta métricas Prometheus para monitoramento de:
 * - Rate limiting (requests, bloqueios, latência)
 * - Performance da aplicação
 * - Saúde de serviços externos (Redis, LLMs)
 *
 * Endpoint: GET /metrics (exposto via admin.routes.ts)
 */

import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// Coleção automática de métricas default (CPU, memória, etc)
collectDefaultMetrics({
  register,
  prefix: 'carinsight_',
});

/**
 * Métricas de Rate Limiting
 */
export const rateLimitMetrics = {
  // Contador total de requisições verificadas
  requestsTotal: new Counter({
    name: 'carinsight_rate_limit_requests_total',
    help: 'Total de requisições verificadas no rate limit',
    labelNames: ['resource', 'status'], // status: allowed, blocked
    registers: [register],
  }),

  // Contador de bloqueios por recurso
  blockedTotal: new Counter({
    name: 'carinsight_rate_limit_blocked_total',
    help: 'Total de requisições bloqueadas por rate limit',
    labelNames: ['resource', 'reason'],
    registers: [register],
  }),

  // Histograma de latência do rate limiting
  duration: new Histogram({
    name: 'carinsight_rate_limit_duration_seconds',
    help: 'Tempo de verificação do rate limit',
    labelNames: ['resource', 'store_type'], // store_type: redis, memory
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [register],
  }),

  // Gauge de requisições ativas na janela atual
  activeRequests: new Gauge({
    name: 'carinsight_rate_limit_active_requests',
    help: 'Número de requisições na janela atual por chave',
    labelNames: ['resource', 'key_hash'], // key_hash é hash da chave (privacy)
    registers: [register],
  }),

  // Contador de erros no rate limiting
  errorsTotal: new Counter({
    name: 'carinsight_rate_limit_errors_total',
    help: 'Total de erros no serviço de rate limiting',
    labelNames: ['error_type'], // store_error, config_error, etc
    registers: [register],
  }),
};

/**
 * Métricas de WhatsApp
 */
export const whatsappMetrics = {
  // Mensagens recebidas
  messagesReceived: new Counter({
    name: 'carinsight_whatsapp_messages_received_total',
    help: 'Total de mensagens recebidas via WhatsApp',
    labelNames: ['type'], // text, audio, image, etc
    registers: [register],
  }),

  // Mensagens enviadas
  messagesSent: new Counter({
    name: 'carinsight_whatsapp_messages_sent_total',
    help: 'Total de mensagens enviadas via WhatsApp',
    labelNames: ['type', 'status'], // status: success, error
    registers: [register],
  }),

  // Latência de processamento de mensagens
  processingDuration: new Histogram({
    name: 'carinsight_whatsapp_processing_duration_seconds',
    help: 'Tempo de processamento de mensagens',
    labelNames: ['type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [register],
  }),

  // Conversas ativas
  activeConversations: new Gauge({
    name: 'carinsight_whatsapp_active_conversations',
    help: 'Número de conversas ativas',
    registers: [register],
  }),
};

/**
 * Métricas de LLM
 */
export const llmMetrics = {
  // Requisições por provider
  requestsTotal: new Counter({
    name: 'carinsight_llm_requests_total',
    help: 'Total de requisições a LLMs',
    labelNames: ['provider', 'model', 'status'], // provider: openai, groq, mock
    registers: [register],
  }),

  // Latência por provider
  latency: new Histogram({
    name: 'carinsight_llm_latency_seconds',
    help: 'Latência das chamadas a LLMs',
    labelNames: ['provider', 'model'],
    buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [register],
  }),

  // Tokens usados
  tokensUsed: new Counter({
    name: 'carinsight_llm_tokens_used_total',
    help: 'Total de tokens usados',
    labelNames: ['provider', 'model', 'type'], // type: prompt, completion
    registers: [register],
  }),

  // Custo estimado
  cost: new Counter({
    name: 'carinsight_llm_cost_usd_total',
    help: 'Custo estimado em USD',
    labelNames: ['provider', 'model'],
    registers: [register],
  }),

  // Circuit breaker state
  circuitBreakerState: new Gauge({
    name: 'carinsight_llm_circuit_breaker_state',
    help: 'Estado do circuit breaker (0=closed, 1=open)',
    labelNames: ['provider'],
    registers: [register],
  }),
};

/**
 * Métricas de Banco de Dados
 */
export const databaseMetrics = {
  // Queries executadas
  queriesTotal: new Counter({
    name: 'carinsight_db_queries_total',
    help: 'Total de queries executadas',
    labelNames: ['operation', 'table'], // operation: select, insert, update, delete
    registers: [register],
  }),

  // Latência de queries
  queryDuration: new Histogram({
    name: 'carinsight_db_query_duration_seconds',
    help: 'Duração das queries',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.5, 1],
    registers: [register],
  }),

  // Conexões ativas
  connections: new Gauge({
    name: 'carinsight_db_connections',
    help: 'Número de conexões ativas com o banco',
    registers: [register],
  }),
};

/**
 * Métricas de Redis
 */
export const redisMetrics = {
  // Operações
  operationsTotal: new Counter({
    name: 'carinsight_redis_operations_total',
    help: 'Total de operações Redis',
    labelNames: ['operation', 'result'], // result: success, error
    registers: [register],
  }),

  // Latência
  latency: new Histogram({
    name: 'carinsight_redis_latency_seconds',
    help: 'Latência das operações Redis',
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
    registers: [register],
  }),

  // Conectado
  connected: new Gauge({
    name: 'carinsight_redis_connected',
    help: 'Status da conexão Redis (1=conectado, 0=desconectado)',
    registers: [register],
  }),
};

/**
 * Métricas de Guardrails
 */
export const guardrailsMetrics = {
  // Mensagens validadas
  messagesValidated: new Counter({
    name: 'carinsight_guardrails_messages_validated_total',
    help: 'Total de mensagens validadas',
    labelNames: ['result'], // result: allowed, blocked
    registers: [register],
  }),

  // Bloqueios por tipo
  blocksByType: new Counter({
    name: 'carinsight_guardrails_blocks_total',
    help: 'Total de bloqueios por tipo',
    labelNames: ['reason'], // rate_limit, injection, length, etc
    registers: [register],
  }),

  // Prompt injection detectados
  injectionDetected: new Counter({
    name: 'carinsight_guardrails_injection_detected_total',
    help: 'Total de tentativas de prompt injection',
    labelNames: ['pattern_type'],
    registers: [register],
  }),
};

/**
 * Métricas de Negócio
 */
export const businessMetrics = {
  // Leads gerados
  leadsGenerated: new Counter({
    name: 'carinsight_business_leads_generated_total',
    help: 'Total de leads gerados',
    labelNames: ['source'],
    registers: [register],
  }),

  // Recomendações feitas
  recommendationsMade: new Counter({
    name: 'carinsight_business_recommendations_total',
    help: 'Total de recomendações de veículos',
    labelNames: ['result'], // clicked, ignored, converted
    registers: [register],
  }),

  // Conversas por status
  conversationsByStatus: new Gauge({
    name: 'carinsight_business_conversations_by_status',
    help: 'Conversas por status',
    labelNames: ['status'], // active, qualified, converted, abandoned
    registers: [register],
  }),
};

/**
 * Helper para observar funções com métricas
 */
export function observeDuration<T extends (...args: any[]) => any>(
  histogram: Histogram<string>,
  labels: Record<string, string>,
  fn: T
): ReturnType<T> {
  const start = Date.now();
  try {
    const result = fn();
    // Se for promise, aguardar
    if (result instanceof Promise) {
      return result.finally(() => {
        histogram.observe(labels, (Date.now() - start) / 1000);
      }) as ReturnType<T>;
    }
    histogram.observe(labels, (Date.now() - start) / 1000);
    return result;
  } catch (error) {
    histogram.observe(labels, (Date.now() - start) / 1000);
    throw error;
  }
}

/**
 * Helper async para observar promises
 */
export async function observeAsync<T>(
  histogram: Histogram<string>,
  labels: Record<string, string>,
  promise: Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await promise;
    histogram.observe(labels, (Date.now() - start) / 1000);
    return result;
  } catch (error) {
    histogram.observe(labels, (Date.now() - start) / 1000);
    throw error;
  }
}

/**
 * Exporta as métricas no formato Prometheus
 */
export async function getPrometheusMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Retorna métricas de negócio agregadas
 */
export async function getMetrics(period: '24h' | '7d' | '30d' = '24h'): Promise<{
  period: string;
  generatedAt: string;
  conversations: {
    total: number;
    active: number;
    completed: number;
    resolved: number;
    avgDurationMinutes: number;
  };
  leads: {
    total: number;
    new: number;
    contacted: number;
    converted: number;
    conversionRate: number;
  };
  messages: {
    total: number;
    avgPerConversation: number;
  };
  recommendations: {
    total: number;
    avgScore: number;
    topModels: Array<{ model: string; count: number }>;
  };
}> {
  const { prisma } = await import('../lib/prisma');

  // Calcular data de início baseada no período
  const now = new Date();
  const startDate = new Date(now);
  if (period === '24h') {
    startDate.setHours(startDate.getHours() - 24);
  } else if (period === '7d') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === '30d') {
    startDate.setDate(startDate.getDate() - 30);
  }

  // Conversations
  const [totalConversations, activeConversations, completedConversations, resolvedConversations] =
    await Promise.all([
      prisma.conversation.count({ where: { startedAt: { gte: startDate } } }),
      prisma.conversation.count({
        where: { startedAt: { gte: startDate }, status: 'active' },
      }),
      prisma.conversation.count({
        where: { startedAt: { gte: startDate }, status: 'completed' },
      }),
      prisma.conversation.count({
        where: { startedAt: { gte: startDate }, status: 'resolved' },
      }),
    ]);

  // Leads
  const [totalLeads, newLeads, contactedLeads, convertedLeads] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: startDate } } }),
    prisma.lead.count({ where: { createdAt: { gte: startDate }, status: 'new' } }),
    prisma.lead.count({ where: { createdAt: { gte: startDate }, status: 'contacted' } }),
    prisma.lead.count({ where: { createdAt: { gte: startDate }, status: 'converted' } }),
  ]);

  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  // Recommendations
  const recommendations = await prisma.recommendation.findMany({
    where: { createdAt: { gte: startDate } },
    select: { matchScore: true, vehicleId: true },
  });

  const avgScore =
    recommendations.length > 0
      ? Math.round(
          recommendations.reduce((sum, r) => sum + (r.matchScore || 0), 0) / recommendations.length
        )
      : 0;

  // Top recommended models
  const vehicleCounts = new Map<string, number>();
  for (const rec of recommendations) {
    const count = vehicleCounts.get(rec.vehicleId) || 0;
    vehicleCounts.set(rec.vehicleId, count + 1);
  }

  const topVehicleIds = Array.from(vehicleCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  const vehicles =
    topVehicleIds.length > 0
      ? await prisma.vehicle.findMany({
          where: { id: { in: topVehicleIds } },
          select: { id: true, marca: true, modelo: true },
        })
      : [];

  const topModels = vehicles.map(v => ({
    model: `${v.marca} ${v.modelo}`,
    count: vehicleCounts.get(v.id) || 0,
  }));

  // Messages
  const totalMessages = await prisma.message.count({
    where: { createdAt: { gte: startDate } },
  });

  const avgPerConversation =
    totalConversations > 0 ? Math.round(totalMessages / totalConversations) : 0;

  // Average conversation duration
  const conversationsWithDuration = await prisma.conversation.findMany({
    where: {
      startedAt: { gte: startDate },
      lastMessageAt: { not: null },
    },
    select: { startedAt: true, lastMessageAt: true },
  });

  let avgDurationMinutes = 0;
  if (conversationsWithDuration.length > 0) {
    const totalDuration = conversationsWithDuration.reduce((sum, c) => {
      if (c.lastMessageAt) {
        return sum + (c.lastMessageAt.getTime() - c.startedAt.getTime());
      }
      return sum;
    }, 0);
    avgDurationMinutes = Math.round(totalDuration / conversationsWithDuration.length / 60000);
  }

  return {
    period,
    generatedAt: new Date().toISOString(),
    conversations: {
      total: totalConversations,
      active: activeConversations,
      completed: completedConversations,
      resolved: resolvedConversations,
      avgDurationMinutes,
    },
    leads: {
      total: totalLeads,
      new: newLeads,
      contacted: contactedLeads,
      converted: convertedLeads,
      conversionRate,
    },
    messages: {
      total: totalMessages,
      avgPerConversation,
    },
    recommendations: {
      total: recommendations.length,
      avgScore,
      topModels,
    },
  };
}

/**
 * Limpa todas as métricas (útil para testes)
 */
export function clearMetrics(): void {
  register.clear();
}

/**
 * Retorna o content type correto para Prometheus
 */
export function getMetricsContentType(): string {
  return register.contentType;
}

/**
 * Registra métricas customizadas
 */
export function registerMetric<T extends Counter | Histogram | Gauge>(metric: T): T {
  register.registerMetric(metric);
  return metric;
}

// Exporta o register para casos avançados
export { register };
