# Model card — modelos de embedding

**Documento:** GOV-MC-004 · **Atualizado:** 2026-07-29 · **Próxima revisão:** 2026-10-29
**Referência:** ISO/IEC 42001:2023 Anexo A.6

| Campo | Primário | Fallback |
|---|---|---|
| Modelo | `text-embedding-3-small` | `embed-multilingual-v3.0` |
| Fornecedor | OpenAI | Cohere |
| Dimensões | 1536 | 1024 |
| Configuração | `src/lib/embedding-router.ts` | idem |
| Sistema | SYS-003 | SYS-003 |

## Uso pretendido

Vetorizar descrição de veículo e consulta do usuário para busca semântica em pgvector, sempre combinada com filtro SQL sobre o estoque real.

## Uso vedado

- **Não é re-ranker.** O Cohere aqui é fallback de *embeddings*. O re-ranqueamento no produto é determinístico, sobre os scores semânticos. Esta distinção está registrada porque a formulação errada ("Cohere re-ranking") já circulou em material externo e foi corrigida.
- Não vetorizar dado pessoal: embeddings cobrem catálogo de veículo, não conteúdo de conversa.

## Limitações conhecidas

- **Dimensionalidade diferente entre primário e fallback** (1536 vs 1024): a troca não é transparente para o índice. Trocar de provedor exige regenerar os embeddings (`npm run embeddings:regenerate`), não é apenas configuração.
- Similaridade semântica sozinha traz resultado plausível mas não filtrado; a garantia de que o veículo existe vem do SQL, não do vetor.

## Avaliação

Retrieval medido contra ground truth; precision@k no golden dataset.

## Riscos associados

RSK-005 (indisponibilidade), RSK-006 (viés na recuperação).
