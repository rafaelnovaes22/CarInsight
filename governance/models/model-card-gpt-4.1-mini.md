# Model card — gpt-4.1-mini

**Documento:** GOV-MC-001 · **Atualizado:** 2026-07-29 · **Próxima revisão:** 2026-10-29
**Referência:** ISO/IEC 42001:2023 Anexo A.6

| Campo | Valor |
|---|---|
| Modelo | `gpt-4.1-mini` |
| Fornecedor | OpenAI (`governance/suppliers/supplier-register.yaml`) |
| Papel na cadeia | **Primário** (prioridade 1 em `src/lib/llm-router.ts`) |
| Sistemas | SYS-001, SYS-004 |
| Custo por 1M tokens | US$ 0,40 entrada / US$ 1,60 saída |
| Configuração | `src/lib/llm-router.ts` → `LLM_PROVIDERS[openai]` |

## Uso pretendido

Compreensão da necessidade declarada pelo usuário em linguagem natural e redação da resposta conversacional. É o modelo escolhido para as etapas que exigem raciocínio aberto e boa qualidade de texto em português.

## Uso vedado

- Ranquear ou selecionar veículos: isso é determinístico, em SQL sobre campos pré-calculados (decisão de arquitetura que derrubou a latência de ~60 s para <5 s).
- Confirmar preço, disponibilidade ou condição comercial sem que o dado venha do banco.
- Qualquer decisão com efeito irreversível para o usuário.

## Limitações conhecidas

- Custo por token cerca de 8x maior na entrada e 20x na saída em relação ao `llama-3.1-8b-instant`, o que motiva o roteamento por etapa.
- Como todo LLM, pode redigir com imprecisão sobre um registro existente; mitigado por disclaimer automático e evidência anexada à recomendação.
- Sujeito a indisponibilidade e a rate limit do fornecedor: coberto por circuit breaker (3 falhas abrem por 60 s) e fallback.

## Avaliação

- Golden dataset com cenários curados (`src/evaluation/golden-dataset.ts`).
- Aderência de papel sob ataque, com juiz LLM e rubrica versionada.
- Última execução de referência: 2026-07-29, via `src/evaluation/benchmark-runner.ts`.

## Riscos associados

RSK-001 (alucinação), RSK-002 (injection), RSK-005 (indisponibilidade), RSK-007 (custo), RSK-010 (regressão por mudança).
