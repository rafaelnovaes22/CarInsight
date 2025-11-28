/**
 * Onboarding Handler
 * 
 * Manages initial greeting, name collection, and context understanding
 * for new conversations in conversational mode.
 */

import { logger } from '../lib/logger';
import { chatCompletion } from '../lib/llm-router';
import { ConversationState, CustomerProfile } from '../types/state.types';

export interface OnboardingStep {
  step: 'greeting' | 'name_collection' | 'context_discovery' | 'complete';
  needsName: boolean;
  needsContext: boolean;
  isComplete: boolean;
}

export class OnboardingHandler {

  /**
   * Check if conversation needs onboarding
   */
  needsOnboarding(state: ConversationState): boolean {
    const messageCount = state.messages.filter(m => m.role === 'user').length;
    const hasName = !!(state.profile && state.profile.customerName);
    const hasContext = !!(state.profile && state.profile.usoPrincipal);

    // First message always needs greeting
    if (messageCount === 0) return true;

    // If no name, still in onboarding
    if (!hasName && messageCount < 3) return true;

    // If has name but no context yet, continue onboarding
    if (hasName && !hasContext && messageCount < 4) return true;

    // Onboarding complete
    return false;
  }

  /**
   * Determine current onboarding step
   */
  getCurrentStep(state: ConversationState): OnboardingStep {
    const messageCount = state.messages.filter(m => m.role === 'user').length;
    const hasName = !!(state.profile && state.profile.customerName);
    const hasContext = !!(state.profile && (state.profile.usoPrincipal || state.profile.orcamento));

    if (messageCount === 0) {
      return {
        step: 'greeting',
        needsName: true,
        needsContext: true,
        isComplete: false
      };
    }

    if (!hasName) {
      return {
        step: 'name_collection',
        needsName: true,
        needsContext: true,
        isComplete: false
      };
    }

    if (!hasContext) {
      return {
        step: 'context_discovery',
        needsName: false,
        needsContext: true,
        isComplete: false
      };
    }

    return {
      step: 'complete',
      needsName: false,
      needsContext: false,
      isComplete: true
    };
  }

  /**
   * Handle onboarding message
   */
  async handleOnboarding(
    message: string,
    state: ConversationState
  ): Promise<{ response: string; updatedProfile: Partial<CustomerProfile> }> {
    const step = this.getCurrentStep(state);

    logger.debug({
      conversationId: state.conversationId,
      step: step.step,
      messageCount: state.messages.length
    }, 'Onboarding: processing step');

    switch (step.step) {
      case 'greeting':
        return this.handleGreeting(message);

      case 'name_collection':
        return this.handleNameCollection(message, state);

      case 'context_discovery':
        return this.handleContextDiscovery(message, state);

      default:
        return { response: '', updatedProfile: {} };
    }
  }

  /**
   * Handle initial greeting
   */
  private async handleGreeting(message: string): Promise<{
    response: string;
    updatedProfile: Partial<CustomerProfile>;
  }> {
    // Check if user already provided their name in first message
    const extractedName = await this.extractName(message);

    if (extractedName) {
      // User said: "Oi, meu nome é João" or "Olá, sou a Maria"
      const response = `Olá, ${extractedName}! 😊 Prazer em conhecê-lo.

Me conta: o que você está procurando?`;

      return {
        response,
        updatedProfile: { customerName: extractedName }
      };
    }

    // Standard greeting (no name provided)
    const response = `Olá! 😊 Bem-vindo à Robust Car!

Sou especialista em veículos usados e vou te ajudar a encontrar o carro ideal.

Como posso te chamar?`;

    return {
      response,
      updatedProfile: {}
    };
  }

  /**
   * Handle name collection
   */
  private async handleNameCollection(
    message: string,
    state: ConversationState
  ): Promise<{ response: string; updatedProfile: Partial<CustomerProfile> }> {
    const extractedName = await this.extractName(message);

    if (!extractedName) {
      // Couldn't extract name, ask again politely
      return {
        response: 'Desculpe, não entendi seu nome. Pode me dizer de novo? 😊',
        updatedProfile: {}
      };
    }

    const response = `Prazer, ${extractedName}! 🤝

Me conta: o que você está procurando?`;

    return {
      response,
      updatedProfile: { customerName: extractedName }
    };
  }

  /**
   * Handle context discovery (uso principal)
   */
  private async handleContextDiscovery(
    message: string,
    state: ConversationState
  ): Promise<{ response: string; updatedProfile: Partial<CustomerProfile> }> {
    // Extract context using LLM
    const context = await this.extractContext(message);

    const customerName = state.profile.customerName || 'amigo';

    let response = '';

    if (context.usoPrincipal === 'uber' || context.usoPrincipal === 'aplicativo') {
      response = `Legal! Para Uber/99, temos vários modelos aptos. Qual categoria você quer e qual seu orçamento?`;

    } else if (context.usoPrincipal === 'familia') {
      response = `Ótimo! Para família temos SUVs e Sedans espaçosos. Me conta mais: quantas pessoas e qual seu orçamento?`;

    } else if (context.usoPrincipal === 'trabalho') {
      response = `Entendi! Para trabalho temos opções econômicas. Qual seu orçamento aproximado?`;

    } else if (context.usoPrincipal === 'viagem') {
      response = `Perfeito! Para viagens temos SUVs e Sedans confortáveis. Qual seu orçamento?`;

    } else {
      // Generic response - let VehicleExpert handle it
      response = `Entendi! Me conta mais sobre o que você busca e qual seu orçamento aproximado?`;
    }

    return {
      response,
      updatedProfile: {
        usoPrincipal: context.usoPrincipal,
        orcamento: context.orcamento
      }
    };
  }

  /**
   * Extract name from message using LLM
   */
  private async extractName(message: string): Promise<string | null> {
    try {
      const prompt = `Extraia APENAS o nome da pessoa desta mensagem. Se não houver nome, retorne "NULL".

Mensagem: "${message}"

Exemplos:
- "Oi, meu nome é João" → João
- "Olá, sou Maria" → Maria
- "Pode me chamar de Carlos" → Carlos
- "José Silva aqui" → José
- "Oi" → NULL
- "Quero comprar um carro" → NULL

IMPORTANTE: Retorne APENAS o primeiro nome, sem sobrenome. Se não houver nome, retorne exatamente "NULL".

Nome:`;

      const response = await chatCompletion([
        { role: 'user', content: prompt }
      ], {
        temperature: 0,
        maxTokens: 20
      });

      const extracted = response.trim();

      if (extracted === 'NULL' || extracted.length === 0 || extracted.length > 30) {
        return null;
      }

      // Capitalize first letter
      return extracted.charAt(0).toUpperCase() + extracted.slice(1).toLowerCase();

    } catch (error) {
      logger.error({ error }, 'Error extracting name');
      return null;
    }
  }

  /**
   * Extract context (uso principal) from message
   */
  private async extractContext(message: string): Promise<{
    usoPrincipal: string | null;
    orcamento: number | null;
  }> {
    try {
      const prompt = `Identifique o CONTEXTO DE USO e ORÇAMENTO desta mensagem sobre compra de carro.

Mensagem: "${message}"

CONTEXTOS POSSÍVEIS:
- uber/aplicativo: Para trabalhar com Uber, 99, etc
- familia: Para uso familiar, esposa, filhos
- trabalho: Para ir ao trabalho, uso diário na cidade
- viagem: Para viagens, passeios
- outro: Outros usos

ORÇAMENTO:
- Extraia o valor aproximado em reais (apenas número)
- Se não mencionar, retorne null

Responda em JSON:
{
  "usoPrincipal": "uber|familia|trabalho|viagem|outro|null",
  "orcamento": 50000 ou null
}

Exemplos:
"Quero um carro para Uber" → {"usoPrincipal": "uber", "orcamento": null}
"Preciso de um carro familiar até 60 mil" → {"usoPrincipal": "familia", "orcamento": 60000}
"Carro para trabalho, uns 40k" → {"usoPrincipal": "trabalho", "orcamento": 40000}

JSON:`;

      const response = await chatCompletion([
        { role: 'user', content: prompt }
      ], {
        temperature: 0,
        maxTokens: 100
      });

      const json = JSON.parse(response);

      return {
        usoPrincipal: json.usoPrincipal === 'null' ? null : json.usoPrincipal,
        orcamento: json.orcamento
      };

    } catch (error) {
      logger.error({ error }, 'Error extracting context');
      return { usoPrincipal: null, orcamento: null };
    }
  }
}

// Singleton export
export const onboardingHandler = new OnboardingHandler();
