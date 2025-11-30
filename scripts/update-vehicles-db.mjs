/**
 * Atualiza o banco de dados com veículos validados
 * Uso: node scripts/update-vehicles-db.mjs
 * 
 * Prerequisito: Executar primeiro validate-and-scrape.mjs para gerar o JSON validado
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

// Mapeamento de categorias para campos aptos
const CATEGORY_FLAGS = {
  'SUV': { aptoFamilia: true, aptoTrabalho: false },
  'SEDAN': { aptoFamilia: true, aptoTrabalho: false },
  'HATCH': { aptoFamilia: false, aptoTrabalho: false },
  'PICKUP': { aptoFamilia: false, aptoTrabalho: true },
  'MINIVAN': { aptoFamilia: true, aptoTrabalho: false },
};

// Verificar se veículo é apto para Uber/Uber Black
function checkUberEligibility(vehicle) {
  const year = vehicle.year;
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - year;
  
  // Uber X: até 10 anos, sedan ou hatch médio
  const isUberXEligible = vehicleAge <= 10 && 
    (vehicle.category === 'SEDAN' || vehicle.category === 'HATCH');
  
  // Uber Black: até 5 anos, sedan executivo ou SUV premium
  const premiumBrands = ['BMW', 'MERCEDES', 'AUDI', 'LEXUS', 'VOLVO', 'JAGUAR'];
  const executiveModels = ['COROLLA', 'CIVIC', 'CRUZE', 'SENTRA', 'FUSION', 'JETTA'];
  
  const isPremiumBrand = premiumBrands.some(b => vehicle.brand.includes(b));
  const isExecutiveModel = executiveModels.some(m => vehicle.model.includes(m));
  
  const isUberBlackEligible = vehicleAge <= 5 && 
    (isPremiumBrand || isExecutiveModel || vehicle.category === 'SUV');
  
  return {
    aptoUber: isUberXEligible,
    aptoUberBlack: isUberBlackEligible
  };
}

async function updateDatabase() {
  console.log('═'.repeat(60));
  console.log('   ATUALIZANDO BANCO DE DADOS');
  console.log('═'.repeat(60) + '\n');
  
  // Carregar veículos validados
  const inputPath = './scripts/robustcar-vehicles-validated.json';
  
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Arquivo não encontrado: ${inputPath}`);
    console.log('   Execute primeiro: node scripts/validate-and-scrape.mjs');
    process.exit(1);
  }
  
  const vehicles = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  console.log(`📂 Carregados ${vehicles.length} veículos do JSON\n`);
  
  // Estatísticas
  let created = 0;
  let updated = 0;
  let errors = 0;
  
  for (const vehicle of vehicles) {
    try {
      const uber = checkUberEligibility(vehicle);
      const flags = CATEGORY_FLAGS[vehicle.category] || {};
      
      const vehicleData = {
        marca: vehicle.brand,
        modelo: vehicle.model,
        versao: vehicle.version || '',
        ano: vehicle.year,
        km: vehicle.mileage,
        combustivel: vehicle.fuel,
        cor: vehicle.color,
        preco: vehicle.price || 0,
        carroceria: vehicle.category,
        url: vehicle.detailUrl,
        disponivel: true,
        // Flags
        aptoUber: uber.aptoUber,
        aptoUberBlack: uber.aptoUberBlack,
        aptoFamilia: flags.aptoFamilia || false,
        aptoTrabalho: flags.aptoTrabalho || false,
        // Limpar embedding antigo para regenerar
        embedding: null,
        embeddingModel: null,
        embeddingGeneratedAt: null,
      };
      
      // Verificar se já existe pela URL
      const existing = await prisma.vehicle.findFirst({
        where: { url: vehicle.detailUrl }
      });
      
      if (existing) {
        await prisma.vehicle.update({
          where: { id: existing.id },
          data: vehicleData
        });
        updated++;
      } else {
        await prisma.vehicle.create({
          data: vehicleData
        });
        created++;
      }
      
      process.stdout.write(`\r   Processados: ${created + updated + errors}/${vehicles.length}`);
      
    } catch (error) {
      errors++;
      console.error(`\n❌ Erro: ${vehicle.brand} ${vehicle.model}: ${error.message}`);
    }
  }
  
  console.log('\n');
  console.log(`   ✅ Criados: ${created}`);
  console.log(`   📝 Atualizados: ${updated}`);
  console.log(`   ❌ Erros: ${errors}`);
  
  // Marcar veículos antigos como indisponíveis (URLs que não estão mais no scraping)
  const validUrls = vehicles.map(v => v.detailUrl);
  const outdatedResult = await prisma.vehicle.updateMany({
    where: {
      url: { notIn: validUrls },
      disponivel: true
    },
    data: { disponivel: false }
  });
  
  if (outdatedResult.count > 0) {
    console.log(`\n   🔄 ${outdatedResult.count} veículos marcados como indisponíveis (removidos do site)`);
  }
  
  // Resumo final
  const total = await prisma.vehicle.count({ where: { disponivel: true } });
  const byCategory = await prisma.vehicle.groupBy({
    by: ['carroceria'],
    where: { disponivel: true },
    _count: true
  });
  
  console.log('\n📊 Resumo do banco:');
  console.log(`   Total disponível: ${total} veículos`);
  byCategory.forEach(c => {
    console.log(`   ${c.carroceria || 'N/I'}: ${c._count}`);
  });
  
  console.log('\n' + '═'.repeat(60));
  console.log('   ✅ Banco de dados atualizado!');
  console.log('═'.repeat(60));
}

updateDatabase()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

