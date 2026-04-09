/**
 * Normaliza valores de carroceria no banco de dados
 * Uso: node tools/scripts/db/normalize-categories.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORY_MAP = {
  suv: 'SUV',
  sedan: 'Sedan',
  hatch: 'Hatch',
  picape: 'Picape',
  van: 'Minivan',
  minivan: 'Minivan',
  moto: 'Moto',
  perua: 'Perua',
};

async function main() {
  console.log('Normalizando categorias de carroceria...\n');

  let total = 0;

  for (const [from, to] of Object.entries(CATEGORY_MAP)) {
    const result = await prisma.vehicle.updateMany({
      where: { carroceria: from },
      data: { carroceria: to },
    });

    if (result.count > 0) {
      console.log(`  "${from}" → "${to}": ${result.count} veículo(s)`);
      total += result.count;
    }
  }

  console.log(`\nTotal normalizado: ${total} veículo(s)`);

  // Resumo final
  const byCategory = await prisma.vehicle.groupBy({
    by: ['carroceria'],
    where: { disponivel: true },
    _count: true,
    orderBy: { _count: { carroceria: 'desc' } },
  });

  console.log('\nDistribuição final:');
  byCategory.forEach(c => console.log(`  ${c.carroceria}: ${c._count}`));
}

main()
  .catch(err => {
    console.error('Erro:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
