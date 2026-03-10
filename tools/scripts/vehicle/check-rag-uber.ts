import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Querying UberEligibleVehicleRule...');

  const citySlug = 'sao-paulo';
  const category = 'Black';
  const modelsToCheck = ['renegade', 't-cross', 'duster', 'tracker', 'kicks', 'creta'];

  const rules = await prisma.uberEligibleVehicleRule.findMany({
    where: {
      citySlug,
      category, // Assuming the DB stores it as 'Black' or 'uberBlack' - checking both below if valid
    },
  });

  console.log(`Found ${rules.length} rules for ${category} in ${citySlug}`);

  // Also check 'uberBlack' just in case
  const rulesUberBlack = await prisma.uberEligibleVehicleRule.findMany({
    where: { citySlug, category: 'uberBlack' },
  });
  console.log(`Found ${rulesUberBlack.length} rules for uberBlack in ${citySlug}`);

  const allRules = [...rules, ...rulesUberBlack];

  console.log('\n--- Checking Suspicious Models ---');
  for (const model of modelsToCheck) {
    const found = allRules.filter(
      r => r.model.toLowerCase().includes(model) || model.includes(r.model.toLowerCase())
    );
    if (found.length > 0) {
      console.log(`[FOUND] ${model.toUpperCase()} is listed in RAG for Black:`);
      found.forEach(f => console.log(`   - ${f.brand} ${f.model} (Min Year: ${f.minYear})`));
    } else {
      console.log(`[NOT FOUND] ${model.toUpperCase()} is NOT in RAG for Black.`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
