
import { uberEligibilityAgent } from '../src/services/uber-eligibility-agent.service';
import { uberRulesProvider } from '../src/services/uber-rules-provider.service';
import * as fs from 'fs';

async function main() {
    console.error('--- DEBUG CLASSIFICATION ---');

    const vehicle = {
        marca: 'Jeep',
        modelo: 'Renegade',
        ano: 2020,
        carroceria: 'SUV',
        arCondicionado: true,
        portas: 4
    };

    const citySlug = 'sao-paulo';

    try {
        // 1. Check Rules Provider state
        const rules = await uberRulesProvider.get(citySlug);
        const blackList = rules.rules.uberBlack?.eligible || [];

        const renegadeRule = blackList.find(r => r.model.toLowerCase().includes('renegade'));

        // 2. Evaluate
        const result = await uberEligibilityAgent.evaluate(vehicle, citySlug);

        const output = {
            blackListSize: blackList.length,
            renegadeInList: !!renegadeRule,
            first5BlackRules: blackList.slice(0, 5),
            result
        };

        fs.writeFileSync('debug-output.json', JSON.stringify(output, null, 2));
        console.log('✅ Debug output written to debug-output.json');
    } catch (e) {
        fs.writeFileSync('debug-output.json', JSON.stringify({ error: String(e) }, null, 2));
    }
}

main();
