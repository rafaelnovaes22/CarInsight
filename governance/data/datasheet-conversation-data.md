# Datasheet — dados de conversa

**Documento:** GOV-DS-002 · **Atualizado:** 2026-07-29 · **Referência:** ISO/IEC 42001 Anexo A.7

| Campo | Valor |
|---|---|
| Conjunto | Mensagens, eventos, recomendações e leads gerados no atendimento |
| Tabelas | `Conversation`, `Message`, `Event`, `Recommendation`, `Lead`, `FollowUp`, `LangGraphCheckpoint` |
| Origem | Interação do consumidor final no WhatsApp |
| Dado pessoal | **Sim**: telefone, nome, e-mail, conteúdo livre |
| Base legal | Art. 7º, V da LGPD (tratativas preliminares); follow-up por legítimo interesse com opt-out |
| Retenção | 90 dias de inatividade (`src/jobs/data-retention.job.ts`) |
| Uso | Continuidade da conversa, retomada de contexto, follow-up, telemetria de custo |

## Trânsito para terceiros

Trechos da conversa vão ao provedor de LLM ativo para gerar resposta. Ver `governance/suppliers/supplier-register.yaml`. Não autorizado para treinamento.

## Cuidados aplicados

- Masking de telefone, e-mail e nome em log (`src/lib/privacy.ts`).
- Checkpoints do LangGraph fazem parte do escopo de exclusão do titular.
- Conteúdo livre pode conter dado de terceiro mencionado pelo usuário: risco reconhecido no AIIA, seção 2, sem controle técnico completo hoje.

## Limitações

- **Não há de-identificação para uso analítico.** Qualquer análise agregada hoje roda sobre dado identificável, o que restringe o uso legítimo. Melhoria futura.
- Exportação entrega o dado ao titular em formato estruturado, sem redação de terceiros mencionados.

## Riscos associados

RSK-003 (vazamento), RSK-004 (retenção), RSK-008 (mensagem não solicitada).
