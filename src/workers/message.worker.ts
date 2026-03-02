import { Worker, type Job } from 'bullmq';
import { type ConnectionOptions } from 'bullmq';
import { logger } from '../lib/logger';
import { type WebhookJob } from '../types/queue.types';
import WhatsAppMetaService from '../services/whatsapp-meta.service';
import { MessageHandlerV2 } from '../services/message-handler-v2.service';
import { WhatsAppEvolutionService } from '../services/whatsapp-evolution.service';

const whatsappMeta = new WhatsAppMetaService();
const messageHandler = new MessageHandlerV2();
const evolutionService = new WhatsAppEvolutionService();

async function processJob(job: Job<WebhookJob>): Promise<void> {
  const { data } = job;

  if (data.source === 'meta') {
    await whatsappMeta.processWebhook(data.body as any);
  } else if (data.source === 'evolution') {
    const response = await messageHandler.handleMessage(data.phoneNumber, data.content);
    await evolutionService.sendMessage(data.phoneNumber, response);
  }
}

export function createMessageWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<WebhookJob>('whatsapp-messages', processJob, {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  });

  worker.on('completed', job => {
    logger.debug({ jobId: job?.id, source: job?.data.source }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, source: job?.data.source, err: err.message, attempts: job?.attemptsMade },
      'Job failed'
    );
  });

  worker.on('error', err => {
    logger.error({ err }, 'Worker error');
  });

  logger.info('Message worker started (concurrency: 5, rate: 10/s)');
  return worker;
}
