import { PrismaClient } from '@prisma/client';
import { initChromaDB, getCollection, generateEmbedding, closeChromaDB } from '../lib/chromadb';

const prisma = new PrismaClient();

function buildVehicleDescription(vehicle: any): string {
  const parts = [
    `${vehicle.brand} ${vehicle.model} ${vehicle.version || ''}`,
    `ano ${vehicle.year}`,
    `${vehicle.mileage.toLocaleString('pt-BR')}km`,
    `${vehicle.fuelType}`,
    `${vehicle.transmission}`,
    `cor ${vehicle.color}`,
  ];

  if (vehicle.features && vehicle.features.length > 0) {
    parts.push(`equipamentos: ${vehicle.features.join(', ')}`);
  }

  if (vehicle.description) {
    parts.push(vehicle.description);
  }

  parts.push(`preço R$ ${vehicle.price.toLocaleString('pt-BR')}`);

  return parts.join('. ');
}

async function generateAndStoreEmbeddings() {
  console.log('🚀 Iniciando geração de embeddings...\n');

  try {
    await initChromaDB();

    const collection = getCollection();
    if (!collection) {
      throw new Error('❌ ChromaDB collection não disponível');
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { available: true },
    });

    console.log(`📊 Encontrados ${vehicles.length} veículos no banco\n`);

    if (vehicles.length === 0) {
      console.log('⚠️  Nenhum veículo encontrado. Execute o seed primeiro!');
      return;
    }

    const existingCount = await collection.count();
    if (existingCount > 0) {
      console.log(`🗑️  Removendo ${existingCount} embeddings antigos...`);
      const existingIds = (await collection.get()).ids;
      if (existingIds.length > 0) {
        await collection.delete({ ids: existingIds });
      }
      console.log('✅ Embeddings antigos removidos\n');
    }

    console.log('🔄 Gerando embeddings...\n');

    const ids: string[] = [];
    const embeddings: number[][] = [];
    const metadatas: any[] = [];
    const documents: string[] = [];

    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      const description = buildVehicleDescription(vehicle);

      console.log(`[${i + 1}/${vehicles.length}] ${vehicle.brand} ${vehicle.model}`);
      console.log(`   📝 "${description.substring(0, 100)}..."`);

      const embedding = await generateEmbedding(description);

      ids.push(vehicle.id);
      embeddings.push(embedding);
      documents.push(description);
      metadatas.push({
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year.toString(),
        price: vehicle.price.toString(),
        mileage: vehicle.mileage.toString(),
      });

      console.log(`   ✅ Embedding gerado (${embedding.length} dimensões)\n`);
    }

    console.log('💾 Salvando no ChromaDB...');

    await collection.add({
      ids,
      embeddings,
      metadatas,
      documents,
    });

    console.log(`\n✅ Sucesso! ${vehicles.length} veículos indexados no ChromaDB`);

    console.log('\n📊 Estatísticas:');
    console.log(`   - Total de veículos: ${vehicles.length}`);
    console.log(`   - Dimensões: ${embeddings[0]?.length || 0}`);
    console.log(`   - Collection: vehicles`);

    const testQuery = 'carro econômico para cidade';
    console.log(`\n🔍 Teste de busca: "${testQuery}"`);
    const queryEmbedding = await generateEmbedding(testQuery);
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: 3,
    });

    console.log('\n🎯 Top 3 resultados:');
    results.ids[0]?.forEach((id, idx) => {
      const vehicle = vehicles.find((v) => v.id === id);
      const distance = results.distances?.[0]?.[idx] || 0;
      const similarity = Math.round((1 - distance) * 100);
      console.log(`   ${idx + 1}. ${vehicle?.brand} ${vehicle?.model} (${similarity}% match)`);
    });

    console.log('\n✨ ChromaDB pronto para uso!');
  } catch (error) {
    console.error('\n❌ Erro:', error);
    throw error;
  } finally {
    await closeChromaDB();
    await prisma.$disconnect();
  }
}

generateAndStoreEmbeddings()
  .then(() => {
    console.log('\n🎉 Processo concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });
