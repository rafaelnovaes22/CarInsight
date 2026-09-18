#!/usr/bin/env node
// Replaces the historical 3-layer, 20-case simulated judge with production-function contracts.
// Fixture provenance and failed assertions stay in the report. No external judge is simulated.
// Offline fixtures measure these contracts only, never a general hallucination rate.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const reportDir = dirname(fileURLToPath(import.meta.url));
const root = join(reportDir, '../..');
const temporary = mkdtempSync(join(tmpdir(), 'carinsight-eval-'));
const resultsPath = join(temporary, 'vitest.json');
// The child inherits no credentials, so this gate cannot silently call paid providers.
const run = spawnSync(
  process.execPath,
  [
    join(root, 'node_modules/vitest/vitest.mjs'),
    'run',
    '--config',
    join(reportDir, 'vitest.config.mjs'),
    '--reporter=json',
    `--outputFile=${resultsPath}`,
  ],
  { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, NODE_ENV: 'test' } }
);

try {
  const measured = JSON.parse(readFileSync(resultsPath, 'utf8'));
  const passed = measured.numPassedTests;
  const total = measured.numTotalTests;
  const pass = run.status === 0 && measured.success === true && total > 0 && passed === total;
  const report = {
    timestamp: new Date().toISOString(),
    scope: 'offline-production-contracts',
    productionQualified: false,
    total,
    passed,
    pass,
    provenance: { fixtures: 'tests/unit/evaluation/ranker-fixtures.ts', version: 1 },
    limitations: [
      'Database boundary is mocked',
      'No LLM replies measured',
      'No live inventory measured',
    ],
    results: measured.testResults.flatMap(suite =>
      suite.assertionResults.map(result => ({
        name: result.fullName,
        status: result.status,
        failures: result.failureMessages,
      }))
    ),
  };
  writeFileSync(join(reportDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({ event: 'offline_evaluation', pass, passed, total, productionQualified: false })
  );
  process.exitCode = pass ? 0 : 1;
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'offline_evaluation_failed',
      reason: error.message,
      stderr: run.stderr,
    })
  );
  process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
