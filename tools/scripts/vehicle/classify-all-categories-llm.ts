/**
 * Script para classificar veículos em TODAS as categorias usando LLM
 *
 * Categorias classificadas:
 * - aptoUber / aptoUberBlack (já existente)
 * - aptoFamilia (família com crianças, viagens)
 * - aptoCarga (trabalho pesado, carga)
 * - aptoUsoDiario (commute, uso urbano)
 * - aptoEntrega (apps de entrega)
 */

import { PrismaClient } from '@prisma/client';
import { chatCompletion } from '../src/lib/llm-router';
import { uberEligibilityValidator } from '../src/services/uber-eligibility-validator.service';

const prisma = new PrismaClient();

interface CategoryClassification {
  aptoFamilia: boolean;
  aptoCarga: boolean;
  aptoUsoDiario: boolean;
  aptoEntrega: boolean;
  aptoViagem: boolean;
  reasoning: string;
}

const CLASSIFICATION_PROMPT = `Você é um avaliador RIGOROSO de veículos. Classifique o veículo abaixo nas categorias.

⚠️ SEJA RESTRITIVO! Na dúvida, REPROVE. Melhor ser criterioso do que permissivo.

CATEGORIAS:

1. **FAMÍLIA (aptoFamilia)** - Família com crianças/cadeirinhas
   ✅ APROVAR APENAS:
   - SUVs (qualquer): Creta, Tracker, Tucson, Renegade, T-Cross, HR-V, etc.
   - Sedans MÉDIOS/GRANDES: Corolla, Civic, Cruze, Jetta, Sentra (NÃO HB20S, Onix Plus)
   - Minivans: Spin, Idea, Meriva, Zafira, Livina
   - Peruas: Golf Variant, Fielder
   
   ❌ REPROVAR SEMPRE:
   - Hatches (Onix, HB20, Argo, Uno, Fox, Ka, Fiesta, Gol, Polo) - NÃO cabem 2 cadeirinhas
   - Sedans COMPACTOS (HB20S, Onix Plus, Cronos, Voyage) - espaço traseiro limitado
   - Pickups - não têm espaço traseiro fechado
   - Motos

2. **CARGA (aptoCarga)** - Transporte de materiais/ferramentas
   ✅ APROVAR APENAS: Pickups, Vans, Furgões, Caminhonetes
   ❌ REPROVAR: Tudo que não seja utilitário de carga

3. **USO DIÁRIO (aptoUsoDiario)** - Commute casa-trabalho
   ✅ APROVAR: Carro com ar-condicionado + ano >= 2010
   ❌ REPROVAR: Motos, Pickups grandes (S10, Hilux diesel), Sem ar-condicionado

4. **ENTREGA (aptoEntrega)** - Apps (Mercado Livre, Lalamove)
   ✅ APROVAR: Ano >= 2010, 4+ portas, porta-malas acessível
   ❌ REPROVAR: Motos, Ano < 2010

5. **VIAGEM (aptoViagem)** - Viagens longas/estrada
   ✅ APROVAR: SUVs, Sedans médios+, Minivans, Peruas (com ar)
   ❌ REPROVAR: Hatches pequenos (Mobi, Kwid, Uno, Ka), Pickups cabine simples, Motos

VEÍCULO:
- Marca: {marca}
- Modelo: {modelo}
- Ano: {ano}
- Carroceria: {carroceria}
- Portas: {portas}
- Ar-Condicionado: {arCondicionado}
- Câmbio: {cambio}
- KM: {km}

⚠️ LEMBRE-SE: Para FAMÍLIA, hatches e sedans compactos = REPROVAR!

Retorne APENAS JSON:
{
  "aptoFamilia": true/false,
  "aptoCarga": true/false,
  "aptoUsoDiario": true/false,
  "aptoEntrega": true/false,
  "aptoViagem": true/false,
  "reasoning": "Explicação breve"
}`;

async function classifyVehicle(vehicle: any): Promise<CategoryClassification> {
  const prompt = CLASSIFICATION_PROMPT.replace('{marca}', vehicle.marca)
    .replace('{modelo}', vehicle.modelo)
    .replace('{ano}', vehicle.ano.toString())
    .replace('{carroceria}', vehicle.carroceria)
    .replace('{portas}', vehicle.portas.toString())
    .replace('{arCondicionado}', vehicle.arCondicionado ? 'Sim' : 'Não')
    .replace('{cambio}', vehicle.cambio || 'N/A')
    .replace('{km}', vehicle.km.toLocaleString('pt-BR'))
    .replace('{combustivel}', vehicle.combustivel || 'N/A');

  try {
    const response = await chatCompletion([{ role: 'user', content: prompt }], {
      temperature: 0.1,
      maxTokens: 500,
    });

    // Parse JSON response
    const cleaned = response
      .trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '');
    return JSON.parse(cleaned);
  } catch (error) {
    console.error(`❌ Erro ao classificar ${vehicle.marca} ${vehicle.modelo}:`, error);
    // Fallback conservador
    return {
      aptoFamilia:
        vehicle.portas >= 4 &&
        ['suv', 'sedan'].some(t => vehicle.carroceria.toLowerCase().includes(t)),
      aptoCarga: ['pickup', 'picape', 'furgao', 'van'].some(t =>
        vehicle.carroceria.toLowerCase().includes(t)
      ),
      aptoUsoDiario: vehicle.arCondicionado && vehicle.ano >= 2010,
      aptoEntrega: vehicle.ano >= 2010,
      aptoViagem: vehicle.portas >= 4 && vehicle.arCondicionado,
      reasoning: 'Classificação fallback (erro no LLM)',
    };
  }
}

async function classifyAllCategories() {
  console.log('🚗 Classificando veículos em TODAS as categorias com LLM...\n');

  try {
    const vehicles = await prisma.vehicle.findMany();
    console.log(`📊 Total de veículos: ${vehicles.length}\n`);

    const stats = {
      uber: 0,
      uberBlack: 0,
      familia: 0,
      carga: 0,
      usoDiario: 0,
      entrega: 0,
      viagem: 0,
    };

    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      console.log(
        `[${i + 1}/${vehicles.length}] ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}...`
      );

      // 1. Classificar Uber (já existente)
      const uberResult = await uberEligibilityValidator.validateEligibility({
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        ano: vehicle.ano,
        carroceria: vehicle.carroceria,
        arCondicionado: vehicle.arCondicionado,
        portas: vehicle.portas,
        cambio: vehicle.cambio,
        cor: vehicle.cor || undefined,
      });

      // 2. Classificar outras categorias
      const categoryResult = await classifyVehicle(vehicle);

      // 3. Atualizar no banco
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          aptoUber: uberResult.uberX || uberResult.uberComfort,
          aptoUberX: uberResult.uberX,
          aptoUberComfort: uberResult.uberComfort,
          aptoUberBlack: uberResult.uberBlack,
          aptoFamilia: categoryResult.aptoFamilia,
          aptoCarga: categoryResult.aptoCarga,
          aptoUsoDiario: categoryResult.aptoUsoDiario,
          aptoEntrega: categoryResult.aptoEntrega,
          // aptoViagem pode ser adicionado ao schema se necessário
        },
      });

      // Estatísticas
      if (uberResult.uberX) stats.uber++;
      if (uberResult.uberBlack) stats.uberBlack++;
      if (categoryResult.aptoFamilia) stats.familia++;
      if (categoryResult.aptoCarga) stats.carga++;
      if (categoryResult.aptoUsoDiario) stats.usoDiario++;
      if (categoryResult.aptoEntrega) stats.entrega++;
      if (categoryResult.aptoViagem) stats.viagem++;

      // Log resumido
      const flags = [];
      if (uberResult.uberX) flags.push('UberX');
      if (uberResult.uberBlack) flags.push('Black');
      if (categoryResult.aptoFamilia) flags.push('Família');
      if (categoryResult.aptoCarga) flags.push('Carga');
      if (categoryResult.aptoUsoDiario) flags.push('Diário');
      if (categoryResult.aptoEntrega) flags.push('Entrega');
      if (categoryResult.aptoViagem) flags.push('Viagem');

      console.log(`   ✅ [${flags.join(', ') || 'Nenhuma'}]`);
      console.log(`   📝 ${categoryResult.reasoning.substring(0, 80)}...\n`);
    }

    console.log('\n📊 RESUMO FINAL:');
    console.log('━'.repeat(40));
    console.log(`🚖 Uber X/Comfort: ${stats.uber} veículos`);
    console.log(`🎩 Uber Black: ${stats.uberBlack} veículos`);
    console.log(`👨‍👩‍👧‍👦 Família: ${stats.familia} veículos`);
    console.log(`📦 Carga: ${stats.carga} veículos`);
    console.log(`🏙️ Uso Diário: ${stats.usoDiario} veículos`);
    console.log(`📬 Entrega: ${stats.entrega} veículos`);
    console.log(`🛣️ Viagem: ${stats.viagem} veículos`);
    console.log('━'.repeat(40));
    console.log('\n✅ Classificação completa concluída!');
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

classifyAllCategories();
