import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { Conversation } from '@prisma/client';
import { ConversationState } from '../types/state.types';
import { WhatsAppMetaService } from './whatsapp-meta.service';

export class LeadService {
  /**
   * Create a lead in the CRM (Release 3.2.1)
   * Also notifies sales team via WhatsApp if configured
   */
  async createLead(
    conversation: Conversation & { customerName?: string | null },
    state: ConversationState,
    customerPhoneNumber: string
  ): Promise<void> {
    try {
      const answers = state.quiz.answers;
      const profile = state.profile;

      const lead = await prisma.lead.create({
        data: {
          conversationId: conversation.id,
          name: conversation.customerName || profile?.customerName || 'Cliente WhatsApp',
          phone: conversation.phoneNumber,
          budget: answers.budget || profile?.budget || null,
          usage: answers.usage || profile?.usage || null,
          people: answers.people || profile?.people || null,
          hasTradeIn: answers.hasTradeIn || profile?.hasTradeIn || false,
          urgency: answers.urgency || profile?.urgency || null,
          status: 'new',
          source: 'whatsapp_bot',
        },
      });

      logger.info({ conversationId: conversation.id, leadId: lead.id }, 'Lead created in database');

      // Notify Sales Team
      await this.notifySalesTeam(conversation, profile, customerPhoneNumber);
    } catch (error) {
      logger.error({ error, conversationId: conversation.id }, 'Error creating lead');
    }
  }

  /**
   * Send notification to sales team via WhatsApp
   */
  private async notifySalesTeam(
    conversation: Conversation & { customerName?: string | null },
    profile: ConversationState['profile'],
    customerPhoneNumber: string
  ): Promise<void> {
    // Notify Sales Team - send to SALES_PHONE_NUMBER if configured
    const salesPhone = process.env.SALES_PHONE_NUMBER;

    logger.info(
      {
        salesPhone,
        customerPhoneNumber,
        envValue: process.env.SALES_PHONE_NUMBER,
      },
      'SALES_PHONE_NUMBER debug - sending notification'
    );

    if (salesPhone) {
      try {
        // Include rich details from profile
        const details: string[] = [];
        // Note: checking conversation.phoneNumber vs customerPhoneNumber redundancy
        // using customerPhoneNumber as passed arg

        if (profile?.customerName) details.push(`👤 *Nome:* ${profile.customerName}`);
        if (customerPhoneNumber) details.push(`📱 *Fone:* ${customerPhoneNumber}`);

        // Trade-in details
        let tradeInText = '';
        if (profile?.hasTradeIn) {
          if (profile.tradeInModel) {
            const brand = profile.tradeInBrand ? this.capitalize(profile.tradeInBrand) : '';
            const model = this.capitalize(profile.tradeInModel);
            tradeInText = brand ? `${brand} ${model}` : model;
            if (profile.tradeInYear) tradeInText += ` ${profile.tradeInYear}`;
            if (profile.tradeInKm)
              tradeInText += ` (${profile.tradeInKm.toLocaleString('pt-BR')} km)`;
          } else {
            tradeInText = 'Sim (veículo não especificado)';
          }
          details.push(`🔄 *Troca:* ${tradeInText}`);
        }

        // Financing details
        if (profile?.wantsFinancing || profile?.financingDownPayment) {
          let entry: string;
          if (profile.financingDownPayment) {
            entry = `Entrada R$ ${profile.financingDownPayment.toLocaleString('pt-BR')}`;
          } else if (profile.hasTradeIn && tradeInText) {
            entry = `Entrada: ${tradeInText}`;
          } else {
            entry = 'Entrada a definir';
          }
          details.push(`🏦 *Financiamento:* Sim (${entry})`);
        }

        // Interest
        const interest = profile?._lastShownVehicles?.[0];
        if (interest) {
          const priceFormatted = interest.price?.toLocaleString('pt-BR') || 'Preço n/d';
          details.push(
            `🚗 *Interesse:* ${interest.brand} ${interest.model} ${interest.year} (R$ ${priceFormatted})`
          );
        } else if (profile?._searchedItem) {
          details.push(`🔍 *Busca:* ${profile._searchedItem}`);
        }

        const message = `🚨 *NOVO LEAD QUENTE!* 🔥\n\n${details.join('\n')}\n\n👉 *Ação:* Entrar em contato IMEDIATAMENTE!`;

        const whatsappService = new WhatsAppMetaService();
        logger.info(
          {
            salesPhone,
            customerPhone: customerPhoneNumber,
            messageLength: message.length,
            samePhone: salesPhone === customerPhoneNumber,
          },
          'Sending lead notification to sales phone'
        );
        await whatsappService.sendMessage(salesPhone, message);

        logger.info({ salesPhone }, 'Sales team notified via WhatsApp');
      } catch (notifyError) {
        logger.error({ error: notifyError }, 'Failed to notify sales team');
      }
    } else {
      logger.warn('SALES_PHONE_NUMBER not configured - skipping lead notification');
    }
  }

  private capitalize(text: string): string {
    return text
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

export const leadService = new LeadService();
