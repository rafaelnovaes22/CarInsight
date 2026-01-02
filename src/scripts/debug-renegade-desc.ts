
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRenegade() {
    const car = await prisma.vehicle.findFirst({
        where: {
            modelo: { contains: 'Renegade', mode: 'insensitive' },
            ano: 2020
        }
    });

    if (!car) {
        console.log('❌ Renegade 2020 not found in DB');
        return;
    }

    console.log(`\n🚙 Found: ${car.marca} ${car.modelo} (${car.ano})`);
    console.log(`💰 Price: R$ ${car.preco}`);
    console.log(`📝 Length: ${car.descricao?.length}`);
    console.log(`\n--- Description Start ---`);
    console.log(car.descricao?.substring(0, 300));
    console.log(`\n--- Analysis Check ---`);
    console.log(car.descricao?.includes('ANÁLISE DO ESPECIALISTA') ? '✅ Has Expert Analysis' : '❌ NO Expert Analysis');
}

checkRenegade();
