/**
 * Script para atualizar elegibilidade de veículos com o novo VehicleClassifierService
 * 
 * Atualiza:
 * - Uber X / Black
 * - Família (Regra estrita)
 * - Carga (Utilitários)
 * - Uso Diário (Econômico + Ar)
 * - Entrega (Logística)
 */

import { PrismaClient } from '@prisma/client';
import { CategoryClassifierService } from '../src/services/category-classifier.service';
import { VehicleClassifierService } from '../src/services/vehicle-classifier.service';

const prisma = new PrismaClient();

async function updateVehicleClassification() {
  console.log('🔄 Iniciando reclassificação de veículos (via RAG/Neural)...\n');

  try {
    const vehicles = await prisma.vehicle.findMany();
    console.log(`📊 Total de veículos para analisar: ${vehicles.length}\n`);

    const stats = {
      uberX: 0,
      uberBlack: 0,
      familia: 0,
      carga: 0,
      usoDiario: 0,
      entrega: 0
    };

    for (const vehicle of vehicles) {
      // Classificar usando serviço RAG (CategoryClassifierService)
      // Adapting Prisma Vehicle to VehicleData interface if needed, but classifyAll handles it.
      const classification = await CategoryClassifierService.classifyAll(vehicle as any, 'sao-paulo');

      // Atualizar estatísticas
      if (classification.aptoUber) stats.uberX++;
      if (classification.aptoUberBlack) stats.uberBlack++;
      if (classification.aptoFamilia) stats.familia++;
      if (classification.aptoCarga) stats.carga++;
      if (classification.aptoUsoDiario) stats.usoDiario++;
      if (classification.aptoEntrega) stats.entrega++;

      // Persistir no banco
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          aptoUber: classification.aptoUber,
          aptoUberBlack: classification.aptoUberBlack,
          aptoFamilia: classification.aptoFamilia,
          aptoCarga: classification.aptoCarga,
          aptoUsoDiario: classification.aptoUsoDiario,
          aptoEntrega: classification.aptoEntrega,
          // Atualiza legado para ser a união das novas categorias de trabalho
          aptoTrabalho: classification.aptoCarga || classification.aptoUsoDiario,
          economiaCombustivel: VehicleClassifierService.classify(vehicle).economiaCombustivel
        }
      });

      // Log para veículos de Carga/Entrega (Novos)
      if (classification.aptoCarga) {
        console.log(`🚚 [CARGA] ${vehicle.marca} ${vehicle.modelo} (${vehicle.carroceria})`);
      }
    }

    console.log('\n✅ Atualização concluída com sucesso!');
    console.log('📊 RESUMO DE CLASSIFICAÇÃO:');
    console.log(`----------------------------------------`);
    console.log(`🚖 Uber X / 99Pop:      ${stats.uberX}`);
    console.log(`🚘 Uber Black:          ${stats.uberBlack}`);
    console.log(`👨‍👩‍👧‍👦 Família:             ${stats.familia}`);
    console.log(`🚚 Trabalho (Carga):    ${stats.carga}`);
    console.log(`💼 Trabalho (Dia a Dia):${stats.usoDiario}`);
    console.log(`📦 Apps de Entrega:     ${stats.entrega}`);
    console.log(`----------------------------------------\n`);

  } catch (error) {
    console.error('❌ Erro durante atualização:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateVehicleClassification();
