import { extractIntent, salesChatCompletion } from '../lib/groq';
import { logger } from '../lib/logger';

export class OrchestratorAgent {
  async identifyIntent(message: string): Promise<string> {
    try {
      const intent = await extractIntent(message);
      return intent;
    } catch (error) {
      logger.error({ error }, 'Error identifying intent');
      // 📝 MVP Fallback: Recognize simple intents without Groq
      const msg = message.toLowerCase().trim();
      if (msg.includes('sim') || msg.includes('quero') || msg.includes('comprar')) {
        logger.info({ message }, 'MVP fallback: Recognized QUALIFICAR intent');
        return 'QUALIFICAR';
      }
      if (msg.includes('vendedor') || msg.includes('humano') || msg.includes('atendente')) {
        logger.info({ message }, 'MVP fallback: Recognized HUMANO intent');
        return 'HUMANO';
      }
      return 'OUTRO';
    }
  }

  async handleQuery(message: string, context: any): Promise<string> {
    try {
      const contextString = context ? `Histórico da conversa: ${JSON.stringify(context)}` : '';
      const response = await salesChatCompletion(message, contextString);
      return response.trim();
    } catch (error) {
      logger.error({ error }, 'Error handling query');
      return 'Desculpe, não entendi. Quer ver nossos carros disponíveis? Digite "sim" para começar!';
    }
  }
}
