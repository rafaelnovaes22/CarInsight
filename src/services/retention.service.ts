/**
 * Retention Service
 *
 * Handles post-sale 100-day customer journey, NPS collection, and referral program.
 * All messages include opt-out instructions for LGPD compliance.
 *
 * 100-day post-sale journey (7 touchpoints):
 * 1. Day 0:  Congratulations + next steps (docs, insurance, first service)
 * 2. Day 3:  Satisfaction check ("How's the new car?")
 * 3. Day 7:  NPS score (1-5)
 * 4. Day 14: Care tips + referral with benefit
 * 5. Day 30: Brand content + VIP group invite
 * 6. Day 60: Testimonial/UGC request + service reminder
 * 7. Day 90: Re-engagement with new inventory
 */

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { maskPhoneNumber } from '../lib/privacy';
import { env } from '../config/env';
import { followUpService } from './follow-up.service';
import { randomUUID } from 'crypto';

export class RetentionService {
  /**
   * Trigger post-sale retention sequence after a vehicle is sold.
   */
  async startPostSaleSequence(
    leadId: string,
    customerName: string,
    vehicleName: string,
    phoneNumber: string
  ): Promise<void> {
    if (!env.ENABLE_RETENTION) return;

    try {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { conversationId: true, followUpOptIn: true },
      });

      if (!lead || !lead.followUpOptIn) {
        logger.info(
          { leadId, phoneNumber: maskPhoneNumber(phoneNumber) },
          'Retention: skipping (opt-out or lead not found)'
        );
        return;
      }

      // Schedule first post-sale follow-up (immediate — day 0 congratulations)
      await followUpService.scheduleFollowUp({
        conversationId: lead.conversationId,
        phoneNumber,
        type: 'post_sale',
        customerName,
        vehicleName,
        sequence: 1,
      });

      logger.info(
        { leadId, phoneNumber: maskPhoneNumber(phoneNumber) },
        'Retention: 100-day post-sale journey started'
      );
    } catch (error) {
      logger.error(
        { error, leadId, phoneNumber: maskPhoneNumber(phoneNumber) },
        'Error starting post-sale sequence'
      );
    }
  }

  /**
   * Record NPS satisfaction score from customer.
   */
  async recordSatisfaction(phoneNumber: string, score: number): Promise<string> {
    if (score < 1 || score > 5) {
      return 'Por favor, dê uma nota de 1 a 5.';
    }

    try {
      const lead = await prisma.lead.findFirst({
        where: { phone: phoneNumber },
        orderBy: { createdAt: 'desc' },
      });

      if (!lead) {
        return 'Não encontrei seu cadastro. Pode falar com nossa equipe!';
      }

      await prisma.lead.update({
        where: { id: lead.id },
        data: { satisfactionScore: score },
      });

      logger.info(
        { phoneNumber: maskPhoneNumber(phoneNumber), score },
        'Retention: satisfaction score recorded'
      );

      if (score >= 4) {
        return `Que bom saber que sua experiência foi boa! 😊 Obrigado pela nota ${score}!\n\nSe tiver algum amigo procurando carro, pode indicar a gente — adoramos indicações!`;
      }

      if (score >= 3) {
        return `Obrigado pela nota ${score}! Alguma coisa que poderíamos ter feito melhor? Seu feedback nos ajuda muito.`;
      }

      return `Obrigado pela sinceridade. Sentimos que a experiência não foi ideal. O que podemos melhorar? Queremos fazer melhor!`;
    } catch (error) {
      logger.error(
        { error, phoneNumber: maskPhoneNumber(phoneNumber) },
        'Error recording satisfaction'
      );
      return 'Houve um erro ao registrar sua avaliação. Tente novamente!';
    }
  }

  /**
   * Generate a unique referral code for a customer.
   */
  async generateReferralCode(phoneNumber: string): Promise<string | null> {
    if (!env.ENABLE_RETENTION) return null;

    try {
      const lead = await prisma.lead.findFirst({
        where: { phone: phoneNumber },
        orderBy: { createdAt: 'desc' },
      });

      if (!lead) return null;

      // If already has a code, return it
      if (lead.referralCode) return lead.referralCode;

      // Generate unique code: first 3 chars of name + random 4 chars
      const namePrefix = (lead.name || 'CLI')
        .replace(/[^a-zA-Z]/g, '')
        .substring(0, 3)
        .toUpperCase();
      const randomSuffix = randomUUID().substring(0, 4).toUpperCase();
      const code = `${namePrefix}${randomSuffix}`;

      await prisma.lead.update({
        where: { id: lead.id },
        data: { referralCode: code },
      });

      logger.info(
        { phoneNumber: maskPhoneNumber(phoneNumber), code },
        'Retention: referral code generated'
      );

      return code;
    } catch (error) {
      logger.error(
        { error, phoneNumber: maskPhoneNumber(phoneNumber) },
        'Error generating referral code'
      );
      return null;
    }
  }

  /**
   * Detect and process a referral code in a greeting message.
   * Returns the referrer's name if found.
   */
  async detectReferral(message: string): Promise<{ referrerName: string; code: string } | null> {
    if (!env.ENABLE_RETENTION) return null;

    // Match patterns like "indicação ABCDEF", "codigo ABCDEF", "vim pela indicação do ABCDEF"
    const patterns = [
      /indica[çc][aã]o\s+([A-Z0-9]{7})/i,
      /c[oó]digo\s+([A-Z0-9]{7})/i,
      /\b([A-Z]{3}[A-Z0-9]{4})\b/,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const code = match[1].toUpperCase();
        const referrer = await prisma.lead.findFirst({
          where: { referralCode: code },
          select: { name: true },
        });

        if (referrer) {
          return { referrerName: referrer.name, code };
        }
      }
    }

    return null;
  }

  /**
   * Record that a customer was referred by someone.
   */
  async recordReferral(phoneNumber: string, referralCode: string): Promise<void> {
    try {
      const lead = await prisma.lead.findFirst({
        where: { phone: phoneNumber },
        orderBy: { createdAt: 'desc' },
      });

      if (lead) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { referredBy: referralCode },
        });
      }

      logger.info(
        { phoneNumber: maskPhoneNumber(phoneNumber), referralCode },
        'Retention: referral recorded'
      );
    } catch (error) {
      logger.error(
        { error, phoneNumber: maskPhoneNumber(phoneNumber) },
        'Error recording referral'
      );
    }
  }

  /**
   * Schedule re-engagement messages for customers who bought 90+ days ago.
   */
  async scheduleReEngagement(): Promise<number> {
    if (!env.ENABLE_RETENTION) return 0;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const eligibleLeads = await prisma.lead.findMany({
        where: {
          soldAt: { lte: cutoffDate },
          followUpOptIn: true,
          status: 'sold',
        },
        select: {
          id: true,
          phone: true,
          name: true,
          conversationId: true,
        },
        take: 50,
      });

      let scheduled = 0;
      for (const lead of eligibleLeads) {
        await followUpService.scheduleFollowUp({
          conversationId: lead.conversationId,
          phoneNumber: lead.phone,
          type: 'referral',
          customerName: lead.name,
          sequence: 1,
        });
        scheduled++;
      }

      logger.info({ scheduled }, 'Retention: re-engagement messages scheduled');
      return scheduled;
    } catch (error) {
      logger.error({ error }, 'Error scheduling re-engagement');
      return 0;
    }
  }
}

export const retentionService = new RetentionService();
