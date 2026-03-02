export interface MetaWebhookJob {
  source: 'meta';
  body: Record<string, unknown>;
  receivedAt: string;
}

export interface EvolutionWebhookJob {
  source: 'evolution';
  phoneNumber: string;
  content: string;
  receivedAt: string;
}

export type WebhookJob = MetaWebhookJob | EvolutionWebhookJob;
