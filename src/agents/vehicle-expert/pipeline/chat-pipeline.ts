import { logger } from '../../../lib/logger';
import { ConversationContext, ConversationResponse } from '../../../types/conversation.types';
import { CustomerProfile } from '../../../types/state.types';

export interface PipelineContext {
  userMessage: string;
  messageLower: string;
  context: ConversationContext;
  updatedProfile: Partial<CustomerProfile>;
  extracted: {
    extracted: Partial<CustomerProfile>;
    confidence: number;
  };
  startTime: number;
}

export interface PipelineStep {
  name: string;
  execute(ctx: PipelineContext): Promise<ConversationResponse | null>;
}

export async function runChatPipeline(
  steps: PipelineStep[],
  ctx: PipelineContext
): Promise<ConversationResponse> {
  for (const step of steps) {
    const result = await step.execute(ctx);
    if (result) {
      logger.debug({ step: step.name }, 'Pipeline step returned response');
      return result;
    }
  }

  // Fallback if no step returned a response
  return {
    response: 'Me conta mais sobre o que você procura! O que é mais importante pra você no carro?',
    extractedPreferences: ctx.extracted.extracted,
    needsMoreInfo: ['usage', 'budget'],
    canRecommend: false,
    nextMode: ctx.context.mode,
    metadata: {
      processingTime: Date.now() - ctx.startTime,
      confidence: 0.5,
      llmUsed: 'rule-based',
    },
  };
}
