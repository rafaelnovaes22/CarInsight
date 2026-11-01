# Model card — gemini-2.5-flash

**Documento:** GOV-MC-002 · **Atualizado:** 2026-07-29 · **Próxima revisão:** 2026-10-29
**Referência:** ISO/IEC 42001:2023 Anexo A.6

| Campo | Valor |
|---|---|
| Modelo | `gemini-2.5-flash` |
| Fornecedor | Google (`governance/suppliers/supplier-register.yaml`) |
| Papel na cadeia | **Fallback nível 2** em `src/lib/llm-router.ts` |
| Sistemas | SYS-001, SYS-004 |
| Custo por 1M tokens | US$ 0,15 entrada / US$ 0,60 saída |
| Configuração | `src/lib/llm-router.ts` → `LLM_PROVIDERS[gemini]` |

## Uso pretendido

Assumir a conversa quando o provedor primário falha ou está com circuit breaker aberto, mantendo qualidade de resposta em português a custo menor.

## Uso vedado

Igual ao modelo primário: não ranqueia, não confirma condição comercial sem dado de origem, não decide de forma irreversível.

## Limitações conhecidas

- Comportamento de aderência ao system prompt difere do primário; qualquer mudança de prompt precisa ser validada **também aqui** (lição do incidente de 2026-03-13, em que o prompt segurava no primário e quebrava no fallback).
- Formato de resposta e tratamento de instrução divergem o suficiente para exigir normalização na camada de abstração.

## Avaliação

Mesma suíte do primário. O gate de promoção exige aprovação no **modelo mais fraco da cadeia**, não apenas no primário.

## Riscos associados

RSK-002, RSK-005, RSK-010.
