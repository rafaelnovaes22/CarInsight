/**
 * Valida URLs dos veículos já existentes no banco
 * Marca como indisponível os que têm URLs quebradas
 */

import { PrismaClient } from '@prisma/client';
import https from 'https';

const prisma = new PrismaClient();

const CONFIG = {
  batchSize: 10,
  delayBetweenBatches: 2000,
  requestTimeout: 10000,
};

async function checkUrl(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve({ valid: false, reason: 'URL vazia' });
      return;
    }
    
    const options = {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: CONFIG.requestTimeout
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const html = data.toLowerCase();
        
        // Status ruim
        if (res.statusCode === 404 || res.statusCode === 410) {
          resolve({ valid: false, reason: `HTTP ${res.statusCode}` });
          return;
        }
        
        // Indicadores de página inválida
        const isInvalid = 
          html.includes('página não encontrada') ||
          html.includes('veículo não disponível') ||
          html.includes('anúncio não encontrado') ||
          html.includes('vendido') ||
          html.includes('não existe') ||
          (html.length < 5000 && !html.includes('quilometragem'));
        
        if (isInvalid) {
          resolve({ valid: false, reason: 'Página inválida/vendido' });
          return;
        }
        
        resolve({ valid: true });
      });
    })
    .on('error', (err) => {
      resolve({ valid: false, reason: err.message });
    })
    .on('timeout', () => {
      resolve({ valid: false, reason: 'Timeout' });
    });
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function validateExistingVehicles() {
  console.log('═'.repeat(60));
  console.log('   VALIDANDO URLs DOS VEÍCULOS NO BANCO');
  console.log('═'.repeat(60) + '\n');
  
  // Buscar veículos disponíveis com URL
  const vehicles = await prisma.vehicle.findMany({
    where: { 
      disponivel: true,
      url: { not: null }
    },
    select: {
      id: true,
      marca: true,
      modelo: true,
      ano: true,
      url: true
    }
  });
  
  console.log(`📊 Total de veículos disponíveis: ${vehicles.length}\n`);
  
  if (vehicles.length === 0) {
    console.log('Nenhum veículo para validar.');
    return;
  }
  
  const invalidVehicles = [];
  let validCount = 0;
  let processed = 0;
  
  // Processar em batches
  for (let i = 0; i < vehicles.length; i += CONFIG.batchSize) {
    const batch = vehicles.slice(i, i + CONFIG.batchSize);
    
    const results = await Promise.all(
      batch.map(async (vehicle) => {
        const result = await checkUrl(vehicle.url);
        return { vehicle, result };
      })
    );
    
    for (const { vehicle, result } of results) {
      processed++;
      
      if (result.valid) {
        validCount++;
      } else {
        invalidVehicles.push({
          id: vehicle.id,
          name: `${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}`,
          url: vehicle.url,
          reason: result.reason
        });
      }
    }
    
    process.stdout.write(`\r   Validados: ${processed}/${vehicles.length} (${invalidVehicles.length} inválidos)`);
    
    if (i + CONFIG.batchSize < vehicles.length) {
      await sleep(CONFIG.delayBetweenBatches);
    }
  }
  
  console.log('\n\n📊 Resultado:');
  console.log(`   ✅ URLs válidas: ${validCount}`);
  console.log(`   ❌ URLs inválidas: ${invalidVehicles.length}`);
  
  if (invalidVehicles.length > 0) {
    console.log('\n🔧 Atualizando veículos inválidos...');
    
    const invalidIds = invalidVehicles.map(v => v.id);
    
    await prisma.vehicle.updateMany({
      where: { id: { in: invalidIds } },
      data: { disponivel: false }
    });
    
    console.log(`   ✅ ${invalidVehicles.length} veículos marcados como indisponíveis`);
    
    console.log('\n📋 Veículos com URLs inválidas:');
    invalidVehicles.slice(0, 15).forEach(v => {
      console.log(`   - ${v.name}`);
      console.log(`     URL: ${v.url}`);
      console.log(`     Motivo: ${v.reason}\n`);
    });
    
    if (invalidVehicles.length > 15) {
      console.log(`   ... e mais ${invalidVehicles.length - 15} veículos`);
    }
  }
  
  // Resumo final
  const finalCount = await prisma.vehicle.count({ where: { disponivel: true } });
  console.log(`\n📊 Total disponível após validação: ${finalCount} veículos`);
  
  console.log('\n' + '═'.repeat(60));
  console.log('   ✅ Validação concluída!');
  console.log('═'.repeat(60));
}

validateExistingVehicles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

