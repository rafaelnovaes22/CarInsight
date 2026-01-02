
import { inMemoryVectorStore } from '../services/in-memory-vector.service';
import { prisma } from '../lib/prisma';

async function debugDescriptions() {
    const vehicles = await prisma.vehicle.findMany({
        where: {
            OR: [
                { modelo: { contains: 'PUNTO' } },
                { modelo: { contains: 'TORO' } }
            ]
        }
    });

    console.log('--- Debugging Descriptions ---');
    for (const v of vehicles) {
        // Access private method logic via public instance if possible, or just copy logic?
        // Since buildVehicleDescription is private, I have to rely on the source code I see.
        // However, I can print the 'description' stored in InMemoryVectorStore if I access it? 
        // No, it's private.
        // I will replicate the logic here to see what it generates.

        const description = (inMemoryVectorStore as any).buildVehicleDescription(v);
        console.log(`\nVEHICLE: ${v.modelo} (${v.carroceria})`);
        console.log(`GENERATED DESC: ${description}`);
    }
}

debugDescriptions();
