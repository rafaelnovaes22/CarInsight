import {
  ConversationState,
  StateUpdate,
  QuizAnswers,
  CustomerProfile,
} from '../../types/state.types';
import { logger } from '../../lib/logger';

/**
 * Quiz questions structure
 */
const QUIZ_QUESTIONS = [
  {
    id: 1,
    field: 'budget',
    question: '💰 Até quanto você pretende investir no carro?\n\n_Exemplo: 50000 ou 50 mil_',
    validator: (answer: string) => {
      const cleaned = answer.replace(/[^\d]/g, '');
      const value = parseInt(cleaned);
      if (!value || value < 5000) {
        return {
          valid: false,
          error:
            '❌ Por favor, digite um valor válido acima de R$ 5.000.\n\n💰 Até quanto você pretende investir no carro?\n\n_Exemplo: 50000 ou 50 mil_',
        };
      }
      return { valid: true, value };
    },
  },
  {
    id: 2,
    field: 'usage',
    question:
      '✅ Anotado!\n\n🚗 Qual será o uso principal do veículo?\n\n1️⃣ Cidade (urbano)\n2️⃣ Viagem (estrada)\n3️⃣ Trabalho\n4️⃣ Misto (cidade + viagem)\n\n_Digite o número da opção_\n\n_Pergunta 2 de 8_',
    validator: (answer: string) => {
      const map: Record<string, string> = {
        '1': 'cidade',
        '2': 'viagem',
        '3': 'trabalho',
        '4': 'misto',
      };
      const value = map[answer.trim()];
      if (!value) {
        return {
          valid: false,
          error:
            '❌ Por favor, escolha uma opção válida (1, 2, 3 ou 4).\n\n🚗 Qual será o uso principal do veículo?\n\n1️⃣ Cidade\n2️⃣ Viagem\n3️⃣ Trabalho\n4️⃣ Misto\n\n_Digite o número_',
        };
      }
      return { valid: true, value };
    },
  },
  {
    id: 3,
    field: 'people',
    question:
      '✅ Anotado!\n\n👥 Para quantas pessoas? (passageiros + motorista)\n\n_Exemplo: 5_\n\n_Pergunta 3 de 8_',
    validator: (answer: string) => {
      const value = parseInt(answer.trim());
      if (!value || value < 1 || value > 9) {
        return {
          valid: false,
          error:
            '❌ Por favor, digite um número entre 1 e 9.\n\n👥 Para quantas pessoas?\n\n_Exemplo: 5_',
        };
      }
      return { valid: true, value };
    },
  },
  {
    id: 4,
    field: 'hasTradeIn',
    question:
      '✅ Anotado!\n\n🔄 Você tem um carro para dar como entrada (trade-in)?\n\n_Digite "sim" ou "não"_\n\n_Pergunta 4 de 8_',
    validator: (answer: string) => {
      const lower = answer.toLowerCase().trim();
      if (lower.includes('sim') || lower.includes('s')) {
        return { valid: true, value: true };
      }
      if (lower.includes('não') || lower.includes('nao') || lower.includes('n')) {
        return { valid: true, value: false };
      }
      return {
        valid: false,
        error:
          '❌ Por favor, responda "sim" ou "não".\n\n🔄 Você tem um carro para dar como entrada?',
      };
    },
  },
  {
    id: 5,
    field: 'minYear',
    question:
      '✅ Anotado!\n\n📅 Ano mínimo do veículo que você aceita?\n\n_Exemplo: 2018_\n\n_Pergunta 5 de 8_',
    validator: (answer: string) => {
      const value = parseInt(answer.trim());
      const currentYear = new Date().getFullYear();
      if (!value || value < 1990 || value > currentYear) {
        return {
          valid: false,
          error: `❌ Por favor, digite um ano válido entre 1990 e ${currentYear}.\n\n📅 Ano mínimo do veículo?\n\n_Exemplo: 2018_`,
        };
      }
      return { valid: true, value };
    },
  },
  {
    id: 6,
    field: 'maxKm',
    question:
      '✅ Anotado!\n\n🛣️ Quilometragem máxima que você aceita?\n\n_Exemplo: 80000_\n\n_Pergunta 6 de 8_',
    validator: (answer: string) => {
      const cleaned = answer.replace(/[^\d]/g, '');
      const value = parseInt(cleaned);
      if (!value || value < 0) {
        return {
          valid: false,
          error:
            '❌ Por favor, digite uma quilometragem válida.\n\n🛣️ Quilometragem máxima?\n\n_Exemplo: 80000_',
        };
      }
      return { valid: true, value };
    },
  },
  {
    id: 7,
    field: 'vehicleType',
    question:
      '✅ Anotado!\n\n🚙 Qual tipo de veículo você prefere?\n\n1️⃣ Hatchback (compacto)\n2️⃣ Sedan\n3️⃣ SUV\n4️⃣ Pickup\n5️⃣ Tanto faz\n\n_Digite o número da opção_\n\n_Pergunta 7 de 8_',
    validator: (answer: string) => {
      const map: Record<string, string> = {
        '1': 'hatch',
        '2': 'sedan',
        '3': 'suv',
        '4': 'pickup',
        '5': 'qualquer',
      };
      const value = map[answer.trim()];
      if (!value) {
        return {
          valid: false,
          error:
            '❌ Por favor, escolha uma opção válida (1, 2, 3, 4 ou 5).\n\n🚙 Qual tipo de veículo?\n\n1️⃣ Hatch\n2️⃣ Sedan\n3️⃣ SUV\n4️⃣ Pickup\n5️⃣ Tanto faz\n\n_Digite o número_',
        };
      }
      return { valid: true, value };
    },
  },
  {
    id: 8,
    field: 'urgency',
    question:
      '✅ Anotado!\n\n⏰ Qual a urgência da compra?\n\n1️⃣ Imediato (esta semana)\n2️⃣ Até 1 mês\n3️⃣ Até 3 meses\n4️⃣ Sem pressa\n\n_Digite o número da opção_\n\n_Pergunta 8 de 8 (última!)_',
    validator: (answer: string) => {
      const map: Record<string, string> = {
        '1': 'imediato',
        '2': '1mes',
        '3': '3meses',
        '4': 'flexivel',
      };
      const value = map[answer.trim()];
      if (!value) {
        return {
          valid: false,
          error:
            '❌ Por favor, escolha uma opção válida (1, 2, 3 ou 4).\n\n⏰ Qual a urgência?\n\n1️⃣ Imediato\n2️⃣ Até 1 mês\n3️⃣ Até 3 meses\n4️⃣ Sem pressa\n\n_Digite o número_',
        };
      }
      return { valid: true, value };
    },
  },
];

/**
 * Generate customer profile from quiz answers
 */
function generateProfile(answers: QuizAnswers): CustomerProfile {
  const priorities: string[] = [];

  if (answers.usage === 'cidade') priorities.push('economico', 'tamanho_compacto');
  if (answers.usage === 'viagem') priorities.push('conforto', 'seguranca');
  if (answers.people && answers.people >= 5) priorities.push('espaco');
  if (answers.urgency === 'imediato') priorities.push('disponivel');

  const dealBreakers: string[] = [];
  if (answers.maxKm && answers.maxKm < 50000) dealBreakers.push('alto_km');
  if (answers.minYear && answers.minYear > 2018) dealBreakers.push('muito_antigo');

  return {
    budget: answers.budget || 50000,
    budgetFlexibility: 10, // +/- 10%
    usagePattern: answers.usage || 'misto',
    familySize: answers.people || 4,
    priorities,
    dealBreakers,
    hasTradeIn: answers.hasTradeIn || false,
    minYear: answers.minYear || 2015,
    maxKm: answers.maxKm || 100000,
    vehicleType: answers.vehicleType || 'qualquer',
    urgency: answers.urgency || 'flexivel',
  };
}

/**
 * QuizNode - Handle quiz questions and collect answers
 */
export async function quizNode(state: ConversationState): Promise<StateUpdate> {
  logger.info(
    {
      conversationId: state.conversationId,
      currentQuestion: state.quiz.currentQuestion,
      progress: state.quiz.progress,
    },
    'QuizNode: Processing answer'
  );

  const lastMessage = state.messages[state.messages.length - 1];
  const userAnswer = lastMessage.content;

  const currentQuestion = QUIZ_QUESTIONS[state.quiz.currentQuestion - 1];

  // Validate answer
  const validation = currentQuestion.validator(userAnswer);

  if (!validation.valid) {
    // Invalid answer, ask again
    return {
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content: validation.error || 'Por favor, tente novamente.',
          timestamp: new Date(),
        },
      ],
      metadata: {
        ...state.metadata,
        lastMessageAt: new Date(),
      },
    };
  }

  // Save answer
  const updatedAnswers = {
    ...state.quiz.answers,
    [currentQuestion.field]: validation.value,
  };

  const newProgress = state.quiz.progress + 1;
  const nextQuestionNum = state.quiz.currentQuestion + 1;

  // Check if quiz is complete
  if (newProgress >= 8) {
    // Quiz complete! Generate profile
    const profile = generateProfile(updatedAnswers);

    logger.info(
      { conversationId: state.conversationId, profile },
      'QuizNode: Quiz completed, profile generated'
    );

    return {
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content:
            '✅ Perfeito! Recebi todas as informações.\n\n🔍 Estou buscando os melhores veículos para você...',
          timestamp: new Date(),
        },
      ],
      quiz: {
        ...state.quiz,
        answers: updatedAnswers,
        progress: newProgress,
        isComplete: true,
      },
      profile,
      graph: {
        ...state.graph,
        currentNode: 'search',
        previousNode: 'quiz',
        nodeHistory: [...state.graph.nodeHistory, 'quiz'],
      },
      metadata: {
        ...state.metadata,
        lastMessageAt: new Date(),
      },
    };
  }

  // Ask next question
  const nextQuestion = QUIZ_QUESTIONS[nextQuestionNum - 1];

  return {
    messages: [
      ...state.messages,
      {
        role: 'assistant',
        content: nextQuestion.question,
        timestamp: new Date(),
      },
    ],
    quiz: {
      ...state.quiz,
      answers: updatedAnswers,
      progress: newProgress,
      currentQuestion: nextQuestionNum,
    },
    metadata: {
      ...state.metadata,
      lastMessageAt: new Date(),
    },
  };
}
