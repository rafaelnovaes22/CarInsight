/**
 * Desativa veículos sem externalId (registros legados, fora do scraper)
 * Uso: node tools/scripts/db/deactivate-legacy-vehicles.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.vehicle.updateMany({
    where: { externalId: null, disponivel: true },
    data: { disponivel: false },
  });

  console.log(`\nDesativados: ${result.count} veículo(s) legados`);

  const total = await prisma.vehicle.count({ where: { disponivel: true } });
  const byCategory = await prisma.vehicle.groupBy({
    by: ['carroceria'],
    where: { disponivel: true },
    _count: true,
    orderBy: { _count: { carroceria: 'desc' } },
  });

  console.log(`\nTotal disponível no banco: ${total}`);
  byCategory.forEach(c => console.log(`  ${c.carroceria}: ${c._count}`));
}

main()
  .catch(err => {
    console.error('Erro:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
