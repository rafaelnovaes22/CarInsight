/**
 * Follow-Up Service
 *
 * Orchestrates follow-up message scheduling for abandoned conversations,
 * post-recommendation sequences, and post-sale 100-day journey retention.
 *
 * Post-sale 100-day journey (7 touchpoints):
 *   Seq 1 — Dia 0:  Parabéns pela compra + próximos passos
 *   Seq 2 — Dia 3:  Check de satisfação ("Como está o carro?")
 *   Seq 3 — Dia 7:  NPS 1-5
 *   Seq 4 — Dia 14: Dicas de cuidados + indicação com benefício
 *   Seq 5 — Dia 30: Conteúdo da marca + convite grupo VIP
 *   Seq 6 — Dia 60: Pedido de depoimento/UGC + lembrete revisão
 *   Seq 7 — Dia 90: Re-engagement com novidades do estoque
 *
 * Compliance:
 * - Quiet hours: Never sends between 22h-09h Brazil time (schedules for 09:00 next day)
 * - Opt-out: Every message includes "Digite PARAR para não receber mais"
 * - Cancellation: If customer re-engages, pending follow-ups are cancelled
 */

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { maskPhoneNumber } from '../lib/privacy';
import { isQuietHours, getNextSendTime } from '../config/time-context';
import { env } from '../config/env';

const AI_FOLLOW_UP_NOTICE = '🤖 _Mensagem automática da assistente virtual Inovais._';

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

// Max sequence per type — post_sale has 7 steps for the 100-day journey
const MAX_SEQUENCE_BY_TYPE: Record<FollowUpType, number> = {
  abandoned_cart: 3,
  post_recommendation: 3,
  post_sale: 7,
  referral: 1,
};

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
    // Marco 1 — Dia 0: Parabéns pela compra
    1: ctx =>
      `Parabéns pela compra${ctx.name ? `, ${ctx.name}` : ''}! 🎉 Seu ${ctx.vehicle || 'novo veículo'} é uma ótima escolha!\n\nPróximos passos importantes:\n• Transfira o documento em até 30 dias\n• Contrate o seguro o quanto antes\n• Agende a primeira revisão conforme o manual\n\nQualquer dúvida, estamos aqui pra ajudar!\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
    // Marco 3 — Dia 3: Check de satisfação
    2: ctx =>
      `Oi${ctx.name ? `, ${ctx.name}` : ''}! Já faz uns dias com o ${ctx.vehicle || 'carro novo'}. Como está sendo a experiência? Curtindo? 🚗✨\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
    // Marco 4 — Dia 7: NPS
    3: ctx =>
      `${ctx.name ? `${ctx.name}, q` : 'Q'}ueria saber: de 1 a 5, como foi sua experiência de compra com a gente? Seu feedback é muito importante!\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
    // Marco 5 — Dia 14: Dicas + indicação com benefício
    4: ctx =>
      `${ctx.name ? `${ctx.name}, d` : 'D'}icas pra cuidar bem do seu ${ctx.vehicle || 'carro'}:\n• Verifique óleo e água a cada 15 dias\n• Calibre os pneus semanalmente\n• Lave o motor a cada 6 meses\n\nE se tiver algum amigo procurando carro, indique a gente! Quem indica ganha condições especiais na próxima revisão. Peça seu código de indicação!\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
    // Marco 4 — Dia 30: Conteúdo da marca + grupo VIP
    5: ctx =>
      `${ctx.name ? `${ctx.name}, v` : 'V'}ocê sabia? Nós trabalhamos pra oferecer a melhor experiência em veículos seminovos — com procedência verificada e garantia de qualidade.\n\nQueremos te convidar pro nosso grupo exclusivo de clientes VIP, onde você recebe novidades e ofertas em primeira mão! Quer participar? É só responder "QUERO".\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
    // Marco 6 — Dia 60: Depoimento/UGC + lembrete revisão
    6: ctx =>
      `Oi${ctx.name ? `, ${ctx.name}` : ''}! Já são 2 meses com o ${ctx.vehicle || 'carro'}! 🎉\n\nQue tal tirar uma foto com ele e compartilhar com a gente? Adoramos ver nossos clientes felizes!\n\nAh, e não esqueça de verificar se já é hora da primeira revisão. Cuidar do carro valoriza seu investimento!\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
    // Marco 6 — Dia 90: Re-engagement com novidades
    7: ctx =>
      `Oi${ctx.name ? `, ${ctx.name}` : ''}! Temos novidades no estoque que combinam com seu perfil. Quer dar uma olhada? 🚗\n\nSe conhecer alguém procurando carro, lembre que temos condições especiais pra indicações!\n\n${AI_FOLLOW_UP_NOTICE}\n${OPT_OUT_HINT}`,
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
  // 100-day journey: day 0, 3, 7, 14, 30, 60, 90
  post_sale: [0, 4320, 10080, 20160, 43200, 86400, 129600],
  referral: [129600], // 90 days
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
    const maxSequence = MAX_SEQUENCE_BY_TYPE[options.type] ?? 3;
    if (sequence > maxSequence) {
      logger.debug(
        { phoneNumber: maskPhoneNumber(options.phoneNumber), sequence, maxSequence },
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
      const maxSeq = MAX_SEQUENCE_BY_TYPE[followUp.type as FollowUpType] ?? 3;
      if (scheduleNext && followUp.sequence < maxSeq) {
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
