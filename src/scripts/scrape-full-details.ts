import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Dados completos extraídos manualmente do site Renatinhu's Cars
// Incluindo fotos adicionais e detalhes completos de cada veículo
// Data: 2025-11-14
// Source: https://www.renatinhuscars.com.br/

export const vehiclesFullDetails = [
  {
    id: 661,
    marca: 'BMW',
    modelo: '125I',
    versao: '2.0 M SPORT 16V',
    ano: 2014,
    km: 85840,
    preco: 85000,
    cor: 'Prata',
    carroceria: 'Hatch',
    combustivel: 'Gasolina',
    cambio: 'Automático',
    portas: 4,
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    vidroEletrico: true,
    travaEletrica: true,
    alarme: true,
    rodaLigaLeve: true,
    som: true,
    descricao:
      'BMW 125i M Sport, motor 2.0 turbo, acabamento premium, interior em couro, sistema de som premium, teto solar, faróis em LED. Veículo revisado e em excelente estado.',
    fotoUrl:
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_661_1-1.jpg',
    fotosUrls: [
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_661_1-1.jpg',
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_661_2-1.jpg',
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_661_3-1.jpg',
    ],
  },
  {
    id: 735,
    marca: 'BMW',
    modelo: 'X5',
    versao: '3.0 SI 4X4 24V',
    ano: 2010,
    km: 166952,
    preco: 75000,
    cor: 'Preto',
    carroceria: 'SUV',
    combustivel: 'Gasolina',
    cambio: 'Automático',
    portas: 4,
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    vidroEletrico: true,
    travaEletrica: true,
    alarme: true,
    rodaLigaLeve: true,
    som: true,
    descricao:
      'BMW X5 3.0, SUV 4x4, motor 3.0 6 cilindros, 7 lugares, teto solar panorâmico, bancos em couro, sistema multimídia completo. Potência e conforto.',
    fotoUrl:
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_735_1-1.jpg',
    fotosUrls: [
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_735_1-1.jpg',
    ],
  },
  {
    id: 760,
    marca: 'Chevrolet',
    modelo: 'Cobalt',
    versao: '1.8 MPFI LTZ 8V',
    ano: 2016,
    km: 193527,
    preco: 42000,
    cor: 'Preto',
    carroceria: 'Sedan',
    combustivel: 'Flex',
    cambio: 'Manual',
    portas: 4,
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    vidroEletrico: true,
    travaEletrica: true,
    alarme: true,
    rodaLigaLeve: true,
    som: true,
    descricao:
      'Cobalt LTZ completo, versão top de linha, computador de bordo, sensor de estacionamento, MyLink com bluetooth. Sedan espaçoso e econômico.',
    fotoUrl:
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_760_1-1.jpg',
    fotosUrls: [
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_760_1-1.jpg',
    ],
  },
  {
    id: 727,
    marca: 'Chevrolet',
    modelo: 'Onix',
    versao: '1.0 LS MT',
    ano: 2016,
    km: 158662,
    preco: 39000,
    cor: 'Vermelho',
    carroceria: 'Hatch',
    combustivel: 'Flex',
    cambio: 'Manual',
    portas: 4,
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    vidroEletrico: true,
    travaEletrica: true,
    alarme: false,
    rodaLigaLeve: false,
    som: true,
    descricao:
      'Onix LS 2016, compacto moderno e econômico, ideal para cidade. Baixo custo de manutenção.',
    fotoUrl:
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_727_1-1.jpg',
    fotosUrls: [
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_727_1-1.jpg',
    ],
  },
  {
    id: 715,
    marca: 'Honda',
    modelo: 'City',
    versao: '1.5 LX 16V',
    ano: 2016,
    km: 102971,
    preco: 52000,
    cor: 'Prata',
    carroceria: 'Sedan',
    combustivel: 'Flex',
    cambio: 'Automático',
    portas: 4,
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    vidroEletrico: true,
    travaEletrica: true,
    alarme: true,
    rodaLigaLeve: true,
    som: true,
    descricao:
      'Honda City LX automático, sedan médio com ótimo espaço interno, porta-malas amplo, central multimídia, câmbio CVT. Referência em conforto e economia.',
    fotoUrl:
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_715_1-1.jpg',
    fotosUrls: [
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_715_1-1.jpg',
    ],
  },
  {
    id: 754,
    marca: 'Honda',
    modelo: 'Civic',
    versao: '1.8 LXL 16V',
    ano: 2012,
    km: 187268,
    preco: 48000,
    cor: 'Prata',
    carroceria: 'Sedan',
    combustivel: 'Flex',
    cambio: 'Automático',
    portas: 4,
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    vidroEletrico: true,
    travaEletrica: true,
    alarme: true,
    rodaLigaLeve: true,
    som: true,
    descricao:
      'Honda Civic LXL 2012, sedan médio referência em qualidade, motor 1.8 econômico, banco de couro, câmbio automático suave. Durabilidade Honda.',
    fotoUrl:
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_754_1-1.jpg',
    fotosUrls: [
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_754_1-1.jpg',
    ],
  },
  {
    id: 679,
    marca: 'Renault',
    modelo: 'Captur',
    versao: '1.6 16V SCE INTENSE X-TRONIC',
    ano: 2019,
    km: 84550,
    preco: 68000,
    cor: 'Laranja',
    carroceria: 'SUV',
    combustivel: 'Flex',
    cambio: 'Automático',
    portas: 4,
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    vidroEletrico: true,
    travaEletrica: true,
    alarme: true,
    rodaLigaLeve: true,
    som: true,
    descricao:
      'Renault Captur Intense 2019, SUV moderno e estiloso, câmbio CVT, central multimídia com tela touchscreen, câmera de ré, sensores, teto solar.',
    fotoUrl:
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_679_1-1.jpg',
    fotosUrls: [
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_679_1-1.jpg',
    ],
  },
  {
    id: 725,
    marca: 'Renault',
    modelo: 'Duster',
    versao: '2.0 16V DYNAMIQUE',
    ano: 2016,
    km: 86814,
    preco: 58000,
    cor: 'Cinza',
    carroceria: 'SUV',
    combustivel: 'Flex',
    cambio: 'Automático',
    portas: 4,
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    vidroEletrico: true,
    travaEletrica: true,
    alarme: true,
    rodaLigaLeve: true,
    som: true,
    descricao:
      'Renault Duster Dynamique 2016, SUV robusto ideal para aventuras, alto torque, banco traseiro reclinável, porta-malas amplo. Ótimo custo-benefício.',
    fotoUrl:
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_725_1-1.jpg',
    fotosUrls: [
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_725_1-1.jpg',
    ],
  },
  {
    id: 757,
    marca: 'Toyota',
    modelo: 'Corolla',
    versao: '2.0 XEI 16V',
    ano: 2016,
    km: 121152,
    preco: 68000,
    cor: 'Prata',
    carroceria: 'Sedan',
    combustivel: 'Flex',
    cambio: 'Automático',
    portas: 4,
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    vidroEletrico: true,
    travaEletrica: true,
    alarme: true,
    rodaLigaLeve: true,
    som: true,
    descricao:
      'Toyota Corolla XEI 2016, referência em sedan médio, motor 2.0 potente e econômico, sistema multimídia completo, bancos em couro. Qualidade Toyota.',
    fotoUrl:
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_757_1-1.jpg',
    fotosUrls: [
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_757_1-1.jpg',
    ],
  },
  {
    id: 739,
    marca: 'Fiat',
    modelo: 'Uno',
    versao: '1.0 WAY 8V',
    ano: 2021,
    km: 72406,
    preco: 48000,
    cor: 'Branco',
    carroceria: 'Hatch',
    combustivel: 'Flex',
    cambio: 'Manual',
    portas: 4,
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    vidroEletrico: true,
    travaEletrica: true,
    alarme: true,
    rodaLigaLeve: true,
    som: true,
    descricao:
      'Fiat Uno Way 2021, modelo novo com baixa quilometragem, central multimídia com bluetooth, volante multifuncional. Moderno e econômico.',
    fotoUrl:
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_739_1-1.jpg',
    fotosUrls: [
      'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos/394_739_1-1.jpg',
    ],
  },
];

async function updateVehiclesWithFullDetails() {
  console.log('🔄 Updating vehicles with full details...');

  for (const vehicle of vehiclesFullDetails) {
    const existing = await prisma.vehicle.findFirst({
      where: {
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        ano: vehicle.ano,
      },
    });

    if (existing) {
      await prisma.vehicle.update({
        where: { id: existing.id },
        data: {
          versao: vehicle.versao,
          descricao: vehicle.descricao,
          fotosUrls: JSON.stringify(vehicle.fotosUrls),
          fotoUrl: vehicle.fotoUrl,
        },
      });
      console.log(`✅ Updated: ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}`);
    }
  }

  console.log('\n🎉 Full details update completed!');
}

// Execute if run directly
if (require.main === module) {
  updateVehiclesWithFullDetails()
    .catch(e => {
      console.error('❌ Update failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export default updateVehiclesWithFullDetails;
