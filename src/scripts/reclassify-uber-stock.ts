
import { PrismaClient } from '@prisma/client';
import { uberEligibilityAgent } from '../services/uber-eligibility-agent.service';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Uber Stock Reclassification (Schema Adapted)...');

    const vehicles = await prisma.vehicle.findMany({
        where: { disponivel: true }
    });

    console.log(`📊 Found ${vehicles.length} available vehicles.`);

    let updatedCount = 0;
    let blackCount = 0;

    for (const vehicle of vehicles) {
        try {
            const eligibility = await uberEligibilityAgent.evaluate(
                {
                    marca: vehicle.marca,
                    modelo: vehicle.modelo,
                    ano: vehicle.ano,
                    carroceria: vehicle.carroceria,
                    portas: vehicle.portas,
                    arCondicionado: vehicle.arCondicionado,
                },
                'sao-paulo'
            );

            // Map strict eligibility to DB schema
            // DB has: aptoUber (General/X/Comfort) and aptoUberBlack (Black)
            const newAptoUber = eligibility.uberX || eligibility.uberComfort;
            const newAptoUberBlack = eligibility.uberBlack;

            const needsUpdate =
                vehicle.aptoUber !== newAptoUber ||
                vehicle.aptoUberBlack !== newAptoUberBlack;

            if (needsUpdate) {
                await prisma.vehicle.update({
                    where: { id: vehicle.id },
                    data: {
                        aptoUber: newAptoUber,
                        aptoUberBlack: newAptoUberBlack
                    }
                });
                updatedCount++;
                // console.log(`   Updated ${vehicle.modelo}: Uber=${newAptoUber}, Black=${newAptoUberBlack}`);
            }

            if (newAptoUberBlack) blackCount++;

        } catch (error: any) {
            console.error(`❌ Error on ${vehicle.id}:`, error.message);
        }
    }

    console.log('\n🏁 Reclassification Complete!');
    console.log(`📝 Updated Vehicles: ${updatedCount}`);
    console.log(`⚫ Final Uber Black Count: ${blackCount}`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
