const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUrls() {
  const vehicles = await prisma.vehicle.findMany({
    select: {
      id: true,
      marca: true,
      modelo: true,
      ano: true,
      url: true,
    },
    take: 10,
  });

  console.log('📊 Primeiros 10 veículos:\n');
  vehicles.forEach(v => {
    console.log(`${v.marca} ${v.modelo} ${v.ano}`);
    console.log(`  URL: ${v.url || '❌ SEM URL'}\n`);
  });

  const withUrl = vehicles.filter(v => v.url).length;
  const total = vehicles.length;
  console.log(`\n📈 ${withUrl}/${total} veículos com URL`);

  await prisma.$disconnect();
}

checkUrls();
