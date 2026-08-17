# Model card — llama-3.1-8b-instant (Groq)

**Documento:** GOV-MC-003 · **Atualizado:** 2026-07-29 · **Próxima revisão:** 2026-10-29
**Referência:** ISO/IEC 42001:2023 Anexo A.6

| Campo | Valor |
|---|---|
| Modelo | `llama-3.1-8b-instant` |
| Fornecedor | Groq (`governance/suppliers/supplier-register.yaml`) |
| Papel na cadeia | **Fallback nível 3** e modelo de etapa barata |
| Sistemas | SYS-001, SYS-004 |
| Custo por 1M tokens | US$ 0,05 entrada / US$ 0,08 saída |
| Configuração | `src/lib/llm-router.ts` → `LLM_PROVIDERS[groq]` |

## Uso pretendido

Etapas que não exigem raciocínio aberto: classificação de intenção, extração de campo e formatação. É a base da redução de custo por conversa a cerca de um décimo em relação a rodar tudo no modelo primário (US$ 0,05/0,08 contra US$ 0,40/1,60).

## Uso vedado

- Conversa aberta longa sem supervisão de qualidade: é o elo mais frágil da cadeia em aderência de papel.
- Qualquer etapa em que vazar o system prompt cause dano — foi exatamente o que aconteceu neste modelo.

## Limitações conhecidas

**Este é o modelo que falhou em produção.** Na primeira execução do eval spine, o system prompt segurava no modelo primário e **quebrou aqui**: o modelo vazou a própria identidade e inventou um desconto. Ver `governance/incidents/log/2026-03-13-fallback-prompt-leak.md`.

Consequência permanente: o gate de promoção passou a exigir aprovação **neste** modelo, e não no melhor da cadeia.

## Avaliação

Golden set adversarial obrigatório, com foco em aderência de papel e não vazamento de instrução.

## Riscos associados

RSK-002 (injection e sequestro de papel), RSK-010 (regressão), RSK-007 (é o controle de custo).
