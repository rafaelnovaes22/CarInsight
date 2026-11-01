/**
 * Valida o registro de riscos contra a metodologia e contra o codigo.
 *
 * ISO/IEC 42001 clausula 6.1. Regra de governance/risk/risk-methodology.md:
 * todo risco precisa de controle que aponte para arquivo real, e risco medio
 * ou acima precisa de aceitacao registrada. Controle que aponta para arquivo
 * inexistente e o que transforma registro de risco em ficcao.
 */

import {
  readGovernanceYaml,
  repoFileExists,
  reportIssues,
  type ValidationIssue,
} from './lib/governance-files';

const REGISTER = 'governance/risk/risk-register.yaml';

interface Risk {
  id: string;
  title: string;
  probability: number;
  impact: number;
  level: number;
  classification: string;
  controls?: string[];
  residual_classification?: string;
  accepted_by?: string;
  accepted_at?: string;
}

interface RiskRegister {
  risks: Risk[];
}

function classify(level: number): string {
  if (level <= 4) return 'baixo';
  if (level <= 9) return 'medio';
  if (level <= 14) return 'alto';
  return 'critico';
}

function checkLevelMatchesScores(risk: Risk): ValidationIssue[] {
  const expectedLevel = risk.probability * risk.impact;
  if (risk.level !== expectedLevel) {
    return [
      {
        file: REGISTER,
        problem: `${risk.id}: level ${risk.level} nao corresponde a probability x impact (${expectedLevel})`,
        fix: `corrigir level para ${expectedLevel} ou revisar as notas`,
      },
    ];
  }

  const expectedClassification = classify(risk.level);
  if (risk.classification !== expectedClassification) {
    return [
      {
        file: REGISTER,
        problem: `${risk.id}: classificacao "${risk.classification}" divergente da faixa (level ${risk.level} = ${expectedClassification})`,
        fix: `usar "${expectedClassification}", conforme risk-methodology.md`,
      },
    ];
  }

  return [];
}

function checkControlsPointToRealFiles(risk: Risk): ValidationIssue[] {
  const controls = risk.controls ?? [];

  if (controls.length === 0) {
    return [
      {
        file: REGISTER,
        problem: `${risk.id} nao declara nenhum controle`,
        fix: 'apontar arquivo de controle, item de backlog com prazo, ou aceitacao explicita',
      },
    ];
  }

  return controls
    .filter(control => !repoFileExists(control))
    .map(control => ({
      file: REGISTER,
      problem: `${risk.id}: controle "${control}" aponta para arquivo que nao existe`,
      fix: 'corrigir o caminho ou remover: controle inexistente e risco nao tratado',
    }));
}

function checkAcceptanceForMediumAndAbove(risk: Risk): ValidationIssue[] {
  const residual = risk.residual_classification ?? risk.classification;
  if (residual === 'baixo') return [];

  const issues: ValidationIssue[] = [];

  if (!risk.accepted_by) {
    issues.push({
      file: REGISTER,
      problem: `${risk.id}: risco residual "${residual}" sem accepted_by`,
      fix: 'registrar quem aceitou (AI Owner para medio ou acima)',
    });
  }

  if (!risk.accepted_at) {
    issues.push({
      file: REGISTER,
      problem: `${risk.id}: risco residual "${residual}" sem data de aceitacao`,
      fix: 'registrar accepted_at',
    });
  }

  if (residual === 'critico') {
    issues.push({
      file: REGISTER,
      problem: `${risk.id}: risco residual CRITICO em aberto`,
      fix: 'nao e aceitavel em producao: mitigar, rebaixar autonomia ou acionar kill switch',
    });
  }

  return issues;
}

function main(): void {
  const register = readGovernanceYaml<RiskRegister>(REGISTER);

  const issues = register.risks.flatMap(risk => [
    ...checkLevelMatchesScores(risk),
    ...checkControlsPointToRealFiles(risk),
    ...checkAcceptanceForMediumAndAbove(risk),
  ]);

  process.exit(reportIssues('registro de riscos', issues));
}

main();
