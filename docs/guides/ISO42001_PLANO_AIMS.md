# Plano de implantação do AIMS (ISO/IEC 42001) — CarInsight

> **STATUS: EXECUTADO em 2026-07-29.** As seis fases foram implementadas. Os artefatos vivem em `governance/`, os validadores em `scripts/governance/`, e o gate roda no CI. Ver `governance/README.md` para o índice e `governance/NONCONFORMITY.md` para as quatro não conformidades encontradas na execução (três fechadas, uma aberta com prazo).
>
> Este documento fica como registro do plano e da estimativa original. O que resta em aberto está listado no fim.

**Criado em 2026-07-29.** Objetivo: sair de "controles técnicos alinhados à norma" para um **AIMS completo** (sistema de gestão de IA), cobrindo as cláusulas 4 a 10 e o Anexo A inteiro, sem parar de entregar produto.

**Ponto de partida** (ver `docs/documentos/APRESENTACAO_GOVERNANCA_IA_CORRIGIDA.md`): o Anexo A já está forte em A.6 (ciclo de vida), A.8 (informação às partes interessadas), A.9 (uso responsável) e parcialmente A.7 (dados). O que falta é o sistema de gestão em volta.

**Princípio que guia o plano:** todo artefato nasce como **arquivo versionado no repo**, e o máximo possível é **verificado em CI**. Documento de governança que vive em PDF solto apodrece na primeira sprint; documento que quebra o build permanece verdadeiro.

---

## Estrutura de diretórios a criar

```
governance/
  policy/            AI-POLICY.md, ACCEPTABLE-USE.md
  roles/             RACI.md
  inventory/         ai-systems.yaml          (inventário de sistemas de IA)
  risk/              risk-register.yaml, risk-methodology.md
  impact/            AIIA-carinsight.md       (AI system impact assessment)
  models/            model-card-*.md          (um por modelo/rota em uso)
  data/              datasheet-*.md, data-lifecycle.md
  suppliers/         supplier-register.yaml   (OpenAI, Google, Groq, Cohere, Deepgram…)
  incidents/         incident-response.md, log/YYYY-MM-DD-*.md
  audit/             internal-audit-YYYY-MM.md, management-review-YYYY-QN.md
  metrics/           objectives.yaml          (objetivos de IA + indicadores)
  README.md          índice: cláusula da norma → artefato → evidência em código
scripts/governance/  validadores rodados em CI
```

---

## Fase 0 — Fundação (cláusulas 4 e 5) · ~6 h

Sem isso nada mais tem âncora. É a fase mais barata e a que mais muda a conversa com auditor ou cliente.

1. `governance/policy/AI-POLICY.md` — política de IA: propósito do uso de IA no produto, princípios (transparência, supervisão humana, privacidade, segurança), compromissos e a quem se aplica. Uma página basta; a norma exige que exista, seja comunicada e revisada.
2. `governance/roles/RACI.md` — papéis: quem aprova mudança de modelo, quem responde por incidente, quem revisa evals, quem fala com o titular de dados. Num time de uma pessoa, declarar isso explicitamente **é** o controle.
3. `governance/inventory/ai-systems.yaml` — inventário: cada sistema de IA, finalidade, modelos usados, dados que toca, público afetado, criticidade. Sem inventário não existe escopo, e sem escopo não existe AIMS.
4. Definir e registrar o **escopo do AIMS** no `governance/README.md`: o que está dentro (agente de WhatsApp, recomendação, embeddings) e o que está fora.

**Pronto quando:** os quatro arquivos existem, o `README.md` mapeia cláusula → artefato, e o inventário lista todos os modelos que aparecem em `src/lib/llm-router.ts` e `src/lib/embedding-router.ts`.

---

## Fase 1 — Risco e impacto (cláusula 6 + A.5) · ~10 h

O coração da norma, e o gap mais visível hoje.

1. `governance/risk/risk-methodology.md` — como risco é avaliado: escala de probabilidade e impacto, critério de aceitação, quem aceita risco residual.
2. `governance/risk/risk-register.yaml` — registro por risco: alucinação com consequência comercial, prompt injection, vazamento de PII, indisponibilidade de provedor, viés na recomendação, custo descontrolado, dependência de fornecedor único. Cada um com: probabilidade, impacto, **controle existente** (apontando para o arquivo real) e risco residual.
3. `governance/impact/AIIA-carinsight.md` — avaliação de impacto do sistema de IA: quem é afetado (consumidor final que recebe recomendação de compra), que decisões o sistema influencia, danos plausíveis, grupos vulneráveis, medidas de mitigação, e por que o sistema **não** é de alto risco no sentido do EU AI Act (ou por que é).
4. `governance/metrics/objectives.yaml` — objetivos de IA mensuráveis, ligados ao que já é medido: precision@3 mínima, taxa de escalada para humano, custo por conversa, taxa de bloqueio de injection, cobertura de evals.

**Pronto quando:** todo risco do registro aponta para um controle existente ou para um item do backlog, e todo objetivo tem uma métrica já coletada em `src/services/recommendation-metrics.service.ts` ou no Prometheus.

---

## Fase 2 — Ciclo de vida, dados e mudança (A.6, A.7) · ~12 h

Aqui a base técnica já existe; o trabalho é documentar e fechar buracos.

1. `governance/models/model-card-*.md` — um por modelo em produção (gpt-4.1-mini, gemini-2.5-flash, llama-3.1-8b, embeddings, re-rank): uso pretendido, uso vedado, limitações conhecidas, custo por 1M de tokens, resultado no golden dataset, data da última avaliação.
2. `governance/data/datasheet-*.md` — origem dos dados de estoque e de conversa, base legal LGPD, retenção, quem acessa, o que vai para o provedor de LLM.
3. `governance/data/data-lifecycle.md` — coleta, uso, retenção de 90 dias, exclusão e exportação, com ponteiro para `src/services/data-rights.service.ts`.
4. **Fechar o gap do scheduler**: a limpeza de 90 dias existe como método mas não roda sozinha. Criar job agendado + teste que prove a execução. É o gap mais concreto de LGPD hoje.
5. **Estender o masking**: `src/lib/privacy.ts` cobre só telefone e preserva 6 dígitos. Avaliar e-mail, nome e endereço nos logs, e reduzir o prefixo preservado.
6. `governance/CHANGE-MANAGEMENT.md` — regra de mudança de modelo ou prompt: exige rodar evals, comparar com baseline, registrar no model card e aprovar segundo o RACI. Já é o que você faz; falta estar escrito.

**Pronto quando:** existe model card para todo modelo do router, o job de retenção roda de verdade e há teste cobrindo, e nenhuma mudança de prompt sobe sem passar pelo gate documentado.

---

## Fase 3 — Operação e fornecedores (A.10, cláusula 8) · ~8 h

1. `governance/incidents/incident-response.md` — o que conta como incidente de IA (alucinação com dano, vazamento, jailbreak bem-sucedido, indisponibilidade prolongada), severidades, quem aciona, prazo de comunicação ao cliente e à ANPD quando aplicável, e o **kill switch**: como desligar o agente e cair para atendimento humano.
2. `governance/incidents/log/` — um arquivo por incidente. Comece registrando os que já aconteceram: o system prompt vazando no fallback barato e o jailbreak "aja como galinha". Incidente documentado com ação corretiva é a evidência mais forte que existe numa auditoria.
3. `governance/suppliers/supplier-register.yaml` — cada provedor (OpenAI, Google/Vertex, Groq, Cohere, Deepgram, Railway): dado que recebe, região de processamento, DPA ou termos aplicáveis, política de treinamento com dados do cliente, plano de saída se cair.
4. **Sincronizar a política de privacidade pública** com os provedores realmente em uso (gap já registrado: `src/public/privacy-policy.html` pode divergir). Adicionar verificação em CI comparando a lista da política com a do supplier register.

**Pronto quando:** existe procedimento de incidente testado ao menos uma vez em simulação, e a política pública não pode divergir do registro de fornecedores sem quebrar o build.

---

## Fase 4 — Verificação e melhoria (cláusulas 9 e 10) · ~8 h, depois recorrente

1. `governance/audit/internal-audit-YYYY-MM.md` — auditoria interna: checklist cláusula a cláusula, evidência apontada, não conformidades encontradas. Fazer a primeira contra este próprio plano.
2. `governance/audit/management-review-YYYY-QN.md` — análise crítica: desempenho contra os objetivos, incidentes do período, riscos novos, decisões tomadas. Trimestral. Num contexto solo, é você assinando uma revisão trimestral honesta.
3. `governance/NONCONFORMITY.md` — registro de não conformidade e ação corretiva, com causa raiz. Ligar ao processo que você já usa: falha vira caso documentado, regra preventiva e teste em CI.
4. Cadência fixa: **auditoria interna semestral, análise crítica trimestral, revisão da política anual**. Colocar no calendário; a norma cobra evidência de recorrência, não de perfeição.

---

## Fase 5 — Governança como código (o diferencial) · ~10 h

O que transforma o pacote de "pasta de documentos" em algo que ninguém consegue deixar apodrecer, e que vira demonstração de entrevista.

1. `scripts/governance/validate-inventory.ts` — falha o build se um modelo aparecer no `llm-router.ts` sem estar no inventário e sem model card.
2. `scripts/governance/validate-suppliers.ts` — falha se um provedor usado no código não estiver no supplier register, ou se a política de privacidade citar provedor diferente.
3. `scripts/governance/check-staleness.ts` — falha (ou avisa) se model card, AIIA ou risk register passarem da data de revisão declarada no próprio arquivo.
4. Job no GitHub Actions rodando os três em todo PR, e um `governance/README.md` gerado com a tabela cláusula → artefato → status.

**Pronto quando:** um PR que adiciona um modelo novo sem documentar não passa no CI.

---

## Sequência recomendada e esforço

| Fase | Entrega | Esforço | Depende de |
|---|---|---|---|
| 0 | Política, RACI, inventário, escopo | ~6 h | — |
| 1 | Metodologia de risco, risk register, AIIA, objetivos | ~10 h | Fase 0 |
| 2 | Model cards, datasheets, scheduler de retenção, masking, change management | ~12 h | Fase 1 |
| 3 | Incident response, log de incidentes, fornecedores, sync da política | ~8 h | Fase 0 |
| 4 | Auditoria interna, análise crítica, não conformidades | ~8 h | Fases 1-3 |
| 5 | Validadores em CI | ~10 h | Fases 0-3 |

**Total: ~54 h.** Em ritmo de meio período, cerca de 3 semanas. Fases 0 e 1 sozinhas (16 h) já mudam a resposta de "tenho controles" para "tenho um AIMS em implantação", que é uma diferença enorme numa entrevista ou numa venda para empresa regulada.

**Ordem de maior retorno por hora:** Fase 0 → Fase 1 → item 4 da Fase 2 (scheduler de retenção, é gap real de LGPD) → Fase 3 item 2 (log dos incidentes que já aconteceram) → resto.

---

## O que este plano não entrega

Certificação. Certificar exige organismo acreditado, auditoria de estágio 1 e 2, e um AIMS operando com histórico. Este plano entrega o **AIMS implantado e auditável internamente**, que é o pré-requisito, e permite a frase honesta: *"o sistema de gestão está implantado e auditado internamente; a certificação externa é uma decisão de negócio que ainda não tomei."*

---

## Resultado da execução (2026-07-29)

**O que a implantação encontrou de errado**, e este é o valor real do exercício:

| Achado | Gravidade |
|---|---|
| **NC-001** — a política de privacidade pública declarava "Jina AI", que não existe no código, e **omitia OpenAI, Google e Cohere**, que são os provedores reais que recebem dado do usuário | Alta (transparência LGPD) |
| **NC-002** — a retenção de 90 dias declarada publicamente **nunca foi executada**: o método existia, nada o chamava | Alta (LGPD, prazo) |
| **NC-003** — material externo alegava "Cohere re-ranking"; o Cohere é fallback de embeddings e o re-rank é determinístico | Média (precisão) |
| **NC-004** — sem registro formal de treinamento dos operadores | Aberta, prazo 2026-09-30 |

As três primeiras foram fechadas na mesma data, e duas delas com **prevenção automatizada em CI**, não só correção pontual.

**Verificação:** `npm run governance` verde nos quatro validadores, `tsc --noEmit` sem erro, 923 testes unitários passando em 78 arquivos (incluindo 24 novos para masking e job de retenção).

**Continua aberto:** NC-004 (treinamento), GAP-002 (viés por subgrupo, 2026-10-31), GAP-003 (mudança de termos de fornecedor, 2026-12-31), além das limitações estruturais registradas na auditoria: autoauditoria sem independência e AIMS sem histórico operacional.
