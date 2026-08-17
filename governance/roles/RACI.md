# Papéis e responsabilidades (RACI)

**Documento:** GOV-ROL-001 · **Versão:** 1.0 · **Atualizado:** 2026-07-29 · **Próxima revisão:** 2027-01-29
**Referência:** ISO/IEC 42001:2023 cláusulas 5.1 e 5.3, Anexo A.3

---

## Contexto honesto

Este produto é operado hoje por **uma pessoa**. Declarar papéis aqui não é burocracia: é o que impede que "todo mundo é responsável" signifique "ninguém é". Quando o time crescer, os papéis já existem e recebem nomes diferentes — este arquivo muda, o processo não.

**R** = executa · **A** = presta contas (uma só pessoa) · **C** = consultado · **I** = informado

## Papéis definidos

| Papel | Quem hoje | Responsabilidade |
|---|---|---|
| **AI Owner** | Rafael de Novaes | Presta contas por todo sistema de IA em produção. Aprova entrada em produção, aumento de autonomia e aceitação de risco residual. |
| **Engenheiro de IA** | Rafael de Novaes | Constrói, testa e opera. Roda evals, mantém model cards, corrige incidente. |
| **Encarregado de dados (LGPD)** | Rafael de Novaes | Responde a titular, executa exclusão e exportação, mantém base legal e retenção. |
| **Operador de negócio** | Equipe do cliente (concessionária) | Atende o handoff humano, reporta comportamento estranho do agente. Treinado, não presumido. |
| **Fornecedor de modelo** | OpenAI, Google, Groq, Cohere | Fornece inferência sob os termos do `supplier-register.yaml`. |

## Matriz de decisão

| Decisão ou atividade | AI Owner | Eng. de IA | Encarregado | Operador |
|---|---|---|---|---|
| Aprovar política de IA e este RACI | **A/R** | C | C | I |
| Adicionar ou trocar modelo em produção | **A** | R | C | I |
| Alterar system prompt | **A** | R | I | I |
| Aceitar risco residual do `risk-register.yaml` | **A/R** | C | C | I |
| Aprovar AIIA de sistema novo | **A** | R | C | I |
| Aumentar autonomia (shadow → assistido → autônomo) | **A** | R | C | C |
| Declarar e classificar incidente de IA | **A** | R | C | I |
| Acionar kill switch (desligar agente) | **A** | R | I | C |
| Responder a titular de dados (LGPD) | I | C | **A/R** | I |
| Executar exclusão ou exportação de dados | I | C | **A/R** | I |
| Contratar ou remover fornecedor de IA | **A/R** | C | C | I |
| Auditoria interna semestral | **A** | R | C | I |
| Análise crítica trimestral | **A/R** | C | C | I |
| Atender o handoff humano no dia a dia | I | I | I | **A/R** |

## Regra de escalada

1. Comportamento anômalo detectado pelo operador → Engenheiro de IA em até 1 dia útil.
2. Suspeita de vazamento de dado pessoal, jailbreak bem-sucedido ou dano ao usuário → **imediato** ao AI Owner e ao Encarregado, e abre incidente.
3. Indisponibilidade acima de 30 minutos com todos os provedores em falha → kill switch e comunicação ao cliente.

## Competência exigida

Quem opera qualquer sistema desta lista precisa conhecer: esta política, o funcionamento dos guardrails, o procedimento de incidente e os direitos do titular sob LGPD. Operador não técnico do cliente recebe treinamento no handoff antes do go-live, e o registro do treinamento fica em `governance/audit/`.
