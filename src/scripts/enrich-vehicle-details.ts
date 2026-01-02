import { PrismaClient } from '@prisma/client';
import { chatCompletion } from '../lib/llm-router';

// Initialize Prisma
const prisma = new PrismaClient();

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enrichVehicles() {
  console.log('🚀 Starting Model-Based Vehicle Enrichment...');

  // Fetch all vehicles
  const vehicles = await prisma.vehicle.findMany({
    where: { disponivel: true },
  });

  console.log(`📊 Found ${vehicles.length} vehicles to enrich.`);

  let count = 0;
  for (const vehicle of vehicles) {
    count++;
    console.log(
      `\n[${count}/${vehicles.length}] Enriching: ${vehicle.marca} ${vehicle.modelo} (${vehicle.ano})`
    );

    // Construct prompt for the expert
    const prompt = `
    Você é um Especialista Automotivo Sênior. Sua tarefa é criar uma "Análise do Especialista" curta e vendedora para este carro, focada em CASOS DE USO (Família, Trabalho, Uber, Viagem).

    DADOS DO VEÍCULO:
    - Modelo: ${vehicle.marca} ${vehicle.modelo}
    - Ano: ${vehicle.ano}
    - Categoria: ${vehicle.carroceria}
    - Câmbio: ${vehicle.cambio}
    - Combustível: ${vehicle.combustivel}
    - Preço: R$ ${vehicle.preco?.toLocaleString('pt-BR')}
    - KM: ${vehicle.km?.toLocaleString('pt-BR')}
    - Opcionais/Detalhes atuais: ${vehicle.descricao}

    REGRAS DE GERAÇÃO:
    1. Use Português do Brasil, natural e persuasivo.
    2. Destaque pontos fortes de acordo com a categoria:
       - SUV: Espaço, altura do solo, porta-malas, viagem em família.
       - Sedan: Conforto, porta-malas, executivo, estrada.
       - Hatch: Economia, agilidade urbana, fácil de estacionar.
    3. Mencione explicitamente palavras-chave semânticas: "Espaço interno", "Conforto", "Economia", "Família", "Uber".
    4. MÁXIMO 3 FRASES. Texto corrido.
    5. NÃO invente opcionais que não estão listados, foque nas características intrínsecas do modelo (ex: Corolla é confiável, Renegade é robusto).

    SAÍDA APENAS O TEXTO DA DESCRIÇÃO.
    `.trim();

    try {
      const response = await chatCompletion(
        [
          { role: 'system', content: 'You are a helpful automotive expert assistant.' },
          { role: 'user', content: prompt },
        ],
        {
          temperature: 0.7,
        }
      );

      const expertAnalysis = response.trim().replace(/^"|"$/g, '');

      console.log(`   📝 Generated: "${expertAnalysis.substring(0, 80)}..."`);

      // Update Database
      // Append expert analysis to existing description or replace if it's too short
      const oldDesc = vehicle.descricao || '';
      const newDesc = `[ANÁLISE DO ESPECIALISTA]: ${expertAnalysis} \n\n[DETALHES TÉCNICOS]: ${oldDesc}`;

      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          descricao: newDesc,
          embedding: null, // Force regeneration
        },
      });

      console.log('   ✅ Saved & Embedding cleared.');

      // Rate limit protection
      await delay(500);
    } catch (error) {
      console.error(`   ❌ Failed to enrich ${vehicle.modelo}:`, error);
    }
  }

  console.log(
    '\n✨ Enrichment Complete! Run "npm run embeddings:generate" (or force) to regenerate embeddings.'
  );
}

enrichVehicles()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
