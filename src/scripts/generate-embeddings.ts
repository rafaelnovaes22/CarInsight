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
/**
 * Gera texto descritivo para o veículo (usado para criar embedding)
 * NOTE: Duplicated logic from InMemoryVectorStore (should be shared util)
 */
function buildVehicleDescription(vehicle: any): string {
  const parts = [
    vehicle.marca,
    vehicle.modelo,
    vehicle.versao || '',
    `ano ${vehicle.ano}`,
    `${vehicle.km.toLocaleString('pt-BR')}km`,
    vehicle.combustivel,
    vehicle.cambio,
    `cor ${vehicle.cor}`,
  ];

  const features: string[] = [];
  if (vehicle.arCondicionado) features.push('ar condicionado');
  if (vehicle.direcaoHidraulica) features.push('direção hidráulica');
  if (vehicle.airbag) features.push('airbag');
  if (vehicle.abs) features.push('abs');
  if (vehicle.vidroEletrico) features.push('vidro elétrico');
  if (vehicle.travaEletrica) features.push('trava elétrica');
  if (vehicle.alarme) features.push('alarme');
  if (vehicle.rodaLigaLeve) features.push('roda de liga leve');
  if (vehicle.som) features.push('som');

  if (features.length > 0) {
    parts.push(`equipamentos: ${features.join(', ')}`);
  }

  if (vehicle.descricao) {
    parts.push(vehicle.descricao);
  }

  if (vehicle.preco) {
    parts.push(`preço R$ ${vehicle.preco.toLocaleString('pt-BR')}`);
  }

  // --- DATA ENRICHMENT (Sync with InMemoryVectorStore) ---
  const criteria: string[] = [];
  const bodyType = vehicle.carroceria?.toLowerCase() || '';
  const version = vehicle.versao?.toLowerCase() || '';
  const model = vehicle.modelo?.toLowerCase() || '';
  const desc = vehicle.descricao?.toLowerCase() || '';

  // Criteria: Family / Space / Trip
  if (
    bodyType.includes('suv') ||
    bodyType.includes('utilitário') ||
    bodyType.includes('minivan') ||
    bodyType.includes('perua') ||
    desc.includes('7 lugares') ||
    model.includes('7 lugares')
  ) {
    criteria.push('ideal para família', 'espaçoso', 'porta-malas grande', 'conforto para viagem');
  }

  // Criteria: Comfort / Executive
  if (bodyType.includes('sedan') || bodyType.includes('sedã')) {
    criteria.push('conforto', 'porta-malas espaçoso', 'carro familiar', 'executivo');
  }

  // Criteria: Economy / City
  if (bodyType.includes('hatch')) {
    // Try to detect 1.0 engine
    const isOnePointZero = version.includes('1.0') || desc.includes('1.0') || model.includes('1.0');
    if (isOnePointZero) {
      criteria.push('econômico', 'carro urbano', 'bom para dia a dia', 'baixo consumo');
    } else {
      criteria.push('prático', 'compacto', 'ágil');
    }
  }

  // Criteria: Utility / Work
  if (bodyType.includes('picape') || bodyType.includes('pickup')) {
    criteria.push('picape', 'caminhonete', 'robusto', 'para trabalho', 'caçamba', 'off-road', 'transportar carga');
  }

  let finalDescription = parts.filter(p => p).join('. ');

  if (criteria.length > 0) {
    finalDescription += ` [Critérios: ${criteria.join(', ')}]`;
  }

  // Prepend Category for strong signal
  return `Categoria: ${vehicle.carroceria}. ${finalDescription}`;
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
        OR: [{ embedding: null }, { embedding: '' }],
      };

    const vehicles = await prisma.vehicle.findMany({
      where: whereClause,
    });

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
          await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: {
              embedding: embeddingToString(embedding),
              embeddingModel: EMBEDDING_MODEL,
              embeddingGeneratedAt: new Date(),
            },
          });

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
    const totalWithEmbeddings = await prisma.vehicle.count({
      where: {
        embedding: {
          not: null,
        },
      },
    });

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

    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        embedding: embeddingToString(embedding),
        embeddingModel: EMBEDDING_MODEL,
        embeddingGeneratedAt: new Date(),
      },
    });

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
    const withEmbeddings = await prisma.vehicle.count({
      where: {
        embedding: {
          not: null,
        },
      },
    });

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
