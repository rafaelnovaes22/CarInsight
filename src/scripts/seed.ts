import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Dados de exemplo de 10 carros usados (depois o cliente fornece os 37 reais)
const vehiclesData = [
  {
    marca: 'Toyota',
    modelo: 'Corolla',
    versao: 'XEI 2.0',
    ano: 2019,
    km: 58000,
    preco: 68000,
    cor: 'Prata',
    carroceria: 'Sedan',
    combustivel: 'Flex',
    cambio: 'Automático',
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    descricao: 'Veículo em excelente estado, único dono, todas revisões em concessionária.',
  },
  {
    marca: 'Honda',
    modelo: 'Civic',
    versao: 'EX 2.0',
    ano: 2018,
    km: 72000,
    preco: 62000,
    cor: 'Preto',
    carroceria: 'Sedan',
    combustivel: 'Flex',
    cambio: 'Automático',
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    descricao: 'Completíssimo, todo original, IPVA 2024 pago.',
  },
  {
    marca: 'Chevrolet',
    modelo: 'Onix',
    versao: 'LT 1.0',
    ano: 2020,
    km: 42000,
    preco: 48000,
    cor: 'Branco',
    carroceria: 'Hatch',
    combustivel: 'Flex',
    cambio: 'Manual',
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    descricao: 'Econômico, ideal para cidade, baixa quilometragem.',
  },
  {
    marca: 'Volkswagen',
    modelo: 'Gol',
    versao: 'Trendline 1.0',
    ano: 2017,
    km: 95000,
    preco: 35000,
    cor: 'Vermelho',
    carroceria: 'Hatch',
    combustivel: 'Flex',
    cambio: 'Manual',
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: false,
    abs: false,
    descricao: 'Ótimo custo-benefício, manutenção em dia.',
  },
  {
    marca: 'Jeep',
    modelo: 'Renegade',
    versao: 'Sport 1.8',
    ano: 2019,
    km: 65000,
    preco: 78000,
    cor: 'Cinza',
    carroceria: 'SUV',
    combustivel: 'Flex',
    cambio: 'Automático',
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    descricao: 'SUV robusto, perfeito para viagens, muito espaço.',
  },
  {
    marca: 'Fiat',
    modelo: 'Toro',
    versao: 'Freedom 1.8',
    ano: 2018,
    km: 88000,
    preco: 72000,
    cor: 'Preto',
    carroceria: 'Picape',
    combustivel: 'Flex',
    cambio: 'Automático',
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    descricao: 'Picape versátil, cabine dupla, ideal para trabalho e lazer.',
  },
  {
    marca: 'Hyundai',
    modelo: 'HB20',
    versao: 'Comfort 1.0',
    ano: 2019,
    km: 52000,
    preco: 42000,
    cor: 'Azul',
    carroceria: 'Hatch',
    combustivel: 'Flex',
    cambio: 'Manual',
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    descricao: 'Compacto e econômico, perfeito para o dia a dia.',
  },
  {
    marca: 'Nissan',
    modelo: 'Kicks',
    versao: 'SV 1.6',
    ano: 2020,
    km: 38000,
    preco: 72000,
    cor: 'Laranja',
    carroceria: 'SUV',
    combustivel: 'Flex',
    cambio: 'CVT',
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    descricao: 'SUV moderno, baixa quilometragem, seminovo.',
  },
  {
    marca: 'Ford',
    modelo: 'Ka',
    versao: 'SE 1.0',
    ano: 2018,
    km: 68000,
    preco: 38000,
    cor: 'Branco',
    carroceria: 'Hatch',
    combustivel: 'Flex',
    cambio: 'Manual',
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    descricao: 'Compacto e ágil, fácil de estacionar.',
  },
  {
    marca: 'Renault',
    modelo: 'Duster',
    versao: 'Dynamique 1.6',
    ano: 2017,
    km: 102000,
    preco: 52000,
    cor: 'Cinza',
    carroceria: 'SUV',
    combustivel: 'Flex',
    cambio: 'Manual',
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    descricao: 'SUV robusto, ótimo para trilhas e viagens.',
  },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.message.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.event.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.vehicle.deleteMany();

  console.log('✅ Cleared existing data');

  // Create vehicles
  for (const vehicle of vehiclesData) {
    await prisma.vehicle.create({
      data: vehicle,
    });
  }

  console.log(`✅ Created ${vehiclesData.length} vehicles`);

  const vehicleCount = await prisma.vehicle.count();
  console.log(`\n📊 Total vehicles in database: ${vehicleCount}`);

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
