import { logger } from '../lib/logger';

interface QuizQuestion {
  id: string;
  question: string;
  type: 'text' | 'choice' | 'number';
  options?: string[];
  validation?: (answer: string) => boolean;
}

const EXIT_FOOTER = '\n\n💡 _Digite "sair" ou "cancelar" para recomeçar_';

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'budget',
    question: `💰 Qual seu orçamento disponível para o carro?\n\n_Exemplo: 50000 ou 50 mil_${EXIT_FOOTER}`,
    type: 'text',
  },
  {
    id: 'usage',
    question: `🚗 Qual será o uso principal do veículo?\n\n1️⃣ Cidade (urbano)\n2️⃣ Viagem (estrada)\n3️⃣ Trabalho leve (escritório, visitas)\n4️⃣ Trabalho pesado (obra, carga, campo)\n5️⃣ Misto (cidade + viagem)\n\n_Digite o número da opção_${EXIT_FOOTER}`,
    type: 'choice',
    options: ['cidade', 'viagem', 'trabalho_leve', 'trabalho_pesado', 'misto'],
  },
  {
    id: 'people',
    question: `👥 Para quantas pessoas? (passageiros + motorista)\n\n_Exemplo: 5_${EXIT_FOOTER}`,
    type: 'number',
  },
  {
    id: 'hasTradeIn',
    question: `🔄 Você tem um carro para dar como entrada (trade-in)?\n\n_Digite "sim" ou "não"_${EXIT_FOOTER}`,
    type: 'choice',
    options: ['sim', 'não', 'nao'],
  },
  {
    id: 'minYear',
    question: `📅 Ano mínimo do veículo que você aceita?\n\n_Exemplo: 2018_${EXIT_FOOTER}`,
    type: 'number',
  },
  {
    id: 'maxKm',
    question: `🛣️ Quilometragem máxima que você aceita?\n\n_Exemplo: 80000 ou 80 mil_${EXIT_FOOTER}`,
    type: 'text',
  },
  {
    id: 'bodyType',
    question: `🚙 Qual tipo de carroceria você prefere?\n\n1️⃣ Hatch (compacto)\n2️⃣ Sedan\n3️⃣ SUV/Crossover\n4️⃣ Picape\n5️⃣ Tanto faz\n\n_Digite o número da opção_${EXIT_FOOTER}`,
    type: 'choice',
    options: ['hatch', 'sedan', 'suv', 'picape', 'tanto faz'],
  },
  {
    id: 'urgency',
    question: `⏰ Quando pretende comprar?\n\n1️⃣ Urgente (esta semana)\n2️⃣ Até 1 mês\n3️⃣ Até 3 meses\n4️⃣ Só pesquisando\n\n_Digite o número da opção_${EXIT_FOOTER}`,
    type: 'choice',
    options: ['urgente', '1mes', '3meses', 'pesquisando'],
  },
];

export class QuizAgent {
  getWelcomeMessage(): string {
    return `Perfeito! Vou fazer algumas perguntas rápidas para encontrar o carro ideal para você. 🎯\n\nSão apenas ${QUIZ_QUESTIONS.length} perguntas e leva menos de 2 minutos!\n\n${QUIZ_QUESTIONS[0].question}`;
  }

  async processAnswer(
    answer: string,
    currentQuestionIndex: number,
    previousAnswers: Record<string, any>
  ): Promise<{ response: string; isComplete: boolean; answers: Record<string, any>; progressIncrement: boolean }> {
    if (currentQuestionIndex >= QUIZ_QUESTIONS.length) {
      return {
        response: 'Quiz já concluído!',
        isComplete: true,
        answers: previousAnswers,
        progressIncrement: false,
      };
    }

    const currentQuestion = QUIZ_QUESTIONS[currentQuestionIndex];
    
    // Validate and parse answer
    const parsedAnswer = await this.parseAnswer(answer, currentQuestion);
    
    if (!parsedAnswer.valid) {
      return {
        response: `${parsedAnswer.error}\n\n${currentQuestion.question}`,
        isComplete: false,
        answers: previousAnswers,
        progressIncrement: false, // Don't increment on invalid answer
      };
    }

    // Save answer
    const answers = {
      ...previousAnswers,
      [currentQuestion.id]: parsedAnswer.value,
    };

    // Check if quiz is complete
    const nextQuestionIndex = currentQuestionIndex + 1;
    const isComplete = nextQuestionIndex >= QUIZ_QUESTIONS.length;

    if (isComplete) {
      return {
        response: `✅ Perfeito! Tenho todas as informações.\n\nAgora vou buscar os melhores veículos para você... ⏳`,
        isComplete: true,
        answers,
        progressIncrement: true,
      };
    }

    // Get next question
    const nextQuestion = QUIZ_QUESTIONS[nextQuestionIndex];
    const progressText = `\n\n_Pergunta ${nextQuestionIndex + 1} de ${QUIZ_QUESTIONS.length}_`;

    return {
      response: `✅ Anotado!\n\n${nextQuestion.question}${progressText}`,
      isComplete: false,
      answers,
      progressIncrement: true, // Increment on valid answer
    };
  }

  private async parseAnswer(
    answer: string,
    question: QuizQuestion
  ): Promise<{ valid: boolean; value?: any; error?: string }> {
    const cleanAnswer = answer.trim().toLowerCase();

    if (question.type === 'choice') {
      // Check if answer is a number (option index)
      const optionIndex = parseInt(cleanAnswer) - 1;
      if (optionIndex >= 0 && optionIndex < (question.options?.length || 0)) {
        return { valid: true, value: question.options![optionIndex] };
      }

      // Check if answer matches an option (flexible matching)
      const matchedOption = question.options?.find(opt => {
        const optLower = opt.toLowerCase();
        // Direct match
        if (cleanAnswer.includes(optLower)) return true;
        
        // Match for usage question - detect work context
        if (question.id === 'usage') {
          // Trabalho pesado: obra, construção, carga, pedreiro, campo, fazenda, rural, material
          const trabalhoPoesadoKeywords = ['obra', 'constru', 'carga', 'pedreiro', 'campo', 'fazenda', 'rural', 
            'material', 'ferramenta', 'entulho', 'terra', 'areia', 'tijolo', 'cimento', 'madeira',
            'agricultur', 'agrícola', 'frete', 'carregar', 'transportar', 'caçamba', 'pesado'];
          if (optLower === 'trabalho_pesado' && trabalhoPoesadoKeywords.some(k => cleanAnswer.includes(k))) return true;
          
          // Trabalho leve: escritório, vendas, visitas, representante, comercial
          const trabalhoLeveKeywords = ['escritório', 'escritorio', 'vendas', 'visita', 'representante', 
            'comercial', 'cliente', 'reunião', 'reuniao', 'empresa'];
          if (optLower === 'trabalho_leve' && trabalhoLeveKeywords.some(k => cleanAnswer.includes(k))) return true;
          
          // Match genérico "trabalho" - default para trabalho_leve, exceto se tiver contexto pesado
          if (cleanAnswer.includes('trabalho') || cleanAnswer.includes('trabalhar')) {
            if (optLower === 'trabalho_pesado' && trabalhoPoesadoKeywords.some(k => cleanAnswer.includes(k))) return true;
            if (optLower === 'trabalho_leve' && !trabalhoPoesadoKeywords.some(k => cleanAnswer.includes(k))) return true;
          }
        }
        
        // Match for urgency question
        if (optLower === '3meses' && (cleanAnswer.includes('3') && cleanAnswer.includes('mes'))) return true;
        if (optLower === '1mes' && (cleanAnswer.includes('1') && cleanAnswer.includes('mes'))) return true;
        if (optLower === 'urgente' && (cleanAnswer.includes('urgent') || cleanAnswer.includes('semana'))) return true;
        if (optLower === 'pesquisando' && (cleanAnswer.includes('pesquis') || cleanAnswer.includes('olhando'))) return true;
        return false;
      });

      if (matchedOption) {
        return { valid: true, value: matchedOption };
      }

      return {
        valid: false,
        error: `❌ Opção inválida. Por favor, *escolha uma das opções digitando o número* (1, 2, 3, 4 ou 5).`,
      };
    }

    if (question.type === 'number') {
      const number = parseInt(cleanAnswer.replace(/\D/g, ''));
      if (isNaN(number) || number <= 0) {
        return {
          valid: false,
          error: '❌ Por favor, digite um número válido.',
        };
      }
      return { valid: true, value: number };
    }

    if (question.type === 'text') {
      // For budget and km, extract numbers
      if (question.id === 'budget' || question.id === 'maxKm') {
        const number = parseInt(cleanAnswer.replace(/\D/g, ''));
        if (isNaN(number) || number <= 0) {
          return {
            valid: false,
            error: '❌ Por favor, digite um valor válido.',
          };
        }
        return { valid: true, value: number };
      }

      return { valid: true, value: answer.trim() };
    }

    return { valid: true, value: answer };
  }

  generateProfile(answers: Record<string, any>): any {
    return {
      budget: answers.budget,
      budgetMin: answers.budget * 0.8,
      budgetMax: answers.budget * 1.2,
      usage: answers.usage,
      people: answers.people,
      hasTradeIn: answers.hasTradeIn === 'sim',
      minYear: answers.minYear,
      maxKm: answers.maxKm,
      bodyType: answers.bodyType,
      urgency: answers.urgency,
      generatedAt: new Date().toISOString(),
    };
  }
}
