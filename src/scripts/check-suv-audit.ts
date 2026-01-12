
import { prisma } from '../lib/prisma';

async function main() {
    console.log('🔍 auditing SUV eligibility for Uber Black...');

    // Explicitly fetch SUVs from 2016+ to be safe
    const suvs = await prisma.vehicle.findMany({
        where: {
            carroceria: { in: ['SUV', 'Suv', 'suv'] },
            ano: { gte: 2015 },
            disponivel: true
        },
        select: {
            marca: true,
            modelo: true,
            ano: true,
            cor: true,
            carroceria: true,
            aptoUberBlack: true,
            aptoUberComfort: true,
            aptoUberX: true
        }
    });

    console.log(`\n🚙 Found ${suvs.length} SUVs in stock (2015+):`);

    suvs.forEach(v => {
        console.log(`- ${v.marca} ${v.modelo} (${v.ano}) Cor: ${v.cor} -> Black: ${v.aptoUberBlack}, Comfort: ${v.aptoUberComfort}`);
    });

    // Also check "sedan" just in case
    const sedans = await prisma.vehicle.findMany({
        where: {
            carroceria: { contains: 'Sedan', mode: 'insensitive' },
            ano: { gte: 2015 },
            disponivel: true
        },
        select: {
            marca: true,
            modelo: true,
            ano: true,
            aptoUberBlack: true
        }
    });
    console.log(`\n🚗 Found ${sedans.length} Sedans in stock (2015+). Black eligible: ${sedans.filter(s => s.aptoUberBlack).length}`);
}

main().catch(console.error);
