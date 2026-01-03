/**
 * Script para classificar TODOS os veículos do banco usando LLM
 *
 * Marca os campos:
 * - aptoUber (Uber X / 99Pop)
 * - aptoUberBlack (Uber Black / 99Black)
 * - aptoFamilia (adequado para famílias)
 * - aptoTrabalho (adequado para trabalho diário)
 * - economiaCombustivel (baixa, media, alta)
 */

import { PrismaClient } from '@prisma/client';
import { VehicleClassifierService } from '../services/vehicle-classifier.service';

const prisma = new PrismaClient();

async function classifyAllVehicles() {
  console.log('🚗 Classificando TODOS os veículos do banco...\n');

  // Buscar todos os veículos disponíveis
  const vehicles = await prisma.vehicle.findMany({
    where: { disponivel: true },
  });

  console.log(`📊 Total de veículos a classificar: ${vehicles.length}\n`);

  let classified = 0;
  let errors = 0;

  for (const vehicle of vehicles) {
    try {
      console.log(`\n🔍 Classificando: ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}`);

      // Usar o VehicleClassifier para classificar (método estático)
      const classification = await VehicleClassifierService.classifyVehicle({
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        ano: vehicle.ano,
        carroceria: vehicle.carroceria,
        combustivel: vehicle.combustivel,
      });

      // Atualizar no banco
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          aptoUber: classification.aptoUber,
          aptoUberBlack: classification.aptoUberBlack,
          aptoFamilia: classification.aptoFamilia,
          aptoTrabalho: classification.aptoTrabalho,
          economiaCombustivel: 'media', // Pode ser melhorado com LLM também
        },
      });

      console.log(`  ✅ Classificado:`);
      console.log(`     - Uber X/99Pop: ${classification.aptoUber ? '✓' : '✗'}`);
      console.log(`     - Uber Black/99Black: ${classification.aptoUberBlack ? '✓' : '✗'}`);
      console.log(`     - Família: ${classification.aptoFamilia ? '✓' : '✗'}`);
      console.log(`     - Trabalho: ${classification.aptoTrabalho ? '✓' : '✗'}`);

      classified++;

      // Delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  ❌ Erro ao classificar ${vehicle.marca} ${vehicle.modelo}:`, error);
      errors++;
    }
  }

  console.log('\n\n📊 Resumo da Classificação:');
  console.log(`  ✅ Classificados: ${classified}`);
  console.log(`  ❌ Erros: ${errors}`);
  console.log(`  📈 Total: ${vehicles.length}`);

  // Estatísticas finais
  const stats = {
    aptoUber: await prisma.vehicle.count({ where: { aptoUber: true } }),
    aptoUberBlack: await prisma.vehicle.count({ where: { aptoUberBlack: true } }),
    aptoFamilia: await prisma.vehicle.count({ where: { aptoFamilia: true } }),
    aptoTrabalho: await prisma.vehicle.count({ where: { aptoTrabalho: true } }),
  };

  console.log('\n📈 Estatísticas Finais:');
  console.log(`  🚕 Aptos para Uber X/99Pop: ${stats.aptoUber}`);
  console.log(`  🚙 Aptos para Uber Black/99Black: ${stats.aptoUberBlack}`);
  console.log(`  👨‍👩‍👧‍👦 Aptos para Família: ${stats.aptoFamilia}`);
  console.log(`  💼 Aptos para Trabalho: ${stats.aptoTrabalho}`);

  console.log('\n✅ Classificação concluída!');
}

classifyAllVehicles()
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
