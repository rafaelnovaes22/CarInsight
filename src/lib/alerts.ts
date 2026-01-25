/**
 * Simple Alerting System for MVP
 *
 * Logs alerts to console/file. Can be extended to email/Slack later.
 * Designed for low-volume MVP with 50 cars, focusing on critical issues.
 */

import { logger } from './logger';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
    timestamp: Date;
    severity: AlertSeverity;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
}

/**
 * In-memory alert storage (sufficient for MVP)
 * For production: Consider Redis or database storage
 */
const alertHistory: Alert[] = [];
const MAX_ALERT_HISTORY = 100;

/**
 * Alert Service - Simple alerting for MVP
 */
export class AlertService {
    /**
     * Send an alert (log + store)
     */
    static send(alert: Omit<Alert, 'timestamp'>): void {
        const fullAlert: Alert = {
            ...alert,
            timestamp: new Date(),
        };

        // Store in memory (circular buffer)
        alertHistory.push(fullAlert);
        if (alertHistory.length > MAX_ALERT_HISTORY) {
            alertHistory.shift();
        }

        // Log with appropriate severity
        const logData = {
            alertType: alert.title,
            severity: alert.severity,
            ...alert.metadata,
        };

        switch (alert.severity) {
            case 'critical':
                logger.error(logData, `🚨 CRITICAL: ${alert.message}`);
                break;
            case 'warning':
                logger.warn(logData, `⚠️  WARNING: ${alert.message}`);
                break;
            default:
                logger.info(logData, `ℹ️  INFO: ${alert.message}`);
        }

        // TODO: Add email/Slack notifications for critical alerts
        // if (alert.severity === 'critical') {
        //   await sendSlackNotification(alert);
        // }
    }

    /**
     * Get recent alerts
     */
    static getRecent(limit: number = 10): Alert[] {
        return alertHistory.slice(-limit);
    }

    /**
     * Get alerts by severity
     */
    static getBySeverity(severity: AlertSeverity): Alert[] {
        return alertHistory.filter((a) => a.severity === severity);
    }

    /**
     * Clear all alerts (for testing)
     */
    static clear(): void {
        alertHistory.length = 0;
    }

    /**
     * Get alert count by severity (for dashboard)
     */
    static getCounts(): Record<AlertSeverity, number> {
        return {
            info: alertHistory.filter((a) => a.severity === 'info').length,
            warning: alertHistory.filter((a) => a.severity === 'warning').length,
            critical: alertHistory.filter((a) => a.severity === 'critical').length,
        };
    }
}

/**
 * Pre-configured alert helpers for common scenarios
 */
export const alerts = {
    /**
     * Alert when a node takes too long (>3s = bad UX)
     */
    slowNode: (node: string, latencyMs: number, threshold: number = 3000) => {
        if (latencyMs > threshold) {
            AlertService.send({
                severity: 'warning',
                title: 'Slow Node Detected',
                message: `Node "${node}" took ${latencyMs}ms (threshold: ${threshold}ms)`,
                metadata: { node, latencyMs, threshold },
            });
        }
    },

    /**
     * Alert when LLM provider falls back to secondary
     */
    llmFallback: (failedProvider: string, fallbackProvider: string, error?: string) => {
        AlertService.send({
            severity: 'warning',
            title: 'LLM Provider Fallback',
            message: `${failedProvider} failed, using ${fallbackProvider}`,
            metadata: { failedProvider, fallbackProvider, error },
        });
    },

    /**
     * Alert when graph execution fails completely
     */
    graphExecutionError: (conversationId: string, error: Error | string) => {
        AlertService.send({
            severity: 'critical',
            title: 'Graph Execution Failed',
            message: `Conversation ${conversationId} crashed: ${error instanceof Error ? error.message : error}`,
            metadata: {
                conversationId,
                error: error instanceof Error ? error.stack : error,
            },
        });
    },

    /**
     * Alert when database connection fails
     */
    databaseError: (operation: string, error: Error | string) => {
        AlertService.send({
            severity: 'critical',
            title: 'Database Error',
            message: `Database operation "${operation}" failed`,
            metadata: {
                operation,
                error: error instanceof Error ? error.message : error,
            },
        });
    },

    /**
     * Alert when vector store is empty or unavailable
     */
    vectorStoreEmpty: (count: number) => {
        AlertService.send({
            severity: 'warning',
            title: 'Vector Store Empty',
            message: `Vector store has only ${count} vectors loaded`,
            metadata: { vectorCount: count },
        });
    },

    /**
     * Alert for high error rate in a time window
     */
    highErrorRate: (errorCount: number, windowMinutes: number, threshold: number = 5) => {
        if (errorCount >= threshold) {
            AlertService.send({
                severity: 'critical',
                title: 'High Error Rate',
                message: `${errorCount} errors in the last ${windowMinutes} minutes`,
                metadata: { errorCount, windowMinutes, threshold },
            });
        }
    },

    /**
     * Info alert for lead created (positive business event)
     */
    leadCreated: (conversationId: string, source: string) => {
        AlertService.send({
            severity: 'info',
            title: 'Lead Created',
            message: `New lead from ${source}`,
            metadata: { conversationId, source },
        });
    },
};
