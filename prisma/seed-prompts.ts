/**
 * Seed system_prompts table with default prompts.
 * Idempotent — uses upsert so it can be run multiple times safely.
 *
 * Usage: npx tsx prisma/seed-prompts.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_BASE_PROMPT,
  DEFAULT_LATE_NIGHT_ADDENDUM,
  DEFAULT_RETURNING_CUSTOMER_ADDENDUM,
} from '../src/agents/vehicle-expert/constants/system-prompt';

const prisma = new PrismaClient();

const prompts = [
  {
    key: 'vehicle_expert_base',
    content: DEFAULT_BASE_PROMPT,
    description: 'Prompt principal do Vehicle Expert Agent',
  },
  {
    key: 'late_night_addendum',
    content: DEFAULT_LATE_NIGHT_ADDENDUM,
    description: 'Adendo emocional para conversas de madrugada',
  },
  {
    key: 'returning_customer_addendum',
    content: DEFAULT_RETURNING_CUSTOMER_ADDENDUM,
    description: 'Adendo para clientes retornantes',
  },
];

async function main() {
  for (const prompt of prompts) {
    await prisma.system_prompts.upsert({
      where: { key: prompt.key },
      update: {
        content: prompt.content,
        description: prompt.description,
        updatedAt: new Date(),
      },
      create: {
        id: prompt.key,
        key: prompt.key,
        content: prompt.content,
        description: prompt.description,
        updatedAt: new Date(),
      },
    });
    console.log(`Upserted prompt: ${prompt.key}`);
  }
  console.log('Done seeding system_prompts');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
