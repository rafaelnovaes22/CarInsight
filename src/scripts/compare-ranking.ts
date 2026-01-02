
import { inMemoryVectorStore } from '../services/in-memory-vector.service';
import { PrismaClient } from '@prisma/client';
import { rankRecommendations } from '../agents/vehicle-expert/processors/recommendation-ranker';
import { VehicleRecommendation, CustomerProfile } from '../types/state.types';

const prisma = new PrismaClient();
const store = inMemoryVectorStore;

async function compareRanking() {
    console.log('🔄 Initializing Store...');
    await store.initialize();

    // Wait for vectors
    let retries = 0;
    while (store.getCount() === 0 && retries < 15) {
        console.log(`⏳ Waiting for vectors... (${retries}/15)`);
        await new Promise(r => setTimeout(r, 1000));
        retries++;
    }

    console.log(`✅ Store ready with ${store.getCount()} vectors.`);

    const query = "viagem familia";
    const userProfile: Partial<CustomerProfile> = {
        budget: 90000,
        usoPrincipal: 'viagem',
        priorities: ['espaco', 'conforto', 'porta-malas'],
        people: 4
    };

    console.log(`\n🔎 Testing Goal: "viagem familia" (Budget: 90k, People: 4)`);

    // --- PHASE 1: CALCULATION (Vector Search) ---
    console.log(`\n🔹 PHASE 1: CALCULATION (Raw Semantic Score)`);
    // Get top 20 candidates
    const rawResults = await store.searchWithScores(query, 20);

    // Hydrate with DB data to create recommendations
    const candidates: VehicleRecommendation[] = [];

    for (const res of rawResults) {
        const vehicle = await prisma.vehicle.findUnique({ where: { id: res.vehicleId } });
        if (!vehicle) continue;

        // Filter by budget strictly for "Calculation" view, or keep widely? 
        // Adapters usually filter first. Let's filter by budget loosely (10% tolerance)
        if (vehicle.preco && vehicle.preco > 99000) continue;

        candidates.push({
            vehicleId: vehicle.id,
            matchScore: res.score * 100,
            // Map Portuguese (Prisma) to English (Ranker expected)
            vehicle: {
                brand: vehicle.marca,
                model: vehicle.modelo,
                year: vehicle.ano,
                price: vehicle.preco ?? 0,
                mileage: vehicle.km,
                bodyType: vehicle.carroceria,
                description: vehicle.descricao || ''
            },
            reasoning: 'Vector match',
            highlights: [],
            concerns: []
        });
    }

    // Show Top 5 Calculation
    candidates.slice(0, 5).forEach((rec, i) => {
        console.log(`${i + 1}. [${rec.matchScore.toFixed(1)}%] ${rec.vehicle.model} (${rec.vehicle.year}) - R$ ${rec.vehicle.price}`);
    });

    // --- PHASE 2: EXPERT (AI Reranking) ---
    console.log(`\n🔸 PHASE 2: EXPERT (AI Reasoning)`);
    console.log(`Reranking top ${candidates.length} candidates...`);

    const reranked = await rankRecommendations(candidates, userProfile, 5);

    // Show Top 5 Expert
    reranked.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec.vehicle.model} (${rec.vehicle.year}) - R$ ${rec.vehicle.price}`);
        console.log(`   💡 "${rec.reasoning}"`);
    });

    await prisma.$disconnect();
}

compareRanking();
