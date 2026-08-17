/**
 * Valida que o registro de fornecedores, o codigo e a politica de privacidade
 * publica falam a mesma coisa sobre quem recebe dado do usuario.
 *
 * ISO/IEC 42001 Anexo A.10 + LGPD art. 6, VI (transparencia).
 * Este validador existe por causa da NC-001: a politica declarava "Jina AI"
 * (inexistente no codigo) e omitia OpenAI, Google e Cohere, que sao os
 * provedores reais. Ver governance/NONCONFORMITY.md.
 */

import {
  readRepoFile,
  readGovernanceYaml,
  reportIssues,
  type ValidationIssue,
} from './lib/governance-files';

const REGISTER = 'governance/suppliers/supplier-register.yaml';
const PRIVACY_POLICY = 'src/public/privacy-policy.html';
const CODE_SOURCES = ['src/lib/llm-router.ts', 'src/lib/embedding-router.ts'];

/** Fornecedor no codigo -> como aparece no registro. */
const CODE_TO_SUPPLIER: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Google (Gemini / Vertex AI)',
  groq: 'Groq',
  cohere: 'Cohere',
};

/** Termo que precisa aparecer na politica publica para o fornecedor ser considerado declarado. */
const SUPPLIER_TO_POLICY_TERM: Record<string, string> = {
  OpenAI: 'OpenAI',
  'Google (Gemini / Vertex AI)': 'Google',
  Groq: 'Groq',
  Cohere: 'Cohere',
  'Meta (WhatsApp Business / Cloud API)': 'Meta',
  Railway: 'Railway',
};

interface Supplier {
  id: string;
  name: string;
  declared_in_privacy_policy?: boolean;
}

interface RemovedSupplier {
  name: string;
}

interface Register {
  suppliers: Supplier[];
  removed?: RemovedSupplier[];
}

function detectProvidersInCode(): string[] {
  const found = new Set<string>();

  for (const source of CODE_SOURCES) {
    const content = readRepoFile(source).toLowerCase();
    for (const [codeName, supplierName] of Object.entries(CODE_TO_SUPPLIER)) {
      if (content.includes(codeName)) found.add(supplierName);
    }
  }

  return [...found];
}

function checkCodeProvidersAreRegistered(register: Register): ValidationIssue[] {
  const registered = new Set(register.suppliers.map(supplier => supplier.name));

  return detectProvidersInCode()
    .filter(name => !registered.has(name))
    .map(name => ({
      file: REGISTER,
      problem: `provedor "${name}" e usado no codigo e nao esta no registro de fornecedores`,
      fix: `adicionar "${name}" com dado enviado, regiao, politica de treinamento e plano de saida`,
    }));
}

function checkDeclaredSuppliersAppearInPolicy(register: Register): ValidationIssue[] {
  const policy = readRepoFile(PRIVACY_POLICY);
  const issues: ValidationIssue[] = [];

  for (const supplier of register.suppliers) {
    if (supplier.declared_in_privacy_policy !== true) continue;

    const term = SUPPLIER_TO_POLICY_TERM[supplier.name];
    if (!term) {
      issues.push({
        file: REGISTER,
        problem: `fornecedor "${supplier.name}" marcado como declarado, sem termo mapeado para busca na politica`,
        fix: 'adicionar o termo em SUPPLIER_TO_POLICY_TERM neste validador',
      });
      continue;
    }

    if (!policy.includes(term)) {
      issues.push({
        file: PRIVACY_POLICY,
        problem: `"${supplier.name}" recebe dado e nao aparece na politica de privacidade publica`,
        fix: `declarar "${term}" nas secoes de processamento e de compartilhamento`,
      });
    }
  }

  return issues;
}

function checkRemovedSuppliersAreGoneFromPolicy(register: Register): ValidationIssue[] {
  const policy = readRepoFile(PRIVACY_POLICY);

  return (register.removed ?? [])
    .filter(removed => policy.includes(removed.name))
    .map(removed => ({
      file: PRIVACY_POLICY,
      problem: `"${removed.name}" foi removido do registro e continua citado na politica publica`,
      fix: `remover "${removed.name}" da politica: declarar fornecedor que nao existe tambem e informacao errada`,
    }));
}

function main(): void {
  const register = readGovernanceYaml<Register>(REGISTER);

  const issues = [
    ...checkCodeProvidersAreRegistered(register),
    ...checkDeclaredSuppliersAppearInPolicy(register),
    ...checkRemovedSuppliersAreGoneFromPolicy(register),
  ];

  process.exit(reportIssues('fornecedores: codigo x registro x politica publica', issues));
}

main();
