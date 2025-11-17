import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

async function seedOnStart() {
  try {
    const count = await prisma.vehicle.count();
    
    if (count > 0) {
      logger.info(`✅ Database já tem ${count} veículos. Pulando seed.`);
      return;
    }

    logger.info('🌱 Populando banco de dados inicial...');

    // Seed básico com alguns veículos
    await prisma.vehicle.createMany({
      data: [
        {
          marca: 'Volkswagen',
          modelo: 'Fox',
          versao: '1.0',
          ano: 2016,
          km: 95000,
          preco: 38000,
          cor: 'Prata',
          carroceria: 'hatch',
          combustivel: 'Flex',
          cambio: 'Manual',
          arCondicionado: true,
          direcaoHidraulica: true,
          airbag: true,
          vidroEletrico: true,
          travaEletrica: true,
          disponivel: true,
        },
        {
          marca: 'Chevrolet',
          modelo: 'Onix',
          versao: '1.0 LT',
          ano: 2017,
          km: 78000,
          preco: 45000,
          cor: 'Branco',
          carroceria: 'hatch',
          combustivel: 'Flex',
          cambio: 'Manual',
          arCondicionado: true,
          direcaoHidraulica: true,
          airbag: true,
          abs: true,
          vidroEletrico: true,
          travaEletrica: true,
          disponivel: true,
        },
        {
          marca: 'Ford',
          modelo: 'Ka',
          versao: 'SE 1.0',
          ano: 2018,
          km: 42000,
          preco: 42000,
          cor: 'Vermelho',
          carroceria: 'hatch',
          combustivel: 'Flex',
          cambio: 'Manual',
          arCondicionado: true,
          direcaoHidraulica: true,
          airbag: true,
          abs: true,
          vidroEletrico: true,
          travaEletrica: true,
          alarme: true,
          disponivel: true,
        },
      ],
    });

    const newCount = await prisma.vehicle.count();
    logger.info(`✅ Seed completo! ${newCount} veículos no banco.`);
  } catch (error) {
    logger.error({ error }, '❌ Erro no seed inicial');
  }
}

seedOnStart();
