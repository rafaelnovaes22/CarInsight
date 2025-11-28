/**
 * Script para atualizar elegibilidade de veículos para Uber/aplicativos
 * 
 * Critérios Uber X / 99Pop:
 * - Ano: 2012 ou mais recente
 * - Ar-condicionado: obrigatório
 * - Portas: 4 ou mais
 * - Carroceria: Sedan ou Hatch
 * 
 * Critérios Uber Black / 99TOP:
 * - Ano: 2018 ou mais recente
 * - Ar-condicionado: obrigatório
 * - Portas: 4
 * - Carroceria: Sedan
 * - Marca: Premium (Honda, Toyota, VW, Chevrolet, Fiat, Nissan, Ford, Hyundai)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateUberEligibility() {
  console.log('🚖 Atualizando elegibilidade Uber...\n');
  
  try {
    // 1. Buscar todos os veículos
    const vehicles = await prisma.vehicle.findMany();
    
    console.log(`📊 Total de veículos: ${vehicles.length}\n`);
    
    let uberXCount = 0;
    let uberBlackCount = 0;
    let familiaCount = 0;
    let trabalhoCount = 0;
    
    for (const vehicle of vehicles) {
      const updates: any = {};
      
      // Critérios Uber X / 99Pop
      const isUberX = 
        vehicle.ano >= 2012 &&
        vehicle.arCondicionado === true &&
        vehicle.portas >= 4 &&
        (vehicle.carroceria.toLowerCase().includes('sedan') || 
         vehicle.carroceria.toLowerCase().includes('hatch'));
      
      // Critérios Uber Black / 99TOP
      const isUberBlack = 
        vehicle.ano >= 2018 &&
        vehicle.arCondicionado === true &&
        vehicle.portas === 4 &&
        vehicle.carroceria.toLowerCase().includes('sedan') &&
        ['honda', 'toyota', 'volkswagen', 'chevrolet', 'nissan', 'ford', 'hyundai', 'fiat']
          .some(marca => vehicle.marca.toLowerCase().includes(marca));
      
      // Classificação de economia de combustível
      let economiaCombustivel = 'media';
      if (vehicle.carroceria.toLowerCase().includes('hatch') || vehicle.km < 50000) {
        economiaCombustivel = 'alta';
      } else if (vehicle.carroceria.toLowerCase().includes('suv') || vehicle.km > 150000) {
        economiaCombustivel = 'baixa';
      }
      
      // Recomendado para família
      const aptoFamilia = 
        vehicle.portas >= 4 &&
        (vehicle.carroceria.toLowerCase().includes('suv') ||
         vehicle.carroceria.toLowerCase().includes('sedan') ||
         vehicle.carroceria.toLowerCase().includes('minivan'));
      
      // Bom para trabalho
      const aptoTrabalho = 
        vehicle.economiaCombustivel !== 'baixa' &&
        vehicle.arCondicionado === true;
      
      updates.aptoUber = isUberX;
      updates.aptoUberBlack = isUberBlack;
      updates.economiaCombustivel = economiaCombustivel;
      updates.aptoFamilia = aptoFamilia;
      updates.aptoTrabalho = aptoTrabalho;
      
      // Atualizar veículo
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: updates
      });
      
      if (isUberX) uberXCount++;
      if (isUberBlack) uberBlackCount++;
      if (aptoFamilia) familiaCount++;
      if (aptoTrabalho) trabalhoCount++;
      
      // Log veículos aptos para Uber
      if (isUberX || isUberBlack) {
        const tags = [];
        if (isUberX) tags.push('Uber X');
        if (isUberBlack) tags.push('Uber Black');
        
        console.log(`✅ ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano} - ${tags.join(', ')}`);
        console.log(`   Preço: R$ ${vehicle.preco.toLocaleString('pt-BR')}`);
        console.log(`   Categoria: ${vehicle.carroceria}`);
        console.log(`   KM: ${vehicle.km.toLocaleString('pt-BR')}`);
        console.log();
      }
    }
    
    console.log('\n📊 RESUMO:');
    console.log(`🚖 Aptos Uber X / 99Pop: ${uberXCount} veículos`);
    console.log(`🚖 Aptos Uber Black / 99TOP: ${uberBlackCount} veículos`);
    console.log(`👨‍👩‍👧‍👦 Recomendados para família: ${familiaCount} veículos`);
    console.log(`💼 Bons para trabalho: ${trabalhoCount} veículos`);
    console.log();
    
    // Mostrar alguns exemplos de Uber
    console.log('\n💡 EXEMPLOS DE VEÍCULOS UBER:');
    
    const uberVehicles = await prisma.vehicle.findMany({
      where: { aptoUber: true },
      orderBy: { preco: 'asc' },
      take: 5
    });
    
    console.log('\n🚖 Top 5 mais baratos para Uber X:');
    for (const v of uberVehicles) {
      console.log(`   ${v.marca} ${v.modelo} ${v.ano} - R$ ${v.preco.toLocaleString('pt-BR')}`);
    }
    
    const blackVehicles = await prisma.vehicle.findMany({
      where: { aptoUberBlack: true },
      orderBy: { preco: 'asc' },
      take: 5
    });
    
    if (blackVehicles.length > 0) {
      console.log('\n🚖 Top 5 mais baratos para Uber Black:');
      for (const v of blackVehicles) {
        console.log(`   ${v.marca} ${v.modelo} ${v.ano} - R$ ${v.preco.toLocaleString('pt-BR')}`);
      }
    }
    
    console.log('\n✅ Atualização concluída!');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateUberEligibility();
