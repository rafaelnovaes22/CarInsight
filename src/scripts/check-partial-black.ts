
import { prisma } from '../lib/prisma';

async function main() {
    const blackCount = await prisma.vehicle.count({
        where: { aptoUberBlack: true }
    });
    console.log(`Current Uber Black Eligible Count: ${blackCount}`);

    if (blackCount > 0) {
        const examples = await prisma.vehicle.findMany({
            where: { aptoUberBlack: true },
            take: 3,
            select: { marca: true, modelo: true, ano: true }
        });
        console.log('Examples:', examples);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
