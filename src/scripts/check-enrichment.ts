import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEnrichment() {
  const vehicles = await prisma.vehicle.findMany({
    select: {
      id: true,
      marca: true,
      modelo: true,
      economiaCombustivel: true,
    },
    where: {
      economiaCombustivel: { not: null },
    },
    take: 10,
  });

  console.log('--- Enriched Vehicles ---');
  console.table(vehicles);
  console.log(`Total enriched found: ${vehicles.length}`);
}

checkEnrichment().finally(async () => {
  await prisma.$disconnect();
});
