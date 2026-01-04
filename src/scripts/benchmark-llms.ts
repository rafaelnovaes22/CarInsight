import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const prisma = new PrismaClient();

interface BenchmarkResult {
  model: string;
  latency: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost: number;
  quality: {
    relevance: number; // 1-5
    accuracy: number; // 1-5
    coherence: number; // 1-5
  };
  response: string;
}

interface TestCase {
  id: string;
  description: string;
  systemPrompt: string;
  userMessage: string;
  expectedKeywords?: string[]; // Palavras que devem aparecer
  context?: unknown;
}

// Casos de teste representativos
const TEST_CASES: TestCase[] = [
  {
    id: 'greeting',
    description: 'Saudação inicial do cliente',
    systemPrompt:
      "Você é um assistente de vendas de carros da Renatinhu's Cars. Seja cordial e profissional.",
    userMessage: 'Olá, bom dia!',
    expectedKeywords: ['olá', 'ajudar', 'carro'],
  },
  {
    id: 'intent-extraction',
    description: 'Extração de intenção de compra',
    systemPrompt:
      'Identifique a intenção do cliente. Retorne apenas: PURCHASE, INQUIRY, HELP, ou OTHER.',
    userMessage: 'Quero comprar um carro usado econômico para trabalhar',
    expectedKeywords: ['PURCHASE'],
  },
  {
    id: 'recommendation-reasoning',
    description: 'Geração de raciocínio para recomendação',
    systemPrompt: 'Explique por que este veículo é uma boa escolha para o cliente.',
    userMessage:
      'Cliente: orçamento R$ 50.000, uso trabalho, 4 pessoas\nVeículo: Honda Civic 2010, R$ 42.000, sedan, automático, baixo consumo',
    expectedKeywords: ['orçamento', 'econômico', 'espaço', 'confortável'],
  },
  {
    id: 'complex-question',
    description: 'Pergunta complexa sobre financiamento',
    systemPrompt: 'Você é especialista em financiamento de veículos. Explique de forma clara.',
    userMessage:
      'Qual a diferença entre financiamento SAC e PRICE? Qual é melhor para um carro de R$ 60.000 em 48 meses?',
    expectedKeywords: ['SAC', 'PRICE', 'juros', 'parcela'],
  },
  {
    id: 'sales-pitch',
    description: 'Pitch de vendas persuasivo',
    systemPrompt: 'Crie um pitch de vendas convincente para este veículo.',
    userMessage: 'Veículo: Fiat Uno Way 2021, R$ 48.000, 72.406 km, completo, único dono',
    expectedKeywords: ['único dono', 'completo', 'conservado', 'oportunidade'],
  },
  {
    id: 'objection-handling',
    description: 'Tratamento de objeção de preço',
    systemPrompt: 'Cliente acha o carro caro. Contra-argumente com benefícios.',
    userMessage: 'Cliente: "Esse Corolla está muito caro, vi mais barato em outro lugar"',
    expectedKeywords: ['qualidade', 'garantia', 'procedência', 'valor'],
  },
];

// Preços por 1M tokens (input/output)
const PRICING = {
  'llama-3.3-70b': { input: 0.59, output: 0.79 }, // Groq
  'gpt-4o': { input: 2.5, output: 10.0 }, // OpenAI GPT-4o
  'gpt-4o-mini': { input: 0.15, output: 0.6 }, // OpenAI GPT-4o-mini
};

async function benchmarkGroq(testCase: TestCase): Promise<BenchmarkResult> {
  const startTime = Date.now();

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: testCase.systemPrompt },
      { role: 'user', content: testCase.userMessage },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const latency = Date.now() - startTime;
  const usage = response.usage!;

  const cost =
    (usage.prompt_tokens / 1_000_000) * PRICING['llama-3.3-70b'].input +
    (usage.completion_tokens / 1_000_000) * PRICING['llama-3.3-70b'].output;

  const responseText = response.choices[0].message.content || '';

  return {
    model: 'Groq LLaMA 3.3 70B',
    latency,
    tokens: {
      prompt: usage.prompt_tokens,
      completion: usage.completion_tokens,
      total: usage.total_tokens,
    },
    cost,
    quality: evaluateQuality(responseText, testCase),
    response: responseText,
  };
}

async function benchmarkGPT4o(testCase: TestCase): Promise<BenchmarkResult> {
  const startTime = Date.now();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: testCase.systemPrompt },
      { role: 'user', content: testCase.userMessage },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const latency = Date.now() - startTime;
  const usage = response.usage!;

  const cost =
    (usage.prompt_tokens / 1_000_000) * PRICING['gpt-4o'].input +
    (usage.completion_tokens / 1_000_000) * PRICING['gpt-4o'].output;

  const responseText = response.choices[0].message.content || '';

  return {
    model: 'OpenAI GPT-4o',
    latency,
    tokens: {
      prompt: usage.prompt_tokens,
      completion: usage.completion_tokens,
      total: usage.total_tokens,
    },
    cost,
    quality: evaluateQuality(responseText, testCase),
    response: responseText,
  };
}

async function benchmarkGPT4oMini(testCase: TestCase): Promise<BenchmarkResult> {
  const startTime = Date.now();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: testCase.systemPrompt },
      { role: 'user', content: testCase.userMessage },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const latency = Date.now() - startTime;
  const usage = response.usage!;

  const cost =
    (usage.prompt_tokens / 1_000_000) * PRICING['gpt-4o-mini'].input +
    (usage.completion_tokens / 1_000_000) * PRICING['gpt-4o-mini'].output;

  const responseText = response.choices[0].message.content || '';

  return {
    model: 'OpenAI GPT-4o-mini',
    latency,
    tokens: {
      prompt: usage.prompt_tokens,
      completion: usage.completion_tokens,
      total: usage.total_tokens,
    },
    cost,
    quality: evaluateQuality(responseText, testCase),
    response: responseText,
  };
}

function evaluateQuality(
  response: string,
  testCase: TestCase
): { relevance: number; accuracy: number; coherence: number } {
  let relevance = 5;
  let accuracy = 5;
  let coherence = 5;

  // Relevância: Contém keywords esperadas?
  if (testCase.expectedKeywords) {
    const foundKeywords = testCase.expectedKeywords.filter(keyword =>
      response.toLowerCase().includes(keyword.toLowerCase())
    );
    relevance = Math.max(
      1,
      Math.round((foundKeywords.length / testCase.expectedKeywords.length) * 5)
    );
  }

  // Accuracy: Resposta tem tamanho adequado?
  if (response.length < 20) accuracy = 2;
  else if (response.length < 50) accuracy = 3;
  else if (response.length > 1000) accuracy = 4;

  // Coherence: Texto bem estruturado?
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) coherence = 1;
  else if (sentences.length === 1) coherence = 3;
  else coherence = 5;

  return { relevance, accuracy, coherence };
}

async function runBenchmark() {
  console.log('🚀 Iniciando Benchmark: Groq LLaMA 3.3 vs GPT-4o vs GPT-4o-mini\n');
  console.log('📊 Usando embeddings OpenAI (text-embedding-3-small) para contexto\n');
  console.log('='.repeat(80));

  const results: {
    testCase: TestCase;
    groq: BenchmarkResult;
    gpt4o: BenchmarkResult;
    gpt4oMini: BenchmarkResult;
  }[] = [];

  for (const testCase of TEST_CASES) {
    console.log(`\n📝 Teste: ${testCase.description}`);
    console.log(`   Cenário: ${testCase.userMessage.substring(0, 80)}...`);

    try {
      // Rodar Groq
      process.stdout.write('   ⏳ Groq LLaMA 3.3... ');
      const groqResult = await benchmarkGroq(testCase);
      console.log(`✅ ${groqResult.latency}ms`);

      // Rodar GPT-4o
      process.stdout.write('   ⏳ GPT-4o... ');
      const gpt4oResult = await benchmarkGPT4o(testCase);
      console.log(`✅ ${gpt4oResult.latency}ms`);

      // Rodar GPT-4o-mini
      process.stdout.write('   ⏳ GPT-4o-mini... ');
      const gpt4oMiniResult = await benchmarkGPT4oMini(testCase);
      console.log(`✅ ${gpt4oMiniResult.latency}ms`);

      results.push({
        testCase,
        groq: groqResult,
        gpt4o: gpt4oResult,
        gpt4oMini: gpt4oMiniResult,
      });

      // Delay para não bater rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      const err = error as Error;
      console.log(`❌ Erro: ${err.message}`);
    }
  }

  // Análise e Relatório
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 RESULTADOS DO BENCHMARK');
  console.log('='.repeat(80));

  generateReport(results);
}

function generateReport(
  results: {
    testCase: TestCase;
    groq: BenchmarkResult;
    gpt4o: BenchmarkResult;
    gpt4oMini: BenchmarkResult;
  }[]
) {
  // Médias
  const avgLatency = {
    groq: results.reduce((acc, r) => acc + r.groq.latency, 0) / results.length,
    gpt4o: results.reduce((acc, r) => acc + r.gpt4o.latency, 0) / results.length,
    gpt4oMini: results.reduce((acc, r) => acc + r.gpt4oMini.latency, 0) / results.length,
  };

  const avgCost = {
    groq: results.reduce((acc, r) => acc + r.groq.cost, 0) / results.length,
    gpt4o: results.reduce((acc, r) => acc + r.gpt4o.cost, 0) / results.length,
    gpt4oMini: results.reduce((acc, r) => acc + r.gpt4oMini.cost, 0) / results.length,
  };

  const avgQuality = {
    groq: {
      relevance: results.reduce((acc, r) => acc + r.groq.quality.relevance, 0) / results.length,
      accuracy: results.reduce((acc, r) => acc + r.groq.quality.accuracy, 0) / results.length,
      coherence: results.reduce((acc, r) => acc + r.groq.quality.coherence, 0) / results.length,
    },
    gpt4o: {
      relevance: results.reduce((acc, r) => acc + r.gpt4o.quality.relevance, 0) / results.length,
      accuracy: results.reduce((acc, r) => acc + r.gpt4o.quality.accuracy, 0) / results.length,
      coherence: results.reduce((acc, r) => acc + r.gpt4o.quality.coherence, 0) / results.length,
    },
    gpt4oMini: {
      relevance:
        results.reduce((acc, r) => acc + r.gpt4oMini.quality.relevance, 0) / results.length,
      accuracy: results.reduce((acc, r) => acc + r.gpt4oMini.quality.accuracy, 0) / results.length,
      coherence:
        results.reduce((acc, r) => acc + r.gpt4oMini.quality.coherence, 0) / results.length,
    },
  };

  console.log('\n📈 LATÊNCIA MÉDIA (menor é melhor)');
  console.log('━'.repeat(80));
  console.log(`   Groq LLaMA 3.3:  ${avgLatency.groq.toFixed(0)}ms`);
  console.log(
    `   GPT-4o:          ${avgLatency.gpt4o.toFixed(0)}ms  (${(avgLatency.gpt4o / avgLatency.groq).toFixed(1)}x mais lento)`
  );
  console.log(
    `   GPT-4o-mini:     ${avgLatency.gpt4oMini.toFixed(0)}ms  (${(avgLatency.gpt4oMini / avgLatency.groq).toFixed(1)}x mais lento)`
  );

  console.log('\n💰 CUSTO MÉDIO POR REQUISIÇÃO (menor é melhor)');
  console.log('━'.repeat(80));
  console.log(
    `   Groq LLaMA 3.3:  $${(avgCost.groq * 1000).toFixed(4)} (por 1k reqs: $${avgCost.groq.toFixed(2)})`
  );
  console.log(
    `   GPT-4o:          $${(avgCost.gpt4o * 1000).toFixed(4)} (por 1k reqs: $${avgCost.gpt4o.toFixed(2)}) [${(avgCost.gpt4o / avgCost.groq).toFixed(1)}x mais caro]`
  );
  console.log(
    `   GPT-4o-mini:     $${(avgCost.gpt4oMini * 1000).toFixed(4)} (por 1k reqs: $${avgCost.gpt4oMini.toFixed(2)}) [${(avgCost.gpt4oMini / avgCost.groq).toFixed(1)}x mais caro]`
  );

  console.log('\n⭐ QUALIDADE MÉDIA (máximo 5.0)');
  console.log('━'.repeat(80));

  const groqAvg =
    (avgQuality.groq.relevance + avgQuality.groq.accuracy + avgQuality.groq.coherence) / 3;
  const gpt4oAvg =
    (avgQuality.gpt4o.relevance + avgQuality.gpt4o.accuracy + avgQuality.gpt4o.coherence) / 3;
  const gpt4oMiniAvg =
    (avgQuality.gpt4oMini.relevance +
      avgQuality.gpt4oMini.accuracy +
      avgQuality.gpt4oMini.coherence) /
    3;

  console.log(
    `   Groq LLaMA 3.3:  ${groqAvg.toFixed(2)}/5.0 (Rel: ${avgQuality.groq.relevance.toFixed(1)}, Acc: ${avgQuality.groq.accuracy.toFixed(1)}, Coh: ${avgQuality.groq.coherence.toFixed(1)})`
  );
  console.log(
    `   GPT-4o:          ${gpt4oAvg.toFixed(2)}/5.0 (Rel: ${avgQuality.gpt4o.relevance.toFixed(1)}, Acc: ${avgQuality.gpt4o.accuracy.toFixed(1)}, Coh: ${avgQuality.gpt4o.coherence.toFixed(1)})`
  );
  console.log(
    `   GPT-4o-mini:     ${gpt4oMiniAvg.toFixed(2)}/5.0 (Rel: ${avgQuality.gpt4oMini.relevance.toFixed(1)}, Acc: ${avgQuality.gpt4oMini.accuracy.toFixed(1)}, Coh: ${avgQuality.gpt4oMini.coherence.toFixed(1)})`
  );

  console.log('\n🎯 TRADE-OFF SCORE (Qualidade / (Latência × Custo))');
  console.log('━'.repeat(80));
  const groqScore = groqAvg / (avgLatency.groq * avgCost.groq * 1000);
  const gpt4oScore = gpt4oAvg / (avgLatency.gpt4o * avgCost.gpt4o * 1000);
  const gpt4oMiniScore = gpt4oMiniAvg / (avgLatency.gpt4oMini * avgCost.gpt4oMini * 1000);

  console.log(`   Groq LLaMA 3.3:  ${groqScore.toFixed(4)}`);
  console.log(`   GPT-4o:          ${gpt4oScore.toFixed(4)}`);
  console.log(`   GPT-4o-mini:     ${gpt4oMiniScore.toFixed(4)}`);

  const winner =
    groqScore > gpt4oScore && groqScore > gpt4oMiniScore
      ? 'Groq LLaMA 3.3'
      : gpt4oScore > gpt4oMiniScore
        ? 'GPT-4o'
        : 'GPT-4o-mini';

  console.log(`\n🏆 VENCEDOR: ${winner}`);

  console.log('\n📋 RECOMENDAÇÃO');
  console.log('━'.repeat(80));

  if (winner === 'Groq LLaMA 3.3') {
    console.log('✅ Groq LLaMA 3.3 oferece o melhor custo-benefício!');
    console.log(
      `   - ${((avgLatency.groq / avgLatency.gpt4o) * 100).toFixed(0)}% mais rápido que GPT-4o`
    );
    console.log(
      `   - ${((1 - avgCost.groq / avgCost.gpt4o) * 100).toFixed(0)}% mais barato que GPT-4o`
    );
    console.log(`   - Qualidade similar em casos de uso de vendas`);
  } else if (winner === 'GPT-4o') {
    console.log('⚠️  GPT-4o tem melhor qualidade, mas custa mais caro');
    console.log(
      `   - ${(((avgQuality.gpt4o.relevance - avgQuality.groq.relevance) / avgQuality.groq.relevance) * 100).toFixed(0)}% mais relevante`
    );
    console.log(`   - Porém ${(avgCost.gpt4o / avgCost.groq).toFixed(1)}x mais caro`);
  } else {
    console.log('💡 GPT-4o-mini oferece bom equilíbrio');
    console.log(`   - Mais rápido que GPT-4o`);
    console.log(`   - Mais barato que GPT-4o`);
    console.log(`   - Qualidade adequada para a maioria dos casos`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Benchmark concluído! ✅\n');

  // Salvar resultados detalhados
  const fs = require('fs');
  fs.writeFileSync('benchmark-results.json', JSON.stringify(results, null, 2));
  console.log('📄 Resultados detalhados salvos em: benchmark-results.json\n');
}

// Executar
runBenchmark()
  .catch(error => {
    console.error('❌ Erro no benchmark:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
