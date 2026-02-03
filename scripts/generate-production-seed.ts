
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function generateSeed() {
    console.log('🔄 Fetching classified vehicles from database...');

    // Fetch all vehicles with their calculated flags
    const vehicles = await prisma.vehicle.findMany({
        orderBy: { marca: 'asc' }
    });

    // Prepare the content for seed.ts
    const fileContent = `import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Dados REAIS e CLASSIFICADOS da Renatinhu's Cars
// Gerado automaticamente em ${new Date().toISOString()}
const vehiclesData = ${JSON.stringify(vehicles, null, 2)};

async function main() {
  console.log('🌱 Seeding database with PRODUCTION data...');

  // Clear existing data
  await prisma.message.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.event.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.vehicle.deleteMany();

  console.log('✅ Cleared existing data');

  // Create vehicles
  for (const vehicle of vehiclesData) {
    // Remove ID and creation dates to allow clean insertion
    const { id, createdAt, updatedAt, ...data } = vehicle as any;
    
    await prisma.vehicle.create({
      data: {
        ...data,
        // Ensure optional date fields are handled
        embeddingGeneratedAt: data.embeddingGeneratedAt ? new Date(data.embeddingGeneratedAt) : null,
        classifiedAt: data.classifiedAt ? new Date(data.classifiedAt) : null,
        fetchedAt: undefined // Only if part of UberEligible which is separate, but fetching on Vehicle might exist? No.
      }
    });
  }

  console.log(\`✅ Created \${vehiclesData.length} vehicles\`);

  const vehicleCount = await prisma.vehicle.count();
  console.log(\`\\n📊 Total vehicles in database: \${vehicleCount}\`);
  console.log('\\n🎉 Production seed completed successfully!');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
`;

    const outputPath = path.join(process.cwd(), 'src/scripts/seed.ts');
    fs.writeFileSync(outputPath, fileContent);
    console.log(`✅ Generated src/scripts/seed.ts with ${vehicles.length} vehicles.`);
}

generateSeed();
