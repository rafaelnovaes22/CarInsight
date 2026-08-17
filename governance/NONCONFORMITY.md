# Não conformidades e ações corretivas

**Documento:** GOV-NC-001 · **Atualizado:** 2026-07-29
**Referência:** ISO/IEC 42001:2023 cláusula 10.2

Regra: não conformidade não se fecha com "corrigido". Fecha com **causa raiz identificada** e **mecanismo que impede a recorrência**, preferencialmente automatizado.

---

## NC-001 — Política de privacidade divergente dos fornecedores reais

**Aberta em:** 2026-07-29 · **Origem:** implantação do AIMS, ao montar o registro de fornecedores
**Status:** **fechada** em 2026-07-29 · **Severidade:** alta (transparência LGPD)

**Descrição.** A política de privacidade pública (`src/public/privacy-policy.html`) declarava que as mensagens eram processadas por **Groq** e **Jina AI**. A realidade do código:

- **OpenAI** é o provedor primário de LLM e de embeddings, e não estava declarado.
- **Google (Gemini)** é fallback de LLM, e não estava declarado.
- **Cohere** é fallback de embeddings, e não estava declarado.
- **Jina AI** estava declarado e **não existe no código** — provável resquício de versão anterior.
- **Railway** hospeda aplicação e banco, e não constava.

**Impacto.** O titular não era informado corretamente sobre quem recebe seu dado pessoal, o que contraria o princípio de transparência da LGPD (art. 6º, VI) e a própria Política de IA deste projeto. Nenhum dado foi tratado por fornecedor não autorizado: a falha era de **declaração**, não de prática.

**Causa raiz.** A política pública foi escrita numa versão anterior da arquitetura e não tinha nenhum vínculo com o código. Não existia processo que obrigasse revisão da política quando um provedor mudava, e o gap era conhecido de forma vaga ("drift de documentação") sem estar quantificado nem atribuído.

**Ação corretiva.**

1. Política pública corrigida para listar OpenAI, Google, Groq, Cohere, Meta e Railway.
2. `governance/suppliers/supplier-register.yaml` criado como fonte da verdade, com Jina AI registrado na seção `removed` para preservar o histórico.
3. **Prevenção automatizada:** `scripts/governance/validate-suppliers.ts` compara, em todo PR, os provedores usados no código, os do registro e os declarados na política pública. Divergência quebra o build.

**Lição.** "Drift de documentação" reconhecido mas não medido é gap que só piora. O que resolveu não foi corrigir o texto: foi tornar impossível o texto divergir do código sem que o CI reclame.

---

## NC-002 — Retenção declarada não era executada

**Aberta em:** 2026-07-29 · **Origem:** avaliação de risco (RSK-004)
**Status:** **fechada** em 2026-07-29 · **Severidade:** alta (LGPD, minimização e prazo)

**Descrição.** A política declarava expurgo de dado pessoal após 90 dias de inatividade. O método `DataRightsService.cleanupInactiveData()` existia e funcionava, mas **nada o chamava em produção**: não havia cron, scheduler nem invocação no bootstrap. O comentário no próprio código dizia "deve ser executado via cron job diário", e o cron não existia.

**Impacto.** Dado pessoal retido por prazo indeterminado, em contradição com o que era informado ao titular. Duração provável: desde a implementação do método.

**Causa raiz.** A implementação parou no serviço, e o agendamento foi tratado como tarefa de infraestrutura sem dono. Não havia verificação de que a promessa da política tivesse execução correspondente.

**Ação corretiva.**

1. `src/jobs/data-retention.job.ts` criado: execução diária, primeira rodada 5 minutos após o boot, log estruturado no evento `data_retention_run`, e proteção contra execução concorrente.
2. Iniciado no bootstrap (`src/index.ts`) e parado no shutdown gracioso.
3. `tests/unit/jobs/data-retention.job.test.ts`: 9 testes cobrindo execução, falha sem derrubar o processo, agendamento diário e parada.
4. `OBJ-006` em `governance/metrics/objectives.yaml` monitora a execução.

**Lição.** Promessa em política pública precisa de execução verificável. Método implementado sem agendamento é conformidade de fachada — pior que gap conhecido, porque parece resolvido.

---

## NC-003 — Alegação incorreta de re-ranking em material externo

**Aberta em:** 2026-07-29 · **Origem:** auditoria de alegações contra o código
**Status:** **fechada** em 2026-07-29 · **Severidade:** média (precisão de comunicação)

**Descrição.** Material externo (currículos e perfil profissional) descrevia o sistema como usando "Cohere re-ranking". No código, o Cohere é **fallback de embeddings** (`embed-multilingual-v3.0`), e o re-ranqueamento é **determinístico** sobre os scores semânticos. A busca por "rerank" no repositório retornava zero ocorrências ligadas ao Cohere.

**Impacto.** Nenhum sobre o usuário do sistema. Impacto de credibilidade: alegação técnica verificável e incorreta em material que pode ser conferido contra o repositório público.

**Causa raiz.** Descrição de arquitetura escrita de memória, sem verificação contra o código, e replicada entre documentos.

**Ação corretiva.**

1. Material externo corrigido para "re-ranqueamento determinístico sobre os scores semânticos, com Cohere como fallback de embeddings".
2. `governance/models/model-card-embeddings.md` registra a distinção de forma explícita, para não voltar.
3. Números de teste unificados no mesmo esforço: circulavam 1.028, 1.037 e 1.091; o valor oficial é **1.082 em 103 arquivos (jul/2026)**.

**Lição.** Alegação técnica sobre um repositório público é verificável por qualquer entrevistador. O model card existe justamente para ser a fonte que se consulta antes de escrever sobre a arquitetura.

---

## Resumo

| ID | Título | Severidade | Status | Prevenção automatizada |
|---|---|---|---|---|
| NC-001 | Política divergente dos fornecedores | Alta | Fechada | Sim, `validate-suppliers.ts` |
| NC-002 | Retenção declarada não executada | Alta | Fechada | Parcial: teste + log; alerta de execução ainda manual |
| NC-003 | Alegação incorreta de re-ranking | Média | Fechada | Não: depende de consultar o model card |
