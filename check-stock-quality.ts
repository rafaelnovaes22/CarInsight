import { prisma } from './src/lib/prisma';
import { inMemoryVectorStore } from './src/services/in-memory-vector.service';
import * as fs from 'fs';

async function checkStock() {
    let output = '🔍 Checking stock for Family SUVs/Sedans around 90k...\n';

    // 1. Check raw DB stock
    const vehicles = await prisma.vehicle.findMany({
        where: {
            disponivel: true,
            preco: {
                gte: 60000,
                lte: 95000
            },
            OR: [
                { carroceria: { contains: 'suv', mode: 'insensitive' } },
                { carroceria: { contains: 'sedan', mode: 'insensitive' } },
                { carroceria: { contains: 'minivan', mode: 'insensitive' } }
            ]
        },
        orderBy: { preco: 'desc' }
    });

    output += `\nFound ${vehicles.length} candidates in DB (60k-95k, Family types):\n`;
    vehicles.forEach(v => {
        output += `- [${v.id}] ${v.marca} ${v.modelo} (${v.ano}) - R$ ${v.preco} - ${v.carroceria}\n`;
    });

    // 2. Check Embedding Scores
    output += '\n🧠 Checking Semantic Scores for query: "viagem familia espaco"\n';
    await inMemoryVectorStore.initialize();

    // Wait for initialization
    console.log('Waiting for vector store to load...');
    let retries = 0;
    while (!(inMemoryVectorStore as any).initialized && retries < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        process.stdout.write('.');
        retries++;
    }
    console.log('\n');

    // Debug store size
    // Accessing private property via any cast strictly for debug script
    const storeSize = (inMemoryVectorStore as any).vectors?.length || (inMemoryVectorStore as any).documents?.length || 0;
    output += `\nVector Store Size: ${storeSize}\n`;
    if (storeSize === 0) {
        output += '⚠️ Vector store empty! Attempting to force load...\n';
        // Force load if possible or just warn
    }

    const results = await inMemoryVectorStore.searchWithScores('viagem familia espaco', 20);

    output += '\nTop 20 Semantic Matches:\n';
    results.slice(0, 20).forEach(r => {
        const v = vehicles.find(db => db.id === r.vehicleId);
        const symbol = v ? '✅ MATCH' : '❌ (Filter mismatch)';
        output += `${symbol} Score: ${r.score.toFixed(4)} | ID: ${r.vehicleId}\n`;
        if (v) output += `   -> ${v.marca} ${v.modelo} - R$ ${v.preco}\n`;
    });

    fs.writeFileSync('stock_report.txt', output);
    console.log('Report saved to stock_report.txt');
}

checkStock();
