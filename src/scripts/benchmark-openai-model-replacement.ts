import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

type CandidateModel = 'gpt-5-mini' | 'gpt-4.1-mini' | 'gpt-5-nano' | 'gpt-4o';

interface TestCase {
  id: string;
  description: string;
  system: string;
  user: string;
  validator: (output: string) => number;
}

interface RunResult {
  model: CandidateModel;
  testId: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  output: string;
  quality: number;
  costUsd: number;
}

interface AggregateModelResult {
  model: CandidateModel;
  qualityAvg: number;
  latencyAvgMs: number;
  costAvgUsd: number;
  compositeScore: number;
  runs: number;
  failures: number;
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CANDIDATES: CandidateModel[] = ['gpt-5-mini', 'gpt-4.1-mini', 'gpt-5-nano', 'gpt-4o'];
const ITERATIONS = 3;
const MAX_OUTPUT_TOKENS = 220;

// Prices per 1M tokens from OpenAI pricing page (checked Feb 18, 2026).
const PRICING_USD_PER_1M: Record<CandidateModel, { input: number; output: number }> = {
  'gpt-5-mini': { input: 0.25, output: 2.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-5-nano': { input: 0.05, output: 0.4 },
  'gpt-4o': { input: 2.5, output: 10.0 },
};

const TEST_CASES: TestCase[] = [
  {
    id: 'intent_classification',
    description: 'Classificacao de intencao em rotulo unico',
    system:
      'Classifique a intencao. Responda EXATAMENTE com uma palavra: QUALIFICAR, HUMANO, INFORMACAO ou OUTRO.',
    user: 'Quero comprar um SUV automatico ate 90 mil para uso diario.',
    validator: output => {
      const normalized = output.trim().toUpperCase();
      return normalized === 'QUALIFICAR' ? 1 : 0;
    },
  },
  {
    id: 'preference_extraction_json',
    description: 'Extracao estruturada de preferencias em JSON',
    system:
      'Extraia preferencias e responda somente JSON valido com campos: budgetMax(number), bodyType(string), transmission(string), usage(string).',
    user: 'Tenho 75 mil, quero um sedan automatico para usar no trabalho e viajar no fim de semana.',
    validator: output => {
      try {
        const parsed = JSON.parse(output);
        let score = 0;
        if (typeof parsed.budgetMax === 'number') score += 0.3;
        if (typeof parsed.bodyType === 'string') score += 0.2;
        if (typeof parsed.transmission === 'string') score += 0.2;
        if (typeof parsed.usage === 'string') score += 0.2;
        if (String(parsed.bodyType || '').toLowerCase().includes('sedan')) score += 0.1;
        return Math.min(1, score);
      } catch {
        return 0;
      }
    },
  },
  {
    id: 'recommendation_explanation',
    description: 'Justificativa de recomendacao curta e util',
    system:
      'Explique em ate 3 frases por que o carro recomendado combina com o perfil do cliente. Seja objetivo.',
    user:
      'Perfil: familia com 2 filhos, uso urbano, orcamento 95 mil. Veiculo: Chevrolet Spin 2022, 7 lugares, cambio automatico, manutencao acessivel.',
    validator: output => {
      const lower = output.toLowerCase();
      let score = 0;
      if (lower.includes('famil')) score += 0.25;
      if (lower.includes('orcamento') || lower.includes('95')) score += 0.25;
      if (lower.includes('7 lugares') || lower.includes('espaco')) score += 0.25;
      if (output.length >= 90 && output.length <= 500) score += 0.25;
      return Math.min(1, score);
    },
  },
  {
    id: 'objection_handling',
    description: 'Resposta a objecao de preco com foco comercial',
    system:
      'Responda como consultor de vendas. Cliente disse que o carro esta caro. Traga argumentos de valor sem inventar fatos.',
    user: 'Esse Corolla 2021 esta caro. Vi um mais barato em outro lugar.',
    validator: output => {
      const lower = output.toLowerCase();
      let score = 0;
      if (lower.includes('procedencia') || lower.includes('historico')) score += 0.25;
      if (lower.includes('garantia') || lower.includes('revis')) score += 0.25;
      if (lower.includes('valor') || lower.includes('custo-beneficio')) score += 0.25;
      if (output.length >= 80) score += 0.25;
      return Math.min(1, score);
    },
  },
  {
    id: 'financial_explanation',
    description: 'Explicacao de financiamento clara e comparativa',
    system:
      'Explique a diferenca entre SAC e PRICE em linguagem simples. Termine com uma recomendacao condicional.',
    user: 'Qual e melhor para financiar 60 mil em 48 meses?',
    validator: output => {
      const lower = output.toLowerCase();
      let score = 0;
      if (lower.includes('sac')) score += 0.2;
      if (lower.includes('price')) score += 0.2;
      if (lower.includes('parcela')) score += 0.2;
      if (lower.includes('juros')) score += 0.2;
      if (lower.includes('depende') || lower.includes('se')) score += 0.2;
      return Math.min(1, score);
    },
  },
];

function calculateCostUsd(
  model: CandidateModel,
  promptTokens: number,
  completionTokens: number
): number {
  const price = PRICING_USD_PER_1M[model];
  return (promptTokens / 1_000_000) * price.input + (completionTokens / 1_000_000) * price.output;
}

async function runSingle(model: CandidateModel, test: TestCase): Promise<RunResult> {
  const start = Date.now();
  const usesMaxCompletionTokens = model.startsWith('gpt-5');

  const payload: any = {
    model,
    messages: [
      { role: 'system', content: test.system },
      { role: 'user', content: test.user },
    ],
  };
  if (!usesMaxCompletionTokens) {
    payload.temperature = 0.2;
  }
  if (usesMaxCompletionTokens) {
    payload.max_completion_tokens = MAX_OUTPUT_TOKENS;
  } else {
    payload.max_tokens = MAX_OUTPUT_TOKENS;
  }

  const resp = await client.chat.completions.create(payload);

  const latencyMs = Date.now() - start;
  const output = resp.choices[0]?.message?.content ?? '';
  const promptTokens = resp.usage?.prompt_tokens ?? 0;
  const completionTokens = resp.usage?.completion_tokens ?? 0;
  const totalTokens = resp.usage?.total_tokens ?? promptTokens + completionTokens;
  const quality = test.validator(output);
  const costUsd = calculateCostUsd(model, promptTokens, completionTokens);

  return {
    model,
    testId: test.id,
    latencyMs,
    promptTokens,
    completionTokens,
    totalTokens,
    output,
    quality,
    costUsd,
  };
}

function aggregate(results: RunResult[], failuresByModel: Record<CandidateModel, number>) {
  const byModel = new Map<CandidateModel, RunResult[]>();
  for (const model of CANDIDATES) byModel.set(model, []);
  for (const r of results) byModel.get(r.model)!.push(r);

  const qualityMin = 0;
  const qualityMax = 1;

  const latencyMins = Math.min(
    ...CANDIDATES.map(m => avg(byModel.get(m)!.map(x => x.latencyMs), Number.MAX_SAFE_INTEGER))
  );
  const latencyMaxs = Math.max(...CANDIDATES.map(m => avg(byModel.get(m)!.map(x => x.latencyMs), 0)));

  const costMins = Math.min(...CANDIDATES.map(m => avg(byModel.get(m)!.map(x => x.costUsd), 0)));
  const costMaxs = Math.max(...CANDIDATES.map(m => avg(byModel.get(m)!.map(x => x.costUsd), 0)));

  const rows: AggregateModelResult[] = CANDIDATES.map(model => {
    const runs = byModel.get(model)!;
    const qualityAvg = avg(runs.map(r => r.quality), 0);
    const latencyAvgMs = avg(runs.map(r => r.latencyMs), 0);
    const costAvgUsd = avg(runs.map(r => r.costUsd), 0);

    const qualityNorm = normalize(qualityAvg, qualityMin, qualityMax, true);
    const latencyNorm = normalize(latencyAvgMs, latencyMins, latencyMaxs, false);
    const costNorm = normalize(costAvgUsd, costMins, costMaxs, false);

    // Weights for this project profile:
    // quality 60%, latency 25%, cost 15%.
    const compositeScore = qualityNorm * 0.6 + latencyNorm * 0.25 + costNorm * 0.15;

    return {
      model,
      qualityAvg,
      latencyAvgMs,
      costAvgUsd,
      compositeScore,
      runs: runs.length,
      failures: failuresByModel[model],
    };
  });

  rows.sort((a, b) => {
    // Always push models with no successful runs to the bottom.
    if (a.runs === 0 && b.runs > 0) return 1;
    if (b.runs === 0 && a.runs > 0) return -1;
    return b.compositeScore - a.compositeScore;
  });
  return rows;
}

function avg(values: number[], fallback: number): number {
  if (!values.length) return fallback;
  return values.reduce((acc, cur) => acc + cur, 0) / values.length;
}

function normalize(value: number, min: number, max: number, higherIsBetter: boolean): number {
  if (max === min) return 1;
  const raw = (value - min) / (max - min);
  return higherIsBetter ? raw : 1 - raw;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY nao encontrado.');
  }

  const results: RunResult[] = [];
  const failuresByModel: Record<CandidateModel, number> = {
    'gpt-5-mini': 0,
    'gpt-4.1-mini': 0,
    'gpt-5-nano': 0,
    'gpt-4o': 0,
  };

  console.log('Benchmark de substituicao do gpt-4o-mini');
  console.log(`Modelos: ${CANDIDATES.join(', ')}`);
  console.log(`Casos: ${TEST_CASES.length}, iteracoes por caso: ${ITERATIONS}`);
  console.log('');

  for (const test of TEST_CASES) {
    console.log(`Caso: ${test.id} - ${test.description}`);
    for (let i = 1; i <= ITERATIONS; i += 1) {
      for (const model of CANDIDATES) {
        process.stdout.write(`  [${i}/${ITERATIONS}] ${model} ... `);
        try {
          const r = await runSingle(model, test);
          results.push(r);
          console.log(
            `ok (${r.latencyMs}ms, q=${r.quality.toFixed(2)}, cost=$${r.costUsd.toFixed(6)})`
          );
        } catch (error: any) {
          failuresByModel[model] += 1;
          console.log(`erro (${error?.message || 'unknown'})`);
        }
      }
    }
    console.log('');
  }

  const summary = aggregate(results, failuresByModel);
  console.log('Resumo por modelo:');
  for (const row of summary) {
    console.log(
      `${row.model.padEnd(11)} | score=${row.compositeScore.toFixed(4)} | quality=${row.qualityAvg.toFixed(
        3
      )} | latency=${row.latencyAvgMs.toFixed(0)}ms | cost=$${row.costAvgUsd.toFixed(6)} | runs=${row.runs} | failures=${row.failures}`
    );
  }

  const winner = summary[0];
  console.log('');
  console.log(`Melhor substituto (score composto): ${winner.model}`);
}

main().catch(err => {
  console.error('Falha no benchmark:', err?.message || err);
  process.exit(1);
});

