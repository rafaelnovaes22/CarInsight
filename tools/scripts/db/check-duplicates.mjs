/**
 * Verifica duplicatas e veículos sem externalId no banco
 * Uso: node tools/scripts/db/check-duplicates.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Veículos sem externalId (não rastreáveis pelo scraper)
  const noExternalId = await prisma.vehicle.findMany({
    where: { externalId: null, disponivel: true },
    select: { id: true, marca: true, modelo: true, ano: true, externalId: true },
  });

  console.log(`\nSem externalId (invisíveis ao sync): ${noExternalId.length}`);
  noExternalId.forEach(v => console.log(`  ${v.marca} ${v.modelo} ${v.ano}`));

  // Duplicatas por marca+modelo+ano
  const all = await prisma.vehicle.findMany({
    where: { disponivel: true },
    select: { id: true, marca: true, modelo: true, ano: true, externalId: true },
  });

  const groups = {};
  for (const v of all) {
    const key = `${v.marca}|${v.modelo}|${v.ano}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(v);
  }

  const duplicates = Object.entries(groups).filter(([, vs]) => vs.length > 1);
  console.log(`\nDuplicatas (mesmo marca+modelo+ano): ${duplicates.length} grupos`);
  duplicates.forEach(([key, vs]) => {
    const [marca, modelo, ano] = key.split('|');
    console.log(`  ${marca} ${modelo} ${ano}:`);
    vs.forEach(v => console.log(`    id=${v.id} externalId=${v.externalId ?? 'NULL'}`));
  });
}

main()
  .catch(err => {
    console.error('Erro:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
