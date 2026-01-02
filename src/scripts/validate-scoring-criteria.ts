import { vehicleSearchAdapter } from '../services/vehicle-search-adapter.service';
import { inMemoryVectorStore } from '../services/in-memory-vector.service';
import * as fs from 'fs';

async function runValidation() {
  const log = (msg: string) => {
    console.log(msg);
    fs.appendFileSync('scoring_validation_output.txt', msg + '\n');
  };

  // Clear previous log
  if (fs.existsSync('scoring_validation_output.txt')) {
    fs.unlinkSync('scoring_validation_output.txt');
  }

  log('🚀 Starting Scoring Criteria Validation...');
  await inMemoryVectorStore.initialize();

  // Wait for init
  while (!inMemoryVectorStore.isInitialized()) {
    await new Promise(r => setTimeout(r, 100));
  }

  const scenarios = [
    {
      criteria: 'Family (Família)',
      queries: ['carro para família', 'espaço para viagem', 'carro grande'],
      expectedTags: [
        'minivan',
        'suv',
        'sedan',
        '7 lugares',
        'idea',
        'spin',
        'doblo',
        'toro',
        'meriva',
      ],
    },
    {
      criteria: 'Economy (Economia)',
      queries: ['carro econômico', 'gasta pouco', 'carro pro dia a dia'],
      expectedTags: ['1.0', 'hatch', 'uno', 'mobi', 'up', 'ka', 'kwid', 'celta', 'palio'],
    },
    {
      criteria: 'Work (Trabalho)',
      queries: ['carro para trabalho', 'carro de firma', 'carregar peso', 'picape'],
      expectedTags: ['strada', 'saveiro', 'montana', 'fiorino', 'toro', 's10', 'hilux'],
    },
    {
      criteria: 'Comfort/Executive (Conforto)',
      queries: ['carro confortável', 'sedan executivo', 'viagem com conforto'],
      expectedTags: ['corolla', 'civic', 'cruze', 'sentra', 'fusion', 'azera', 'sedan'],
    },
  ];

  for (const scenario of scenarios) {
    log(`\n---------------------------------------------------`);
    log(`🧪 Testing Criteria: ${scenario.criteria}`);

    for (const query of scenario.queries) {
      log(`   🔎 Query: "${query}"`);
      const results = await vehicleSearchAdapter.search(query, { limit: 5 });

      if (results.length === 0) {
        log(`      ❌ No results found!`);
        continue;
      }

      const topResult = results[0];
      const top3 = results.slice(0, 3);

      // Validation Logic
      const isRelevant = (vehicle: any) => {
        const text = (
          vehicle.model +
          ' ' +
          vehicle.bodyType +
          ' ' +
          vehicle.description
        ).toLowerCase();
        return scenario.expectedTags.some(tag => text.includes(tag.toLowerCase()));
      };

      const top1Relevant = isRelevant(topResult.vehicle);
      const top3RelevanceCount = top3.filter(r => isRelevant(r.vehicle)).length;

      log(`      🏆 Top 1: [${topResult.vehicle.model}] Score: ${topResult.matchScore}`);
      log(`      📊 Top 3 Relevance: ${top3RelevanceCount}/3`);

      if (top1Relevant) {
        log(`      ✅ PASS: Top result matches criteria.`);
      } else {
        log(`      ⚠️ WARNING: Top result [${topResult.vehicle.model}] might not be optimal.`);
        log(`         Reasoning: ${topResult.reasoning}`);
      }

      // Log scores to check separation
      const scores = results.map(r => r.matchScore);
      const spread = Math.max(...scores) - Math.min(...scores);
      log(`      SC Spread: ${spread} (High: ${Math.max(...scores)}, Low: ${Math.min(...scores)})`);
    }
  }

  log('\n✅ Validation Complete.');
  process.exit(0);
}

runValidation();
