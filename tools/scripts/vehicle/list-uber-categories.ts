import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Listing all Uber categories...');

  const categories = await prisma.uberEligibleVehicleRule.findMany({
    select: {
      category: true,
      citySlug: true,
    },
    distinct: ['category', 'citySlug'],
  });

  console.log('Found categories:');
  console.table(categories);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
