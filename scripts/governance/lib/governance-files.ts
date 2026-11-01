/**
 * Helpers compartilhados pelos validadores de governanca.
 *
 * Regra do AIMS: documento de governanca que pode divergir do codigo sem
 * ninguem notar nao e controle, e decoracao. Estes helpers existem para que
 * cada validador seja curto e legivel.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parse } from 'yaml';

/**
 * Sobe do cwd procurando package.json. Funciona igual em CJS e ESM, e nao
 * depende de import.meta (indefinido quando o tsx transpila para CJS).
 */
function findRepoRoot(): string {
  let current = process.cwd();

  while (!existsSync(resolve(current, 'package.json'))) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(
        `Raiz do repositorio nao encontrada a partir de ${process.cwd()}: ` +
          'nenhum package.json encontrado subindo a arvore de diretorios.'
      );
    }
    current = parent;
  }

  return current;
}

export const REPO_ROOT = findRepoRoot();

export interface ValidationIssue {
  file: string;
  problem: string;
  fix: string;
}

/** Le um arquivo do repositorio. Lanca com caminho no erro, nunca mensagem vaga. */
export function readRepoFile(relativePath: string): string {
  const fullPath = resolve(REPO_ROOT, relativePath);

  if (!existsSync(fullPath)) {
    throw new Error(
      `Arquivo de governanca ausente: ${relativePath} (esperado em ${fullPath}). ` +
        `Ver governance/README.md para a lista de artefatos obrigatorios.`
    );
  }

  return readFileSync(fullPath, 'utf8');
}

/** Le e parseia um YAML de governanca. */
export function readGovernanceYaml<T>(relativePath: string): T {
  const raw = readRepoFile(relativePath);

  try {
    return parse(raw) as T;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`YAML invalido em ${relativePath}: ${detail}`);
  }
}

export function repoFileExists(relativePath: string): boolean {
  return existsSync(resolve(REPO_ROOT, relativePath));
}

/** Extrai valores de uma propriedade repetida em codigo TS, ex.: model: 'x'. */
export function extractQuotedValues(source: string, property: string): string[] {
  const pattern = new RegExp(`${property}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`, 'g');
  const found = new Set<string>();

  for (const match of source.matchAll(pattern)) {
    found.add(match[1]);
  }

  return [...found];
}

/** Imprime o resultado e devolve o exit code, para o validador so chamar process.exit. */
export function reportIssues(checkName: string, issues: ValidationIssue[]): number {
  if (issues.length === 0) {
    console.log(`OK  ${checkName}`);
    return 0;
  }

  console.error(`\nFALHA  ${checkName}: ${issues.length} problema(s)\n`);
  for (const issue of issues) {
    console.error(`  [${issue.file}]`);
    console.error(`    problema: ${issue.problem}`);
    console.error(`    corrigir: ${issue.fix}\n`);
  }

  return 1;
}
