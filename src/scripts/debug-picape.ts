
import { vehicleSearchAdapter } from '../services/vehicle-search-adapter.service';
import { inMemoryVectorStore } from '../services/in-memory-vector.service';

async function debugPicape() {
    await inMemoryVectorStore.initialize();
    while (!inMemoryVectorStore.isInitialized()) {
        await new Promise(r => setTimeout(r, 100));
    }

    const queries = ['picape', 'caminhonete', 'caçamba', 'toro'];

    for (const q of queries) {
        console.log(`\n🔎 Searching for "${q}"...`);
        const results = await vehicleSearchAdapter.search(q, { limit: 10 });

        const toro = results.find(r => r.vehicle.model.toUpperCase().includes('TORO'));
        if (toro) {
            console.log(`   ✅ Toro rank: #${results.indexOf(toro) + 1} (Score: ${toro.matchScore})`);
        } else {
            console.log(`   ❌ Toro NOT found in top 10`);
        }

        console.log('   Top 3 Results:');
        results.slice(0, 3).forEach((r, i) => {
            console.log(`   #${i + 1} [${r.vehicle.model}] (${r.vehicle.bodyType}) Score: ${r.matchScore}`);
        });
    }
}

debugPicape();
