/**
 * Unit tests for AlertService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AlertService, alerts, AlertSeverity } from '../../../src/lib/alerts';

describe('AlertService', () => {
    beforeEach(() => {
        AlertService.clear();
    });

    describe('send', () => {
        it('should store alert in history', () => {
            AlertService.send({
                severity: 'info',
                title: 'Test Alert',
                message: 'This is a test',
            });

            const recent = AlertService.getRecent();
            expect(recent).toHaveLength(1);
            expect(recent[0].title).toBe('Test Alert');
            expect(recent[0].severity).toBe('info');
            expect(recent[0].timestamp).toBeInstanceOf(Date);
        });

        it('should store metadata', () => {
            AlertService.send({
                severity: 'warning',
                title: 'Test with Metadata',
                message: 'Test message',
                metadata: { node: 'discovery', latency: 5000 },
            });

            const recent = AlertService.getRecent();
            expect(recent[0].metadata).toEqual({ node: 'discovery', latency: 5000 });
        });
    });

    describe('getRecent', () => {
        it('should return limited number of alerts', () => {
            for (let i = 0; i < 15; i++) {
                AlertService.send({
                    severity: 'info',
                    title: `Alert ${i}`,
                    message: 'Test',
                });
            }

            const recent = AlertService.getRecent(5);
            expect(recent).toHaveLength(5);
            // Should return most recent
            expect(recent[0].title).toBe('Alert 10');
        });
    });

    describe('getBySeverity', () => {
        it('should filter by severity', () => {
            AlertService.send({ severity: 'info', title: 'Info 1', message: 'Test' });
            AlertService.send({ severity: 'warning', title: 'Warning 1', message: 'Test' });
            AlertService.send({ severity: 'critical', title: 'Critical 1', message: 'Test' });
            AlertService.send({ severity: 'warning', title: 'Warning 2', message: 'Test' });

            const warnings = AlertService.getBySeverity('warning');
            expect(warnings).toHaveLength(2);
            expect(warnings.every((a) => a.severity === 'warning')).toBe(true);
        });
    });

    describe('getCounts', () => {
        it('should return counts by severity', () => {
            AlertService.send({ severity: 'info', title: 'Info 1', message: 'Test' });
            AlertService.send({ severity: 'info', title: 'Info 2', message: 'Test' });
            AlertService.send({ severity: 'warning', title: 'Warning 1', message: 'Test' });
            AlertService.send({ severity: 'critical', title: 'Critical 1', message: 'Test' });

            const counts = AlertService.getCounts();
            expect(counts).toEqual({
                info: 2,
                warning: 1,
                critical: 1,
            });
        });
    });

    describe('clear', () => {
        it('should remove all alerts', () => {
            AlertService.send({ severity: 'info', title: 'Test', message: 'Test' });
            AlertService.send({ severity: 'warning', title: 'Test', message: 'Test' });

            AlertService.clear();

            expect(AlertService.getRecent()).toHaveLength(0);
        });
    });
});

describe('Pre-configured alerts', () => {
    beforeEach(() => {
        AlertService.clear();
    });

    describe('slowNode', () => {
        it('should create alert for latency above threshold', () => {
            alerts.slowNode('discovery', 4500, 3000);

            const recent = AlertService.getRecent();
            expect(recent).toHaveLength(1);
            expect(recent[0].severity).toBe('warning');
            expect(recent[0].title).toBe('Slow Node Detected');
            expect(recent[0].metadata?.node).toBe('discovery');
            expect(recent[0].metadata?.latencyMs).toBe(4500);
        });

        it('should not create alert below threshold', () => {
            alerts.slowNode('discovery', 2000, 3000);
            expect(AlertService.getRecent()).toHaveLength(0);
        });
    });

    describe('llmFallback', () => {
        it('should create warning alert', () => {
            alerts.llmFallback('openai', 'groq', 'Rate limit exceeded');

            const recent = AlertService.getRecent();
            expect(recent).toHaveLength(1);
            expect(recent[0].severity).toBe('warning');
            expect(recent[0].metadata?.failedProvider).toBe('openai');
            expect(recent[0].metadata?.fallbackProvider).toBe('groq');
        });
    });

    describe('graphExecutionError', () => {
        it('should create critical alert', () => {
            const error = new Error('Graph execution failed');
            alerts.graphExecutionError('conv-123', error);

            const recent = AlertService.getRecent();
            expect(recent).toHaveLength(1);
            expect(recent[0].severity).toBe('critical');
            expect(recent[0].metadata?.conversationId).toBe('conv-123');
        });
    });

    describe('leadCreated', () => {
        it('should create info alert', () => {
            alerts.leadCreated('conv-123', 'negotiation');

            const recent = AlertService.getRecent();
            expect(recent).toHaveLength(1);
            expect(recent[0].severity).toBe('info');
            expect(recent[0].title).toBe('Lead Created');
            expect(recent[0].metadata?.source).toBe('negotiation');
        });
    });
});
