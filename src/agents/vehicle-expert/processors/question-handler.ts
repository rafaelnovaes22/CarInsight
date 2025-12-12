/**
 * Question Handler
 *
 * Handles user questions and generates contextual follow-up questions.
 */

import { chatCompletion } from '../../../lib/llm-router';
import { logger } from '../../../lib/logger';
import { vehicleSearchAdapter } from '../../../services/vehicle-search-adapter.service';
import { CustomerProfile } from '../../../types/state.types';
import { ConversationContext, QuestionGenerationOptions } from '../../../types/conversation.types';
import { SYSTEM_PROMPT } from '../constants';
import { summarizeContext } from '../assessors';

/**
 * Answer user's question using RAG (Retrieval Augmented Generation)
 *
 * @param question - User's question
 * @param context - Conversation context
 * @param profile - Customer profile
 * @returns Answer string
 */
export async function answerQuestion(
  question: string,
  context: ConversationContext,
  profile: Partial<CustomerProfile>
): Promise<string> {
  try {
    // Search relevant vehicles semantically
    const relevantVehicles = await vehicleSearchAdapter.search(question, {
      maxPrice: profile.budget,
      bodyType: profile.bodyType,
      minYear: profile.minYear,
      limit: 3,
    });

    // Build context for LLM
    const vehicleContext =
      relevantVehicles.length > 0
        ? `VEÍCULOS RELEVANTES NO ESTOQUE:\n${relevantVehicles
            .map(
              (v, i) =>
                `${i + 1}. ${v.vehicle.brand} ${v.vehicle.model} ${v.vehicle.year} - R$ ${v.vehicle.price.toLocaleString('pt-BR')}`
            )
            .join('\n')}`
        : 'Nenhum veículo específico encontrado para essa pergunta.';

    const conversationSummary = summarizeContext(context);

    const prompt = `${SYSTEM_PROMPT}

PERGUNTA DO CLIENTE: "${question}"

${vehicleContext}

CONTEXTO DA CONVERSA:
${conversationSummary}

PERFIL DO CLIENTE (até agora):
${JSON.stringify(profile, null, 2)}

Responda a pergunta de forma natural e útil, usando exemplos dos veículos quando apropriado.
Se a pergunta for sobre diferenças entre categorias, explique claramente.
Sempre mantenha o foco em ajudar o cliente a encontrar o carro ideal.`;

    const response = await chatCompletion(
      [
        { role: 'system', content: prompt },
        { role: 'user', content: question },
      ],
      {
        temperature: 0.7,
        maxTokens: 350,
      }
    );

    return response.trim();
  } catch (error) {
    logger.error({ error, question }, 'Failed to answer question');
    return 'Desculpe, não consegui processar sua pergunta. Pode reformular de outra forma?';
  }
}

/**
 * Generate next contextual question to ask the user
 *
 * @param options - Question generation options
 * @returns Generated question string
 */
export async function generateNextQuestion(options: QuestionGenerationOptions): Promise<string> {
  try {
    const { profile, missingFields, context } = options;

    // Determinar qual nome do app usar nas respostas
    const appName =
      profile.appMencionado === '99'
        ? '99'
        : profile.appMencionado === 'uber'
          ? 'Uber'
          : profile.appMencionado === 'app'
            ? 'app de transporte'
            : null;

    const appContext = appName
      ? `\n\n⚠️ IMPORTANTE: O cliente mencionou "${appName}" - USE ESTE NOME nas suas respostas, NÃO substitua por outro nome de app!`
      : '';

    const prompt = `${SYSTEM_PROMPT}

PERFIL ATUAL DO CLIENTE:
${JSON.stringify(profile, null, 2)}
${appContext}

INFORMAÇÕES QUE AINDA PRECISAMOS:
${missingFields.join(', ')}

CONTEXTO DA CONVERSA:
${context || 'Início da conversa'}

TAREFA:
Gere a PRÓXIMA MELHOR PERGUNTA para fazer ao cliente.

        DIRETRIZES:
        1. A pergunta deve ser contextual (baseada no que já sabemos)
        2. Priorize informações essenciais: orçamento, uso
        3. Seja natural, não robótico
        4. Faça UMA pergunta por vez
        5. Se apropriado, ofereça contexto antes de perguntar
        6. Use emojis com moderação (apenas se natural)
        7. Se o cliente mencionou um app de transporte específico (99, Uber), USE ESSE NOME na sua resposta

EXEMPLO BOM:
"Legal! Para viagens em família, temos SUVs e sedans muito confortáveis. Quantas pessoas costumam viajar juntas?"

EXEMPLO RUIM:
"Quantas pessoas?"

Gere APENAS a pergunta, sem prefácio ou explicação:`;

    const response = await chatCompletion(
      [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Qual a próxima melhor pergunta?' },
      ],
      {
        temperature: 0.8,
        maxTokens: 150,
      }
    );

    return response.trim();
  } catch (error) {
    logger.error({ error }, 'Failed to generate question');

    // Fallback to basic question based on missing fields
    const { profile, missingFields } = options;

    if (missingFields.includes('budget') || !profile.budget) {
      return '💰 Até quanto você pretende investir no carro?';
    }
    if (missingFields.includes('usage') || !profile.usage) {
      return '🚗 Qual vai ser o uso principal? Cidade, viagens, trabalho?';
    }

    return 'Me conta mais sobre o que você busca no carro ideal?';
  }
}
