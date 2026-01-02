
import { rankRecommendations } from './agents/vehicle-expert/processors/recommendation-ranker';
import { VehicleRecommendation } from './types/state.types';

async function testReranking() {
    console.log('🧪 Testing AI Reranking...');

    // Mock Profile
    const profile = {
        usage: 'família',
        people: 4,
        priorities: ['espaço', 'bagageiro'],
        budget: 60000
    };

    // Mock Recommendations (Simulating Vector Search Results)
    // Intentionally putting the "Best" car (Spin) at index 2 to see if AI promotes it
    const baseRec = { reasoning: 'Test', highlights: [], concerns: [] };

    const candidates: VehicleRecommendation[] = [
        {
            ...baseRec,
            vehicleId: '1',
            matchScore: 0.88,
            vehicle: { id: '1', brand: 'Fiat', model: 'Punto', year: 2014, price: 45000, bodyType: 'Hatch', mileage: 80000, transmission: 'Manual', fuel: 'Flex' }
        },
        {
            ...baseRec,
            vehicleId: '2',
            matchScore: 0.85,
            vehicle: { id: '2', brand: 'Chevrolet', model: 'Onix', year: 2015, price: 50000, bodyType: 'Hatch', mileage: 70000, transmission: 'Manual', fuel: 'Flex' }
        },
        {
            ...baseRec,
            vehicleId: '3',
            matchScore: 0.82, // Lower vector score but BETTER semantic fit
            vehicle: { id: '3', brand: 'Chevrolet', model: 'Spin', year: 2013, price: 55000, bodyType: 'Minivan', mileage: 90000, transmission: 'Automático', fuel: 'Flex' }
        },
        {
            ...baseRec,
            vehicleId: '4',
            matchScore: 0.80,
            vehicle: { id: '4', brand: 'Hyundai', model: 'HB20S', year: 2014, price: 52000, bodyType: 'Sedan', mileage: 85000, transmission: 'Manual', fuel: 'Flex' }
        }
    ];

    console.log('📋 Candidates (Before Rerank):');
    candidates.forEach((c, i) => console.log(`#${i} ${c.vehicle.model} (${c.vehicle.bodyType})`));

    const ranked = await rankRecommendations(candidates, profile as any, 3);

    console.log('\n🏆 Ranked (After AI):');
    ranked.forEach((r, i) => {
        console.log(`#${i + 1} ${r.vehicle.model} (${r.vehicle.bodyType})`);
        console.log(`   💡 Reasoning: ${r.reasoning}`);
    });
}

testReranking();
