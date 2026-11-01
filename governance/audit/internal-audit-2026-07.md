# Auditoria interna do AIMS — julho de 2026

**Documento:** GOV-AUD-001 · **Data:** 2026-07-29 · **Auditor:** AI Owner (autoauditoria declarada)
**Escopo:** SYS-001 a SYS-004 · **Referência:** ISO/IEC 42001:2023 cláusula 9.2
**Próxima auditoria:** 2027-01-29 (semestral)

---

## Ressalva de independência

Esta é uma **autoauditoria**: auditor e auditado são a mesma pessoa, porque o produto é operado por uma pessoa. A norma pede imparcialidade, e isso aqui não é plenamente atendido. A mitigação adotada é objetiva: cada conformidade abaixo aponta para **arquivo verificável**, e os validadores em CI checam parte das afirmações automaticamente. Terceiro pode reexecutar a verificação sem depender da palavra do auditor.

Quando houver segunda pessoa técnica no projeto, a auditoria passa a ser cruzada.

---

## Resultado por cláusula

| Cláusula | Requisito | Status | Evidência |
|---|---|---|---|
| 4.1-4.2 | Contexto e partes interessadas | **Conforme** | `impact/AIIA-carinsight.md` §2, `inventory/ai-systems.yaml` |
| 4.3 | Escopo do AIMS | **Conforme** | `inventory/ai-systems.yaml` → `scope` |
| 4.4 | Sistema de gestão estabelecido | **Conforme com observação** | Estrutura `governance/` completa; operando há 1 dia, sem histórico |
| 5.1 | Liderança e comprometimento | **Conforme** | `policy/AI-POLICY.md`, `roles/RACI.md` |
| 5.2 | Política de IA | **Conforme** | `policy/AI-POLICY.md` v1.0, aprovada |
| 5.3 | Papéis e responsabilidades | **Conforme** | `roles/RACI.md` com matriz de decisão |
| 6.1 | Riscos e oportunidades | **Conforme** | `risk/risk-methodology.md`, `risk/risk-register.yaml` (10 riscos) |
| 6.1.4 | Avaliação de impacto do sistema de IA | **Conforme** | `impact/AIIA-carinsight.md` |
| 6.2 | Objetivos de IA | **Conforme** | `metrics/objectives.yaml` (8 objetivos, todos com fonte de medição) |
| 6.3 | Planejamento de mudança | **Conforme** | `CHANGE-MANAGEMENT.md` |
| 7.1-7.2 | Recursos e competência | **Não conforme** | Competência exigida está declarada no RACI, mas **não há registro de treinamento** dos operadores do cliente |
| 7.3 | Conscientização | **Conforme com observação** | Treinamento de operador aconteceu, sem registro formal |
| 7.4 | Comunicação | **Conforme** | Escalada no RACI, comunicação externa em `incidents/incident-response.md` §5 |
| 7.5 | Informação documentada | **Conforme** | Tudo versionado em git, com versão e data de revisão por documento |
| 8.1 | Planejamento e controle operacional | **Conforme** | `CHANGE-MANAGEMENT.md`, gates em `.github/workflows/ci.yml` |
| 8.2-8.4 | Avaliação de impacto e ciclo de vida | **Conforme** | AIIA + model cards + eval suite |
| 9.1 | Monitoramento e medição | **Conforme** | `metrics/objectives.yaml`, Prometheus, `recommendation-health-monitor.service.ts` |
| 9.2 | Auditoria interna | **Conforme** | Este documento |
| 9.3 | Análise crítica pela direção | **Conforme** | `audit/management-review-2026-Q3.md` |
| 10.1-10.2 | Melhoria e ação corretiva | **Conforme** | `NONCONFORMITY.md` com 3 NCs tratadas |

### Anexo A (amostragem)

| Controle | Status | Evidência |
|---|---|---|
| A.2 Política | Conforme | `policy/AI-POLICY.md` |
| A.3 Papéis | Conforme | `roles/RACI.md` |
| A.4 Recursos | Conforme | `inventory/ai-systems.yaml` |
| A.5 Avaliação de impacto | Conforme | `impact/AIIA-carinsight.md` |
| A.6 Ciclo de vida | **Forte** | Golden dataset, benchmark runner, model cards, CI como gate |
| A.7 Dados | Conforme | `data/data-lifecycle.md`, datasheets, job de retenção |
| A.8 Informação às partes interessadas | **Forte** | `disclosure.messages.ts`, política pública, disclosure em todo template |
| A.9 Uso responsável | Conforme | Usos vedados na política, guardrails, handoff |
| A.10 Fornecedores | Conforme | `suppliers/supplier-register.yaml` |

---

## Não conformidades encontradas

**NC-001** (política divergente dos fornecedores) e **NC-002** (retenção não executada) foram detectadas **durante** esta implantação e fechadas na mesma data. **NC-003** (alegação incorreta de re-ranking em material externo) idem. Detalhe em `NONCONFORMITY.md`.

**NC-004 — Ausência de registro de treinamento (cláusula 7.2).** Aberta nesta auditoria.
O RACI declara a competência exigida do operador de negócio, e o treinamento efetivamente ocorreu, mas não existe registro (quem, quando, conteúdo, confirmação). Sem registro, o controle não é demonstrável.
**Ação:** criar `governance/audit/training-log.md` e registrar retroativamente o que for possível confirmar. **Responsável:** AI Owner. **Prazo:** 2026-09-30.

---

## Observações (não são NC)

1. **O AIMS tem um dia de vida.** Toda conformidade acima é de *estrutura*, não de *histórico operacional*. Um auditor externo pediria evidência de funcionamento ao longo do tempo: registros de análise crítica, incidentes tratados no processo, revisões cumpridas. Isso só o tempo entrega.
2. **GAP-002** (análise de viés por subgrupo, RSK-006) e **GAP-003** (verificação de mudança de termos de fornecedor, RSK-009) seguem abertos com prazo, e são as fragilidades técnicas mais relevantes.
3. **Autonomia declarada como "assistido"** em SYS-001 e SYS-002 está coerente com os controles observados. Não há evidência para promover a autônomo, e não se recomenda.

## Conclusão

O AIMS está **implantado e coerente com o código**, com uma não conformidade aberta (NC-004, registro de treinamento) e duas lacunas técnicas com prazo. Não há impedimento à operação no estágio assistido.

A afirmação defensável hoje é: *"sistema de gestão de IA implantado, auditado internamente, com não conformidades registradas e em tratamento"*. **Não** é: "certificado" nem "conforme à ISO 42001" — certificação exige organismo acreditado e auditoria externa de estágio 1 e 2.
