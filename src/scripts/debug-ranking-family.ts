
import { inMemoryVectorStore } from '../services/in-memory-vector.service';
import { prisma } from '../lib/prisma';
import * as fs from 'fs';

async function debugRanking() {
    console.log('🔄 Inicializando Vector Store...');
    await inMemoryVectorStore.initialize();

    // Wait for initialization to complete
    process.stdout.write('⏳ Aguardando carregamento...');
    while (!inMemoryVectorStore.isInitialized()) {
        process.stdout.write('.');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\n✅ Vector Store pronto!');

    const query = "carro confortável para viagem em família";
    console.log(`\n🔍 Buscando scores para: "${query}"\n`);

    // Force loading all items to verify everything
    const allResults = await inMemoryVectorStore.searchWithScores(query, 100);

    // Get details from DB to show Names
    const vehicleIds = allResults.map(r => r.vehicleId);
    const vehicles = await prisma.vehicle.findMany({
        where: { id: { in: vehicleIds }, disponivel: true },
        select: { id: true, marca: true, modelo: true, ano: true, preco: true, carroceria: true }
    });

    const vehicleMap = new Map(vehicles.map(v => [v.id, v]));

    let output = `# Ranking Debug: "${query}"\n\n`;
    output += '📊 Ranking por SCORE SEMÂNTICO (O que a IA acha melhor):\n';
    output += '---------------------------------------------------------\n';

    let rank = 1;
    for (const res of allResults) {
        const v = vehicleMap.get(res.vehicleId);
        if (!v) continue; // Pode estar indisponível

        // Highlight Fiat Idea
        const isFocus = v.modelo.toLowerCase().includes('idea');
        const marker = isFocus ? '<<<< FIAT IDEA' : '';

        output += `#${rank} [Score: ${res.score.toFixed(4)}] ${v.marca} ${v.modelo} ${v.ano} - R$ ${v.preco?.toLocaleString('pt-BR')} ${marker}\n`;
        rank++;
    }

    // Use absolute path or relative to cwd
    fs.writeFileSync('debug_results.md', output, { encoding: 'utf8' });
    console.log('✅ Resultados salvos em debug_results.md');
}

debugRanking();
