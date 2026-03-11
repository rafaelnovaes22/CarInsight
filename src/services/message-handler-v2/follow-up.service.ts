import { featureFlags } from '../../lib/feature-flags';
import { logger } from '../../lib/logger';
import { maskPhoneNumber } from '../../lib/privacy';
import { prisma } from '../../lib/prisma';
import { cache } from '../../lib/redis';
import type { ConversationState } from '../../types/state.types';
import { conversionTracker } from '../conversion-tracker.service';
import { followUpService } from '../follow-up.service';

export class MessageHandlerFollowUpService {
  async handleReengagement(phoneNumber: string, lowerMessage: string): Promise<string | null> {
    if (!featureFlags.isEnabled('ENABLE_FOLLOW_UP')) {
      return null;
    }

    await followUpService.cancelPendingFollowUps(phoneNumber);

    if (lowerMessage === 'parar' || lowerMessage === 'pare') {
      await followUpService.handleOptOut(phoneNumber);
      return 'Pronto! Voce nao recebera mais mensagens de acompanhamento. Se precisar de algo, e so chamar! \uD83D\uDE0A';
    }

    return null;
  }

  async scheduleExitFollowUp(phoneNumber: string): Promise<void> {
    if (!featureFlags.isEnabled('ENABLE_FOLLOW_UP')) {
      return;
    }

    try {
      const conversation = await prisma.conversation.findFirst({
        where: { phoneNumber, status: 'active' },
        select: { id: true, customerName: true },
      });

      if (!conversation) {
        return;
      }

      const stateKey = `conversation:${conversation.id}:state`;
      const cachedStateJson = await cache.get(stateKey);
      if (!cachedStateJson) {
        return;
      }

      const state = JSON.parse(cachedStateJson) as ConversationState;
      if (state.recommendations.length === 0) {
        return;
      }

      await followUpService.scheduleFollowUp({
        conversationId: conversation.id,
        phoneNumber,
        type: 'abandoned_cart',
        customerName: state.profile?.customerName || conversation.customerName || undefined,
        vehicleName: this.getFirstVehicleName(state.recommendations),
      });
    } catch (error) {
      logger.error(
        { error, phoneNumber: maskPhoneNumber(phoneNumber) },
        'Error scheduling exit follow-up'
      );
    }
  }

  async scheduleRecommendationFollowUp(
    conversationId: string,
    phoneNumber: string,
    state: ConversationState,
    persistConversionScore: (score: number) => Promise<void>
  ): Promise<boolean> {
    if (
      !featureFlags.isEnabled('ENABLE_FOLLOW_UP') ||
      state.recommendations.length === 0 ||
      state.metadata.flags.includes('follow_up_scheduled')
    ) {
      return false;
    }

    const score = conversionTracker.calculateScore(
      state.profile || {},
      {
        startedAt: new Date(state.metadata.startedAt),
        lastMessageAt: new Date(state.metadata.lastMessageAt),
        flags: state.metadata.flags,
        messageCount: state.messages.length,
      },
      phoneNumber
    );

    await persistConversionScore(score);

    if (!conversionTracker.shouldScheduleFollowUp(score, true)) {
      return false;
    }

    await followUpService.scheduleFollowUp({
      conversationId,
      phoneNumber,
      type: 'post_recommendation',
      customerName: state.profile?.customerName,
      vehicleName: this.getFirstVehicleName(state.recommendations),
    });

    state.metadata.flags = [...state.metadata.flags, 'follow_up_scheduled'];
    return true;
  }

  private getFirstVehicleName(recommendations: any[]): string | undefined {
    const firstRecommendation = recommendations[0];
    if (!firstRecommendation?.vehicle) {
      return undefined;
    }

    const brand = firstRecommendation.vehicle.marca || firstRecommendation.vehicle.brand || '';
    const model = firstRecommendation.vehicle.modelo || firstRecommendation.vehicle.model || '';
    return `${brand} ${model}`.trim() || undefined;
  }
}
