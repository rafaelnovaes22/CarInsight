import { inMemoryVectorStore } from './src/services/in-memory-vector.service';
import { vectorSearchService, VehicleSearchCriteria } from './src/services/vector-search.service';

async function test() {
  console.log('🧪 Testando busca vetorial...\n');

  // Initialize
  console.log('1️⃣ Inicializando vector store...');
  await inMemoryVectorStore.initialize();
  console.log(`✅ ${inMemoryVectorStore.getCount()} veículos indexados\n`);

  // Test 1: Carro econômico para cidade
  console.log('2️⃣ Teste: Carro econômico para cidade');
  const criteria1: VehicleSearchCriteria = {
    budget: 50000,
    usage: 'cidade',
    persons: 4,
    bodyType: 'sedan',
    year: 2015,
    mileage: 80000,
    brand: 'volkswagen',
  };

  const results1 = await vectorSearchService.searchVehicles(criteria1, 3);
  console.log(`\n📊 Encontrados ${results1.length} resultados:`);
  results1.forEach((v, i) => {
    console.log(`\n${i + 1}. ${v.brand} ${v.model} ${v.year}`);
    console.log(`   Match Score: ${v.matchScore}%`);
    console.log(`   Preço: R$ ${v.price.toLocaleString('pt-BR')}`);
    console.log(`   KM: ${v.mileage.toLocaleString('pt-BR')}`);
    console.log(`   Motivos: ${v.matchReasons.join(', ')}`);
  });

  console.log('\n✅ Teste completo!');
  process.exit(0);
}

test().catch(error => {
  console.error('❌ Erro:', error);
  process.exit(1);
});
