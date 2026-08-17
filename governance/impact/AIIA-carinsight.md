# Avaliação de impacto do sistema de IA (AIIA)

**Documento:** GOV-IIA-001 · **Versão:** 1.0 · **Data:** 2026-07-29 · **Próxima revisão:** 2028-01-29
**Sistemas avaliados:** SYS-001 a SYS-004 (`governance/inventory/ai-systems.yaml`)
**Referência:** ISO/IEC 42001:2023 cláusula 6.1.4 e Anexo A.5; temas do EU AI Act
**Aprovado por:** AI Owner

---

## 1. Descrição do sistema e finalidade

Agente conversacional que atende consumidores no WhatsApp em nome de uma concessionária. Ele qualifica o interessado, entende a necessidade declarada, recomenda veículos do **estoque real** do cliente com explicação da escolha, faz follow-up e transfere para vendedor humano quando o assunto sai do escopo ou quando o usuário pede.

Finalidade legítima: reduzir o tempo de qualificação manual (hoje da ordem de dezenas de minutos por lead) e atender fora do horário comercial, sem prometer o que o estoque não tem.

## 2. Quem é afetado

| Parte afetada | Como | Assimetria de poder |
|---|---|---|
| **Consumidor final** | Recebe recomendação que influencia decisão de compra de valor alto; fornece dado pessoal | Alta: não escolheu falar com IA, não conhece o critério de recomendação |
| **Vendedor da concessionária** | Recebe lead qualificado pelo sistema; herda a conversa no handoff | Média: depende da qualidade do que o agente coletou |
| **Cliente B2B (concessionária)** | Tem sua marca representada pelo agente | Baixa: contratou e pode desligar |
| **Terceiros mencionados na conversa** | Podem ter dado pessoal citado pelo usuário | Alta: não têm relação com o serviço |

## 3. Decisões que o sistema influencia

- **Quais veículos o consumidor considera** (influência forte, é a saída principal).
- **Se o consumidor segue com o atendimento humano** (influência moderada).
- **Priorização do lead pelo vendedor** (influência moderada).

O sistema **não** decide: aprovação de crédito, preço final, condição de pagamento, nem qualquer efeito jurídico. Toda decisão comercial passa por pessoa.

## 4. Danos plausíveis e mitigação

| Dano | Como aconteceria | Mitigação | Risco |
|---|---|---|---|
| Decisão de compra baseada em informação errada | Alucinação sobre preço, disponibilidade ou característica | Filtro SQL sobre estoque real; disclaimer automático; golden dataset | RSK-001 |
| Recomendação inadequada ao perfil | Cálculo de aptidão enviesado ou entendimento errado da necessidade | Ranqueamento determinístico e auditável; explicação por recomendação; métricas de precisão | RSK-006 |
| Exposição de dado pessoal | PII em log, trace de terceiro ou resposta cruzada | Masking em log; bloqueio de PII na saída; retenção de 90 dias com job agendado | RSK-003, RSK-004 |
| Manipulação do consumidor | Prompt que gere pressão ou urgência artificial | Usos vedados na política; system prompt versionado e revisado; juiz LLM de aderência de papel | RSK-002 |
| Incômodo e percepção de spam | Follow-up em excesso ou fora de contexto | Opt-out em um comando; rate limiting; disclosure em todo template | RSK-008 |
| Sensação de estar sendo enganado sobre falar com humano | Ausência de disclosure | Disclosure em toda entrada, follow-up e resposta LGPD; prompt proíbe negar que é IA | Controle em `disclosure.messages.ts` |
| Exclusão de quem não usa bem texto escrito | Interface só conversacional, em português | Handoff humano sempre disponível; sem exigência de formulário | Aceito, ver seção 6 |

## 5. Dado pessoal e base legal

Coletados: telefone (identificador da conversa no WhatsApp), nome e e-mail quando o usuário informa, conteúdo da conversa e preferências declaradas. **Não** são coletados nem inferidos dados sensíveis.

Base legal LGPD: execução de tratativas preliminares a pedido do titular (art. 7º, V) para o atendimento, e legítimo interesse (art. 7º, IX) para o follow-up, com opt-out disponível a qualquer momento. Detalhe em `governance/data/data-lifecycle.md`.

Transferência a terceiros: conteúdo da conversa é enviado ao provedor de LLM em uso para gerar a resposta. Provedores, regiões e termos em `governance/suppliers/supplier-register.yaml`. Nenhum provedor está autorizado a treinar modelo com esse conteúdo.

## 6. Classificação de risco regulatório

**EU AI Act:** o sistema não se enquadra nas práticas proibidas (art. 5º) nem nos casos de alto risco do Anexo III: não faz biometria, não avalia crédito ou empregabilidade, não opera infraestrutura crítica nem serviço público essencial. Enquadra-se como **sistema de risco limitado com obrigação de transparência** (art. 50): o usuário precisa saber que interage com IA, e sabe.

**LGPD:** tratamento de dado pessoal comum, sem decisão automatizada com efeito jurídico ou que afete significativamente o titular no sentido do art. 20 — a recomendação é sugestão, não deferimento. Ainda assim, o direito à explicação é atendido por construção: cada recomendação carrega o motivo.

**Reavaliar esta classificação se:** o sistema passar a decidir sobre crédito ou financiamento, passar a inferir dado sensível (por exemplo, condição de saúde ao recomendar veículo adaptado), atuar em vertical de saúde com aconselhamento, ou ganhar autonomia para fechar negócio sem pessoa.

## 7. Acessibilidade e exclusão

O canal é texto no WhatsApp, em português. Isso exclui quem tem baixa alfabetização, deficiência visual sem leitor de tela configurado, ou não fala português. A mitigação atual é a existência permanente do caminho humano: em qualquer momento o usuário pede atendente e recebe. Não há hoje suporte a áudio nem a outros idiomas — limitação declarada, não resolvida.

## 8. Supervisão humana efetiva

Não é supervisão nominal: o sistema é **híbrido por desenho** (cerca de 70% do fluxo determinístico), o LLM interpreta e redige, e código decide o que tem consequência. Além disso, três circuit breakers de conversa (loop ≥ 8 iterações, erros ≥ 5, estagnação ≥ 6) forçam handoff automático, e o agente nunca encerra silenciosamente.

Estágio de autonomia atual: **assistido**. Promoção para autônomo exige gate de eval e de custo, com aprovação do AI Owner (`governance/CHANGE-MANAGEMENT.md`).

## 9. Conclusão

O sistema é apropriado para a finalidade, com risco residual **médio**, concentrado em qualidade de recomendação e proteção de dado pessoal. Os dois riscos que mais merecem atenção continuada são RSK-001 (alucinação com consequência comercial) e RSK-006 (viés na recomendação, com análise por subgrupo ainda pendente até 2026-10-31).

Nenhum impedimento à operação no estágio assistido.
