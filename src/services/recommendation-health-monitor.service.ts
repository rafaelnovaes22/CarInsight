import { AlertService } from '../lib/alerts';
import { logger } from '../lib/logger';
import { MetricsPeriod } from './metrics.service';
import { AccuracyMetrics, recommendationMetrics } from './recommendation-metrics.service';

export type RecommendationHealthStatus = 'healthy' | 'warning' | 'critical';

export interface RecommendationHealthThresholds {
  minPrecisionAt3: number;
  maxRejectionRate: number;
  minCtr: number;
  minConversationsWithFeedback: number;
  precisionAt3DropWarning: number;
  rejectionRateIncreaseWarning: number;
  ctrDropWarning: number;
}

export interface RecommendationHealthCheck {
  id:
    | 'precision_at_3'
    | 'rejection_rate'
    | 'ctr'
    | 'sample_size'
    | 'precision_drift'
    | 'rejection_drift'
    | 'ctr_drift';
  status: RecommendationHealthStatus;
  currentValue: number;
  threshold: number;
  message: string;
}

export interface RecommendationHealthSnapshot {
  generatedAt: string;
  period: MetricsPeriod;
  baselinePeriod: MetricsPeriod;
  status: RecommendationHealthStatus;
  thresholds: RecommendationHealthThresholds;
  current: AccuracyMetrics;
  baseline: AccuracyMetrics;
  drift: {
    precisionAt3: number;
    rejectionRate: number;
    ctr: number;
    mrr: number;
    conversionRate: number;
  };
  checks: RecommendationHealthCheck[];
}

interface EvaluateHealthOptions {
  thresholds?: Partial<RecommendationHealthThresholds>;
  emitAlerts?: boolean;
}

const DEFAULT_THRESHOLDS: RecommendationHealthThresholds = {
  minPrecisionAt3: 60,
  maxRejectionRate: 25,
  minCtr: 15,
  minConversationsWithFeedback: 8,
  precisionAt3DropWarning: 8,
  rejectionRateIncreaseWarning: 8,
  ctrDropWarning: 6,
};

function parseEnvNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getWorseStatus(
  a: RecommendationHealthStatus,
  b: RecommendationHealthStatus
): RecommendationHealthStatus {
  const order: Record<RecommendationHealthStatus, number> = {
    healthy: 0,
    warning: 1,
    critical: 2,
  };
  return order[a] >= order[b] ? a : b;
}

export class RecommendationHealthMonitorService {
  private readonly lastStatusByWindow = new Map<string, RecommendationHealthStatus>();

  private resolveThresholds(
    overrides?: Partial<RecommendationHealthThresholds>
  ): RecommendationHealthThresholds {
    const envThresholds: RecommendationHealthThresholds = {
      minPrecisionAt3: parseEnvNumber(
        'RECOMMENDATION_HEALTH_MIN_PRECISION_AT3',
        DEFAULT_THRESHOLDS.minPrecisionAt3
      ),
      maxRejectionRate: parseEnvNumber(
        'RECOMMENDATION_HEALTH_MAX_REJECTION_RATE',
        DEFAULT_THRESHOLDS.maxRejectionRate
      ),
      minCtr: parseEnvNumber('RECOMMENDATION_HEALTH_MIN_CTR', DEFAULT_THRESHOLDS.minCtr),
      minConversationsWithFeedback: parseEnvNumber(
        'RECOMMENDATION_HEALTH_MIN_FEEDBACK_CONVERSATIONS',
        DEFAULT_THRESHOLDS.minConversationsWithFeedback
      ),
      precisionAt3DropWarning: parseEnvNumber(
        'RECOMMENDATION_HEALTH_DRIFT_PRECISION_DROP',
        DEFAULT_THRESHOLDS.precisionAt3DropWarning
      ),
      rejectionRateIncreaseWarning: parseEnvNumber(
        'RECOMMENDATION_HEALTH_DRIFT_REJECTION_INCREASE',
        DEFAULT_THRESHOLDS.rejectionRateIncreaseWarning
      ),
      ctrDropWarning: parseEnvNumber(
        'RECOMMENDATION_HEALTH_DRIFT_CTR_DROP',
        DEFAULT_THRESHOLDS.ctrDropWarning
      ),
    };

    return {
      ...envThresholds,
      ...overrides,
    };
  }

  async evaluateHealth(
    period: MetricsPeriod = '7d',
    baselinePeriod: MetricsPeriod = '30d',
    options: EvaluateHealthOptions = {}
  ): Promise<RecommendationHealthSnapshot> {
    const thresholds = this.resolveThresholds(options.thresholds);
    const [current, baseline] = await Promise.all([
      recommendationMetrics.calculateMetrics(period),
      recommendationMetrics.calculateMetrics(baselinePeriod),
    ]);

    const drift = {
      precisionAt3: Math.round((current.precisionAt3 - baseline.precisionAt3) * 10) / 10,
      rejectionRate: Math.round((current.rejectionRate - baseline.rejectionRate) * 10) / 10,
      ctr: Math.round((current.ctr - baseline.ctr) * 10) / 10,
      mrr: Math.round((current.mrr - baseline.mrr) * 100) / 100,
      conversionRate: Math.round((current.conversionRate - baseline.conversionRate) * 10) / 10,
    };

    const checks: RecommendationHealthCheck[] = [];
    let status: RecommendationHealthStatus = 'healthy';

    const registerCheck = (check: RecommendationHealthCheck) => {
      checks.push(check);
      status = getWorseStatus(status, check.status);
    };

    registerCheck({
      id: 'precision_at_3',
      status: current.precisionAt3 < thresholds.minPrecisionAt3 ? 'critical' : 'healthy',
      currentValue: current.precisionAt3,
      threshold: thresholds.minPrecisionAt3,
      message:
        current.precisionAt3 < thresholds.minPrecisionAt3
          ? `Precision@3 (${current.precisionAt3}%) abaixo do minimo (${thresholds.minPrecisionAt3}%).`
          : 'Precision@3 dentro do esperado.',
    });

    registerCheck({
      id: 'rejection_rate',
      status: current.rejectionRate > thresholds.maxRejectionRate ? 'critical' : 'healthy',
      currentValue: current.rejectionRate,
      threshold: thresholds.maxRejectionRate,
      message:
        current.rejectionRate > thresholds.maxRejectionRate
          ? `Taxa de rejeicao (${current.rejectionRate}%) acima do limite (${thresholds.maxRejectionRate}%).`
          : 'Taxa de rejeicao dentro do esperado.',
    });

    registerCheck({
      id: 'ctr',
      status: current.ctr < thresholds.minCtr ? 'warning' : 'healthy',
      currentValue: current.ctr,
      threshold: thresholds.minCtr,
      message:
        current.ctr < thresholds.minCtr
          ? `CTR (${current.ctr}%) abaixo do alvo (${thresholds.minCtr}%).`
          : 'CTR dentro do esperado.',
    });

    registerCheck({
      id: 'sample_size',
      status:
        current.conversationsWithFeedback < thresholds.minConversationsWithFeedback
          ? 'warning'
          : 'healthy',
      currentValue: current.conversationsWithFeedback,
      threshold: thresholds.minConversationsWithFeedback,
      message:
        current.conversationsWithFeedback < thresholds.minConversationsWithFeedback
          ? `Amostra baixa (${current.conversationsWithFeedback} conversas com feedback).`
          : 'Amostra de feedback suficiente.',
    });

    const precisionDrop = baseline.precisionAt3 - current.precisionAt3;
    registerCheck({
      id: 'precision_drift',
      status: precisionDrop > thresholds.precisionAt3DropWarning ? 'warning' : 'healthy',
      currentValue: Math.round(precisionDrop * 10) / 10,
      threshold: thresholds.precisionAt3DropWarning,
      message:
        precisionDrop > thresholds.precisionAt3DropWarning
          ? `Queda de Precision@3 de ${Math.round(precisionDrop * 10) / 10} pontos vs baseline.`
          : 'Sem queda relevante de Precision@3.',
    });

    const rejectionIncrease = current.rejectionRate - baseline.rejectionRate;
    registerCheck({
      id: 'rejection_drift',
      status: rejectionIncrease > thresholds.rejectionRateIncreaseWarning ? 'warning' : 'healthy',
      currentValue: Math.round(rejectionIncrease * 10) / 10,
      threshold: thresholds.rejectionRateIncreaseWarning,
      message:
        rejectionIncrease > thresholds.rejectionRateIncreaseWarning
          ? `Aumento de rejeicao de ${Math.round(rejectionIncrease * 10) / 10} pontos vs baseline.`
          : 'Sem aumento relevante de rejeicao.',
    });

    const ctrDrop = baseline.ctr - current.ctr;
    registerCheck({
      id: 'ctr_drift',
      status: ctrDrop > thresholds.ctrDropWarning ? 'warning' : 'healthy',
      currentValue: Math.round(ctrDrop * 10) / 10,
      threshold: thresholds.ctrDropWarning,
      message:
        ctrDrop > thresholds.ctrDropWarning
          ? `Queda de CTR de ${Math.round(ctrDrop * 10) / 10} pontos vs baseline.`
          : 'Sem queda relevante de CTR.',
    });

    const snapshot: RecommendationHealthSnapshot = {
      generatedAt: new Date().toISOString(),
      period,
      baselinePeriod,
      status,
      thresholds,
      current,
      baseline,
      drift,
      checks,
    };

    logger.info(
      {
        status: snapshot.status,
        period: snapshot.period,
        baselinePeriod: snapshot.baselinePeriod,
        precisionAt3: current.precisionAt3,
        rejectionRate: current.rejectionRate,
        ctr: current.ctr,
      },
      'Recommendation health evaluated'
    );

    if (options.emitAlerts) {
      this.emitAlerts(snapshot);
    }

    return snapshot;
  }

  private emitAlerts(snapshot: RecommendationHealthSnapshot): void {
    const key = `${snapshot.period}->${snapshot.baselinePeriod}`;
    const previousStatus = this.lastStatusByWindow.get(key);
    this.lastStatusByWindow.set(key, snapshot.status);

    if (snapshot.status === 'healthy') {
      if (previousStatus && previousStatus !== 'healthy') {
        AlertService.send({
          severity: 'info',
          title: 'Recommendation Quality Recovered',
          message: `Recommendation quality recovered for ${snapshot.period} vs ${snapshot.baselinePeriod}.`,
          metadata: {
            period: snapshot.period,
            baselinePeriod: snapshot.baselinePeriod,
            precisionAt3: snapshot.current.precisionAt3,
            rejectionRate: snapshot.current.rejectionRate,
            ctr: snapshot.current.ctr,
          },
        });
      }
      return;
    }

    const failingChecks = snapshot.checks.filter(c => c.status !== 'healthy');
    const severity = snapshot.status === 'critical' ? 'critical' : 'warning';

    AlertService.send({
      severity,
      title: 'Recommendation Quality Drift',
      message: `Recommendation quality is ${snapshot.status} for ${snapshot.period} vs ${snapshot.baselinePeriod}.`,
      metadata: {
        period: snapshot.period,
        baselinePeriod: snapshot.baselinePeriod,
        failingChecks: failingChecks.map(c => c.id),
        precisionAt3: snapshot.current.precisionAt3,
        rejectionRate: snapshot.current.rejectionRate,
        ctr: snapshot.current.ctr,
        drift: snapshot.drift,
      },
    });
  }
}

export const recommendationHealthMonitor = new RecommendationHealthMonitorService();
