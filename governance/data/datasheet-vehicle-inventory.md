# Datasheet — estoque de veículos

**Documento:** GOV-DS-001 · **Atualizado:** 2026-07-29 · **Referência:** ISO/IEC 42001 Anexo A.7

| Campo | Valor |
|---|---|
| Conjunto | Catálogo de veículos do cliente B2B |
| Tabela | `Vehicle` (`prisma/schema.prisma`) |
| Origem | Fornecido pelo cliente (concessionária) e carregado por seed ou integração |
| Dado pessoal | Não |
| Uso | Filtro e ordenação em SQL, geração de embeddings, base factual da recomendação |

## Por que este conjunto é o controle central de alucinação

A recomendação é produzida **filtrando este conjunto**, não gerando texto livre. Se um veículo não está aqui, o agente não pode oferecê-lo. É o que sustenta a afirmação "o agente não inventa registro que não existe".

## Campos de aptidão pré-calculados

Calculados no momento da escrita, não em tempo de resposta. Foi a mudança que tirou o LLM do caminho crítico de ranqueamento e derrubou a latência de ~60 s para menos de 5 s.

## Qualidade e limitações

- **Atualidade depende do cliente.** Estoque desatualizado gera recomendação de veículo já vendido: risco operacional real, não de modelo.
- **Viés de catálogo.** O sistema só recomenda o que o cliente tem. A explicação por recomendação (`recommendation-explainer.service.ts`) deixa isso visível em vez de mascarar.
- **Regras específicas** de elegibilidade (ex.: `UberEligibleVehicleRule`) são determinísticas e auditáveis por código.

## Riscos associados

RSK-001 (alucinação), RSK-006 (viés na recomendação).
