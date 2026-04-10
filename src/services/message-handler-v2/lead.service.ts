import { logger } from '../../lib/logger';
import { maskPhoneNumber } from '../../lib/privacy';
import { prisma } from '../../lib/prisma';
import type { ConversationState } from '../../types/state.types';

type LeadVehicle = NonNullable<
  NonNullable<ConversationState['profile']>['_lastShownVehicles']
>[number];

function capitalize(text: string): string {
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatVehicleSummary(vehicle: LeadVehicle): string {
  const priceFormatted = vehicle.price?.toLocaleString('pt-BR') || 'Preco n/d';
  return `${vehicle.brand} ${vehicle.model} ${vehicle.year} (R$ ${priceFormatted})`;
}

function mapRecommendationToVehicle(
  recommendation: ConversationState['recommendations'][number]
): LeadVehicle | null {
  const vehicle = recommendation?.vehicle;
  if (!vehicle) return null;

  const brand = vehicle.marca || vehicle.brand || '';
  const model = vehicle.modelo || vehicle.model || '';
  const year = Number(vehicle.ano || vehicle.year || 0);
  const price = Number(vehicle.preco ?? vehicle.price ?? 0);

  if (!brand || !model || !year) {
    return null;
  }

  return {
    vehicleId: recommendation.vehicleId,
    brand,
    model,
    year,
    price,
    bodyType: vehicle.carroceria || vehicle.bodyType,
  };
}

function dedupeVehicles(vehicles: Array<LeadVehicle | null | undefined>): LeadVehicle[] {
  const seen = new Set<string>();
  const deduped: LeadVehicle[] = [];

  for (const vehicle of vehicles) {
    if (!vehicle) continue;
    if (seen.has(vehicle.vehicleId)) continue;
    seen.add(vehicle.vehicleId);
    deduped.push(vehicle);
  }

  return deduped;
}

function resolveSelectedVehicle(state: ConversationState): LeadVehicle | null {
  const profile = state.profile;
  if (!profile) return null;

  if (profile._selectedVehicleSnapshot) {
    return profile._selectedVehicleSnapshot;
  }

  if (profile._selectedVehicleId) {
    const selectedFromShown = profile._lastShownVehicles?.find(
      vehicle => vehicle.vehicleId === profile._selectedVehicleId
    );
    if (selectedFromShown) {
      return selectedFromShown;
    }

    const selectedFromRecommendations = state.recommendations
      .map(mapRecommendationToVehicle)
      .find(vehicle => vehicle?.vehicleId === profile._selectedVehicleId);

    if (selectedFromRecommendations) {
      return selectedFromRecommendations;
    }
  }

  if ((profile._lastShownVehicles?.length || 0) === 1) {
    return profile._lastShownVehicles?.[0] || null;
  }

  return null;
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

        const selectedVehicle = resolveSelectedVehicle(state);
        const latestOptions = dedupeVehicles([
          ...(profile?._lastShownVehicles || []),
          ...state.recommendations.map(mapRecommendationToVehicle),
        ]).slice(0, 5);

        if (selectedVehicle) {
          details.push(
            `\uD83D\uDE97 *Interesse principal:* ${formatVehicleSummary(selectedVehicle)}`
          );
        } else if (profile?._searchedItem) {
          details.push(`\uD83D\uDD0D *Busca:* ${profile._searchedItem}`);
        }

        const shouldIncludeOptionList =
          latestOptions.length > 1 ||
          (!selectedVehicle && latestOptions.length > 0) ||
          (selectedVehicle &&
            latestOptions.length > 0 &&
            !latestOptions.some(vehicle => vehicle.vehicleId === selectedVehicle.vehicleId));

        if (shouldIncludeOptionList) {
          details.push(
            `\uD83D\uDCCB *Ultimas opcoes apresentadas:*\n${latestOptions
              .map((vehicle, index) => `${index + 1}. ${formatVehicleSummary(vehicle)}`)
              .join('\n')}`
          );
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
