
import { prisma } from '../src/lib/prisma';

async function main() {
    const vehicles = await prisma.vehicle.findMany({
        where: {
            OR: [
                { modelo: { contains: 'Palio', mode: 'insensitive' } },
                { modelo: { contains: 'Celta', mode: 'insensitive' } },
                { preco: { lte: 35000 } }
            ]
        },
        select: {
            id: true,
            marca: true,
            modelo: true,
            ano: true,
            preco: true
        }
    });

    console.log(JSON.stringify(vehicles, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
