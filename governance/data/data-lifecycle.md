# Ciclo de vida do dado pessoal

**Documento:** GOV-DAT-001 · **Versão:** 1.0 · **Atualizado:** 2026-07-29 · **Próxima revisão:** 2027-01-29
**Referência:** ISO/IEC 42001:2023 Anexo A.7; LGPD (Lei 13.709/2018)
**Responsável:** Encarregado de dados (`governance/roles/RACI.md`)

---

## 1. Dados tratados

| Dado | Origem | Onde vive | Base legal |
|---|---|---|---|
| Telefone | Metadado da mensagem no WhatsApp | `Conversation.phoneNumber`, `FollowUp.phoneNumber`, `Lead.phone` | Art. 7º, V (tratativas preliminares) |
| Nome | Informado pelo usuário | `Lead.name` | Art. 7º, V |
| E-mail | Informado pelo usuário (opcional) | `Lead.email` | Art. 7º, V |
| Conteúdo da conversa | Mensagens trocadas | `Message`, `LangGraphCheckpoint` | Art. 7º, V |
| Preferências declaradas | Respostas do quiz | `Recommendation`, `Event` | Art. 7º, V |
| Custo e tokens por mensagem | Telemetria | `Message.tokenUsage`, `Message.cost` | Art. 7º, IX (legítimo interesse: controle operacional) |

**Não tratados:** dado sensível (art. 5º, II), dado de criança e adolescente de forma deliberada, localização precisa, biometria.

## 2. Minimização

O sistema não pede dado que não use. Nome e e-mail só são coletados quando o usuário decide avançar para contato com vendedor. O telefone não é solicitado: já vem do canal.

## 3. Compartilhamento com terceiros

O conteúdo da conversa é enviado ao provedor de LLM em uso no momento para gerar a resposta. Lista completa, região de processamento e política de treinamento em `governance/suppliers/supplier-register.yaml`.

Regra dura: **nenhum fornecedor está autorizado a usar esse conteúdo para treinar modelo.** Fornecedor que altere os termos nesse sentido é removido da cadeia (RSK-009).

A política pública (`src/public/privacy-policy.html`) precisa listar exatamente os provedores do registro. A divergência é verificada em CI por `scripts/governance/validate-suppliers.ts`.

## 4. Retenção e expurgo

- **Prazo:** 90 dias de inatividade da conversa.
- **Implementação:** `DataRightsService.cleanupInactiveData()` em `src/services/data-rights.service.ts`.
- **Execução:** job agendado diário em `src/jobs/data-retention.job.ts`, com log estruturado no evento `data_retention_run`.
- **Ordem de exclusão** (transacional, respeitando integridade referencial): FollowUp → Message → Event → Recommendation → Lead → Conversation.

Histórico honesto: até 2026-07-29 o método existia **sem scheduler**, isto é, a retenção declarada publicamente não era cumprida por omissão. Registrado como RSK-004 em nível crítico e mitigado na mesma data.

## 5. Direitos do titular

Atendidos por comando conversacional, sem formulário e sem fila:

| Direito | Como exercer | Implementação |
|---|---|---|
| Confirmação e acesso | Pedir na conversa | `DataRightsService.hasUserData()`, `exportUserData()` |
| Exclusão | Pedir na conversa, com confirmação explícita (janela de 5 min) | `DataRightsService.deleteUserData()` |
| Portabilidade | Exportação em formato estruturado | `exportUserData()` |
| Oposição ao follow-up | Responder "PARAR" | `follow-up.service.ts` |

Toda solicitação gera log de auditoria. Toda resposta a pedido de dados carrega disclosure de IA.

## 6. Segurança aplicada ao dado

- Masking em log (`src/lib/privacy.ts`): telefone, e-mail e nome.
- Bloqueio de PII na saída da conversa (`guardrails.service.ts`).
- Logs estruturados em JSON com masking aplicado na origem (`src/lib/logger.ts`).
- Rate limiting por telefone, que também limita enumeração.

## 7. Incidente com dado pessoal

Segue `governance/incidents/incident-response.md`. Vazamento confirmado de dado pessoal é severidade **S1**: comunicação ao AI Owner e ao Encarregado imediata, avaliação de comunicação à ANPD e ao titular em prazo razoável, e registro em `governance/incidents/log/`.
