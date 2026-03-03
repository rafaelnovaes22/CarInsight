/**
 * Follow-Up Scheduler
 *
 * In-process polling scheduler that replaces the BullMQ-based worker
 * when Redis is unavailable (e.g., Railway without Redis add-on).
 *
 * Polls for due follow-ups every 2 minutes and processes them directly.
 */

import { logger } from '../lib/logger';
import { maskPhoneNumber } from '../lib/privacy';
import { followUpService } from '../services/follow-up.service';
import { isQuietHours } from '../config/time-context';

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const BATCH_SIZE = 20;

let intervalId: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

/**
 * Process a single follow-up. Errors are caught so one failure
 * doesn't block the rest of the batch.
 */
async function processSingleFollowUp(followUp: any): Promise<void> {
  const { id, phoneNumber, content, conversationId } = followUp;

  try {
    // Skip during quiet hours — will be picked up in the next cycle after 08h
    if (isQuietHours()) {
      logger.debug({ followUpId: id }, 'Follow-up: quiet hours, skipping until next cycle');
      return;
    }

    // Check for re-engagement
    const { prisma } = await import('../lib/prisma');
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { lastMessageAt: true },
    });

    if (!conversation) {
      logger.warn(
        { followUpId: id, conversationId },
        'Follow-up: conversation not found, cancelling'
      );
      await followUpService.markAsSent(id, false);
      return;
    }

    if (conversation.lastMessageAt > followUp.createdAt) {
      logger.info(
        { followUpId: id, phoneNumber: maskPhoneNumber(phoneNumber) },
        'Follow-up: customer re-engaged, cancelling'
      );
      await followUpService.cancelPendingFollowUps(phoneNumber);
      return;
    }

    // Send the message
    const { WhatsAppServiceFactory } = await import('../services/whatsapp-factory');
    const whatsappService = WhatsAppServiceFactory.getInstance();
    await whatsappService.sendMessage(phoneNumber, content);

    // Mark as sent (auto-schedules next in sequence)
    await followUpService.markAsSent(id, true);

    logger.info(
      { followUpId: id, phoneNumber: maskPhoneNumber(phoneNumber) },
      'Follow-up sent successfully'
    );
  } catch (error) {
    logger.error(
      { err: error, followUpId: id, phoneNumber: maskPhoneNumber(phoneNumber) },
      'Follow-up: failed to process'
    );
  }
}

/**
 * Poll for due follow-ups and process them.
 */
async function pollAndProcess(): Promise<void> {
  if (isProcessing) {
    logger.debug('Follow-up scheduler: previous cycle still running, skipping');
    return;
  }

  isProcessing = true;

  try {
    const dueFollowUps = await followUpService.getDueFollowUps(BATCH_SIZE);

    if (dueFollowUps.length === 0) return;

    logger.info({ count: dueFollowUps.length }, 'Follow-up scheduler: processing due follow-ups');

    for (const followUp of dueFollowUps) {
      await processSingleFollowUp(followUp);
    }
  } catch (error) {
    logger.error({ err: error }, 'Follow-up scheduler: poll cycle failed');
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the follow-up scheduler.
 */
export function startFollowUpScheduler(): void {
  if (intervalId) {
    logger.warn('Follow-up scheduler already running');
    return;
  }

  intervalId = setInterval(pollAndProcess, POLL_INTERVAL_MS);

  // Run once immediately on startup
  pollAndProcess();

  logger.info(
    { intervalMs: POLL_INTERVAL_MS, batchSize: BATCH_SIZE },
    'Follow-up scheduler started'
  );
}

/**
 * Stop the follow-up scheduler.
 */
export function stopFollowUpScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Follow-up scheduler stopped');
  }
}
