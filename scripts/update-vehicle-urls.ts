/**
 * Script para atualizar URLs dos veículos na Renatinhu's Cars
 * 
 * O padrão de URL é:
 * https://www.renatinhuscars.com.br/?veiculo={marca}+{modelo}+{versao}&id={id}
 * 
 * O ID está embutido no fotoUrl: 394_{id}_1-1.jpg
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE_URL = 'https://www.renatinhuscars.com.br/';

function extractVehicleIdFromFotoUrl(fotoUrl: string | null): string | null {
    if (!fotoUrl) return null;

    // Pattern: 394_{id}_1-1.jpg
    const match = fotoUrl.match(/394_(\d+)_/);
    return match ? match[1] : null;
}

function buildVehicleUrl(marca: string, modelo: string, versao: string, vehicleId: string): string {
    // Encode: BMW 125I 2.0 M SPORT 16V 4P -> BMW+125I+2.0+M+SPORT+16V+4P
    const veiculoName = `${marca} ${modelo} ${versao}`.trim().replace(/\s+/g, '+');
    return `${BASE_URL}?veiculo=${encodeURIComponent(veiculoName).replace(/%20/g, '+')}&id=${vehicleId}`;
}

async function main() {
    console.log('🔗 Atualizando URLs dos veículos...\n');

    const vehicles = await prisma.vehicle.findMany({
        select: {
            id: true,
            marca: true,
            modelo: true,
            versao: true,
            fotoUrl: true,
            url: true,
        }
    });

    console.log(`📊 Total de veículos: ${vehicles.length}\n`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const vehicle of vehicles) {
        const vehicleId = extractVehicleIdFromFotoUrl(vehicle.fotoUrl);

        if (!vehicleId) {
            console.log(`⚠️ Sem ID no fotoUrl: ${vehicle.marca} ${vehicle.modelo}`);
            failed++;
            continue;
        }

        const newUrl = buildVehicleUrl(vehicle.marca, vehicle.modelo, vehicle.versao || '', vehicleId);

        if (vehicle.url === newUrl) {
            skipped++;
            continue;
        }

        await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: { url: newUrl }
        });

        console.log(`✅ ${vehicle.marca} ${vehicle.modelo} -> id=${vehicleId}`);
        console.log(`   🔗 ${newUrl}\n`);
        updated++;
    }

    console.log('\n📊 Resumo:');
    console.log(`   ✅ Atualizados: ${updated}`);
    console.log(`   ⏭️ Já atualizados: ${skipped}`);
    console.log(`   ❌ Sem ID: ${failed}`);
    console.log(`   📊 Total: ${vehicles.length}`);

    await prisma.$disconnect();
}

main().catch(console.error);
