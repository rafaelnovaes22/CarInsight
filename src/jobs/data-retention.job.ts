/**
 * Data Retention Job (LGPD / ISO 42001)
 *
 * A politica publica declara retencao de 90 dias de inatividade, e
 * DataRightsService.cleanupInactiveData() implementa o expurgo. Ate 2026-07-29
 * nada chamava esse metodo em producao: a promessa nao era cumprida por omissao.
 * Registrado como RSK-004 (critico) em governance/risk/risk-register.yaml.
 *
 * Segue o padrao in-process de src/workers/follow-up-scheduler.ts para nao
 * introduzir dependencia de scheduler externo.
 */

import { logger } from '../lib/logger';
import { dataRightsService } from '../services/data-rights.service';

const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // diario
const FIRST_RUN_DELAY_MS = 5 * 60 * 1000; // 5 min apos boot, fora do caminho de startup

let intervalId: ReturnType<typeof setInterval> | null = null;
let firstRunTimeoutId: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

export interface RetentionRunResult {
  deletedCount: number;
  durationMs: number;
  skipped: boolean;
}

/**
 * Executa o expurgo uma vez. Idempotente e seguro para chamar manualmente.
 * Nunca lanca: falha aqui nao pode derrubar o processo do agente.
 */
export async function runDataRetention(): Promise<RetentionRunResult> {
  if (isRunning) {
    logger.warn({ event: 'data_retention_run' }, 'Data retention already running, skipping cycle');
    return { deletedCount: 0, durationMs: 0, skipped: true };
  }

  isRunning = true;
  const startedAt = Date.now();

  try {
    const deletedCount = await dataRightsService.cleanupInactiveData();
    const durationMs = Date.now() - startedAt;

    logger.info(
      { event: 'data_retention_run', deletedCount, durationMs, retentionDays: 90 },
      'LGPD: data retention run completed'
    );

    return { deletedCount, durationMs, skipped: false };
  } catch (error) {
    logger.error(
      { event: 'data_retention_run', err: error, durationMs: Date.now() - startedAt },
      'LGPD: data retention run failed'
    );
    return { deletedCount: 0, durationMs: Date.now() - startedAt, skipped: false };
  } finally {
    isRunning = false;
  }
}

/** Agenda a execucao diaria. Chamado no bootstrap. */
export function startDataRetentionSchedule(): void {
  if (intervalId) {
    logger.warn({ event: 'data_retention_schedule' }, 'Data retention schedule already started');
    return;
  }

  firstRunTimeoutId = setTimeout(() => {
    void runDataRetention();
  }, FIRST_RUN_DELAY_MS);

  intervalId = setInterval(() => {
    void runDataRetention();
  }, RUN_INTERVAL_MS);

  logger.info(
    { event: 'data_retention_schedule', intervalHours: 24, firstRunInMinutes: 5 },
    'LGPD: data retention schedule started'
  );
}

/** Para o agendamento. Chamado no shutdown gracioso. */
export function stopDataRetentionSchedule(): void {
  if (firstRunTimeoutId) {
    clearTimeout(firstRunTimeoutId);
    firstRunTimeoutId = null;
  }

  if (!intervalId) return;

  clearInterval(intervalId);
  intervalId = null;
  logger.info({ event: 'data_retention_schedule' }, 'LGPD: data retention schedule stopped');
}

/** Exposto para teste e para health check de governanca. */
export function isDataRetentionScheduled(): boolean {
  return intervalId !== null;
}
