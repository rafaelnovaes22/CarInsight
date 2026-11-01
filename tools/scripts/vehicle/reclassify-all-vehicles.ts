/**
 * Script para re-classificar veículos existentes usando prompts especializados por categoria
 *
 * Este script usa o novo CategoryClassifierService que faz chamadas LLM paralelas
 * com prompts específicos para cada categoria, evitando "task interference".
 *
 * Uso: npx ts-node scripts/reclassify-all-vehicles.ts [--dry-run] [--limit N]
 */

import { PrismaClient } from '@prisma/client';
import {
  CategoryClassifierService,
  FullClassificationResult,
} from '../src/services/category-classifier.service';

const prisma = new PrismaClient();

interface ReclassifyOptions {
  dryRun: boolean;
  limit: number | null;
}

function parseArgs(): ReclassifyOptions {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;

  return { dryRun, limit };
}

async function reclassifyAllVehicles() {
  const options = parseArgs();

  console.log('🚗 Reclassificando veículos com prompts especializados...\n');
  console.log(`   Modo: ${options.dryRun ? '🔍 DRY-RUN (sem salvar)' : '💾 PRODUÇÃO (salvando)'}`);
  if (options.limit) {
    console.log(`   Limite: ${options.limit} veículos`);
  }
  console.log('');

  try {
    const vehicles = await prisma.vehicle.findMany({
      take: options.limit || undefined,
      select: {
        id: true,
        marca: true,
        modelo: true,
        ano: true,
        carroceria: true,
        arCondicionado: true,
        portas: true,
        cambio: true,
        cor: true,
        combustivel: true,
        km: true,
        // Current classifications for comparison
        aptoFamilia: true,
        aptoUber: true,
        aptoUberBlack: true,
        aptoCarga: true,
        aptoUsoDiario: true,
        aptoEntrega: true,
      },
    });

    console.log(`📊 Total de veículos: ${vehicles.length}\n`);
    console.log('━'.repeat(80));

    const stats = {
      total: vehicles.length,
      processed: 0,
      errors: 0,
      changes: {
        familia: 0,
        uber: 0,
        uberBlack: 0,
        carga: 0,
        usoDiario: 0,
        entrega: 0,
        viagem: 0,
      },
    };

    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      const progress = `[${i + 1}/${vehicles.length}]`;

      console.log(`${progress} ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}`);

      try {
        // Classify using specialized prompts
        const result = await CategoryClassifierService.classifyAll(vehicle);

        // Check for changes
        const changes = detectChanges(vehicle, result);
        if (changes.length > 0) {
          console.log(`   📝 Mudanças: ${changes.join(', ')}`);
          changes.forEach(change => {
            const key = change.replace('apto', '').toLowerCase() as keyof typeof stats.changes;
            if (stats.changes[key] !== undefined) {
              stats.changes[key]++;
            }
          });
        } else {
          console.log('   ✅ Sem mudanças');
        }

        // Show reasoning summary
        console.log(
          `   💡 Família: ${result.aptoFamilia ? '✅' : '❌'} | Uber: ${result.aptoUber ? '✅' : '❌'} | Black: ${result.aptoUberBlack ? '✅' : '❌'} | Carga: ${result.aptoCarga ? '✅' : '❌'} | Diário: ${result.aptoUsoDiario ? '✅' : '❌'} | Entrega: ${result.aptoEntrega ? '✅' : '❌'} | Viagem: ${result.aptoViagem ? '✅' : '❌'}`
        );

        // Save if not dry-run
        if (!options.dryRun) {
          await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: {
              aptoFamilia: result.aptoFamilia,
              aptoUber: result.aptoUber,
              aptoUberBlack: result.aptoUberBlack,
              aptoCarga: result.aptoCarga,
              aptoUsoDiario: result.aptoUsoDiario,
              aptoEntrega: result.aptoEntrega,
              aptoViagem: result.aptoViagem,
            },
          });
        }

        stats.processed++;
      } catch (error) {
        console.log(`   ❌ ERRO: ${(error as Error).message}`);
        stats.errors++;
      }

      console.log('');
    }

    // Final stats
    console.log('━'.repeat(80));
    console.log('\n📊 RESUMO FINAL:');
    console.log('━'.repeat(40));
    console.log(`✅ Processados: ${stats.processed}/${stats.total}`);
    console.log(`❌ Erros: ${stats.errors}`);
    console.log('\n🔄 Mudanças por categoria:');
    console.log(`   👨‍👩‍👧‍👦 Família: ${stats.changes.familia}`);
    console.log(`   🚖 Uber: ${stats.changes.uber}`);
    console.log(`   🎩 Uber Black: ${stats.changes.uberBlack}`);
    console.log(`   📦 Carga: ${stats.changes.carga}`);
    console.log(`   🏙️ Uso Diário: ${stats.changes.usoDiario}`);
    console.log(`   📬 Entrega: ${stats.changes.entrega}`);
    console.log(`   🛣️ Viagem: ${stats.changes.viagem}`);
    console.log('━'.repeat(40));

    if (options.dryRun) {
      console.log('\n⚠️ MODO DRY-RUN: Nenhuma alteração foi salva no banco.');
      console.log('   Execute sem --dry-run para salvar as alterações.');
    } else {
      console.log('\n✅ Classificação completa! Alterações salvas no banco.');
    }
  } catch (error) {
    console.error('❌ Erro fatal:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function detectChanges(
  current: {
    aptoFamilia: boolean;
    aptoUber: boolean;
    aptoUberBlack: boolean;
    aptoCarga: boolean;
    aptoUsoDiario: boolean;
    aptoEntrega: boolean;
  },
  newResult: FullClassificationResult
): string[] {
  const changes: string[] = [];

  if (current.aptoFamilia !== newResult.aptoFamilia) {
    changes.push(`aptoFamilia: ${current.aptoFamilia} → ${newResult.aptoFamilia}`);
  }
  if (current.aptoUber !== newResult.aptoUber) {
    changes.push(`aptoUber: ${current.aptoUber} → ${newResult.aptoUber}`);
  }
  if (current.aptoUberBlack !== newResult.aptoUberBlack) {
    changes.push(`aptoUberBlack: ${current.aptoUberBlack} → ${newResult.aptoUberBlack}`);
  }
  if (current.aptoCarga !== newResult.aptoCarga) {
    changes.push(`aptoCarga: ${current.aptoCarga} → ${newResult.aptoCarga}`);
  }
  if (current.aptoUsoDiario !== newResult.aptoUsoDiario) {
    changes.push(`aptoUsoDiario: ${current.aptoUsoDiario} → ${newResult.aptoUsoDiario}`);
  }
  if (current.aptoEntrega !== newResult.aptoEntrega) {
    changes.push(`aptoEntrega: ${current.aptoEntrega} → ${newResult.aptoEntrega}`);
  }
  // aptoViagem is new, always counts as change if true
  if (newResult.aptoViagem) {
    changes.push(`aptoViagem: NEW → ${newResult.aptoViagem}`);
  }

  return changes;
}

reclassifyAllVehicles();
