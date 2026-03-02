/**
 * Special Cases Step
 *
 * Handles Uber Black questions, Uber/99 eligibility questions,
 * and name correction ("não escolhi" / "só uma dúvida").
 *
 * Extracted from vehicle-expert.agent.ts lines 492-543.
 */

import { PipelineStep, PipelineContext } from '../chat-pipeline';
import { handleUberBlackQuestion, handleUberEligibilityQuestion } from '../../processors';
import { CustomerProfile } from '../../../../types/state.types';

function getAppCategoryName(
  profile: Partial<CustomerProfile>,
  category: 'x' | 'black' | 'comfort'
): string {
  const is99 = profile.appMencionado === '99';
  switch (category) {
    case 'x':
      return is99 ? '99Pop' : 'Uber X';
    case 'black':
      return is99 ? '99Black' : 'Uber Black';
    case 'comfort':
      return is99 ? '99TOP' : 'Uber Comfort';
    default:
      return is99 ? '99' : 'Uber';
  }
}

export const specialCasesStep: PipelineStep = {
  name: 'special-cases',
  execute: async (ctx: PipelineContext) => {
    const { userMessage, context, updatedProfile, extracted, startTime } = ctx;

    // 2.0. Check for Uber Black question (delegated to handler)
    const uberResult = await handleUberBlackQuestion(
      userMessage,
      context,
      updatedProfile,
      extracted,
      startTime,
      getAppCategoryName
    );
    if (uberResult.handled && uberResult.response) {
      return uberResult.response;
    }

    // 2.0.1. Check for Uber/99 eligibility question ("serve pra Uber?") WITHOUT assuming choice
    const uberEligibilityResult = await handleUberEligibilityQuestion(
      userMessage,
      context,
      updatedProfile,
      extracted,
      startTime
    );
    if (uberEligibilityResult.handled && uberEligibilityResult.response) {
      return uberEligibilityResult.response;
    }

    // 2.0.2. If user corrects us ("não escolhi"), acknowledge and reset the assumption
    // This avoids keeping the conversation stuck in negotiation when it was only a doubt.
    const correctionLower = userMessage.toLowerCase();
    const isNotChosenCorrection =
      /\b(não|nao)\s+escolhi\b/.test(correctionLower) ||
      /\bs[óo]\s+uma\s+d[úu]vida\b/.test(correctionLower) ||
      /\bquis\s+t(i|í)rar\s+uma\s+d[úu]vida\b/.test(correctionLower);

    if (isNotChosenCorrection) {
      return {
        response:
          `Sem problemas — entendi que você *não escolheu* um carro ainda, era só uma dúvida.\n\n` +
          `Qual é a dúvida exatamente? Se for sobre *Uber/99*, me diga sua *cidade/UF* e a *categoria* (X/Comfort/Black) que eu te ajudo a confirmar.`,
        extractedPreferences: {
          ...extracted.extracted,
          _showedRecommendation: false,
        },
        needsMoreInfo: [],
        canRecommend: false,
        nextMode: context.mode,
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0.95,
          llmUsed: 'rule-based',
        },
      };
    }

    return null;
  },
};
