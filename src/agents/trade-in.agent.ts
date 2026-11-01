import { ConversationContext, ConversationResponse } from '../types/conversation.types';
import { extractTradeInInfo, inferBrandFromModel } from './vehicle-expert/extractors';
import { capitalize } from './vehicle-expert/constants';

export class TradeInAgent {
  /**
   * Process trade-in intents
   */
  public async processTradeIn(
    userMessage: string,
    context: ConversationContext
  ): Promise<ConversationResponse | null> {
    const { profile } = context;
    const lastShownVehicles = profile._lastShownVehicles || [];

    // Case 1: Analyzing trade-in details (user providing specific car info)
    // usually happens when we Asked for trade-in details
    const tradeInInfo = extractTradeInInfo(userMessage);

    if (tradeInInfo.model || tradeInInfo.year) {
      const selectedVehicle = lastShownVehicles[0];
      const selectedVehicleName = selectedVehicle
        ? `${selectedVehicle.brand} ${selectedVehicle.model} ${selectedVehicle.year}`
        : 'o carro novo';

      const tradeInBrand = tradeInInfo.brand || inferBrandFromModel(tradeInInfo.model || '');
      const tradeInText =
        `${tradeInBrand ? capitalize(tradeInBrand) + ' ' : ''}${capitalize(tradeInInfo.model || '')} ${tradeInInfo.year || ''}`.trim();

      // Check for financing intent in the same message
      const wantsFinancing = /financ|parcel|entrada/i.test(userMessage);

      let responseText = `Perfeito! O ${tradeInText} pode entrar na negociação do ${selectedVehicleName}! 🚗🔄\n\n⚠️ O valor do seu carro na troca depende de uma avaliação presencial pela nossa equipe.\n\nVou conectar você com um consultor para:\n• Avaliar o ${tradeInText}`;

      if (wantsFinancing) {
        responseText += `\n• Simular o financiamento considerando a troca`;
      }

      responseText += `\n• Apresentar a proposta final\n• Tirar todas as suas dúvidas\n\n_Digite "vendedor" para falar com nossa equipe!_`;

      return {
        response: responseText,
        extractedPreferences: {
          hasTradeIn: true,
          tradeInBrand: tradeInBrand,
          tradeInModel: tradeInInfo.model?.toLowerCase(),
          tradeInYear: tradeInInfo.year,
          tradeInKm: tradeInInfo.km,
          wantsFinancing: wantsFinancing || context.profile.wantsFinancing,
          _awaitingTradeInDetails: false,
        },
        needsMoreInfo: [],
        canRecommend: false,
        nextMode: 'negotiation',
      };
    }

    // Case 2: User expressed intent to trade-in but didn't give details yet
    // "Quero dar meu carro na troca"
    if (/troca|meu carro|tenho um|minha/i.test(userMessage)) {
      const selectedVehicle = lastShownVehicles[0];
      const modelName = selectedVehicle
        ? `${selectedVehicle.brand} ${selectedVehicle.model} ${selectedVehicle.year}`
        : 'carro novo';

      return {
        response: `Show! Ter um carro na troca ajuda muito na negociação do ${modelName}! 🚗🔄\n\nMe conta sobre o seu veículo:\n\n• *Qual carro é?* (ex: Fiat Argo 2019, VW Polo 2020)\n• *Km aproximado*\n\n_Exemplo: "Gol 2018 com 80 mil km"_`,
        extractedPreferences: {
          hasTradeIn: true,
          _awaitingTradeInDetails: true,
        },
        needsMoreInfo: ['tradeInModel', 'tradeInYear'],
        canRecommend: false,
        nextMode: 'negotiation', // Stays in negotiation/tradein loop
      };
    }

    return null; // Not handled
  }
}

export const tradeInAgent = new TradeInAgent();
