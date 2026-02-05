import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find all unique carroceria values
    const allTypes = await prisma.vehicle.groupBy({
        by: ['carroceria'],
        _count: { carroceria: true }
    });
    console.log('\n📊 Tipos de carroceria no banco:');
    console.log(JSON.stringify(allTypes, null, 2));

    // Find SUVs
    const suvs = await prisma.vehicle.findMany({
        where: {
            carroceria: { mode: 'insensitive', equals: 'SUV' }
        },
        select: { marca: true, modelo: true, carroceria: true, disponivel: true, preco: true }
    });
    console.log('\n🚙 SUVs encontrados:', suvs.length);
    console.log(JSON.stringify(suvs, null, 2));

    // Find total available
    const available = await prisma.vehicle.count({ where: { disponivel: true } });
    console.log('\n✅ Total veículos disponíveis:', available);

    await prisma.$disconnect();
}

main().catch(console.error);
