import { rankRecommendations } from '../agents/vehicle-expert/processors/recommendation-ranker';
import { CustomerProfile, VehicleRecommendation } from '../types/state.types';

async function run() {
  console.log('🚀 Starting Isolated Reranker Test...');

  // 1. Mock Data
  const mockVehicles: VehicleRecommendation[] = [
    {
      vehicleId: '1',
      matchScore: 80,
      reasoning: 'mock',
      highlights: [],
      concerns: [],
      vehicle: {
        brand: 'Ford',
        model: 'EcoSport',
        year: 2018,
        price: 65000,
        mileage: 50000,
        bodyType: 'SUV',
        description: 'Carro SUV compacto, bom estado.',
      },
    },
    {
      vehicleId: '2',
      matchScore: 70,
      reasoning: 'mock',
      highlights: [],
      concerns: [],
      vehicle: {
        brand: 'Jeep',
        model: 'Renegade',
        year: 2020,
        price: 85000,
        mileage: 40000,
        bodyType: 'SUV',
        description:
          'SUV Completo, teto solar, couro. [ANÁLISE DO ESPECIALISTA]: Ideal para família.',
      },
    },
  ];

  const profile: Partial<CustomerProfile> = {
    budget: 90000,
    usoPrincipal: 'viagem',
    priorities: ['conforto', 'seguranca'],
    people: 4,
  };

  // 2. Execute
  try {
    const results = await rankRecommendations(mockVehicles, profile, 2);

    // 3. Validation
    if (results && results.length > 0) {
      console.log('✅ Success! Raw results:');
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.error('❌ Failed: No results returned (or empty)');
    }
  } catch (error) {
    console.error('❌ CRITICAL ERROR:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  }
}

run();
