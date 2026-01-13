import { VehicleExpertAgent } from '../agents/vehicle-expert.agent';
import { vehicleSearchAdapter } from '../services/vehicle-search-adapter.service';
import { logger } from '../lib/logger';

import { inMemoryVectorStore } from '../services/in-memory-vector.service';

// Mock logger to reduce noise
logger.info = console.log as any;

// Mock in-memory vector store
inMemoryVectorStore.search = async () => ['1']; // Return mock ID

async function verifyUberX() {
  const agent = new VehicleExpertAgent();

  // Inject mock search results into adapter (since we don't have DB active)
  // or relies on the fact that the test environment might have a mock DB or we mock the method
  // Since we are running as a script, we likely need to MOCK the adapter's search method
  // precisely because we might not have a running DB connection in this script context easily
  // WITHOUT connecting to the real DB.

  // However, connecting to DB is better if possible.
  // Let's try to mock the adapter method directly.

  const originalSearch = vehicleSearchAdapter.search;
  vehicleSearchAdapter.search = async (query, filters) => {
    console.log('Search called with filters:', filters);
    return [
      {
        vehicleId: '1',
        matchScore: 0.9,
        reasoning: 'test',
        highlights: [],
        concerns: [],
        vehicle: {
          id: '1',
          brand: 'Fiat',
          model: 'Mobi',
          year: 2020,
          price: 45000,
          mileage: 30000,
          bodyType: 'hatch',
          transmission: 'manual',
          fuelType: 'flex',
          detailsUrl: 'http://link-uber-x.com',
        },
      },
    ] as any;
  };

  const context: any = {
    profile: {},
    messages: [],
    metadata: { messageCount: 0 },
  };

  const response = await agent.chat('quero um sedan para uber x até 50 mil', context);

  /* console.log('\nResponse:', response.response); */
  const fs = await import('fs');
  fs.writeFileSync('verify_output.txt', JSON.stringify(response, null, 2));

  if (response.response?.includes('http://link-uber-x.com')) {
    console.log('\n✅ LINKS FOUND');
  } else {
    console.log('\n❌ LINKS MISSING');
  }

  // Restore
  vehicleSearchAdapter.search = originalSearch;
}

verifyUberX().catch(console.error);
