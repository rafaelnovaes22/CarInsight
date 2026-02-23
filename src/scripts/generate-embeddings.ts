import { PrismaClient } from '@prisma/client';
import {
  generateEmbedding,
  embeddingToString,
  getEmbeddingStats,
  EMBEDDING_MODEL,
} from '../lib/embeddings';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

interface GenerateEmbeddingsOptions {
  forceRegenerate?: boolean;
  batchSize?: number;
  delayMs?: number;
}

/**
 * Gera texto descritivo para o veículo (usado para criar embedding)
 */
function buildVehicleDescription(vehicle: any): string {
  const parts = [
    vehicle.marca,
    vehicle.modelo,
    vehicle.versao || '',
    `${vehicle.ano}`,
    vehicle.carroceria,
    vehicle.combustivel,
    vehicle.cambio,
  ];

  const features: string[] = [];
  if (vehicle.arCondicionado) features.push('ar condicionado');
  if (vehicle.direcaoHidraulica) features.push('direção hidráulica');
  if (vehicle.airbag) features.push('airbag');
  if (vehicle.abs) features.push('ABS');
  if (vehicle.vidroEletrico) features.push('vidro elétrico');
  if (vehicle.travaEletrica) features.push('trava elétrica');
  if (vehicle.alarme) features.push('alarme');
  if (vehicle.rodaLigaLeve) features.push('roda de liga leve');
  if (vehicle.som) features.push('som');

  if (features.length > 0) {
    parts.push(`Equipamentos: ${features.join(', ')}`);
  }

  if (vehicle.descricao) {
    parts.push(vehicle.descricao);
  }

  return parts.filter(p => p).join(' ');
}

/**
 * Gera embeddings para todos os veículos no banco
 */
async function generateAllEmbeddings(options: GenerateEmbeddingsOptions = {}): Promise<void> {
  const { forceRegenerate = false, batchSize = 10, delayMs = 1000 } = options;

  try {
    console.log('\n🚀 Iniciando geração de embeddings...\n');

    // Buscar veículos
    const whereClause = forceRegenerate
      ? {}
      : {
          /* We'll filter the vehicles that need embeddings via raw query or fetching all and checking locally if Prisma can't filter Unsupported columns */
        };

    // Since Prisma can't easily filter Unsupported columns via Prisma Client natively in all versions,
    // we fetch IDs using raw SQL
    const missingEmbeddingsQuery = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Vehicle" 
      WHERE "embedding" IS NULL OR "disponivel" = true
    `;

    const vehiclesToProcess = forceRegenerate
      ? await prisma.vehicle.findMany()
      : await prisma.vehicle.findMany({
          where: { id: { in: missingEmbeddingsQuery.map(r => r.id) } },
        });

    // Filter to only missing embeddings if not forcing
    let vehicles = vehiclesToProcess;
    if (!forceRegenerate) {
      const missingIds = await prisma.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Vehicle" WHERE "embedding" IS NULL`;
      const missingIdSet = new Set(missingIds.map(r => r.id));
      vehicles = vehiclesToProcess.filter(v => missingIdSet.has(v.id));
    }

    if (vehicles.length === 0) {
      console.log('✅ Todos os veículos já possuem embeddings!');
      return;
    }

    console.log(`📊 Encontrados ${vehicles.length} veículos para processar\n`);

    let processed = 0;
    let errors = 0;

    // Processar em lotes
    for (let i = 0; i < vehicles.length; i += batchSize) {
      const batch = vehicles.slice(i, i + batchSize);
      console.log(
        `\n📦 Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(vehicles.length / batchSize)} (${batch.length} veículos)...`
      );

      for (const vehicle of batch) {
        try {
          const description = buildVehicleDescription(vehicle);

          console.log(
            `\n  🚗 ${vehicle.marca} ${vehicle.modelo} ${vehicle.versao || ''} (${vehicle.ano})`
          );
          console.log(`     📝 Descrição: "${description.substring(0, 100)}..."`);

          // Gerar embedding
          const embedding = await generateEmbedding(description);

          // Estatísticas do embedding
          const stats = getEmbeddingStats(embedding);
          console.log(`     📊 Dimensões: ${stats.dimensions}`);
          console.log(`     📊 Magnitude: ${stats.magnitude}`);

          // Salvar no banco
          const vectorString = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `
            UPDATE "Vehicle" 
            SET "embedding" = $1::vector, 
                "embeddingModel" = $2, 
                "embeddingGeneratedAt" = $3 
            WHERE id = $4
          `,
            vectorString,
            EMBEDDING_MODEL,
            new Date(),
            vehicle.id
          );

          processed++;
          console.log(`     ✅ Embedding salvo com sucesso!`);

          // Delay para evitar rate limit
          if (i + batch.indexOf(vehicle) + 1 < vehicles.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        } catch (error: any) {
          errors++;
          console.error(`     ❌ Erro ao processar ${vehicle.modelo}: ${error.message}`);
          logger.error({ vehicleId: vehicle.id, error: error.message }, 'Erro ao gerar embedding');
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DA GERAÇÃO DE EMBEDDINGS');
    console.log('='.repeat(60));
    console.log(`✅ Processados com sucesso: ${processed}`);
    console.log(`❌ Erros: ${errors}`);
    console.log(`📈 Taxa de sucesso: ${((processed / vehicles.length) * 100).toFixed(1)}%`);
    console.log('='.repeat(60) + '\n');

    // Verificação final
    const rawCount = await prisma.$queryRaw<
      { count: number }[]
    >`SELECT COUNT(*) as count FROM "Vehicle" WHERE "embedding" IS NOT NULL`;
    const totalWithEmbeddings = Number(rawCount[0].count);

    const totalVehicles = await prisma.vehicle.count();

    console.log(`🎯 Total de veículos com embeddings: ${totalWithEmbeddings}/${totalVehicles}`);

    if (totalWithEmbeddings === totalVehicles) {
      console.log('✅ Todos os veículos possuem embeddings!\n');
    } else {
      console.log(`⚠️  ${totalVehicles - totalWithEmbeddings} veículos ainda sem embeddings\n`);
    }
  } catch (error: any) {
    console.error('\n❌ Erro fatal:', error.message);
    logger.error({ error: error.message }, 'Erro fatal ao gerar embeddings');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Regenera embedding de um veículo específico
 */
async function regenerateVehicleEmbedding(vehicleId: string): Promise<void> {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error(`Veículo ${vehicleId} não encontrado`);
    }

    console.log(`\n🔄 Regenerando embedding para ${vehicle.marca} ${vehicle.modelo}...`);

    const description = buildVehicleDescription(vehicle);
    const embedding = await generateEmbedding(description);

    const vectorString = `[${embedding.join(',')}]`;
    await prisma.$executeRawUnsafe(
      `
      UPDATE "Vehicle" 
      SET "embedding" = $1::vector, 
          "embeddingModel" = $2, 
          "embeddingGeneratedAt" = $3 
      WHERE id = $4
    `,
      vectorString,
      EMBEDDING_MODEL,
      new Date(),
      vehicleId
    );

    console.log('✅ Embedding regenerado com sucesso!\n');
  } catch (error: any) {
    console.error(`❌ Erro: ${error.message}`);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Estatísticas de embeddings no banco
 */
async function showEmbeddingStats(): Promise<void> {
  try {
    const total = await prisma.vehicle.count();

    // Contagem via sql raw
    const rawQueryRes = await prisma.$queryRaw<
      { count: number }[]
    >`SELECT COUNT(*) as count FROM "Vehicle" WHERE "embedding" IS NOT NULL`;
    const withEmbeddings = Number(rawQueryRes[0].count);

    const byModel = await prisma.vehicle.groupBy({
      by: ['embeddingModel'],
      _count: true,
    });

    console.log('\n📊 ESTATÍSTICAS DE EMBEDDINGS');
    console.log('='.repeat(60));
    console.log(`Total de veículos: ${total}`);
    console.log(
      `Com embeddings: ${withEmbeddings} (${((withEmbeddings / total) * 100).toFixed(1)}%)`
    );
    console.log(`Sem embeddings: ${total - withEmbeddings}`);
    console.log('\nModelos de embedding:');
    byModel.forEach(group => {
      console.log(`  - ${group.embeddingModel || 'null'}: ${group._count} veículos`);
    });
    console.log('='.repeat(60) + '\n');
  } catch (error: any) {
    console.error(`❌ Erro: ${error.message}`);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI
const command = process.argv[2];
const arg = process.argv[3];

if (!command || command === 'help') {
  console.log(`
📝 USO:
  
  Gerar embeddings para todos os veículos:
    tsx src/scripts/generate-embeddings.ts generate
    
  Forçar regeneração de todos:
    tsx src/scripts/generate-embeddings.ts generate force
    
  Regenerar um veículo específico:
    tsx src/scripts/generate-embeddings.ts regenerate <vehicleId>
    
  Ver estatísticas:
    tsx src/scripts/generate-embeddings.ts stats

💡 DICA: Configure OPENAI_API_KEY no .env antes de executar
  `);
  process.exit(0);
}

(async () => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('\n❌ ERRO: OPENAI_API_KEY não configurada no .env\n');
      console.log('💡 Configure sua chave de API:');
      console.log('   1. Obtenha em: https://platform.openai.com/api-keys');
      console.log('   2. Adicione no .env: OPENAI_API_KEY=sk-...\n');
      process.exit(1);
    }

    switch (command) {
      case 'generate':
        await generateAllEmbeddings({
          forceRegenerate: arg === 'force',
          batchSize: 10,
          delayMs: 1000,
        });
        break;

      case 'regenerate':
        if (!arg) {
          console.error(
            '\n❌ Uso: tsx src/scripts/generate-embeddings.ts regenerate <vehicleId>\n'
          );
          process.exit(1);
        }
        await regenerateVehicleEmbedding(arg);
        break;

      case 'stats':
        await showEmbeddingStats();
        break;

      default:
        console.error(`\n❌ Comando desconhecido: ${command}\n`);
        console.log('Use "help" para ver os comandos disponíveis\n');
        process.exit(1);
    }

    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ Erro fatal: ${error.message}\n`);
    process.exit(1);
  }
})();
