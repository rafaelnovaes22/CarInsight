import { prisma } from '../lib/prisma';
import { cache } from '../lib/redis';
import { logger } from '../lib/logger';
import { OrchestratorAgent } from '../agents/orchestrator.agent';
import { QuizAgent } from '../agents/quiz.agent';
import { RecommendationAgent } from '../agents/recommendation.agent';
import { guardrails } from './guardrails.service';

export class MessageHandler {
  private orchestrator: OrchestratorAgent;
  private quizAgent: QuizAgent;
  private recommendationAgent: RecommendationAgent;

  constructor() {
    this.orchestrator = new OrchestratorAgent();
    this.quizAgent = new QuizAgent();
    this.recommendationAgent = new RecommendationAgent();
  }

  async handleMessage(phoneNumber: string, message: string): Promise<string> {
    try {
      // 🛡️ GUARDRAIL: Validate input
      const inputValidation = guardrails.validateInput(phoneNumber, message);
      if (!inputValidation.allowed) {
        logger.warn({ phoneNumber, reason: inputValidation.reason }, 'Input blocked by guardrails');
        return inputValidation.reason || 'Desculpe, não consegui processar sua mensagem.';
      }

      // Use sanitized input
      const sanitizedMessage = inputValidation.sanitizedInput || message;
      // Get or create conversation
      let conversation = await this.getOrCreateConversation(phoneNumber);

      // Log message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'incoming',
          content: sanitizedMessage,
          messageType: 'text',
        },
      });

      // Get conversation context from cache
      const contextKey = `conversation:${conversation.id}:context`;
      const cachedContext = await cache.get(contextKey);
      let context = cachedContext ? JSON.parse(cachedContext) : {};

      logger.debug({ 
        conversationId: conversation.id,
        currentStep: conversation.currentStep,
        quizProgress: context.quizProgress,
        hasQuizAnswers: !!context.quizAnswers
      }, 'Processing message with context');

      // Route message based on current step
      let response: string;

      switch (conversation.currentStep) {
        case 'greeting':
          response = await this.handleGreeting(conversation, sanitizedMessage, context);
          break;

        case 'quiz':
          response = await this.handleQuiz(conversation, sanitizedMessage, context);
          break;

        case 'recommendation':
          response = await this.handleRecommendation(conversation, sanitizedMessage, context);
          break;

        default:
          response = await this.handleGeneral(conversation, sanitizedMessage, context);
      }

      // 🛡️ GUARDRAIL: Validate output before sending
      const outputValidation = guardrails.validateOutput(response);
      if (!outputValidation.allowed) {
        logger.error({ conversationId: conversation.id, reason: outputValidation.reason }, 'Output blocked by guardrails');
        response = 'Desculpe, houve um erro ao processar sua solicitação. Por favor, tente novamente ou digite "vendedor" para falar com nossa equipe.';
      }

      // Update last message timestamp
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      // Log outgoing message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'outgoing',
          content: response,
          messageType: 'text',
        },
      });

      // Save updated context to cache (TTL 24 hours)
      await cache.set(contextKey, JSON.stringify(context), 86400);

      return response;
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Error handling message');
      return 'Desculpe, ocorreu um erro. Por favor, tente novamente.';
    }
  }

  private async getOrCreateConversation(phoneNumber: string) {
    // Check for existing active conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        phoneNumber,
        status: 'active',
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!conversation) {
      // Create new conversation
      conversation = await prisma.conversation.create({
        data: {
          phoneNumber,
          status: 'active',
          currentStep: 'greeting',
        },
      });

      // Log event
      await prisma.event.create({
        data: {
          conversationId: conversation.id,
          eventType: 'started',
        },
      });

      logger.info({ conversationId: conversation.id, phoneNumber }, 'New conversation created');
    }

    return conversation;
  }

  private async handleGreeting(conversation: any, message: string, context: any): Promise<string> {
    // Check if this is the FIRST interaction (no quiz context yet)
    if (!context.quizProgress && context.quizProgress !== 0) {
      // Update to quiz step
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { currentStep: 'quiz' },
      });

      // Initialize quiz context
      context.quizProgress = 0;
      context.quizAnswers = {};
      
      // Save context to cache
      const contextKey = `conversation:${conversation.id}:context`;
      await cache.set(contextKey, JSON.stringify(context), 86400);
      
      // Return greeting + first question
      const firstQuestion = await this.quizAgent.getQuestion(0);
      const greetingMessage = `Olá! 👋 Bem-vindo à FaciliAuto!

Sou seu assistente virtual e estou aqui para ajudar você a encontrar o carro usado perfeito.

🚗 Vamos começar! Vou fazer algumas perguntas para entender suas necessidades.

${firstQuestion}`;

      return greetingMessage;
    }

    // For subsequent messages, identify intent
    const intent = await this.orchestrator.identifyIntent(message);

    logger.debug({ intent, conversationId: conversation.id }, 'Intent identified');

    if (intent === 'QUALIFICAR') {
      // Start quiz - update conversation in DB
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { currentStep: 'quiz' },
      });

      // Initialize quiz context
      context.quizProgress = 0;
      context.quizAnswers = {};
      
      // Save context immediately to cache
      const contextKey = `conversation:${conversation.id}:context`;
      await cache.set(contextKey, JSON.stringify(context), 86400);
      
      return this.quizAgent.getWelcomeMessage();
    }

    if (intent === 'HUMANO') {
      // Handoff to human
      await prisma.event.create({
        data: {
          conversationId: conversation.id,
          eventType: 'handoff_requested',
        },
      });

      return `Entendi! Vou conectar você com um de nossos vendedores especialistas.\n\nUm momento, por favor. ⏳`;
    }

    // Default greeting
    return `Olá! 👋 Bem-vindo à FaciliAuto!\n\nSou seu assistente virtual e estou aqui para ajudar você a encontrar o carro usado perfeito.\n\n🚗 Quer ver nossos veículos disponíveis?\n\n_Digite "sim" para começar ou "falar com vendedor" se preferir atendimento humano._`;
  }

  private async handleQuiz(conversation: any, message: string, context: any): Promise<string> {
    const currentProgress = context.quizProgress || 0;
    const currentAnswers = context.quizAnswers || {};
    
    logger.debug({ 
      conversationId: conversation.id, 
      currentProgress, 
      answersCount: Object.keys(currentAnswers).length,
      message 
    }, 'Starting handleQuiz');

    const { response, isComplete, answers, progressIncrement } = await this.quizAgent.processAnswer(
      message,
      currentProgress,
      currentAnswers
    );

    // Update context only if answer was valid
    if (progressIncrement) {
      context.quizProgress = currentProgress + 1;
    }
    context.quizAnswers = answers;
    
    // 📝 SAVE CONTEXT TO CACHE IMMEDIATELY (critical for MVP)
    const contextKey = `conversation:${conversation.id}:context`;
    await cache.set(contextKey, JSON.stringify(context), 86400);
    
    logger.debug({ 
      conversationId: conversation.id, 
      newProgress: context.quizProgress, 
      answersCount: Object.keys(answers).length,
      isComplete,
      progressIncrement
    }, 'Quiz context updated');

    if (isComplete) {
      logger.info({ conversationId: conversation.id, answers }, 'Quiz completed, generating recommendations');
      
      // Update conversation step in DB
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentStep: 'recommendation',
          quizAnswers: JSON.stringify(answers),
          profileData: JSON.stringify(this.quizAgent.generateProfile(answers)),
        },
      });

      await prisma.event.create({
        data: {
          conversationId: conversation.id,
          eventType: 'quiz_completed',
          metadata: JSON.stringify({ answers }),
        },
      });

      // Generate recommendations
      const recommendations = await this.recommendationAgent.generateRecommendations(
        conversation.id,
        answers
      );

      // Format and return recommendations
      return this.formatRecommendations(recommendations);
    }

    return response;
  }

  private async handleRecommendation(conversation: any, message: string, context: any): Promise<string> {
    // Handle user response to recommendations
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('mais') || lowerMessage.includes('outro')) {
      return 'No momento, mostrei as 3 melhores opções baseadas no seu perfil.\n\nGostaria de:\n\n1️⃣ Ver detalhes de algum veículo específico\n2️⃣ Agendar uma visita\n3️⃣ Falar com um vendedor\n\nDigite o número da opção.';
    }

    if (lowerMessage.includes('visita') || lowerMessage.includes('agendar')) {
      await prisma.event.create({
        data: {
          conversationId: conversation.id,
          eventType: 'visit_scheduled',
        },
      });

      // Create lead
      await this.createLead(conversation);

      return `Ótimo! 🎉\n\nVou transferir você para nossa equipe de vendas para agendar sua visita.\n\nUm vendedor entrará em contato em breve.\n\nObrigado por escolher a FaciliAuto!`;
    }

    return `Entendi! Como posso ajudar mais?\n\n• Digite o número do carro para ver mais detalhes\n• Digite "agendar" para marcar uma visita\n• Digite "vendedor" para falar com nossa equipe`;
  }

  private async handleGeneral(conversation: any, message: string, context: any): Promise<string> {
    // Use orchestrator for general queries
    return await this.orchestrator.handleQuery(message, context);
  }

  private formatRecommendations(recommendations: any[]): string {
    if (recommendations.length === 0) {
      return 'Desculpe, não encontrei veículos que atendam exatamente suas necessidades no momento.\n\nMas nossa equipe pode ajudar! Digite "vendedor" para falar com um especialista.';
    }

    let message = `🎯 Encontrei ${recommendations.length} veículos perfeitos para você!\n\n`;

    recommendations.forEach((rec, index) => {
      const vehicle = rec.vehicle;
      message += `━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `${index + 1}️⃣ Match Score: ${rec.matchScore}/100 ⭐\n\n`;
      message += `🚗 ${vehicle.marca} ${vehicle.modelo} ${vehicle.versao || ''}\n`;
      message += `📅 Ano: ${vehicle.ano} | 🛣️ ${vehicle.km.toLocaleString('pt-BR')} km\n`;
      message += `💰 R$ ${parseFloat(vehicle.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      message += `🎨 Cor: ${vehicle.cor}\n\n`;
      message += `💡 ${rec.reasoning}\n\n`;
      
      // Adicionar link do veículo se existir
      if (vehicle.url) {
        message += `🔗 Ver detalhes: ${vehicle.url}\n\n`;
      }
    });

    message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `Gostou de algum? Digite "vendedor" para falar com nossa equipe e fechar negócio! 🤝\n\n`;
    message += `Ou digite "agendar" para marcar test-drive. 📅`;

    return message;
  }

  private async createLead(conversation: any) {
    // Parse JSON strings
    const profile = conversation.profileData ? JSON.parse(conversation.profileData) : {};
    const answers = conversation.quizAnswers ? JSON.parse(conversation.quizAnswers) : {};

    try {
      await prisma.lead.create({
        data: {
          conversationId: conversation.id,
          name: conversation.customerName || 'Cliente WhatsApp',
          phone: conversation.phoneNumber,
          budget: answers.budget ? parseFloat(answers.budget) : null,
          usage: answers.usage,
          people: answers.people ? parseInt(answers.people) : null,
          hasTradeIn: answers.hasTradeIn === 'sim',
          urgency: answers.urgency,
          status: 'new',
          source: 'whatsapp_bot',
        },
      });

      logger.info({ conversationId: conversation.id }, 'Lead created');
    } catch (error) {
      logger.error({ error, conversationId: conversation.id }, 'Error creating lead');
    }
  }
}
