/**
 * Script para atualizar elegibilidade de veículos para Uber usando LLM
 *
 * VANTAGENS sobre whitelist estática:
 * - Se adapta automaticamente a novos modelos
 * - Critérios sempre atualizados (basta atualizar prompt)
 * - Não precisa manter lista manual de modelos
 * - Funciona com qualquer veículo do estoque
 */

import { PrismaClient } from '@prisma/client';
import { uberEligibilityValidator } from '../src/services/uber-eligibility-validator.service';

const prisma = new PrismaClient();

async function updateUberEligibilityWithLLM() {
  console.log('🚖 Atualizando elegibilidade Uber com LLM...\n');

  try {
    // 1. Buscar todos os veículos
    const vehicles = await prisma.vehicle.findMany();

    console.log(`📊 Total de veículos: ${vehicles.length}\n`);
    console.log('🤖 Validando com LLM (pode demorar alguns minutos)...\n');

    let uberXCount = 0;
    let uberComfortCount = 0;
    let uberBlackCount = 0;
    let familiaCount = 0;
    let trabalhoCount = 0;

    const eligibleVehicles: any[] = [];
    const rejectedVehicles: any[] = [];

    for (const vehicle of vehicles) {
      // Validar com LLM
      const eligibility = await uberEligibilityValidator.validateEligibility({
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        ano: vehicle.ano,
        carroceria: vehicle.carroceria,
        arCondicionado: vehicle.arCondicionado,
        portas: vehicle.portas,
        cambio: vehicle.cambio,
        cor: vehicle.cor,
      });

      // Economia de combustível (mantém lógica simples)
      let economiaCombustivel = 'media';
      if (vehicle.carroceria.toLowerCase().includes('hatch') || vehicle.km < 50000) {
        economiaCombustivel = 'alta';
      } else if (vehicle.carroceria.toLowerCase().includes('suv') || vehicle.km > 150000) {
        economiaCombustivel = 'baixa';
      }

      // Família (mantém lógica simples)
      const aptoFamilia =
        vehicle.portas >= 4 &&
        (vehicle.carroceria.toLowerCase().includes('suv') ||
          vehicle.carroceria.toLowerCase().includes('sedan') ||
          vehicle.carroceria.toLowerCase().includes('minivan'));

      // Trabalho (mantém lógica simples)
      const aptoTrabalho = economiaCombustivel !== 'baixa' && vehicle.arCondicionado === true;

      // Atualizar no banco
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          aptoUber: eligibility.uberX,
          aptoUberBlack: eligibility.uberBlack,
          economiaCombustivel,
          aptoFamilia,
          aptoTrabalho,
        },
      });

      // Contadores
      if (eligibility.uberX) uberXCount++;
      if (eligibility.uberBlack) uberBlackCount++;
      if (aptoFamilia) familiaCount++;
      if (aptoTrabalho) trabalhoCount++;

      // Log
      if (eligibility.uberX || eligibility.uberComfort || eligibility.uberBlack) {
        const categories = [];
        if (eligibility.uberX) categories.push('X');
        if (eligibility.uberComfort) categories.push('Comfort');
        if (eligibility.uberBlack) categories.push('Black');

        console.log(
          `✅ ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano} - [${categories.join(', ')}]`
        );
        console.log(`   ${eligibility.reasoning}`);
        console.log(`   Confiança: ${(eligibility.confidence * 100).toFixed(0)}%`);
        console.log();

        eligibleVehicles.push({
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          ano: vehicle.ano,
          preco: vehicle.preco,
          categories,
          confidence: eligibility.confidence,
        });
      } else {
        console.log(`❌ ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano} - Não apto`);
        console.log(`   ${eligibility.reasoning}`);
        console.log();

        rejectedVehicles.push({
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          ano: vehicle.ano,
          reason: eligibility.reasoning,
        });
      }
    }

    console.log('\n📊 RESUMO:');
    console.log(`🚖 Aptos Uber X / 99Pop: ${uberXCount} veículos`);
    console.log(`🚖 Aptos Uber Comfort/XL: ${uberComfortCount} veículos`);
    console.log(`🚖 Aptos Uber Black: ${uberBlackCount} veículos`);
    console.log(`👨‍👩‍👧‍👦 Recomendados para família: ${familiaCount} veículos`);
    console.log(`💼 Bons para trabalho: ${trabalhoCount} veículos`);
    console.log();

    // Top 5 por categoria
    if (eligibleVehicles.length > 0) {
      console.log('\n💡 TOP 5 MAIS BARATOS POR CATEGORIA:');

      const uberXVehicles = eligibleVehicles
        .filter(v => v.categories.includes('X'))
        .sort((a, b) => a.preco - b.preco)
        .slice(0, 5);

      if (uberXVehicles.length > 0) {
        console.log('\n🚖 Uber X:');
        uberXVehicles.forEach(v => {
          console.log(`   ${v.marca} ${v.modelo} ${v.ano} - R$ ${v.preco.toLocaleString('pt-BR')}`);
        });
      }

      const blackVehicles = eligibleVehicles
        .filter(v => v.categories.includes('Black'))
        .sort((a, b) => a.preco - b.preco)
        .slice(0, 5);

      if (blackVehicles.length > 0) {
        console.log('\n🎩 Uber Black:');
        blackVehicles.forEach(v => {
          console.log(`   ${v.marca} ${v.modelo} ${v.ano} - R$ ${v.preco.toLocaleString('pt-BR')}`);
        });
      }
    }

    // Veículos rejeitados
    if (rejectedVehicles.length > 0) {
      console.log('\n⚠️  VEÍCULOS NÃO APTOS (exemplos):');
      rejectedVehicles.slice(0, 3).forEach(v => {
        console.log(`   ❌ ${v.marca} ${v.modelo} ${v.ano}`);
        console.log(`      Motivo: ${v.reason.substring(0, 80)}...`);
      });
    }

    console.log('\n✅ Atualização concluída com sucesso!');
    console.log('🤖 Validação feita com LLM (sem whitelist estática)');
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateUberEligibilityWithLLM();
