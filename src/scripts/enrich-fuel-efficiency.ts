import { PrismaClient } from '@prisma/client';
import { tavilySearchService } from '../services/tavily-search.service';
import { openai } from '../lib/openai';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

async function enrichFuelEfficiency() {
  console.log('⛽ Starting fuel efficiency enrichment...');

  if (!process.env.TAVILY_API_KEY) {
    console.error('❌ TAVILY_API_KEY is missing in environment!');
  } else {
    console.log('✅ TAVILY_API_KEY found');
  }

  // Fetch vehicles without consumption data OR with invalid data
  const vehicles = await prisma.vehicle.findMany({
    where: {
      OR: [
        { economiaCombustivel: null },
        { economiaCombustivel: '' },
        { economiaCombustivel: 'media' }, // Fix bad data
      ],
      disponivel: true,
    },
    // take: 5 // Debug limit
  });

  console.log(`Found ${vehicles.length} vehicles to enrich`);

  for (const vehicle of vehicles) {
    try {
      const query = `consumo combustível urbano ficha técnica ${vehicle.marca} ${vehicle.modelo} ${vehicle.versao || ''} ${vehicle.ano}`;
      console.log(`Searching: ${query}`);

      const results = await tavilySearchService.search(query, 3);
      console.log(`Results found: ${results.length}`);

      if (!results || results.length === 0) {
        console.warn(`No results for ${vehicle.id}`);
        continue;
      }

      // Prepare context for LLM
      const context = results.map(r => `Title: ${r.title}\nContent: ${r.content}`).join('\n---\n');

      const prompt = `
        Você é um especialista automotivo.
        Analise os resultados de busca abaixo e extraia o **consumo urbano com gasolina** (em km/l) para o veículo: ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}.
        
        Resultados:
        ${context}
        
        Regras:
        1. Retorne APENAS o número (ex: "10.5"). Use ponto para decimal.
        2. Se houver variação, retorne uma média conservadora.
        3. Se não encontrar o dado, retorne "N/A".
        4. Priorize consumo URBANO com GASOLINA.
      `;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0,
      });

      const consumption = response.choices[0]?.message?.content?.trim();
      console.log(`Extracted: ${consumption}`);

      if (consumption && consumption !== 'N/A' && !isNaN(parseFloat(consumption))) {
        const val = parseFloat(consumption); // Valida se é número
        const formatted = `${val} km/l`;

        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { economiaCombustivel: formatted },
        });

        console.log(`✅ Updated ${vehicle.modelo}: ${formatted}`);
      } else {
        console.warn(
          `Could not extract valid consumption for ${vehicle.modelo}. Got: ${consumption}`
        );
      }
    } catch (error) {
      logger.error({ vehicleId: vehicle.id, error }, 'Error enriching vehicle');
    }

    // Tiny delay to be nice to APIs
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger.info('⛽ Enrichment complete.');
}

// Execute if run directly
if (require.main === module) {
  enrichFuelEfficiency()
    .catch(e => {
      console.error('❌ Enrichment failed:', e);
      // Don't exit process with error to allow subsequent tasks (if any) in a pipeline,
      // but strictly speaking we should probably exit(1). For dev script, logging is enough.
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
