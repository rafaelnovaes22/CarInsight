const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkVehicle() {
  try {
    // Buscar Jeep Compass
    const jeepCompass = await prisma.vehicle.findMany({
      where: {
        OR: [
          { marca: { contains: 'Jeep', mode: 'insensitive' } },
          { modelo: { contains: 'Compass', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        marca: true,
        modelo: true,
        ano: true,
        preco: true,
        disponivel: true,
      },
    });

    console.log('\n=== Veículos Jeep/Compass ===');
    if (jeepCompass.length === 0) {
      console.log('❌ Nenhum Jeep Compass encontrado no banco');
    } else {
      console.log(`✅ Encontrados ${jeepCompass.length} veículos:`);
      jeepCompass.forEach(v => {
        console.log(
          `   - ${v.marca} ${v.modelo} ${v.ano} - R$ ${v.preco} (${v.disponivel ? 'disponível' : 'indisponível'})`
        );
      });
    }

    // Listar todas as marcas disponíveis
    const marcas = await prisma.vehicle.groupBy({
      by: ['marca'],
      where: { disponivel: true },
      _count: true,
      orderBy: { _count: { marca: 'desc' } },
    });

    console.log('\n=== Marcas disponíveis ===');
    marcas.forEach(m => {
      console.log(`   - ${m.marca}: ${m._count} veículos`);
    });

    // Total de veículos
    const total = await prisma.vehicle.count({ where: { disponivel: true } });
    console.log(`\n📊 Total: ${total} veículos disponíveis\n`);
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkVehicle();
