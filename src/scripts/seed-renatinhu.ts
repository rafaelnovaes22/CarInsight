import { PrismaClient } from '@prisma/client';
import { renatinhuVehicles } from './scrape-renatinhu';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with Renatinhu Cars vehicles...');

  // Clear existing data
  await prisma.message.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.event.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.vehicle.deleteMany();

  console.log('✅ Cleared existing data');

  // Create vehicles from Renatinhu's Cars
  for (const vehicle of renatinhuVehicles) {
    await prisma.vehicle.create({
      data: {
        ...vehicle,
        fotosUrls: vehicle.fotoUrl || '',
      },
    });
  }

  console.log(`✅ Created ${renatinhuVehicles.length} vehicles from Renatinhu's Cars`);

  const vehicleCount = await prisma.vehicle.count();
  console.log(`\n📊 Total vehicles in database: ${vehicleCount}`);

  // Show summary by brand
  const brands = await prisma.vehicle.groupBy({
    by: ['marca'],
    _count: {
      marca: true,
    },
    orderBy: {
      _count: {
        marca: 'desc',
      },
    },
  });

  console.log('\n📈 Vehicles by brand:');
  brands.forEach(brand => {
    console.log(`  ${brand.marca}: ${brand._count.marca} veículos`);
  });

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📍 Source: https://www.renatinhuscars.com.br/');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
