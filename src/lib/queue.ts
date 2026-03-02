import { Queue, type ConnectionOptions } from 'bullmq';
import { logger } from './logger';

let messageQueue: Queue | null = null;

export function createMessageQueue(connection: ConnectionOptions): Queue {
  messageQueue = new Queue('whatsapp-messages', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  messageQueue.on('error', err => {
    logger.error({ err }, 'Message queue error');
  });

  logger.info('Message queue initialized');
  return messageQueue;
}

export function getMessageQueue(): Queue | null {
  return messageQueue;
}

export async function closeMessageQueue(): Promise<void> {
  if (messageQueue) {
    await messageQueue.close();
    messageQueue = null;
    logger.info('Message queue closed');
  }
}
