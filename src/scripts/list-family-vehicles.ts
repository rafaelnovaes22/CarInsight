
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listFamilyVehicles() {
    try {
        const vehicles = await prisma.vehicle.findMany({
            where: {
                aptoFamilia: true,
                disponivel: true, // Only show available vehicles
            },
            orderBy: {
                preco: 'asc',
            },
            select: {
                id: true,
                marca: true,
                modelo: true,
                ano: true,
                preco: true,
                km: true,
                carroceria: true,
            }
        });

        console.log(`\n🚙 Encontrados ${vehicles.length} veículos com perfil FAMÍLIA:\n`);

        vehicles.forEach((v, index) => {
            console.log(`${index + 1}. ${v.marca} ${v.modelo} ${v.ano}`);
            console.log(`   💰 R$ ${v.preco?.toLocaleString('pt-BR')}`);
            console.log(`   📏 ${v.km.toLocaleString('pt-BR')} km`);
            console.log(`   📦 ${v.carroceria}`);
            console.log('---');
        });

    } catch (error) {
        console.error('Erro ao listar veículos:', error);
    } finally {
        await prisma.$disconnect();
    }
}

listFamilyVehicles();
