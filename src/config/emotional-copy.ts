/**
 * Emotional Copy Library
 *
 * Phrases organized by emotional trigger and time slot.
 * Used for aspirational/emotional selling, especially during late-night sessions.
 *
 * Compliance: All phrases are aspirational, never aggressive.
 * Scarcity claims must be backed by real data (never fabricated).
 */

import { TimeSlot } from './time-context';

export type EmotionalTrigger = 'DESEJO' | 'IMPULSO' | 'DOR' | 'COMPARACAO' | 'CONEXAO' | 'ESCASSEZ';

type CopyVariants = Record<TimeSlot, string[]>;

export const EMOTIONAL_COPY: Record<EmotionalTrigger, CopyVariants> = {
  DESEJO: {
    morning: [
      'Esse carro vai deixar seu dia a dia muito mais prático!',
      'Imagina sair de casa com esse carro toda manhã...',
    ],
    afternoon: [
      'Esse aqui é daqueles que você olha e já se imagina dirigindo.',
      'Visual bonito e prático no dia a dia — combinação perfeita.',
    ],
    evening: [
      'Imagina chegar em casa depois do trabalho com esse carro na garagem...',
      'Aquele conforto de dirigir um carro que você realmente gosta.',
    ],
    late_night: [
      'Imagina você nesse carro amanhã de manhã... aquele cheirinho de carro novo.',
      'Fecha os olhos e imagina: você saindo com esse carro amanhã. Que sensação!',
      'Esse carro tem a cara de quem merece algo especial.',
    ],
  },

  IMPULSO: {
    morning: [
      'Esse modelo costuma sair rápido do estoque.',
      'Se interessou? Vale a pena garantir logo.',
    ],
    afternoon: [
      'Esse modelo tem bastante procura, viu?',
      'Tem tido bastante interesse nesse aqui ultimamente.',
    ],
    evening: [
      'Esse aqui é dos mais procurados. Se gostou, não deixa pra depois!',
      'Modelos assim não ficam muito tempo disponíveis.',
    ],
    late_night: [
      'Você tá pesquisando na hora certa — decisões importantes merecem calma.',
      'Aproveita que tá pensando com tranquilidade agora pra dar esse passo.',
      'De madrugada a gente pensa melhor, né? Esse carro merece essa atenção.',
    ],
  },

  DOR: {
    morning: [
      'Cansou de gastar com manutenção? Esse aqui é econômico e confiável.',
      'Pra quem quer parar de se preocupar com mecânico, esse é ideal.',
    ],
    afternoon: [
      'Chega de dor de cabeça com carro, né? Esse é zero problema.',
      'Se quer tranquilidade, esse modelo é uma boa pedida.',
    ],
    evening: [
      'Depois de um dia longo, o que você quer é um carro que não dá trabalho.',
      'Imagine não se preocupar mais com manutenção toda hora.',
    ],
    late_night: [
      'Cansado de gastar com mecânico? Esse aqui é zero dor de cabeça.',
      'Sei como é ficar pensando "será que meu carro vai dar problema?". Com esse, pode relaxar.',
      'Você merece um carro que te dá paz, não preocupação.',
    ],
  },

  COMPARACAO: {
    morning: [
      'Comparando com outros da mesma faixa, esse se destaca em custo-benefício.',
      'Olhando os números, esse aqui entrega mais pelo mesmo valor.',
    ],
    afternoon: [
      'Já pesquisou bastante, né? Esse se destaca por um bom motivo.',
      'Comparando com similares, esse oferece um conjunto mais completo.',
    ],
    evening: [
      'Depois de pesquisar tanto, esse modelo se destaca naturalmente.',
      'Quem compara bastante acaba chegando nesse — e por bons motivos.',
    ],
    late_night: [
      'Você já pesquisou bastante, né? Esse se destaca pelo conjunto completo.',
      'De tudo que você viu, esse aqui reúne o melhor de cada um.',
      'Pesquisar de madrugada mostra dedicação — e esse carro está à altura.',
    ],
  },

  CONEXAO: {
    morning: [
      'Fico feliz em te ajudar a encontrar o carro certo!',
      'Vamos encontrar a melhor opção juntos!',
    ],
    afternoon: [
      'Tô aqui pra te ajudar no que precisar!',
      'Pode contar comigo pra tirar todas as dúvidas.',
    ],
    evening: [
      'Que bom que você tá dedicando esse tempo pra essa decisão!',
      'Comprar carro é uma decisão importante — tô aqui pra ajudar.',
    ],
    late_night: [
      'Fico feliz que você está dedicando esse tempo pra essa decisão importante.',
      'Tô aqui pra te ajudar, sem pressa nenhuma. Pergunte o que quiser!',
      'Pesquisar carro de madrugada? Isso sim é dedicação! Tô junto contigo.',
      'Esse é o seu momento — sem correria, sem pressão. Vamos com calma.',
    ],
  },

  ESCASSEZ: {
    morning: [
      'Esse é um dos poucos disponíveis nessa faixa.',
      'Opções assim não aparecem todo dia no estoque.',
    ],
    afternoon: [
      'Tem poucas unidades assim no momento.',
      'Esse modelo nessa condição é difícil de encontrar.',
    ],
    evening: [
      'Não costuma durar muito tempo no estoque, esse tipo de oferta.',
      'Raridade encontrar nessa faixa com esses opcionais.',
    ],
    late_night: [
      'Único na loja nessa faixa — e com essa quilometragem.',
      'Já tiveram outras consultas sobre esse modelo recentemente.',
      'Oportunidades assim são raras — mas a decisão é sua, sem pressa.',
    ],
  },
};

/**
 * Get a random emotional copy for a given trigger and time slot.
 */
export function getEmotionalCopy(trigger: EmotionalTrigger, timeSlot: TimeSlot): string {
  const variants = EMOTIONAL_COPY[trigger][timeSlot];
  return variants[Math.floor(Math.random() * variants.length)];
}

/**
 * Get a recommendation framing phrase for the given time slot.
 * Used after showing vehicle details to add emotional context.
 */
export function getRecommendationFraming(vehicleName: string, timeSlot: TimeSlot): string {
  if (timeSlot === 'late_night') {
    const framings = [
      `Imagina você nesse ${vehicleName} amanhã de manhã...`,
      `Esse ${vehicleName} tem a sua cara. Pensa nisso com calma.`,
      `Amanhã você pode estar no volante desse ${vehicleName}. Que tal?`,
    ];
    return framings[Math.floor(Math.random() * framings.length)];
  }

  if (timeSlot === 'evening') {
    const framings = [
      `Esse ${vehicleName} combina com seu estilo.`,
      `Já pensou em como esse ${vehicleName} ia ficar na sua garagem?`,
    ];
    return framings[Math.floor(Math.random() * framings.length)];
  }

  return '';
}

/**
 * Get a closing phrase for recommendations based on time slot.
 */
export function getEmotionalClosing(timeSlot: TimeSlot): string {
  const closings: Record<TimeSlot, string[]> = {
    morning: ['Quer saber mais de algum? Me fala!', 'Gostou de algum? Me conta!'],
    afternoon: ['Qual te chamou mais atenção?', 'Me diz qual te interessou mais!'],
    evening: [
      'Algum desses combinou com o que você tinha em mente?',
      'Curtiu algum? Posso te contar mais detalhes!',
    ],
    late_night: [
      'Aproveita que tá pensando com calma agora 😉',
      'Sem pressa, me fala qual te chamou mais atenção!',
      'Tá com alguma dúvida? Pode perguntar, tô aqui!',
    ],
  };

  const variants = closings[timeSlot];
  return variants[Math.floor(Math.random() * variants.length)];
}
