import { inMemoryVectorStore } from './src/services/in-memory-vector.service';
import { vectorSearchService, VehicleSearchCriteria } from './src/services/vector-search.service';

async function testVectorSearch() {
  console.log('🧪 Testando busca vetorial...\n');

  try {
    // Inicializar vector store
    console.log('1️⃣ Inicializando vector store...');
    await inMemoryVectorStore.initialize();
    console.log(`✅ ${inMemoryVectorStore.getCount()} veículos indexados\n`);

    // Teste 1: Busca por carro econômico
    console.log('2️⃣ Teste 1: Carro econômico para cidade');
    const criteria1: VehicleSearchCriteria = {
      budget: 50000,
      usage: 'cidade',
      persons: 4,
      essentialItems: ['ar condicionado', 'direção hidráulica'],
      year: 2015,
      mileage: 100000,
    };

    const results1 = await vectorSearchService.searchVehicles(criteria1, 3);
    console.log(`\n📊 Encontrados ${results1.length} veículos:\n`);
    
    results1.forEach((v, i) => {
      console.log(`${i + 1}. ${v.brand} ${v.model} ${v.year}`);
      console.log(`   💰 R$ ${v.price.toLocaleString('pt-BR')}`);
      console.log(`   🎯 Match: ${v.matchScore}%`);
      console.log(`   ✨ ${v.matchReasons.join(', ')}`);
      console.log('');
    });

    // Teste 2: Busca por SUV
    console.log('\n3️⃣ Teste 2: SUV para família');
    const criteria2: VehicleSearchCriteria = {
      budget: 80000,
      usage: 'viagem',
      persons: 5,
      bodyType: 'suv',
      year: 2018,
      mileage: 80000,
    };

    const results2 = await vectorSearchService.searchVehicles(criteria2, 3);
    console.log(`\n📊 Encontrados ${results2.length} veículos:\n`);
    
    results2.forEach((v, i) => {
      console.log(`${i + 1}. ${v.brand} ${v.model} ${v.year}`);
      console.log(`   💰 R$ ${v.price.toLocaleString('pt-BR')}`);
      console.log(`   🎯 Match: ${v.matchScore}%`);
      console.log(`   ✨ ${v.matchReasons.join(', ')}`);
      console.log('');
    });

    console.log('✅ Testes concluídos!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

testVectorSearch();
