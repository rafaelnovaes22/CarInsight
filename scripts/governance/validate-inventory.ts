/**
 * Valida que o inventario de sistemas de IA reflete o codigo.
 *
 * ISO/IEC 42001 clausula 4.3 e Anexo A.4. Objetivo OBJ-008.
 * Falha se: modelo usado no codigo nao esta no inventario, modelo do inventario
 * nao tem model card, ou sistema aponta para arquivo que nao existe.
 */

import {
  readRepoFile,
  readGovernanceYaml,
  repoFileExists,
  extractQuotedValues,
  reportIssues,
  type ValidationIssue,
} from './lib/governance-files';

const INVENTORY = 'governance/inventory/ai-systems.yaml';
const MODEL_SOURCES = ['src/lib/llm-router.ts', 'src/lib/embedding-router.ts'];

/** Modelos que existem no codigo mas nao representam fornecedor real. */
const SYNTHETIC_MODELS = new Set(['mock']);

interface AiSystem {
  id: string;
  name: string;
  entrypoint?: string;
  models?: string[];
  aiia?: string;
  evals?: string[];
}

interface Inventory {
  systems: AiSystem[];
}

function collectModelsFromCode(): string[] {
  const models = new Set<string>();

  for (const source of MODEL_SOURCES) {
    const content = readRepoFile(source);
    for (const model of extractQuotedValues(content, 'model')) {
      if (!SYNTHETIC_MODELS.has(model)) models.add(model);
    }
  }

  return [...models];
}

function modelCardPath(model: string): string {
  return `governance/models/model-card-${model}.md`;
}

/** Model card de embeddings e agrupado: os dois modelos compartilham um card. */
const GROUPED_CARDS: Record<string, string> = {
  'text-embedding-3-small': 'governance/models/model-card-embeddings.md',
  'embed-multilingual-v3.0': 'governance/models/model-card-embeddings.md',
};

function checkModelsAreInventoried(inventory: Inventory): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const inventoried = new Set(inventory.systems.flatMap(system => system.models ?? []));

  for (const model of collectModelsFromCode()) {
    if (!inventoried.has(model)) {
      issues.push({
        file: INVENTORY,
        problem: `modelo "${model}" e usado no codigo e nao esta no inventario`,
        fix: `adicionar "${model}" ao campo models do sistema que o usa`,
      });
      continue;
    }

    const cardPath = GROUPED_CARDS[model] ?? modelCardPath(model);
    if (!repoFileExists(cardPath)) {
      issues.push({
        file: cardPath,
        problem: `modelo "${model}" esta no inventario e nao tem model card`,
        fix: `criar ${cardPath} com uso pretendido, uso vedado, limitacoes e avaliacao`,
      });
    }
  }

  return issues;
}

function checkReferencedFilesExist(inventory: Inventory): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const system of inventory.systems) {
    const referenced = [system.entrypoint, system.aiia].filter(
      (path): path is string => typeof path === 'string'
    );

    for (const path of referenced) {
      if (!repoFileExists(path)) {
        issues.push({
          file: INVENTORY,
          problem: `sistema ${system.id} aponta para "${path}", que nao existe`,
          fix: 'corrigir o caminho ou remover a referencia',
        });
      }
    }
  }

  return issues;
}

function main(): void {
  const inventory = readGovernanceYaml<Inventory>(INVENTORY);

  const issues = [...checkModelsAreInventoried(inventory), ...checkReferencedFilesExist(inventory)];

  process.exit(reportIssues('inventario de sistemas de IA', issues));
}

main();
