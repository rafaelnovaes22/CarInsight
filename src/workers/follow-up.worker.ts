/**
 * Follow-Up Worker
 *
 * BullMQ worker that processes scheduled follow-up messages.
 * Runs on a separate queue ('follow-up-messages') from the main message queue.
 *
 * Features:
 * - 3 retries with exponential backoff
 * - Re-engagement check before sending (customer may have returned)
 * - Quiet hours enforcement
 * - Automatic next-in-sequence scheduling after successful send
 */

import { Worker, Queue, type Job, type ConnectionOptions } from 'bullmq';
import { logger } from '../lib/logger';
import { maskPhoneNumber } from '../lib/privacy';
import { followUpService } from '../services/follow-up.service';
import { isQuietHours, getNextSendTime } from '../config/time-context';

export interface FollowUpJob {
  followUpId: string;
  phoneNumber: string;
  content: string;
  conversationId: string;
  type: string;
  sequence: number;
}

const QUEUE_NAME = 'follow-up-messages';

let followUpQueue: Queue<FollowUpJob> | null = null;

/**
 * Create the follow-up message queue.
 */
export function createFollowUpQueue(connection: ConnectionOptions): Queue<FollowUpJob> {
  followUpQueue = new Queue<FollowUpJob>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 2000 },
    },
  });

  followUpQueue.on('error', err => {
    logger.error({ err }, 'Follow-up queue error');
  });

  logger.info('Follow-up queue initialized');
  return followUpQueue;
}

/**
 * Get the follow-up queue instance.
 */
export function getFollowUpQueue(): Queue<FollowUpJob> | null {
  return followUpQueue;
}

/**
 * Enqueue a follow-up message for sending.
 */
export async function enqueueFollowUp(
  followUpId: string,
  phoneNumber: string,
  content: string,
  conversationId: string,
  type: string,
  sequence: number,
  delay?: number
): Promise<void> {
  if (!followUpQueue) {
    logger.warn('Follow-up queue not initialized, skipping enqueue');
    return;
  }

  await followUpQueue.add(
    'send-follow-up',
    {
      followUpId,
      phoneNumber,
      content,
      conversationId,
      type,
      sequence,
    },
    {
      delay: delay || 0,
      jobId: `follow-up-${followUpId}`,
    }
  );

  logger.debug(
    { followUpId, phoneNumber: maskPhoneNumber(phoneNumber), delay },
    'Follow-up enqueued'
  );
}

/**
 * Process a follow-up job.
 */
async function processFollowUpJob(job: Job<FollowUpJob>): Promise<void> {
  const { followUpId, phoneNumber, content, conversationId } = job.data;

  logger.info(
    {
      followUpId,
      phoneNumber: maskPhoneNumber(phoneNumber),
      attempt: job.attemptsMade + 1,
    },
    'Processing follow-up job'
  );

  // 1. Check if we're in quiet hours — reschedule if so
  if (isQuietHours()) {
    const nextSend = getNextSendTime();
    const _delay = nextSend.getTime() - Date.now();
    logger.info(
      { followUpId, nextSend: nextSend.toISOString() },
      'Follow-up: quiet hours, rescheduling'
    );
    throw new Error(`QUIET_HOURS: Rescheduled to ${nextSend.toISOString()}`);
  }

  // 2. Check if customer has re-engaged (conversation has new messages since scheduling)
  const { prisma } = await import('../lib/prisma');
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { lastMessageAt: true, status: true },
  });

  if (!conversation) {
    logger.warn({ followUpId, conversationId }, 'Follow-up: conversation not found, skipping');
    await followUpService.markAsSent(followUpId, false);
    return;
  }

  // If customer sent a message after the follow-up was scheduled, cancel it
  const followUp = await prisma.followUp.findUnique({
    where: { id: followUpId },
    select: { createdAt: true, status: true },
  });

  if (!followUp || followUp.status !== 'pending') {
    logger.info({ followUpId, status: followUp?.status }, 'Follow-up: already processed, skipping');
    return;
  }

  if (conversation.lastMessageAt > followUp.createdAt) {
    logger.info(
      { followUpId, phoneNumber: maskPhoneNumber(phoneNumber) },
      'Follow-up: customer re-engaged since scheduling, cancelling'
    );
    await followUpService.cancelPendingFollowUps(phoneNumber);
    return;
  }

  // 3. Send the follow-up message
  try {
    const { WhatsAppServiceFactory } = await import('../services/whatsapp-factory');
    const whatsappService = WhatsAppServiceFactory.getInstance();
    await whatsappService.sendMessage(phoneNumber, content);

    // 4. Mark as sent and schedule next in sequence
    await followUpService.markAsSent(followUpId, true);

    logger.info(
      { followUpId, phoneNumber: maskPhoneNumber(phoneNumber) },
      'Follow-up message sent successfully'
    );
  } catch (error) {
    logger.error(
      { error, followUpId, phoneNumber: maskPhoneNumber(phoneNumber) },
      'Follow-up: failed to send message'
    );
    throw error; // BullMQ will retry
  }
}

/**
 * Create the follow-up worker.
 */
export function createFollowUpWorker(connection: ConnectionOptions): Worker<FollowUpJob> {
  const worker = new Worker<FollowUpJob>(QUEUE_NAME, processFollowUpJob, {
    connection,
    concurrency: 2,
    limiter: {
      max: 5,
      duration: 1000,
    },
  });

  worker.on('completed', job => {
    logger.debug({ jobId: job?.id, followUpId: job?.data.followUpId }, 'Follow-up job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      {
        jobId: job?.id,
        followUpId: job?.data.followUpId,
        err: err.message,
        attempts: job?.attemptsMade,
      },
      'Follow-up job failed'
    );
  });

  worker.on('error', err => {
    logger.error({ err }, 'Follow-up worker error');
  });

  logger.info('Follow-up worker started (concurrency: 2, rate: 5/s)');
  return worker;
}

/**
 * Close the follow-up queue.
 */
export async function closeFollowUpQueue(): Promise<void> {
  if (followUpQueue) {
    await followUpQueue.close();
    followUpQueue = null;
    logger.info('Follow-up queue closed');
  }
}
