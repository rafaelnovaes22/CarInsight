/**
 * Testes do job de retencao (LGPD / ISO 42001 Anexo A.7)
 *
 * Cobre RSK-004: a politica publica declara expurgo em 90 dias de inatividade,
 * e antes deste job o metodo existia sem nada agenda-lo.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const cleanupInactiveData = vi.fn();

vi.mock('../../../src/services/data-rights.service', () => ({
  dataRightsService: {
    cleanupInactiveData: () => cleanupInactiveData(),
  },
}));

vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  runDataRetention,
  startDataRetentionSchedule,
  stopDataRetentionSchedule,
  isDataRetentionScheduled,
} from '../../../src/jobs/data-retention.job';

describe('data-retention job', () => {
  beforeEach(() => {
    cleanupInactiveData.mockReset();
    stopDataRetentionSchedule();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopDataRetentionSchedule();
    vi.useRealTimers();
  });

  describe('runDataRetention', () => {
    it('executa o expurgo e devolve a contagem apagada', async () => {
      cleanupInactiveData.mockResolvedValue(7);

      const result = await runDataRetention();

      expect(cleanupInactiveData).toHaveBeenCalledTimes(1);
      expect(result.deletedCount).toBe(7);
      expect(result.skipped).toBe(false);
    });

    it('nao lanca quando o expurgo falha, para nao derrubar o agente', async () => {
      cleanupInactiveData.mockRejectedValue(new Error('database unreachable'));

      const result = await runDataRetention();

      expect(result.deletedCount).toBe(0);
      expect(result.skipped).toBe(false);
    });

    it('devolve 0 apagados quando nao ha dado inativo', async () => {
      cleanupInactiveData.mockResolvedValue(0);

      const result = await runDataRetention();

      expect(result.deletedCount).toBe(0);
    });
  });

  describe('agendamento', () => {
    it('nao esta agendado antes de start', () => {
      expect(isDataRetentionScheduled()).toBe(false);
    });

    it('agenda e depois para', () => {
      startDataRetentionSchedule();
      expect(isDataRetentionScheduled()).toBe(true);

      stopDataRetentionSchedule();
      expect(isDataRetentionScheduled()).toBe(false);
    });

    it('ignora start duplicado em vez de criar dois timers', () => {
      startDataRetentionSchedule();
      startDataRetentionSchedule();

      stopDataRetentionSchedule();
      expect(isDataRetentionScheduled()).toBe(false);
    });

    it('executa a primeira rodada 5 minutos apos o start, fora do caminho de boot', async () => {
      cleanupInactiveData.mockResolvedValue(1);
      startDataRetentionSchedule();

      expect(cleanupInactiveData).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(cleanupInactiveData).toHaveBeenCalledTimes(1);
    });

    it('executa uma vez por dia depois da primeira rodada', async () => {
      cleanupInactiveData.mockResolvedValue(0);
      startDataRetentionSchedule();

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(cleanupInactiveData).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(cleanupInactiveData).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(cleanupInactiveData).toHaveBeenCalledTimes(3);
    });

    it('nao dispara a primeira rodada se o schedule foi parado antes dela', async () => {
      cleanupInactiveData.mockResolvedValue(0);
      startDataRetentionSchedule();
      stopDataRetentionSchedule();

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

      expect(cleanupInactiveData).not.toHaveBeenCalled();
    });
  });
});
