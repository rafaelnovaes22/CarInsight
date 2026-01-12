
import { prisma } from '../lib/prisma';

async function main() {
    console.log('🔍 Checking raw vehicle structure...');

    const vehicle = await prisma.vehicle.findFirst();

    if (vehicle) {
        console.log('Keys found:', Object.keys(vehicle));
        console.log('aptoUberBlack value:', (vehicle as any).aptoUberBlack);
        console.log('apto_uber_black value:', (vehicle as any).apto_uber_black);
    } else {
        console.log('❌ No vehicles found.');
    }

    const blackEligible = await prisma.vehicle.count({
        where: {
            // Use 'any' type cast if typescript complains, but prisma client should work if generated correctly
            aptoUberBlack: true
        } as any
    });
    console.log('Count where aptoUberBlack=true:', blackEligible);
}

main().catch(console.error);
