import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCounts() {
  const total = await prisma.vehicle.count();
  const uberX = await prisma.vehicle.count({ where: { aptoUberX: true } });
  const uberComfort = await prisma.vehicle.count({ where: { aptoUberComfort: true } });
  const uberBlack = await prisma.vehicle.count({ where: { aptoUberBlack: true } });

  // Check aptoUber (legacy)
  const aptoUber = await prisma.vehicle.count({ where: { aptoUber: true } });

  console.log({
    total,
    uberX,
    uberComfort,
    uberBlack,
    aptoUber,
  });

  // List Uber Black vehicles
  const blackVehicles = await prisma.vehicle.findMany({
    where: { aptoUberBlack: true },
    select: { marca: true, modelo: true, ano: true, preco: true },
  });
  console.log('Black Vehicles:', blackVehicles);
}

checkCounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
