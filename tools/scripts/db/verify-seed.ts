import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.vehicle.count();
  console.log(`\n📊 Total de veículos no banco: ${count}`);

  const sample = await prisma.vehicle.findFirst();
  if (sample) {
    console.log('\n📋 Exemplo de veículo no banco:');
    console.log(JSON.stringify(sample, null, 2));
  } else {
    console.log('\n❌ Nenhum veículo encontrado!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
