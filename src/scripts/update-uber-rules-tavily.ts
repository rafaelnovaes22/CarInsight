import dotenv from 'dotenv';
dotenv.config();

import { tavilySearchService } from '../services/tavily-search.service';
import { chatCompletion } from '../lib/llm-router';

async function main() {
  console.log('🚀 Starting Uber Rules Update POC (Tavily + LLM)...');

  if (!process.env.TAVILY_API_KEY) {
    console.error('❌ TAVILY_API_KEY is missing! Please check your .env file.');
    process.exit(1);
  }

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const formattedDate = currentDate.toLocaleDateString('pt-BR');

  // 1. Search for current rules
  const queries = [
    `Requisitos Uber Black Brasil ${currentYear} lista carros aceitos e excluidos`,
    `Lista carros proibidos Uber Black ${currentYear} Brasil`,
    `Requisitos Uber Comfort Brasil ${currentYear} ano veiculo`,
    `Mudanças regras Uber Brasil ${currentYear}`,
  ];

  let aggregatedContext = '';

  for (const query of queries) {
    console.log(`\n🔍 Searching: "${query}"...`);
    const results = await tavilySearchService.search(query, 3);

    if (results.length > 0) {
      console.log(`   ✅ Found ${results.length} results.`);
      results.forEach(r => {
        aggregatedContext += `SOURCE: ${r.title} (${r.url})\nCONTENT: ${r.content}\n\n`;
      });
    } else {
      console.log('   ⚠️ No results found.');
    }
  }

  if (!aggregatedContext) {
    console.error('❌ Failed to gather any context from searches.');
    process.exit(1);
  }

  console.log('\n🧠 Generating new rules prompt with LLM...');

  // 2. Generate new criteria prompt
  // We ask the LLM to write the "System Prompt" that the validator service uses.
  const promptGenerationTask = `
    Você é um Arquiteto de Software Sênior. Sua tarefa é criar um SYSTEM PROMPT rigoroso para um validador de veículos Uber.
    
    DATA ATUAL: ${formattedDate} (Considere esta data como "hoje" para validar vigência de regras).
    
    Analise o contexto abaixo (resultados de busca recentes) e extraia as regras REAIS e ATUALIZADAS para Uber X, Comfort e Black no Brasil (foco SP) para ${currentYear}.
    
    CONTEXTO OBTIDO VIA PESQUISA:
    ${aggregatedContext}

    -------------
    
    SAÍDA ESPERADA:
    Escreva APENAS o texto do prompt que deve ser usado no arquivo 'uber-eligibility-validator.service.ts'.
    O prompt deve seguir EXATAMENTE este formato (mantenha a estrutura, atualize os dados):

    ATENÇÃO MÁXIMA: Você é um validador RIGOROSO de veículos para Uber Black/Comfort no Brasil (ATUALIZADO em ${formattedDate}).

    🚨 REGRA DE OURO (EXCLUSÕES IMEDIATAS):
    Se o veículo estiver nesta lista, ele **NUNCA** pode ser Uber Black:
    - [Listar carros explicitamente excluídos encontrados na pesquisa, ex: HB20S, Ford Ka Sedan, etc]

    CRITÉRIOS POR CATEGORIA (Ano vigente: ${currentYear}):
    1. **UBER X**: ... (regras de ano e modelo)
    2. **UBER COMFORT**: ... (regras de ano e modelo)
    3. **UBER BLACK**: ... (regras de ano, cores, modelos aceitos/excluídos)

    TAREFA: Analise o veículo e retorne JSON estrito: { "uberX": bool, "uberComfort": bool, "uberBlack": bool, "reasoning": string, "confidence": number }
  `;

  const newSystemPrompt = await chatCompletion([{ role: 'user', content: promptGenerationTask }], {
    temperature: 0.2,
  });

  console.log('\n✨ GENERATED NEW VALIDATION PROMPT:\n');
  console.log('---------------------------------------------------');
  console.log(newSystemPrompt);
  console.log('---------------------------------------------------');

  console.log(
    '\n✅ POC Completed! In production, this output would update the validator service configuration.'
  );
}

main().catch(err => {
  console.error('Execution failed:', err);
  process.exit(1);
});
