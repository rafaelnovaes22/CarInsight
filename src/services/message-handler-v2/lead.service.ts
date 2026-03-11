import { logger } from '../../lib/logger';
import { maskPhoneNumber } from '../../lib/privacy';
import { prisma } from '../../lib/prisma';
import type { ConversationState } from '../../types/state.types';

function capitalize(text: string): string {
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export class MessageHandlerLeadService {
  async createLead(
    conversation: any,
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

      const salesPhone = process.env.SALES_PHONE_NUMBER;

      logger.info(
        {
          salesPhone: maskPhoneNumber(salesPhone),
          customerPhoneNumber: maskPhoneNumber(customerPhoneNumber),
          envValue: process.env.SALES_PHONE_NUMBER ? 'configured' : 'missing',
        },
        'SALES_PHONE_NUMBER debug - sending notification'
      );

      if (!salesPhone) {
        logger.warn('SALES_PHONE_NUMBER not configured - skipping lead notification');
        return;
      }

      try {
        const details: string[] = [];

        if (profile?.customerName) details.push(`\uD83D\uDC64 *Nome:* ${profile.customerName}`);
        if (conversation.phoneNumber)
          details.push(`\uD83D\uDCF1 *Fone:* ${conversation.phoneNumber}`);

        const budget = profile?.budget || answers.budget;
        if (budget) {
          details.push(`\uD83D\uDCB0 *Orcamento:* R$ ${Number(budget).toLocaleString('pt-BR')}`);
        }

        let tradeInText = '';
        if (profile?.hasTradeIn) {
          if (profile.tradeInModel) {
            const brand = profile.tradeInBrand ? capitalize(profile.tradeInBrand) : '';
            const model = capitalize(profile.tradeInModel);
            tradeInText = brand ? `${brand} ${model}` : model;
            if (profile.tradeInYear) tradeInText += ` ${profile.tradeInYear}`;
            if (profile.tradeInKm) {
              tradeInText += ` (${profile.tradeInKm.toLocaleString('pt-BR')} km)`;
            }
          } else {
            tradeInText = 'Sim (veiculo nao especificado)';
          }
          details.push(`\uD83D\uDD04 *Troca:* ${tradeInText}`);
        }

        if (profile?.wantsFinancing || profile?.financingDownPayment) {
          let entry: string;
          if (profile.financingDownPayment) {
            entry = `Entrada R$ ${profile.financingDownPayment.toLocaleString('pt-BR')}`;
          } else if (profile.hasTradeIn && tradeInText) {
            entry = `Entrada: ${tradeInText}`;
          } else {
            entry = 'Entrada a definir';
          }
          details.push(`\uD83C\uDFE6 *Financiamento:* Sim (${entry})`);
        }

        const interest = profile?._lastShownVehicles?.[0];
        if (interest) {
          const priceFormatted = interest.price?.toLocaleString('pt-BR') || 'Preco n/d';
          details.push(
            `\uD83D\uDE97 *Interesse:* ${interest.brand} ${interest.model} ${interest.year} (R$ ${priceFormatted})`
          );
        } else if (profile?._searchedItem) {
          details.push(`\uD83D\uDD0D *Busca:* ${profile._searchedItem}`);
        }

        const customerLink = `https://wa.me/${conversation.phoneNumber.replace(/\D/g, '')}`;
        details.push(`\uD83D\uDCAC *Chat direto:* ${customerLink}`);

        const message =
          '\uD83D\uDEA8 *NOVO LEAD QUENTE!* \uD83D\uDD25\n\n' +
          `${details.join('\n')}\n\n` +
          '\uD83D\uDC49 *Acao:* Entrar em contato IMEDIATAMENTE!';

        const { WhatsAppServiceFactory } = await import('../whatsapp-factory');
        const whatsappService = WhatsAppServiceFactory.getInstance();

        logger.info(
          {
            salesPhone: maskPhoneNumber(salesPhone),
            customerPhone: maskPhoneNumber(customerPhoneNumber),
            messageLength: message.length,
            samePhone: salesPhone === customerPhoneNumber,
          },
          'Sending lead notification to sales phone'
        );
        await whatsappService.sendMessage(salesPhone, message);

        logger.info(
          { salesPhone: maskPhoneNumber(salesPhone) },
          'Sales team notified via WhatsApp'
        );
      } catch (notifyError) {
        logger.error({ error: notifyError }, 'Failed to notify sales team');
      }
    } catch (error) {
      logger.error({ error, conversationId: conversation.id }, 'Error creating lead');
    }
  }
}
