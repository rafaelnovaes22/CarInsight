/**
 * Follow-Up Service
 *
 * Orchestrates follow-up message scheduling for abandoned conversations,
 * post-recommendation sequences, and post-sale retention.
 *
 * Compliance:
 * - Quiet hours: Never sends between 22h-08h (schedules for 08:00 next day)
 * - Opt-out: Every message includes "Digite PARAR para não receber mais"
 * - Cancellation: If customer re-engages, pending follow-ups are cancelled
 * - Max 3 messages per sequence
 */

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { maskPhoneNumber } from '../lib/privacy';
import { isQuietHours, getNextSendTime } from '../config/time-context';
import { env } from '../config/env';

const AI_FOLLOW_UP_NOTICE = '🤖 _Mensagem automática da assistente virtual CarInsight._';

export type FollowUpType = 'abandoned_cart' | 'post_recommendation' | 'post_sale' | 'referral';

interface ScheduleFollowUpOptions {
  conversationId: string;
  phoneNumber: string;
  type: FollowUpType;
  vehicleName?: string;
  customerName?: string;
  delayMinutes?: number;
  sequence?: number;
}

const MAX_SEQUENCE = 3;

// Follow-up message templates
const OPT_OUT_HINT = '_Digite PARAR para não receber mais mensagens._';

const FOLLOW_UP_TEMPLATES: Record<
  FollowUpType,
  Record<number, (ctx: { name?: string; vehicle?: string }) => string>
> = {
  abandoned_cart: {
    1: ctx =>
      `Oi${ctx.name ? `, ${ctx.name}` : ''}! Vi que você se interessou pelo ${ctx.vehicle || 'nosso estoque'}. Ficou alguma dúvida? Tô aqui pra ajudar! 😊\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
    2: ctx =>
      `${ctx.name ? `${ctx.name}, a` : 'A'}chei uma informação legal sobre o ${ctx.vehicle || 'carro que você viu'}: ele tem ótima avaliação de quem já comprou! Quer saber mais?\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
    3: ctx =>
      `O ${ctx.vehicle || 'carro que você viu'} ainda está disponível, mas já tiveram mais pessoas perguntando! Se quiser, é só chamar 😉\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
  },
  post_recommendation: {
    1: ctx =>
      `Oi${ctx.name ? `, ${ctx.name}` : ''}! Você viu algumas opções com a gente. Gostou de alguma? Posso te ajudar com mais detalhes! 🚗\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
    2: ctx =>
      `${ctx.name ? `${ctx.name}, s` : 'S'}e quiser agendar uma visita pra ver de perto, é só falar! Nosso time tá esperando pra te atender.\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
    3: _ctx =>
      `Última mensagem! Se precisar de ajuda pra encontrar o carro ideal, estamos aqui. É só mandar um "oi" 😊\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
  },
  post_sale: {
    1: ctx =>
      `Oi${ctx.name ? `, ${ctx.name}` : ''}! Como está o ${ctx.vehicle || 'carro novo'}? Curtindo? 🚗✨\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
    2: ctx =>
      `${ctx.name ? `${ctx.name}, q` : 'Q'}ueria saber: de 1 a 5, como foi sua experiência de compra com a gente? Seu feedback é muito importante!\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
    3: _ctx =>
      `Que bom ter você como cliente! Se tiver algum amigo procurando carro, pode mandar pra gente — adoramos indicações! 😊\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
  },
  referral: {
    1: ctx =>
      `Oi${ctx.name ? `, ${ctx.name}` : ''}! Temos novidades no estoque que combinam com seu perfil. Quer dar uma olhada? 🚗\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
    2: _ctx => '',
    3: _ctx => '',
  },
};

// Default delays in minutes for each sequence step
const DEFAULT_DELAYS: Record<FollowUpType, number[]> = {
  abandoned_cart: [30, 240, 1440], // 30min, 4h, 24h
  post_recommendation: [30, 240, 1440],
  post_sale: [4320, 10080, 20160], // 3 days, 7 days, 14 days
  referral: [129600, 0, 0], // 90 days
};

export class FollowUpService {
  /**
   * Schedule a follow-up message. Respects quiet hours and max sequence.
   */
  async scheduleFollowUp(options: ScheduleFollowUpOptions): Promise<string | null> {
    if (!env.ENABLE_FOLLOW_UP) {
      return null;
    }

    const sequence = options.sequence || 1;
    if (sequence > MAX_SEQUENCE) {
      logger.debug(
        { phoneNumber: maskPhoneNumber(options.phoneNumber), sequence },
        'Follow-up: max sequence reached, skipping'
      );
      return null;
    }

    // Generate message content
    const template = FOLLOW_UP_TEMPLATES[options.type]?.[sequence];
    if (!template) {
      logger.warn({ type: options.type, sequence }, 'Follow-up: no template for this sequence');
      return null;
    }

    const content = template({
      name: options.customerName,
      vehicle: options.vehicleName,
    });

    if (!content) return null;

    // Calculate scheduled time
    const delayMinutes = options.delayMinutes ?? DEFAULT_DELAYS[options.type]?.[sequence - 1] ?? 30;
    let scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    // Respect quiet hours
    if (isQuietHours(scheduledAt)) {
      scheduledAt = getNextSendTime(scheduledAt);
    }

    try {
      const followUp = await prisma.followUp.create({
        data: {
          conversationId: options.conversationId,
          phoneNumber: options.phoneNumber,
          type: options.type,
          sequence,
          status: 'pending',
          scheduledAt,
          content,
        },
      });

      // Update conversation follow-up count
      await prisma.conversation.update({
        where: { id: options.conversationId },
        data: {
          followUpCount: { increment: 1 },
          lastFollowUpAt: new Date(),
        },
      });

      logger.info(
        {
          followUpId: followUp.id,
          phoneNumber: maskPhoneNumber(options.phoneNumber),
          type: options.type,
          sequence,
          scheduledAt: scheduledAt.toISOString(),
        },
        'Follow-up scheduled'
      );

      return followUp.id;
    } catch (error) {
      logger.error(
        { error, phoneNumber: maskPhoneNumber(options.phoneNumber) },
        'Error scheduling follow-up'
      );
      return null;
    }
  }

  /**
   * Cancel all pending follow-ups for a phone number.
   * Called when customer re-engages spontaneously.
   */
  async cancelPendingFollowUps(phoneNumber: string): Promise<number> {
    if (!env.ENABLE_FOLLOW_UP) return 0;

    try {
      const result = await prisma.followUp.updateMany({
        where: {
          phoneNumber,
          status: 'pending',
        },
        data: {
          status: 'cancelled',
        },
      });

      if (result.count > 0) {
        logger.info(
          { phoneNumber: maskPhoneNumber(phoneNumber), cancelled: result.count },
          'Pending follow-ups cancelled (customer re-engaged)'
        );
      }

      return result.count;
    } catch (error) {
      logger.error(
        { error, phoneNumber: maskPhoneNumber(phoneNumber) },
        'Error cancelling follow-ups'
      );
      return 0;
    }
  }

  /**
   * Handle opt-out request from customer (typing "PARAR").
   */
  async handleOptOut(phoneNumber: string): Promise<boolean> {
    try {
      await this.cancelPendingFollowUps(phoneNumber);

      logger.info({ phoneNumber: maskPhoneNumber(phoneNumber) }, 'Follow-up: Customer opted out');

      return true;
    } catch (error) {
      logger.error({ error, phoneNumber: maskPhoneNumber(phoneNumber) }, 'Error handling opt-out');
      return false;
    }
  }

  /**
   * Get pending follow-ups that are due for sending.
   */
  async getDueFollowUps(limit: number = 50): Promise<any[]> {
    try {
      return await prisma.followUp.findMany({
        where: {
          status: 'pending',
          scheduledAt: { lte: new Date() },
        },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
        include: {
          conversation: {
            select: {
              id: true,
              phoneNumber: true,
              customerName: true,
              status: true,
              lastMessageAt: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error fetching due follow-ups');
      return [];
    }
  }

  /**
   * Mark follow-up as sent and schedule next in sequence.
   */
  async markAsSent(followUpId: string, scheduleNext: boolean = true): Promise<void> {
    try {
      const followUp = await prisma.followUp.update({
        where: { id: followUpId },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });

      // Schedule next in sequence if applicable
      if (scheduleNext && followUp.sequence < MAX_SEQUENCE) {
        await this.scheduleFollowUp({
          conversationId: followUp.conversationId,
          phoneNumber: followUp.phoneNumber,
          type: followUp.type as FollowUpType,
          sequence: followUp.sequence + 1,
        });
      }
    } catch (error) {
      logger.error({ error, followUpId }, 'Error marking follow-up as sent');
    }
  }

  /**
   * Mark a follow-up as replied (customer responded to it).
   */
  async markAsReplied(phoneNumber: string): Promise<void> {
    try {
      await prisma.followUp.updateMany({
        where: {
          phoneNumber,
          status: 'sent',
        },
        data: {
          status: 'replied',
        },
      });
    } catch (error) {
      logger.error(
        { error, phoneNumber: maskPhoneNumber(phoneNumber) },
        'Error marking follow-up as replied'
      );
    }
  }

  /**
   * Detect if a conversation was abandoned after viewing recommendations.
   */
  async detectAbandonment(
    conversationId: string,
    phoneNumber: string,
    lastMessageAt: Date,
    hasRecommendations: boolean
  ): Promise<boolean> {
    if (!env.ENABLE_FOLLOW_UP || !hasRecommendations) return false;

    const timeSinceLastMessage = Date.now() - lastMessageAt.getTime();
    const ABANDONMENT_THRESHOLD = 30 * 60 * 1000; // 30 minutes

    if (timeSinceLastMessage < ABANDONMENT_THRESHOLD) return false;

    // Check if there's already a pending follow-up
    const existingFollowUp = await prisma.followUp.findFirst({
      where: {
        conversationId,
        status: { in: ['pending', 'sent'] },
      },
    });

    if (existingFollowUp) return false;

    // Mark conversation as abandoned
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { abandonedAt: new Date() },
    });

    return true;
  }
}

export const followUpService = new FollowUpService();
