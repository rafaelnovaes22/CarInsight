# Metodologia de avaliação de risco de IA

**Documento:** GOV-RSK-001 · **Versão:** 1.0 · **Atualizado:** 2026-07-29 · **Próxima revisão:** 2027-01-29
**Referência:** ISO/IEC 42001:2023 cláusulas 6.1.2 e 6.1.3, Anexo A.5

---

## Escalas

**Probabilidade** (janela de 12 meses, considerando o volume atual):

| Nível | Rótulo | Critério |
|---|---|---|
| 1 | Raro | Não ocorreu e exige combinação improvável de falhas |
| 2 | Improvável | Não ocorreu, mas é plausível |
| 3 | Possível | Já ocorreu em ambiente de teste, ou é esperado eventualmente |
| 4 | Provável | Já ocorreu em produção pelo menos uma vez |
| 5 | Quase certo | Ocorre de forma recorrente sem controle ativo |

**Impacto** (o maior entre as dimensões: pessoa afetada, cliente B2B, conformidade, financeiro):

| Nível | Rótulo | Critério |
|---|---|---|
| 1 | Desprezível | Ruído na experiência, sem consequência |
| 2 | Menor | Retrabalho ou incômodo, reversível pelo próprio usuário |
| 3 | Moderado | Decisão do usuário influenciada por informação errada; reversível com intervenção |
| 4 | Alto | Dano financeiro ao usuário ou ao cliente, exposição de dado pessoal, indisponibilidade prolongada |
| 5 | Severo | Dano relevante a pessoa, incidente de dado pessoal com necessidade de comunicação à ANPD, perda de confiança irreparável |

**Nível de risco = probabilidade × impacto.**

| Faixa | Classificação | Tratamento exigido |
|---|---|---|
| 1-4 | Baixo | Aceitar e monitorar |
| 5-9 | Médio | Controle obrigatório, revisão semestral |
| 10-14 | Alto | Controle obrigatório com verificação automatizada, revisão trimestral |
| 15-25 | Crítico | Não vai a produção sem mitigação que reduza a faixa |

## Critério de aceitação

Risco residual **Baixo** é aceito pelo Engenheiro de IA. **Médio** e acima exige aceitação registrada do **AI Owner** (`governance/roles/RACI.md`), com data e justificativa no próprio registro de risco.

Nenhum risco de nível **Crítico** pode permanecer aberto em produção. Se surgir, o tratamento imediato é reduzir autonomia (voltar o estágio) ou acionar o kill switch.

## Regra de rastreabilidade

Todo risco no `risk-register.yaml` precisa ter, obrigatoriamente:

1. Um **controle apontando para arquivo real do repositório**, ou
2. Um item de backlog explícito com prazo, ou
3. Uma aceitação de risco assinada pelo AI Owner.

Risco com controle que aponta para arquivo inexistente **falha o CI** (`scripts/governance/validate-risk-register.ts`). É o que impede o registro de virar ficção.

## Ciclo

- **Reavaliação completa:** semestral, junto com a auditoria interna.
- **Reavaliação pontual (gatilhos):** entrada de modelo novo, mudança de fornecedor, incidente de severidade S1 ou S2, entrada em vertical novo, mudança regulatória.
- **Registro de mudança:** histórico no fim do `risk-register.yaml`.
