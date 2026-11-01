import { faker } from '@faker-js/faker';

// Lazy load do Prisma para evitar erros de inicialização
let prismaInstance: any = null;

async function getPrismaClient() {
  if (!prismaInstance) {
    try {
      const { PrismaClient } = await import('@prisma/client');
      prismaInstance = new PrismaClient();
    } catch (error) {
      console.warn('⚠️  Prisma não disponível');
      return null;
    }
  }
  return prismaInstance;
}

// Export para compatibilidade
export const prisma = {
  get client() {
    return prismaInstance;
  }
};

/**
 * Gera dados mock para conversação
 */
export function createMockConversation(overrides = {}) {
  return {
    whatsappId: faker.phone.number('5511#########'),
    state: 'INITIAL',
    currentStep: 'greeting',
    context: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Gera dados mock para consulta
 */
export function createMockConsultation(overrides = {}) {
  return {
    conversationId: faker.string.uuid(),
    budget: faker.number.int({ min: 30000, max: 100000 }),
    usage: faker.helpers.arrayElement(['trabalho', 'família', 'lazer']),
    persons: faker.number.int({ min: 2, max: 7 }),
    essentialItems: ['ar condicionado', 'direção elétrica'],
    bodyType: faker.helpers.arrayElement(['sedan', 'hatch', 'suv']),
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Gera dados mock para veículo
 */
export function createMockVehicle(overrides = {}) {
  return {
    brand: 'Fiat',
    model: faker.helpers.arrayElement(['Argo', 'Mobi', 'Cronos', 'Pulse']),
    version: '1.0',
    year: faker.number.int({ min: 2020, max: 2024 }),
    price: faker.number.int({ min: 40000, max: 90000 }),
    category: faker.helpers.arrayElement(['hatch', 'sedan', 'suv']),
    fuelType: faker.helpers.arrayElement(['flex', 'gasolina', 'elétrico']),
    transmission: faker.helpers.arrayElement(['manual', 'automático']),
    doors: faker.number.int({ min: 2, max: 5 }),
    seats: faker.number.int({ min: 4, max: 7 }),
    trunkCapacity: faker.number.int({ min: 250, max: 600 }),
    fuelConsumption: faker.number.float({ min: 8, max: 15, fractionDigits: 1 }),
    features: ['ar condicionado', 'direção elétrica', 'vidros elétricos'],
    imageUrl: faker.image.urlLoremFlickr({ category: 'car' }),
    available: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Gera mensagem mock do WhatsApp
 */
export function createMockWhatsAppMessage(overrides = {}) {
  return {
    from: faker.phone.number('5511#########'),
    id: faker.string.uuid(),
    timestamp: Date.now(),
    type: 'text',
    text: {
      body: faker.lorem.sentence(),
    },
    ...overrides,
  };
}

/**
 * Limpa todas as tabelas do banco de teste
 */
export async function cleanDatabase() {
  const client = await getPrismaClient();
  if (!client) {
    console.warn('⚠️  Prisma não disponível para limpeza');
    return;
  }
  
  const tables = ['Message', 'Recommendation', 'Event', 'Lead', 'Conversation'];
  
  for (const table of tables) {
    try {
      await client.$executeRawUnsafe(`DELETE FROM "${table}";`);
    } catch (error) {
      // Tabela pode não existir
    }
  }
}

/**
 * Cria uma conversação de teste completa no banco
 */
export async function createTestConversation(data = {}) {
  const client = await getPrismaClient();
  if (!client) {
    throw new Error('Prisma não disponível');
  }
  return await client.conversation.create({
    data: createMockConversation(data),
  });
}

/**
 * Aguarda tempo em ms (helper para testes assíncronos)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock de resposta do Groq
 */
export function createMockGroqResponse(content: string) {
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };
}

/**
 * Mock de resposta de embedding OpenAI
 */
export function createMockEmbedding(dimensions = 1536) {
  return Array.from({ length: dimensions }, () => 
    faker.number.float({ min: -1, max: 1, fractionDigits: 6 })
  );
}

/**
 * Verifica se banco está disponível
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const client = await getPrismaClient();
    if (!client) return false;
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
