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

function detectFeatures(version: string, category?: string) {
  const versionUpper = version.toUpperCase();

  let portas = 4;
  if (category === 'MOTO') {
    portas = 0;
  } else if (versionUpper.includes('2P') || versionUpper.includes('2 PORTAS')) {
    portas = 2;
  }

  const isMoto = category === 'MOTO';

  const features = {
    arCondicionado: !isMoto && !versionUpper.includes('BASE'),
    direcaoHidraulica: !isMoto, // Assumindo carros tem, motos não (simplificação)
    airbag: !isMoto,
    abs: !isMoto, // Motos tem ABS mas vamos deixar false por padrao seed antigo ou true se quiser
    vidroEletrico: !isMoto && !versionUpper.includes('BASE'),
    travaEletrica: !isMoto && !versionUpper.includes('BASE'),
    alarme: true,
    rodaLigaLeve: versionUpper.includes('LTZ') || versionUpper.includes('EX') || versionUpper.includes('LIMITED'),
    som: !isMoto,
    portas: portas
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

import { VehicleClassifierService } from '../src/services/vehicle-classifier.service';

function generateDescription(vehicle: RobustCarVehicle): string {
  const features = detectFeatures(vehicle.version);
  const transmission = detectTransmission(vehicle.version);

  let desc = `${vehicle.brand} ${vehicle.model} ${vehicle.version} ${vehicle.year}. `;
  desc += `${vehicle.fuel}, ${transmission}, ${vehicle.color.toLowerCase()}. `;
  desc += `${vehicle.mileage.toLocaleString('pt-BR')} km rodados. `;

  const featuresList: string[] = [];
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

  // Deletar recomendações primeiro (foreign key)
  await prisma.recommendation.deleteMany();
  console.log('✅ Recomendações deletadas');

  // Agora deletar veículos
  await prisma.vehicle.deleteMany();
  console.log('✅ Veículos deletados!\n');

  console.log('📝 Inserindo veículos da Robust Car...\n');

  let successCount = 0;
  let skipCount = 0;

  for (const vehicle of vehiclesData) {
    if (vehicle.price === null) {
      console.log(`⏭️  Pulando ${vehicle.brand} ${vehicle.model} (preço não disponível)`);
      skipCount++;
      continue;
    }

    // MOTO check removed to allow insertion

    try {
      const features = detectFeatures(vehicle.version, vehicle.category);
      const transmission = detectTransmission(vehicle.version);

      const vehicleInput = {
        model: vehicle.model,
        brand: vehicle.brand,
        year: vehicle.year,
        price: vehicle.price!,
        category: CATEGORY_TO_CARROCERIA[vehicle.category] || 'Outros',
        fuel: normalizeFuel(vehicle.fuel),
        transmission: transmission,
        features
      };

      // Validação via LLM (Assíncrona - pode demorar um pouco)
      const eligibility = await VehicleClassifierService.detectEligibilityWithLLM(vehicleInput);

      // Elegibilidade será definida via LLM posteriormente
      // Para evitar erros, inicializamos como false
      await prisma.vehicle.create({
        data: {
          marca: vehicle.brand,
          modelo: vehicle.model,
          versao: vehicle.version,
          ano: vehicle.year,
          km: vehicle.mileage,
          preco: vehicle.price,
          cor: vehicle.color,
          carroceria: vehicleInput.category,
          combustivel: vehicleInput.fuel,
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

          disponivel: true,
          aptoUber: eligibility.uberX || eligibility.uberComfort, // Se for X ou Comfort, marca como aptoUber (genérico)
          aptoUberBlack: eligibility.uberBlack,
          aptoFamilia: VehicleClassifierService.detectFamilyEligibility(vehicleInput),
          aptoTrabalho: VehicleClassifierService.detectWorkEligibility(vehicleInput)
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
