
import { vehicleExpert } from '../src/agents/vehicle-expert.agent';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('🐞 Debugging Search Issue (Initial Message - Usage Fix Check)...');

    const userQuery = 'um carro não muito novo por ser caro, nem muito velho também, para trabalhar diariamente';

    console.log('📝 Query:', userQuery);

    const context: any = {
        messages: [],
        profile: {},
        metadata: { messageCount: 1 },
        mode: 'greeting'
    };

    // call with the initial long query
    const result = await vehicleExpert.chat(userQuery, context);

    console.log('\n🔍 Result:', JSON.stringify(result, null, 2));

    if (result.extractedPreferences) {
        console.log('\n📋 Extracted Preferences:', JSON.stringify(result.extractedPreferences, null, 2));
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
