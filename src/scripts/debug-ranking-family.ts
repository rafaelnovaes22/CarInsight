import { inMemoryVectorStore } from '../services/in-memory-vector.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const store = inMemoryVectorStore;

async function debugRanking() {
  console.log('🔄 Initializing Store...');
  await store.initialize();

  // Wait for vectors to be populated
  let retries = 0;
  while (store.getCount() === 0 && retries < 10) {
    console.log(`⏳ Waiting for vectors... (${retries}/10)`);
    await new Promise(r => setTimeout(r, 1000));
    retries++;
  }

  console.log(`✅ Store ready with ${store.getCount()} vectors.`);

  const query = 'viagem familia';
  const filters = { maxPrice: 90000 };

  console.log(`\n🔎 Searching for: "${query}" (Max Price: ${filters.maxPrice})`);

  // 1. Run Search with Scores (Limit 50 to get enough candidates to filter)
  const results = await store.searchWithScores(query, 50);

  console.log(`\n📊 Raw Semantic Scores (Top 20 filtered):`);

  let count = 0;
  // Fetch details for context
  for (const res of results) {
    if (count >= 20) break;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: res.vehicleId },
      select: { marca: true, modelo: true, ano: true, preco: true, descricao: true },
    });

    if (vehicle) {
      // Manual filter application
      if (filters.maxPrice && (vehicle.preco ?? 0) > filters.maxPrice) continue;

      console.log(
        `\n[Score: ${(res.score * 100).toFixed(1)}%] ${vehicle.marca} ${vehicle.modelo} (${vehicle.ano})`
      );
      console.log(`   💰 R$ ${vehicle.preco?.toLocaleString()}`);
      console.log(`   📝 Desc excerpt: ${vehicle.descricao?.substring(0, 100)}...`);
      count++;
    }
  }

  await prisma.$disconnect();
}

debugRanking();
