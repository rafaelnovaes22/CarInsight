# Gestão de mudança em sistemas de IA

**Documento:** GOV-CHG-001 · **Versão:** 1.0 · **Atualizado:** 2026-07-29 · **Próxima revisão:** 2027-01-29
**Referência:** ISO/IEC 42001:2023 cláusulas 6.3 e 8.1, Anexo A.6

---

## Princípio

Mudança em prompt, modelo ou lógica de decisão é **mudança de comportamento do produto**, não refactor. Passa por gate. O gate não é opinião: é a eval suite.

## Classificação da mudança

| Tipo | Exemplos | Gate exigido | Aprovação |
|---|---|---|---|
| **Cosmética** | Texto de mensagem fixa, log, comentário | Testes existentes | Engenheiro de IA |
| **Comportamental** | System prompt, ordem do grafo, regra de guardrail, threshold de score | Evals completas + comparação com baseline | Engenheiro de IA, ciente o AI Owner |
| **Estrutural** | Modelo novo, provedor novo, mudança de embeddings, novo nó com decisão | Evals + model card + inventário + risco reavaliado | **AI Owner** |
| **De autonomia** | Promover shadow → assistido → autônomo | Evals + gate de custo + revisão do AIIA | **AI Owner** |

## Checklist para mudança comportamental ou acima

1. Rodar as evals contra a baseline (`src/evaluation/benchmark-runner.ts`) e registrar o delta.
2. Validar **no modelo mais fraco da cadeia**, não só no primário. Regra criada pelo incidente de 2026-03-13, em que o prompt segurava no `gpt-4.1-mini` e vazava identidade no `llama-3.1-8b-instant`.
3. Rodar a suíte de segurança (`tests/e2e/security/guardrails.test.ts`).
4. Se entrou modelo ou provedor: criar model card em `governance/models/`, atualizar `governance/inventory/ai-systems.yaml` e `governance/suppliers/supplier-register.yaml`.
5. Reavaliar os riscos ligados em `governance/risk/risk-register.yaml` e atualizar residual se mudou.
6. Se a mudança afeta o usuário final ou o tratamento de dado: revisar `governance/impact/AIIA-carinsight.md`.
7. Abrir PR. O CI roda testes, evals e os validadores de governança. **PR que adiciona modelo sem documentação não passa.**

## Rollback

Critério de rollback definido antes do deploy, não durante o incidente: queda de precision@3 abaixo do alvo de OBJ-001, qualquer falha no golden set adversarial (OBJ-002), aumento de custo por conversa acima do alvo de OBJ-003, ou latência p95 acima de 5 s (OBJ-004).

Rollback é decisão do Engenheiro de IA e não exige aprovação prévia: reverter é sempre permitido.

## Promoção de autonomia

Estágios: **shadow** (roda sem enviar, resultado comparado) → **assistido** (envia, pessoa disponível e handoff ativo) → **autônomo** (envia sem supervisão contínua).

Promover exige, cumulativamente: evals verdes por período definido, custo por resultado dentro do alvo, zero incidente S1 ou S2 no período, e aprovação registrada do AI Owner. Estágio atual de cada sistema está no inventário.

**Rebaixar autonomia é a primeira resposta a incidente**, antes de qualquer correção de código.
