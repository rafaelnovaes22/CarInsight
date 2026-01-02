
import { prisma } from './src/lib/prisma';

async function check() {
    const renegade = await prisma.vehicle.findFirst({
        where: { modelo: { contains: 'Renegade', mode: 'insensitive' } }
    });

    if (renegade) {
        console.log(`Model: ${renegade.modelo}`);
        console.log(`Description Length: ${renegade.descricao?.length}`);
        console.log(`Description Preview: ${renegade.descricao?.substring(0, 200)}...`);

        // Check if embedding exists
        console.log(`Embedding Present: ${!!renegade.embedding}`);
        if (renegade.embedding) {
            console.log(`Embedding Length: ${renegade.embedding.length}`);
        }
    } else {
        console.log('Renegade not found');
    }
}

check();
