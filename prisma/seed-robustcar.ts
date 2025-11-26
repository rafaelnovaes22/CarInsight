import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface RobustCarVehicle {
  brand: string;
  model: string;
  version: string;
  year: number;
  mileage: number;
  fuel: string;
  color: string;
  price: number | null;
  detailUrl: string;
  category: string;
}

const CATEGORY_TO_CARROCERIA: Record<string, string> = {
  'SUV': 'SUV',
  'SEDAN': 'Sedan',
  'HATCH': 'Hatchback',
  'PICKUP': 'Picape',
  'MINIVAN': 'Minivan',
  'MOTO': 'Moto',
  'OUTROS': 'Outros'
};

function detectTransmission(version: string): string {
  const versionUpper = version.toUpperCase();
  if (versionUpper.includes('AUT') || versionUpper.includes('AUTOMATICO') || versionUpper.includes('CVT')) {
    return 'Automático';
  }
  return 'Manual';
}

function detectFeatures(version: string) {
  const versionUpper = version.toUpperCase();
  
  const features = {
    arCondicionado: !versionUpper.includes('BASE'),
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    vidroEletrico: !versionUpper.includes('BASE'),
    travaEletrica: !versionUpper.includes('BASE'),
    alarme: true,
    rodaLigaLeve: versionUpper.includes('LTZ') || versionUpper.includes('EX') || versionUpper.includes('LIMITED'),
    som: true,
    portas: 4
  };
  
  return features;
}

function normalizeFuel(fuel: string): string {
  const fuelMap: Record<string, string> = {
    'FLEX': 'Flex',
    'DIESEL': 'Diesel',
    'HÍBRIDO': 'Híbrido',
    'ELÉTRICO': 'Elétrico',
    'GASOLINA': 'Gasolina'
  };
  
  return fuelMap[fuel] || 'Flex';
}

function generateDescription(vehicle: RobustCarVehicle): string {
  const features = detectFeatures(vehicle.version);
  const transmission = detectTransmission(vehicle.version);
  
  let desc = `${vehicle.brand} ${vehicle.model} ${vehicle.version} ${vehicle.year}. `;
  desc += `${vehicle.fuel}, ${transmission}, ${vehicle.color.toLowerCase()}. `;
  desc += `${vehicle.mileage.toLocaleString('pt-BR')} km rodados. `;
  
  const featuresList = [];
  if (features.arCondicionado) featuresList.push('Ar-condicionado');
  if (features.direcaoHidraulica) featuresList.push('Direção hidráulica');
  if (features.airbag) featuresList.push('Airbag');
  if (features.abs) featuresList.push('Freios ABS');
  if (features.vidroEletrico) featuresList.push('Vidros elétricos');
  if (features.travaEletrica) featuresList.push('Travas elétricas');
  
  if (featuresList.length > 0) {
    desc += `Equipado com: ${featuresList.join(', ')}. `;
  }
  
  desc += `Veículo em ótimo estado de conservação.`;
  
  return desc;
}

async function main() {
  console.log('🚀 Iniciando seed da Robust Car...\n');
  
  // Tentar múltiplos caminhos possíveis
  const possiblePaths = [
    join(process.cwd(), 'scripts', 'robustcar-vehicles.json'),
    join(__dirname, '..', 'scripts', 'robustcar-vehicles.json'),
    join(process.cwd(), '..', 'scripts', 'robustcar-vehicles.json'),
  ];
  
  let jsonPath: string | null = null;
  for (const path of possiblePaths) {
    try {
      if (readFileSync(path, 'utf-8')) {
        jsonPath = path;
        console.log(`✅ Arquivo encontrado: ${path}`);
        break;
      }
    } catch (e) {
      console.log(`⏭️  Tentando: ${path} - não encontrado`);
    }
  }
  
  if (!jsonPath) {
    throw new Error('❌ Arquivo robustcar-vehicles.json não encontrado em nenhum caminho possível');
  }
  
  const vehiclesData: RobustCarVehicle[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  
  console.log(`📦 Carregados ${vehiclesData.length} veículos do JSON\n`);
  
  console.log('🗑️  Limpando base de dados atual...');
  await prisma.vehicle.deleteMany();
  console.log('✅ Base limpa!\n');
  
  console.log('📝 Inserindo veículos da Robust Car...\n');
  
  let successCount = 0;
  let skipCount = 0;
  
  for (const vehicle of vehiclesData) {
    if (vehicle.price === null) {
      console.log(`⏭️  Pulando ${vehicle.brand} ${vehicle.model} (preço não disponível)`);
      skipCount++;
      continue;
    }
    
    if (vehicle.category === 'MOTO') {
      console.log(`⏭️  Pulando ${vehicle.brand} ${vehicle.model} (categoria MOTO)`);
      skipCount++;
      continue;
    }
    
    try {
      const features = detectFeatures(vehicle.version);
      const transmission = detectTransmission(vehicle.version);
      
      await prisma.vehicle.create({
        data: {
          marca: vehicle.brand,
          modelo: vehicle.model,
          versao: vehicle.version,
          ano: vehicle.year,
          km: vehicle.mileage,
          preco: vehicle.price,
          cor: vehicle.color,
          carroceria: CATEGORY_TO_CARROCERIA[vehicle.category] || 'Outros',
          combustivel: normalizeFuel(vehicle.fuel),
          cambio: transmission,
          
          arCondicionado: features.arCondicionado,
          direcaoHidraulica: features.direcaoHidraulica,
          airbag: features.airbag,
          abs: features.abs,
          vidroEletrico: features.vidroEletrico,
          travaEletrica: features.travaEletrica,
          alarme: features.alarme,
          rodaLigaLeve: features.rodaLigaLeve,
          som: features.som,
          portas: features.portas,
          
          url: vehicle.detailUrl,
          fotoUrl: vehicle.detailUrl,
          fotosUrls: JSON.stringify([vehicle.detailUrl]),
          
          descricao: generateDescription(vehicle),
          
          disponivel: true
        }
      });
      
      successCount++;
      console.log(`✅ ${successCount}. ${vehicle.brand} ${vehicle.model} ${vehicle.year} - R$ ${vehicle.price.toLocaleString('pt-BR')}`);
    } catch (error) {
      console.error(`❌ Erro ao inserir ${vehicle.brand} ${vehicle.model}:`, error);
    }
  }
  
  console.log('\n📊 Resumo:');
  console.log(`   ✅ Inseridos: ${successCount}`);
  console.log(`   ⏭️  Pulados: ${skipCount}`);
  console.log(`   📦 Total: ${vehiclesData.length}`);
  
  const categoryCounts = await prisma.vehicle.groupBy({
    by: ['carroceria'],
    _count: true
  });
  
  console.log('\n🚗 Veículos por categoria:');
  categoryCounts.forEach(({ carroceria, _count }) => {
    console.log(`   ${carroceria}: ${_count}`);
  });
  
  console.log('\n✅ Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
