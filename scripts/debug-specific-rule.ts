
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DEBUG RENEGADE RULE ---');
    const rule = await prisma.uberEligibleVehicleRule.findFirst({
        where: {
            model: { contains: 'Renegade', mode: 'insensitive' },
            category: 'uberBlack'
        }
    });

    if (rule) {
        console.log('FOUND RULE:');
        console.log(JSON.stringify(rule, null, 2));
    } else {
        console.log('Renegade NOT found in Uber Black.');
    }
}

main();
