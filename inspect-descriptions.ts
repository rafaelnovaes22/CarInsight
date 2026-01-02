import { prisma } from './src/lib/prisma';
import { inMemoryVectorStore } from './src/services/in-memory-vector.service';
import * as fs from 'fs';

async function inspect() {
    const targetIds = [
        'cc2ae990-6b82-495a-bcfd-e3a69dd0a5d8', // Ecosport (Winner)
        '03f3989e-2b52-41fa-8566-dc9aba2c4d76', // Renegade (Loser)
        'fc9e9939-28d3-4ee4-aa9c-5d361c97e3df', // Stonic (Loser)
        'a49a039d-d5aa-4fa7-9e18-c24db3c83872'  // HB20S (Sedan)
    ];

    const vehicles = await prisma.vehicle.findMany({
        where: { id: { in: targetIds } }
    });

    let output = '--- Description Inspection ---\\n';
    for (const v of vehicles) {
        // Reconstruct the string used for embedding (approximate, based on logic I know)
        // Actually, let's look at the stored embedding description if we can access it, 
        // but typically we can't easily reverse it. 
        // We'll rely on the DB fields that MAKE UP the description.

        output += `\\n[${v.modelo}] - R$ ${v.preco}\\n`;
        output += `Category: ${v.carroceria}\\n`;
        output += `Opcionais: ${v.opcionais || 'N/A'}\\n`;
        output += `Descricao (DB): ${v.descricao || 'N/A'}\\n`;

        // Simulate what buildVehicleDescription likely produces
        const simulated = `Veículo ${v.marca} ${v.modelo} ${v.ano} ${v.cor}. ${v.carroceria}. Preço R$ ${v.preco}. Quilometragem ${v.km} km. Combustível ${v.combustivel}. Câmbio ${v.cambio}. Detalhes: ${v.descricao || ''} ${v.opcionais || ''}`;
        output += `Simulated Embedding Input: "${simulated}"\\n`;
    }

    fs.writeFileSync('descriptions_report.txt', output);
    console.log('Saved to descriptions_report.txt');
}

inspect();
