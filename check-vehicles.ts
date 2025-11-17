import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVehicles() {
  const total = await prisma.vehicle.count();
  const disponivel = await prisma.vehicle.count({ where: { disponivel: true } });
  
  console.log(`\n📊 Veículos no banco:`);
  console.log(`   Total: ${total}`);
  console.log(`   Disponíveis: ${disponivel}`);
  console.log(`   Indisponíveis: ${total - disponivel}`);
  
  if (disponivel < total) {
    console.log(`\n⚠️  ${total - disponivel} veículos marcados como indisponíveis!`);
    
    const indisponiveis = await prisma.vehicle.findMany({
      where: { disponivel: false },
      select: { id: true, marca: true, modelo: true, ano: true }
    });
    
    console.log(`\n🚗 Veículos indisponíveis:`);
    indisponiveis.forEach((v, i) => {
      console.log(`   ${i + 1}. ${v.marca} ${v.modelo} ${v.ano}`);
    });
  }
  
  await prisma.$disconnect();
}

checkVehicles();
