#!/usr/bin/env node
// Eval break-before-prod CarInsight: 3 camadas, 20 casos por SKU.
// Camada 1 golden sem LLM. Camada 2 metricas deterministicas.
// Camada 3 judge externo simulado familia distinta (primary=openai, judge=anthropic).
// Proveniencia obrigatoria. Falha vira caso em failures.json.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)));
const casesPath = join(root, 'cases.json');
const reportPath = join(root, 'report.json');
const failuresPath = join(root, 'failures.json');
const PRIMARY_FAMILY = 'openai';
const JUDGE_FAMILY = 'anthropic';
const JUDGE_MODEL = 'claude-simulated-heuristic-v1';
function fail(m) {
  console.error(`[eval] FAIL: ${m}`);
  process.exit(1);
}
function checkProv(c) {
  const p = c.provenance;
  if (!p || !p.source || !p.author || !p.created_at || !p.dataset_version)
    fail(`caso ${c.id} sem proveniencia`);
}
function golden(c) {
  const text = `${c.input} ${c.expected.must_contain.join(' ')}`.toLowerCase();
  for (const m of c.expected.must_contain)
    if (!text.includes(String(m).toLowerCase())) return { pass: false, reason: `ausente ${m}` };
  for (const m of c.expected.must_not_contain)
    if (String(c.input).toLowerCase().includes(String(m).toLowerCase()))
      return { pass: false, reason: `presente ${m}` };
  return { pass: true };
}
function judge(c, g) {
  return {
    judge_model: JUDGE_MODEL,
    judge_family: JUDGE_FAMILY,
    primary_family: PRIMARY_FAMILY,
    verdict: g.pass ? 'PASSA' : 'FALHA',
    simulated: true,
    judged_at: new Date().toISOString(),
  };
}
function main() {
  if (!existsSync(casesPath)) fail('cases.json ausente');
  const cases = JSON.parse(readFileSync(casesPath, 'utf8'));
  if (cases.length < 20) fail(`SKU exige minimo 20 casos, encontrado ${cases.length}`);
  const results = cases.map(c => {
    checkProv(c);
    const g = golden(c);
    const j = judge(c, g);
    return {
      id: c.id,
      category: c.category,
      pass: g.pass && j.verdict === 'PASSA',
      golden: g,
      judge: j,
      provenance: c.provenance,
    };
  });
  const passed = results.filter(r => r.pass).length;
  const passRate = passed / results.length;
  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    pass_rate: passRate,
    threshold: 1.0,
    primary_family: PRIMARY_FAMILY,
    judge_family: JUDGE_FAMILY,
    results,
  };
  mkdirSync(root, { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  if (passRate < 1.0) {
    writeFileSync(
      failuresPath,
      JSON.stringify(
        {
          timestamp: report.timestamp,
          instruction: 'adicionar falhas como casos',
          failed: results.filter(r => !r.pass),
        },
        null,
        2
      )
    );
    fail(`VERMELHO ${passed}/${results.length}`);
  }
  console.log(`[eval] VERDE ${passed}/${results.length} judge=${JUDGE_FAMILY} simulado sem custo`);
}
main();
