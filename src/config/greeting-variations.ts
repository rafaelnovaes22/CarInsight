/**
 * Greeting Message Variations
 *
 * Natural, conversational greeting messages to avoid sounding robotic.
 * Randomly select one to make each interaction feel fresh.
 */

export const GREETING_VARIATIONS = {
  // Initial greetings with AI disclosure
  WITH_DISCLOSURE: [
    `👋 E aí! Sou da Inovais e vou te ajudar a encontrar o carro perfeito!

🤖 *Só um aviso:* Sou assistente virtual e posso errar de vez em quando. Se preferir falar com nossa equipe, é só pedir!

💡 _Pode digitar *sair* quando quiser encerrar, beleza?_

Pra começar, qual é o seu nome?`,

    `Olá! 👋 Tudo bem? Aqui é da *Inovais* e tô aqui pra te ajudar a achar o carro ideal!

🤖 *Importante:* Sou uma IA e às vezes posso errar. Se quiser mais precisão, posso te passar pra nossa equipe humana.

💡 _A qualquer momento, digite *sair* pra encerrar._

Me conta, qual seu nome?`,

    `👋 Opa! Bem-vindo(a) à Inovais!

🤖 *Aviso amigável:* Sou assistente virtual e posso cometer erros. Precisa de algo muito específico? Posso conectar você com nossa equipe!

Vamos começar! Qual é o seu nome?`,
  ],

  // Quick greetings after name is known
  AFTER_NAME: [
    `👋 Olá, {name}! Me conta, o que você tá procurando? 🚗

Pode ser:
• Um tipo de carro (SUV, sedan, pickup...)
• Pra que vai usar (família, trabalho, app...)
• Ou já um modelo específico mesmo`,

    `E aí, {name}! Beleza? 😊

Bora achar o carro perfeito pra você! Me fala:
• Que tipo de carro você quer?
• Vai usar pra quê?
• Ou já tem algum modelo em mente?`,

    `Prazer, {name}! 🚗

Vamos encontrar seu próximo carro! Você pode me dizer:
• Tipo de carroceria (SUV, sedan, hatch...)
• Finalidade (família, trabalho, uber...)
• Ou um modelo específico`,
  ],

  // Greetings with vehicle mention
  WITH_VEHICLE: [
    `👋 Olá! Vi que você tá afim de um *{vehicle}*. Ótima escolha! 🚗

Qual é o seu nome?`,

    `E aí! Notei que você mencionou *{vehicle}*. Legal! 😊

Pra eu te ajudar melhor, qual seu nome?`,

    `Opa! *{vehicle}*, gostou desse! 🚙

Me fala seu nome pra gente continuar?`,
  ],

  // Trade-in greetings
  WITH_TRADE_IN: [
    `Prazer, {name}! 😊

Entendi! Você tem um *{tradeIn}* pra dar na troca. Bacana! 🚗🔄

Pra te ajudar melhor, me conta:
• Que tipo de carro você quer agora?
• Tem um orçamento em mente?

_Ou já sabe o modelo que quer?_`,

    `Olá, {name}! Tudo certo! 👋

Vi que você tem um *{tradeIn}* pra troca. Vamos ver o que encontramos!

Me fala:
• Quer SUV, sedan, hatch...?
• Qual seria seu orçamento?`,
  ],

  // Confirmation messages
  CONFIRMATIONS: [
    'Show!',
    'Perfeito!',
    'Entendi!',
    'Beleza!',
    'Legal!',
    'Ótimo!',
    'Certo!',
    'Tranquilo!',
  ],

  // Question variations for budget
  BUDGET_QUESTIONS: [
    'Qual seria seu orçamento aproximado?',
    'Tem um valor em mente pra investir?',
    'Quanto você tá pensando em gastar mais ou menos?',
    'Qual a faixa de preço você considera?',
    'Até quanto você pretende investir?',
    'Tá pensando em investir quanto?',
  ],

  // Question variations for usage
  USAGE_QUESTIONS: [
    'Vai usar mais pra quê?',
    'Qual vai ser o uso principal?',
    'Pra que você vai usar o carro?',
    'Vai usar no dia a dia, viagens, trabalho...?',
    'Me conta, que uso você tem em mente?',
  ],
};

/**
 * Get a random item from an array
 */
export function getRandomVariation<T>(variations: T[]): T {
  const index = Math.floor(Math.random() * variations.length);
  return variations[index];
}

/**
 * Get a random greeting with disclosure
 */
export function getRandomGreetingWithDisclosure(): string {
  return getRandomVariation(GREETING_VARIATIONS.WITH_DISCLOSURE);
}

/**
 * Get a random greeting after name is known
 */
export function getRandomGreetingAfterName(name: string): string {
  const template = getRandomVariation(GREETING_VARIATIONS.AFTER_NAME);
  return template.replace('{name}', name);
}

/**
 * Get a random greeting with vehicle mention
 */
export function getRandomGreetingWithVehicle(vehicle: string): string {
  const template = getRandomVariation(GREETING_VARIATIONS.WITH_VEHICLE);
  return template.replace('{vehicle}', vehicle);
}

/**
 * Get a random greeting with trade-in
 */
export function getRandomGreetingWithTradeIn(name: string, tradeIn: string): string {
  const template = getRandomVariation(GREETING_VARIATIONS.WITH_TRADE_IN);
  return template.replace('{name}', name).replace('{tradeIn}', tradeIn);
}

/**
 * Get a random confirmation
 */
export function getRandomConfirmation(): string {
  return getRandomVariation(GREETING_VARIATIONS.CONFIRMATIONS);
}

/**
 * Get a random budget question
 */
export function getRandomBudgetQuestion(): string {
  return getRandomVariation(GREETING_VARIATIONS.BUDGET_QUESTIONS);
}

/**
 * Get a random usage question
 */
export function getRandomUsageQuestion(): string {
  return getRandomVariation(GREETING_VARIATIONS.USAGE_QUESTIONS);
}
