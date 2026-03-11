import { calculateCost } from '../../lib/llm-router';
import { cache } from '../../lib/redis';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import type { ConversationState } from '../../types/state.types';

let explanationColumnAvailable = true;

interface AudioMessageOptionsLike {
  mediaId?: string;
  waMessageId?: string;
}

interface PersistGraphResultParams {
  conversationId: string;
  previousState?: ConversationState;
  newState: ConversationState;
  finalResponse: string;
  processingTimeMs: number;
}

export class MessageHandlerPersistenceService {
  async loadState(conversationId: string): Promise<ConversationState | undefined> {
    const stateKey = this.getStateKey(conversationId);
    const cachedStateJson = await cache.get(stateKey);

    if (!cachedStateJson) {
      return undefined;
    }

    try {
      const currentState = JSON.parse(cachedStateJson) as ConversationState;
      currentState.metadata.startedAt = new Date(currentState.metadata.startedAt);
      currentState.metadata.lastMessageAt = new Date(currentState.metadata.lastMessageAt);
      currentState.messages = currentState.messages.map(message => ({
        ...message,
        timestamp: new Date(message.timestamp),
      }));
      return currentState;
    } catch (error) {
      logger.error({ error }, 'Error parsing cached state');
      return undefined;
    }
  }

  async saveState(conversationId: string, state: ConversationState): Promise<void> {
    await cache.set(this.getStateKey(conversationId), JSON.stringify(state), 86400);
  }

  async logIncomingMessage(
    conversationId: string,
    content: string,
    audioOptions?: AudioMessageOptionsLike
  ): Promise<void> {
    const isAudioMessage = !!audioOptions?.mediaId;
    const messageType = isAudioMessage ? 'audio_transcription' : 'text';

    await prisma.message.create({
      data: {
        conversationId,
        direction: 'incoming',
        content,
        messageType,
        waMessageId: audioOptions?.waMessageId,
        originalMediaId: audioOptions?.mediaId,
      },
    });
  }

  async logOutgoingMessage(
    conversationId: string,
    content: string,
    metrics?: {
      processingTimeMs?: number;
      tokenUsage?: unknown;
      cost?: number;
    }
  ): Promise<void> {
    await prisma.message.create({
      data: {
        conversationId,
        direction: 'outgoing',
        content,
        messageType: 'text',
        processingTimeMs: metrics?.processingTimeMs,
        tokenUsage: metrics?.tokenUsage
          ? JSON.parse(JSON.stringify(metrics.tokenUsage))
          : undefined,
        cost: metrics?.cost,
      },
    });
  }

  async persistGraphResult({
    conversationId,
    previousState,
    newState,
    finalResponse,
    processingTimeMs,
  }: PersistGraphResultParams): Promise<void> {
    await this.saveState(conversationId, newState);

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        currentStep: newState.graph.currentNode,
        lastMessageAt: new Date(),
        quizAnswers: newState.quiz.isComplete ? JSON.stringify(newState.quiz.answers) : null,
        profileData: newState.profile ? JSON.stringify(newState.profile) : null,
      },
    });

    let cost: number | undefined;
    const tokenUsage = newState.metadata.tokenUsage || undefined;
    if (tokenUsage && newState.metadata.llmUsed) {
      try {
        cost = calculateCost(newState.metadata.llmUsed, tokenUsage);
      } catch (error) {
        logger.error({ error }, 'Error calculating message cost');
      }
    }

    await this.logOutgoingMessage(conversationId, finalResponse, {
      processingTimeMs,
      tokenUsage,
      cost,
    });

    if (newState.quiz.isComplete && !previousState?.quiz.isComplete) {
      await prisma.event.create({
        data: {
          conversationId,
          eventType: 'quiz_completed',
          metadata: JSON.stringify({ answers: newState.quiz.answers }),
        },
      });
    }

    if (
      newState.recommendations.length > 0 &&
      (!previousState || previousState.recommendations.length === 0)
    ) {
      await this.persistRecommendations(conversationId, newState);
    }
  }

  async updateConversionScore(conversationId: string, score: number): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { conversionScore: Math.min(score, 32767) },
    });
  }

  private getStateKey(conversationId: string): string {
    return `conversation:${conversationId}:state`;
  }

  private async persistRecommendations(
    conversationId: string,
    state: ConversationState
  ): Promise<void> {
    for (let index = 0; index < state.recommendations.length; index++) {
      const recommendation = state.recommendations[index];
      const baseData = {
        conversationId,
        vehicleId: recommendation.vehicleId,
        matchScore: recommendation.matchScore,
        reasoning: recommendation.reasoning,
        position: index + 1,
      };

      const explanation = recommendation.explanation
        ? (recommendation.explanation as any)
        : undefined;
      const data =
        explanationColumnAvailable && explanation ? { ...baseData, explanation } : baseData;

      try {
        await prisma.recommendation.create({ data: data as any });
      } catch (error: any) {
        const message = String(error?.message || '');

        if (message.includes('Unique constraint')) {
          continue;
        }

        if (
          message.includes('Unknown argument `explanation`') ||
          (message.includes('column') && message.includes('explanation')) ||
          (message.includes('does not exist') && message.includes('explanation'))
        ) {
          explanationColumnAvailable = false;
          logger.warn('Explanation column not available in DB, disabling for this session');

          try {
            await prisma.recommendation.create({ data: baseData });
          } catch (fallbackError: any) {
            const fallbackMessage = String(fallbackError?.message || '');
            if (!fallbackMessage.includes('Unique constraint')) {
              logger.error({ error: fallbackError }, 'Error saving recommendation (fallback)');
            }
          }
        } else {
          logger.error({ error }, 'Error saving recommendation');
        }
      }
    }
  }
}
