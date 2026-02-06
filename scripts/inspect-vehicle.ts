import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      modelo: { contains: 'HB20S' },
      ano: 2025,
    },
  });

  if (vehicle) {
    console.log('📋 Detalhes do HB20 2025:');
    console.log(JSON.stringify(vehicle, null, 2));

    console.log('\n🔍 Análise de Elegibilidade:');
    console.log(`- Apto Família: ${vehicle.aptoFamilia}`);
    console.log(`- Apto Uber: ${vehicle.aptoUber}`);
    console.log(`- Apto Uber Black: ${vehicle.aptoUberBlack}`);
  } else {
    console.log('❌ Nenhum HB20 2025 encontrado.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
