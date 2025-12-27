import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const vehicles = await prisma.vehicle.findMany({
        orderBy: { preco: 'desc' }
    });

    console.log(`\n📊 Listagem Completa de Elegibilidade (${vehicles.length} veículos)\n`);
    console.log(`Critérios atuais:`);
    console.log(`- Família: SUV/Sedan/Minivan + Segurança (Ar/Dir/Airbag/ABS) + 4 portas`);
    console.log(`- Uber: Ano >= 2010, Preço 20k-100k, !Moto, !Outros, Flex/Gas/Diesel`);
    console.log(`- Black: Ano >= 2018, Preço 40k-200k, Sedan/SUV, Flex/Gas, Completo\n`);

    // Header
    console.log(`${'ID'.padEnd(3)} | ${'VEÍCULO'.padEnd(40)} | ${'CAT'.padEnd(8)} | ${'ANO'.padEnd(4)} | ${'PREÇO'.padEnd(10)} | ${'FAM'.padEnd(3)} | ${'UBER'.padEnd(4)} | ${'BLACK'.padEnd(5)}`);
    console.log('-'.repeat(100));

    vehicles.forEach((v, idx) => {
        const name = `${v.marca} ${v.modelo} ${v.versao}`.substring(0, 40);
        const cat = v.carroceria.substring(0, 8);
        const price = v.preco ? `R$ ${(v.preco / 1000).toFixed(1)}k` : 'N/A';

        const fam = v.aptoFamilia ? '✅' : '❌';
        const uber = v.aptoUber ? '✅' : '❌';
        const black = v.aptoUberBlack ? '✅' : '❌';

        console.log(`${(idx + 1).toString().padEnd(3)} | ${name.padEnd(40)} | ${cat.padEnd(8)} | ${v.ano.toString().padEnd(4)} | ${price.padEnd(10)} | ${fam.padEnd(3)} | ${uber.padEnd(4)} | ${black.padEnd(5)}`);
    });

    console.log('\n✅ Fim da lista.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
