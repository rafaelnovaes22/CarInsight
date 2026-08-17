# AIMS — sistema de gestão de IA (ISO/IEC 42001)

**Implantado em:** 2026-07-29 · **Escopo:** ver `inventory/ai-systems.yaml` → `scope`
**Status honesto:** AIMS implantado e **auditado internamente**. **Não certificado** — certificação exige organismo acreditado e auditoria externa de estágio 1 e 2.

Este diretório não é documentação de vitrine: parte dele é **verificada em CI**. `npm run governance` falha o build quando um documento aqui divergir do código.

---

## Como isto se mantém verdadeiro

| Validador | O que impede | Comando |
|---|---|---|
| `validate-inventory.ts` | Modelo usado no código sem estar no inventário e sem model card | `npm run governance:inventory` |
| `validate-suppliers.ts` | Fornecedor recebendo dado sem estar no registro ou sem constar na política pública; fornecedor removido que continua declarado | `npm run governance:suppliers` |
| `validate-risk-register.ts` | Controle apontando para arquivo inexistente; nível de risco incoerente com as notas; risco médio ou acima sem aceitação registrada | `npm run governance:risks` |
| `check-staleness.ts` | Documento passado da própria data de revisão | `npm run governance:staleness` |

Tudo junto: `npm run governance`. No CI, roda antes dos testes (`.github/workflows/ci.yml`).

Os dois primeiros validadores nasceram de falhas reais: NC-001 (política declarava um fornecedor inexistente e omitia três reais) e o gate de model card.

## Rastreabilidade: cláusula → artefato → evidência

| Cláusula ISO 42001 | Artefato | Evidência em código |
|---|---|---|
| 4.1-4.2 Contexto e partes interessadas | `impact/AIIA-carinsight.md` §2 | — |
| 4.3 Escopo | `inventory/ai-systems.yaml` | Verificado em CI |
| 5.2 Política de IA | `policy/AI-POLICY.md` | `src/config/disclosure.messages.ts`, `src/services/guardrails.service.ts` |
| 5.3 Papéis | `roles/RACI.md` | — |
| 6.1 Riscos | `risk/risk-methodology.md`, `risk/risk-register.yaml` | Controles verificados em CI |
| 6.1.4 Avaliação de impacto | `impact/AIIA-carinsight.md` | — |
| 6.2 Objetivos | `metrics/objectives.yaml` | `src/services/recommendation-metrics.service.ts`, Prometheus |
| 6.3 / 8.1 Mudança e operação | `CHANGE-MANAGEMENT.md` | `.github/workflows/ci.yml`, `src/evaluation/benchmark-runner.ts` |
| 7.5 Informação documentada | Todo este diretório, versionado | `check-staleness.ts` |
| 9.1 Monitoramento | `metrics/objectives.yaml` | `recommendation-health-monitor.service.ts`, Grafana |
| 9.2 Auditoria interna | `audit/internal-audit-2026-07.md` | — |
| 9.3 Análise crítica | `audit/management-review-2026-Q3.md` | — |
| 10.2 Ação corretiva | `NONCONFORMITY.md`, `incidents/` | Testes de regressão por incidente |
| A.6 Ciclo de vida | `models/model-card-*.md` | `src/evaluation/golden-dataset.ts` |
| A.7 Dados | `data/data-lifecycle.md`, `data/datasheet-*.md` | `src/jobs/data-retention.job.ts`, `src/lib/privacy.ts` |
| A.8 Informação às partes interessadas | `policy/AI-POLICY.md` §2 | `src/config/disclosure.messages.ts`, `src/public/privacy-policy.html` |
| A.9 Uso responsável | `policy/AI-POLICY.md` §4 | `src/services/guardrails.service.ts` |
| A.10 Fornecedores | `suppliers/supplier-register.yaml` | Verificado em CI |

## Cadência

| Atividade | Frequência | Próxima |
|---|---|---|
| Análise crítica pela direção | Trimestral | 2026-10-29 |
| Auditoria interna | Semestral | 2027-01-29 |
| Revisão da política de IA | Anual | 2027-07-29 |
| Revisão de model cards | Trimestral | 2026-10-29 |
| Reavaliação de risco | Semestral, ou por gatilho | 2028-01-29 |

Gatilhos de reavaliação fora de cadência: modelo ou fornecedor novo, incidente S1 ou S2, entrada em vertical novo, mudança regulatória.

## O que está aberto

| Item | Descrição | Prazo |
|---|---|---|
| **NC-004** | Sem registro formal de treinamento dos operadores (cláusula 7.2) | 2026-09-30 |
| **GAP-002** | Sem análise de viés por subgrupo na recomendação (RSK-006) | 2026-10-31 |
| **GAP-003** | Sem verificação automatizada de mudança de termos de fornecedor (RSK-009) | 2026-12-31 |

## Como declarar isto externamente

Correto: *"controles de governança alinhados à ISO/IEC 42001 e a temas do EU AI Act, com AIMS implantado e auditado internamente; sem certificação externa"*.

Incorreto: "certificado ISO 42001", "conforme à ISO 42001", "governança ISO 42001 implementada" sem a ressalva.

A diferença não é cosmética: certificação é ato de terceiro acreditado. A decisão registrada na análise crítica de 2026-Q3 veda o uso da palavra "certificado".

## Estrutura

```
governance/
  README.md                  este índice
  policy/AI-POLICY.md         política de IA (cláusula 5.2)
  roles/RACI.md               papéis e matriz de decisão (5.3)
  inventory/ai-systems.yaml   inventário e escopo (4.3, A.4)
  risk/                       metodologia e registro de riscos (6.1)
  impact/AIIA-carinsight.md   avaliação de impacto (6.1.4, A.5)
  metrics/objectives.yaml     objetivos e indicadores (6.2)
  models/                     model cards (A.6)
  data/                       ciclo de vida e datasheets (A.7)
  suppliers/                  registro de fornecedores (A.10)
  incidents/                  procedimento e log de incidentes (8.1, 10.2)
  audit/                      auditoria interna e análise crítica (9.2, 9.3)
  CHANGE-MANAGEMENT.md        gestão de mudança (6.3)
  NONCONFORMITY.md            não conformidades e ações corretivas (10.2)
```
