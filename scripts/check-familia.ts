import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFamilia() {
  const familia = await prisma.vehicle.findMany({
    where: { aptoFamilia: true },
    select: { marca: true, modelo: true, ano: true, carroceria: true, portas: true },
  });

  console.log(`\n📊 Veículos marcados como FAMÍLIA: ${familia.length}\n`);
  console.log('Marca | Modelo | Ano | Carroceria | Portas');
  console.log('-'.repeat(60));

  familia.forEach(v => {
    console.log(`${v.marca} | ${v.modelo} | ${v.ano} | ${v.carroceria} | ${v.portas}`);
  });

  // Mostrar também os NÃO família
  const naoFamilia = await prisma.vehicle.findMany({
    where: { aptoFamilia: false },
    select: { marca: true, modelo: true, ano: true, carroceria: true },
  });

  console.log(`\n❌ NÃO família: ${naoFamilia.length}`);
  naoFamilia.forEach(v => {
    console.log(`${v.marca} ${v.modelo} ${v.ano} - ${v.carroceria}`);
  });

  await prisma.$disconnect();
}

checkFamilia();
