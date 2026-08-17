/**
 * Verifica se documento de governanca passou da propria data de revisao.
 *
 * ISO/IEC 42001 clausulas 7.5 e 9.3. O objetivo e simples: documento de
 * governanca vencido e pior do que documento ausente, porque parece valido.
 * Cada artefato declara "Proxima revisao" ou "next_review", e este script cobra.
 *
 * Por padrao apenas avisa (exit 0). Com --strict, falha o build.
 */

import { readRepoFile, reportIssues, type ValidationIssue } from './lib/governance-files';

const TRACKED_DOCUMENTS = [
  'governance/policy/AI-POLICY.md',
  'governance/roles/RACI.md',
  'governance/inventory/ai-systems.yaml',
  'governance/risk/risk-methodology.md',
  'governance/risk/risk-register.yaml',
  'governance/impact/AIIA-carinsight.md',
  'governance/metrics/objectives.yaml',
  'governance/data/data-lifecycle.md',
  'governance/CHANGE-MANAGEMENT.md',
  'governance/suppliers/supplier-register.yaml',
  'governance/incidents/incident-response.md',
  'governance/models/model-card-gpt-4.1-mini.md',
  'governance/models/model-card-gemini-2.5-flash.md',
  'governance/models/model-card-llama-3.1-8b-instant.md',
  'governance/models/model-card-embeddings.md',
];

/** Aceita "Próxima revisão: 2027-07-29", "next_review: 2027-07-29" e variantes sem acento. */
const REVIEW_DATE_PATTERN =
  /(?:pr[óo]xima\s+revis[ãa]o|next_review|next\s+review)\s*:?\s*\**\s*(\d{4}-\d{2}-\d{2})/i;

function findReviewDate(content: string): string | null {
  const match = content.match(REVIEW_DATE_PATTERN);
  return match ? match[1] : null;
}

function checkDocument(path: string, today: Date): ValidationIssue[] {
  const reviewDate = findReviewDate(readRepoFile(path));

  if (!reviewDate) {
    return [
      {
        file: path,
        problem: 'nao declara data de proxima revisao',
        fix: 'adicionar "Próxima revisão: YYYY-MM-DD" no cabecalho, ou next_review no YAML',
      },
    ];
  }

  const due = new Date(`${reviewDate}T00:00:00Z`);
  if (Number.isNaN(due.getTime())) {
    return [
      {
        file: path,
        problem: `data de revisao invalida: "${reviewDate}"`,
        fix: 'usar formato YYYY-MM-DD',
      },
    ];
  }

  if (due >= today) return [];

  const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
  return [
    {
      file: path,
      problem: `revisao vencida em ${reviewDate} (${daysOverdue} dia(s) atras)`,
      fix: 'revisar o conteudo e atualizar a data, ou registrar por que segue valido',
    },
  ];
}

function main(): void {
  const strict = process.argv.includes('--strict');
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');

  const issues = TRACKED_DOCUMENTS.flatMap(path => checkDocument(path, today));
  const exitCode = reportIssues('frescor dos documentos de governanca', issues);

  if (!strict && exitCode !== 0) {
    console.error('AVISO: rodando sem --strict, entao isto nao falha o build.');
    process.exit(0);
  }

  process.exit(exitCode);
}

main();
