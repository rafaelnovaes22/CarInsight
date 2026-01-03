
import { PrismaClient } from '@prisma/client';
import { exactSearchParser } from './services/exact-search-parser.service';
import { logger } from './lib/logger';

const prisma = new PrismaClient();

async function runTest() {
    const fakeModel = 'X2000_TEST_MOTO';
    const query = `Quero comprar uma ${fakeModel} 2024`;

    console.log('🧪 Starting Dynamic Parser Test...');

    try {
        // 1. Clean up potential leftovers
        await prisma.vehicle.deleteMany({
            where: { modelo: fakeModel }
        });

        // 2. Insert fake moto
        console.log(`📝 Inserting fake vehicle: ${fakeModel}`);
        await prisma.vehicle.create({
            data: {
                marca: 'TestBrand',
                modelo: fakeModel,
                ano: 2024,
                km: 0,
                preco: 15000,
                carroceria: 'Moto',
                combustivel: 'Flex',
                cambio: 'Manual'
            }
        });

        // 3. Initialize parser (should load the new model)
        console.log('🔄 Initializing parser (loading from DB)...');
        await exactSearchParser.initialize();

        // 4. Test parsing
        console.log(`🔎 Parsing query: "${query}"`);
        const result = await exactSearchParser.parse(query);

        console.log('📊 Result:', JSON.stringify(result, null, 2));

        // 5. Verification
        if (result.model === fakeModel) {
            console.log('✅ SUCCESS: Dynamic model was recognized!');
        } else {
            console.error('❌ FAILURE: Model was NOT recognized.');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Error during test:', error);
        process.exit(1);
    } finally {
        // Cleanup
        console.log('🧹 Cleaning up...');
        await prisma.vehicle.deleteMany({
            where: { modelo: fakeModel }
        });
        await prisma.$disconnect();
    }
}

runTest();
