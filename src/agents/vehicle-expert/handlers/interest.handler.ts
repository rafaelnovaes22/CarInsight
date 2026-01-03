/**
 * Interest Handler
 *
 * Handles the case when user expresses interest/likes a shown vehicle.
 * Asks about payment method (cash, financing, trade-in).
 */

import { logger } from '../../../lib/logger';
import { PostRecommendationContext, HandlerResult } from './types';

/**
 * Handle interest intent
 *
 * When user says something like "gostei", "quero esse", "esse mesmo", "curti o primeiro"
 */
export const handleInterest = (ctx: PostRecommendationContext): HandlerResult => {
  const { userMessage, lastShownVehicles, extracted, startTime } = ctx;

  const firstVehicle = lastShownVehicles[0];
  const vehicleName = `${firstVehicle.brand} ${firstVehicle.model} ${firstVehicle.year}`;
  const vehiclePrice = firstVehicle.price.toLocaleString('pt-BR');

  logger.info({ vehicleName, userMessage }, 'User expressed interest in shown vehicle');

  // Try to detect which vehicle they picked (primeiro, segundo, etc OR by model name)
  const normalized = userMessage.toLowerCase();
  let selectedIndex = 0;

  // First check if user mentioned a specific position
  if (/primeiro|1|um\b/.test(normalized)) selectedIndex = 0;
  else if (/segundo|2|dois/.test(normalized)) selectedIndex = 1;
  else if (/terceiro|3|tr[eê]s/.test(normalized)) selectedIndex = 2;
  else if (/quarto|4|quatro/.test(normalized)) selectedIndex = 3;
  else if (/quinto|5|cinco/.test(normalized)) selectedIndex = 4;
  else {
    // Check if user mentioned a model name from the shown vehicles
    for (let i = 0; i < lastShownVehicles.length; i++) {
      const vehicle = lastShownVehicles[i];
      const modelLower = vehicle.model.toLowerCase();
      const brandLower = vehicle.brand.toLowerCase();

      if (normalized.includes(modelLower) || normalized.includes(brandLower)) {
        selectedIndex = i;
        logger.info({ model: vehicle.model, index: i }, 'User selected vehicle by model name');
        break;
      }
    }
  }

  const selectedVehicle = lastShownVehicles[selectedIndex] || firstVehicle;
  const selectedName = `${selectedVehicle.brand} ${selectedVehicle.model} ${selectedVehicle.year}`;
  const selectedPrice = selectedVehicle.price.toLocaleString('pt-BR');

  // Check if user previously mentioned financing needs
  const wantsFinancing = ctx.updatedProfile?.wantsFinancing || extracted.extracted.wantsFinancing;

  let interestResponse = '';

  if (wantsFinancing) {
    interestResponse = `Ótima escolha! 🎉 O ${selectedName} é um excelente carro!
    
💰 Valor: R$ ${selectedPrice}

Como você mencionou o interesse em financiar 🏦, me conta:
• Tem algum valor de *entrada*?
• Ou tem algum *carro na troca*?`;
  } else {
    interestResponse = `Ótima escolha! 🎉 O ${selectedName} é um excelente carro!

💰 Valor: R$ ${selectedPrice}

Me conta como pretende pagar:
• À vista
• Financiamento
• Tem veículo na troca?`;
  }

  return {
    handled: true,
    response: {
      response: interestResponse,
      extractedPreferences: {
        ...extracted.extracted,
        _showedRecommendation: true,
        _lastShownVehicles: [selectedVehicle], // Focus on selected vehicle only
      },
      needsMoreInfo: ['paymentMethod'],
      canRecommend: false,
      nextMode: 'negotiation',
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.95,
        llmUsed: 'rule-based',
      },
    },
  };
};
