
import { preferenceExtractor } from '../src/agents/preference-extractor.agent';

async function main() {
    console.log('🧪 Testing Preference Extractor Runtime...');

    const inputs = [
        'Quero um carro pra trabalhar no dia a dia',
        'Preciso de um carro para Uber, até 60 mil',
        'Preciso de uma picape para trabalho',
        'Preciso de um carro de 7 lugares pra família',
        'Oi, tudo bem?'
    ];

    for (const input of inputs) {
        console.log(`\nInput: "${input}"`);
        try {
            const result = await preferenceExtractor.extract(input);
            console.log('Result:', JSON.stringify(result.extracted, null, 2));
            console.log('Confidence:', result.confidence);
        } catch (error) {
            console.error('❌ ERROR:', error);
        }
    }
}

main().catch(console.error);
