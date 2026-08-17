# Resposta a incidente de IA

**Documento:** GOV-INC-001 · **Versão:** 1.0 · **Atualizado:** 2026-07-29 · **Próxima revisão:** 2027-01-29
**Referência:** ISO/IEC 42001:2023 cláusulas 8.1 e 10.2, Anexo A.6

---

## 1. O que conta como incidente de IA

Não é qualquer bug. É incidente quando o comportamento do sistema de IA causa ou pode causar dano a uma pessoa, ao cliente ou à conformidade:

- Resposta com informação falsa sobre preço, disponibilidade ou condição comercial que chegou ao usuário.
- Jailbreak bem-sucedido: o agente assumiu outra persona, vazou instrução interna ou concedeu algo que não podia.
- Exposição de dado pessoal a quem não deveria ver, incluindo em log ou trace de terceiro.
- Retenção ou exclusão de dado divergente do declarado publicamente.
- Indisponibilidade que deixou usuários sem resposta e sem handoff.
- Recomendação com dano potencial (por exemplo, veículo inadequado a uma necessidade de segurança declarada).
- Custo de inferência fora de controle, por falha de roteamento.

## 2. Severidades

| Sev | Critério | Prazo de resposta | Quem é acionado |
|---|---|---|---|
| **S1** | Dado pessoal exposto, dano concreto a uma pessoa, ou sistema enganando ativamente sobre ser IA | Imediato | AI Owner + Encarregado |
| **S2** | Jailbreak bem-sucedido, informação comercial falsa entregue, indisponibilidade > 30 min sem handoff | Mesmo dia útil | AI Owner |
| **S3** | Degradação de qualidade acima do limiar, custo fora do alvo, falha recorrente sem dano direto | 3 dias úteis | Engenheiro de IA |
| **S4** | Anomalia sem impacto ao usuário, detectada por monitoramento | Próxima sprint | Engenheiro de IA |

## 3. Procedimento

**Contenção primeiro, causa raiz depois.**

1. **Detectar e registrar.** Abrir arquivo em `governance/incidents/log/YYYY-MM-DD-slug.md` usando o modelo da seção 6. Registrar antes de corrigir: memória de incidente apaga rápido.
2. **Conter.** Na ordem: rebaixar o estágio de autonomia do sistema afetado → se insuficiente, acionar o **kill switch**.
3. **Comunicar.** S1 e S2 vão ao AI Owner imediatamente. Se envolver dado pessoal, o Encarregado avalia comunicação ao titular e à ANPD. Cliente B2B é informado em S1 e S2, sempre.
4. **Corrigir.** Correção só entra por PR, com teste que reproduza a falha. Correção sem teste de regressão não fecha incidente.
5. **Aprender.** A falha vira **caso permanente na eval suite**, e a regra preventiva entra no guardrail ou no prompt.
6. **Fechar.** Registro completo com causa raiz e ação corretiva, referenciado em `governance/NONCONFORMITY.md`. Se revelou risco novo ou mudou probabilidade, atualizar `governance/risk/risk-register.yaml`.

## 4. Kill switch

**Como desligar o agente:**

1. Desativar o webhook do WhatsApp na Meta Cloud API (para a entrada de mensagem na origem).
2. Alternativamente, desligar a feature flag do fluxo afetado (`src/lib/feature-flags.ts`), que permite desligamento parcial sem derrubar o serviço.
3. Redirecionar o número para atendimento humano e avisar o operador do cliente.

O sistema já degrada sozinho antes disso: se todos os provedores de LLM falham, cai em modo mock e escala para humano em vez de responder errado.

**Quem pode acionar:** AI Owner ou Engenheiro de IA, sem necessidade de aprovação prévia. Acionar sem precisar é erro pequeno; não acionar quando precisava é erro grande.

## 5. Comunicação externa

- **Ao usuário afetado:** quando houve informação falsa entregue ou dado exposto. Linguagem simples, sem jargão, com o que foi feito.
- **Ao cliente B2B:** em S1 e S2, com o que aconteceu, o impacto e a correção.
- **À ANPD e ao titular:** avaliação do Encarregado em caso de incidente de segurança com dado pessoal que possa gerar risco ou dano relevante (LGPD art. 48). A avaliação é registrada mesmo quando a conclusão é não comunicar.

## 6. Modelo de registro

```markdown
# Incidente YYYY-MM-DD — título curto

**Severidade:** S1-S4 · **Sistema:** SYS-00X · **Detectado por:** eval / monitoramento / usuário / operador
**Status:** aberto | contido | fechado · **Risco relacionado:** RSK-00X

## O que aconteceu
## Impacto real (não o potencial)
## Contenção aplicada e quando
## Causa raiz
## Ação corretiva (com link para PR ou commit)
## Como fica coberto de agora em diante (teste, eval, guardrail)
## Lição
```
