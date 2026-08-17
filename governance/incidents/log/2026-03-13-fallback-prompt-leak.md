# Incidente 2026-03-13 — system prompt vazando no modelo de fallback

**Severidade:** S2 · **Sistema:** SYS-001 · **Detectado por:** primeira execução do eval spine
**Status:** fechado · **Risco relacionado:** RSK-002, RSK-010

## O que aconteceu

A primeira execução da eval suite com golden set adversarial testou aderência de papel em toda a cadeia de modelos, não só no primário. O `gpt-4.1-mini` segurava as instruções normalmente. No fallback barato, `llama-3.1-8b-instant` (Groq), o mesmo prompt quebrou: o modelo **revelou a própria identidade de sistema e inventou um desconto** que não existia.

## Impacto real

Nenhum usuário afetado: pegou em avaliação, antes de chegar a produção nesse caminho. O impacto foi de confiança interna, e é justamente o ponto: sem a eval rodando no modelo mais fraco, isso teria chegado ao usuário na primeira indisponibilidade do provedor primário.

## Contenção aplicada

Não foi necessário conter em produção. O gate de promoção bloqueou a subida.

## Causa raiz

Duas causas somadas:

1. **O prompt assumia capacidade de instrução do modelo grande.** Instruções longas e implícitas, que um modelo de 8B não sustenta.
2. **A avaliação testava só o melhor caminho.** A suíte rodava no provedor primário, e a cadeia de fallback era tratada como detalhe de infraestrutura, não como superfície de comportamento.

## Ação corretiva

- System prompt reestruturado: regras de papel e de identidade explícitas e curtas, no topo, em vez de diluídas.
- **Regra permanente: o gate de promoção passa a exigir aprovação no modelo mais fraco da cadeia**, não no primário. Está em `governance/CHANGE-MANAGEMENT.md`, item 2 do checklist.
- Caso adversarial fixado no golden set (`src/evaluation/golden-dataset.ts`).

## Como fica coberto

`OBJ-002` em `governance/metrics/objectives.yaml` exige 100% de aprovação nos casos de papel e identidade, medidos no modelo mais fraco, em todo PR. Regressão quebra o build.

## Lição

Fallback não é detalhe de infraestrutura: é outro modelo, com outro comportamento, na frente do mesmo usuário. Cadeia de modelos precisa ser avaliada inteira, e o elo mais fraco define a garantia real do sistema.
