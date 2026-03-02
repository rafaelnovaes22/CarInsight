import { PipelineStep, PipelineContext } from '../chat-pipeline';
import { logger } from '../../../../lib/logger';

export const guardrailsStep: PipelineStep = {
  name: 'guardrails',
  execute: async (ctx: PipelineContext) => {
    const { userMessage, context, updatedProfile, startTime } = ctx;

    // 2.0.-2. GUARDRAIL: Handle suspicious budget confirmation flow
    if (context.profile?._awaitingBudgetConfirmation && context.profile._suspectedBudget) {
      const suspected = context.profile._suspectedBudget;
      const msgLower = userMessage.toLowerCase().trim();
      const isConfirmation =
        /^(sim|isso|isso mesmo|é isso|exato|ss|s|yes|correto|confirmo|isso ai|issoai)$/i.test(
          msgLower
        );
      const hasNewNumber = /\d/.test(msgLower);

      if (isConfirmation) {
        // User confirmed: "100" means "100 mil"
        updatedProfile.budget = suspected * 1000;
        updatedProfile._awaitingBudgetConfirmation = undefined;
        updatedProfile._suspectedBudget = undefined;
        logger.info({ suspected, confirmed: suspected * 1000 }, 'Budget confirmed by user (x1000)');

        // Guard: se acabou de confirmar budget mas falta usage, perguntar imediatamente
        if (!updatedProfile.usage && !updatedProfile.usoPrincipal) {
          const isMoto =
            updatedProfile.bodyType === 'moto' || updatedProfile.priorities?.includes('moto');
          const vehicleEmoji = isMoto ? '🏍️' : '🚗';
          const nextQuestion = `Ótimo, anotei! ${vehicleEmoji} Qual vai ser o uso principal? Cidade, viagens, trabalho...?`;

          return {
            response: nextQuestion,
            extractedPreferences: updatedProfile,
            needsMoreInfo: ['usage'],
            canRecommend: false,
            nextMode: context.mode,
            metadata: {
              processingTime: Date.now() - startTime,
              confidence: 0.9,
              llmUsed: 'rule-based',
            },
          };
        }
        // Continue normal flow with corrected budget
      } else if (hasNewNumber) {
        // User sent a different number — let extraction handle it normally
        updatedProfile._awaitingBudgetConfirmation = undefined;
        updatedProfile._suspectedBudget = undefined;
        // Continue — the new extraction may set a proper budget or trigger another confirmation
      } else {
        // User said something else (like "não") — clear and re-ask
        updatedProfile._awaitingBudgetConfirmation = undefined;
        updatedProfile._suspectedBudget = undefined;
        return {
          response: 'Sem problemas! Qual seria o valor que você tem em mente pro carro? 😊',
          extractedPreferences: updatedProfile,
          needsMoreInfo: ['budget'],
          canRecommend: false,
          nextMode: context.mode,
          metadata: {
            processingTime: Date.now() - startTime,
            confidence: 0.9,
            llmUsed: 'rule-based',
          },
        };
      }
    }

    // 2.0.-1.5 GUARDRAIL: Trigger budget confirmation if new extraction flagged suspicious value
    if (
      updatedProfile._awaitingBudgetConfirmation &&
      updatedProfile._suspectedBudget &&
      !context.profile?._awaitingBudgetConfirmation
    ) {
      const suspected = updatedProfile._suspectedBudget;
      const formatted = (suspected * 1000).toLocaleString('pt-BR');
      return {
        response: `Só pra confirmar, você quis dizer R$ ${formatted}? 😊`,
        extractedPreferences: updatedProfile,
        needsMoreInfo: ['budget'],
        canRecommend: false,
        nextMode: context.mode,
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0.9,
          llmUsed: 'rule-based',
        },
      };
    }

    // 2.0.-1.3 GUARDRAIL: Handle suspicious down payment confirmation flow
    if (
      context.profile?._awaitingDownPaymentConfirmation &&
      context.profile._suspectedDownPayment
    ) {
      const msgLower = userMessage.toLowerCase().trim();
      const hasNewNumber = /\d/.test(msgLower);

      if (hasNewNumber) {
        // User sent a new value — let extraction handle it
        updatedProfile._awaitingDownPaymentConfirmation = undefined;
        updatedProfile._suspectedDownPayment = undefined;
      } else {
        // User declined — clear and continue without down payment
        updatedProfile._awaitingDownPaymentConfirmation = undefined;
        updatedProfile._suspectedDownPayment = undefined;
        updatedProfile.financingDownPayment = 0;
      }
    }

    // 2.0.-1.2 GUARDRAIL: Trigger down payment confirmation if new extraction flagged suspicious value
    if (
      updatedProfile._awaitingDownPaymentConfirmation &&
      updatedProfile._suspectedDownPayment &&
      !context.profile?._awaitingDownPaymentConfirmation
    ) {
      const selectedVehicle = updatedProfile._lastShownVehicles?.[0];
      const suggestedEntry = selectedVehicle ? Math.round(selectedVehicle.price * 0.2) : 10000;
      const suggestedFormatted = suggestedEntry.toLocaleString('pt-BR');
      return {
        response: `Esse valor de entrada está abaixo do mínimo praticado pelas financeiras (geralmente a partir de 20% do veículo). Gostaria de ajustar? Um bom ponto de partida seria R$ ${suggestedFormatted}. 😊`,
        extractedPreferences: updatedProfile,
        needsMoreInfo: ['financingDownPayment'],
        canRecommend: false,
        nextMode: context.mode,
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0.9,
          llmUsed: 'rule-based',
        },
      };
    }

    return null;
  },
};
