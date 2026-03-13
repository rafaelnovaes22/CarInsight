# Briefing para conversa sobre Governança de IA

Baseado no projeto `CarInsight` e no que foi verificado no repositório em 2026-03-13.

## 1. Como se posicionar em 30-45 segundos

Sugestão de fala:

> No meu trabalho mais recente, minha atuação foi muito forte na tradução de princípios de governança de IA para controles operacionais de produto. Neste projeto, por exemplo, implementei transparência sobre uso de IA, guardrails de entrada e saída, detecção de prompt injection, trilhas de auditoria, métricas de qualidade, handoff para humano, rotinas de privacidade/LGPD e mecanismos de resiliência e monitoramento. Minha experiência é mais forte em desenho e implementação prática desses controles dentro do sistema do que em condução formal de uma certificação de ponta a ponta como auditor líder.

## 2. O que é este projeto

- Backend TypeScript/Node.js para atendimento automotivo via WhatsApp.
- Orquestra fluxo conversacional com LangGraph.
- Faz recomendação de veículos com busca híbrida e múltiplos agentes.
- Usa múltiplos provedores de LLM com fallback e circuit breaker.
- Persiste conversas, mensagens, eventos, recomendações, checkpoints e métricas.

Resumo técnico:

- Runtime: Node.js + TypeScript + Express
- Dados: PostgreSQL + Prisma + pgvector
- IA: OpenAI, Gemini, Groq e embeddings com OpenAI/Cohere
- Operação: health checks, Prometheus, Grafana, logs estruturados

## 3. O que este projeto prova sobre Governança de IA

### 3.1 Transparência para o usuário

O projeto implementa disclosure explícito de IA:

- Saudação inicial informa que o usuário está falando com uma assistente virtual de IA.
- A mensagem também informa limitação do sistema e possibilidade de transferência para humano.
- Há disclaimers automáticos para respostas com preço e recomendação.
- Existe política pública de privacidade com seção específica sobre uso de IA.

Evidências:

- `src/config/disclosure.messages.ts`
- `src/graph/nodes/greeting.node.ts`
- `src/services/guardrails.service.ts`
- `src/public/privacy-policy.html`

### 3.2 Supervisão humana e handoff

O projeto não deixa o atendimento inteiramente "preso" na IA:

- Detecta intenção de falar com vendedor/humano.
- Propaga flag de `handoff_requested` no estado conversacional.
- Cria lead quando o fluxo aponta handoff.
- Tem circuit breakers para loop técnico, excesso de erro e estagnação do fluxo.
- Na prática, a arquitetura prevê saída para humano quando a IA não está conseguindo evoluir o atendimento.

Evidências:

- `src/utils/handoff-detector.ts`
- `src/graph/nodes/discovery.node.ts`
- `src/graph/nodes/recommendation/handlers/handoff-handler.ts`
- `src/services/message-handler-v2.service.ts`
- `src/utils/circuit-breaker.ts`
- `src/graph/workflow.ts`

### 3.3 Segurança de entrada e saída

Há uma camada explícita de guardrails:

- Rate limiting por número de telefone
- Detecção de prompt injection em PT-BR e EN
- Bloqueio de padrões de system prompt extraction
- Sanitização de input
- Validação de output
- Bloqueio de vazamento de prompt/sistema
- Bloqueio de CPF e mensagens de erro técnicas indo ao usuário

Evidências:

- `src/services/guardrails.service.ts`
- `src/services/rate-limit.service.ts`
- `src/services/metrics.service.ts`
- `tests/e2e/security/guardrails.test.ts`

### 3.4 Rastreabilidade e trilha de auditoria

O sistema registra evidências úteis para auditoria técnica e operacional:

- Mensagens de entrada e saída
- Tempo de processamento
- Token usage e custo estimado
- Eventos de conversa
- Recomendações persistidas
- Checkpoints do LangGraph
- Logs estruturados com eventos de negócio

Evidências:

- `prisma/schema.prisma`
- `src/services/message-handler-v2/persistence.service.ts`
- `src/graph/persistence/prisma-saver.ts`
- `src/lib/logger.ts`

Ponto forte para a conversa:

> Eu não tratei governança como documento isolado; eu materializei governança em persistência, logs, eventos e checkpoints que permitem reconstruir comportamento do sistema.

### 3.5 Privacidade e direitos de dados

O projeto tem implementação prática de LGPD:

- Mascaramento de telefone em logs
- Comando conversacional para exclusão de dados
- Comando conversacional para exportação de dados
- Confirmação explícita antes da exclusão
- Logs de auditoria dessas solicitações
- Política de privacidade com direitos do titular

Evidências:

- `src/lib/privacy.ts`
- `src/services/data-rights.service.ts`
- `src/services/message-handler-v2/data-rights-commands.service.ts`
- `src/public/privacy-policy.html`

### 3.6 Robustez, resiliência e continuidade operacional

O projeto traz controles de robustez bem concretos:

- Roteamento multi-LLM com fallback
- Circuit breaker por provedor
- Fallback para modo mock quando provedores falham
- Rate limiting com Redis e fallback em memória
- Health checks públicos
- Monitoramento de dependências

Evidências:

- `src/lib/llm-router.ts`
- `src/lib/embedding-router.ts`
- `src/services/rate-limit.service.ts`
- `src/services/public-health.service.ts`
- `monitoring/prometheus/prometheus.yml`
- `monitoring/grafana/dashboards/carinsight-dashboard.json`

### 3.7 Monitoramento de qualidade e performance

O projeto mede qualidade de recomendação e não só uptime:

- Métricas de recomendação: precision@k, CTR, MRR, rejeição, conversão
- Health monitor para drift e degradação de qualidade
- Alertas quando qualidade cai
- Golden dataset e benchmark runner para validação

Evidências:

- `src/services/recommendation-metrics.service.ts`
- `src/services/recommendation-health-monitor.service.ts`
- `src/evaluation/golden-dataset.ts`
- `src/evaluation/benchmark-runner.ts`

Ponto forte para a conversa:

> Além de segurança e compliance, eu também me preocupei com governança de performance e qualidade do sistema, medindo se a recomendação continua útil ao longo do tempo.

### 3.8 Explicabilidade operacional

O projeto não depende só de "score mágico":

- Gera pacotes de evidência para explicar por que um veículo foi escolhido
- Explicação pode ser determinística ou via SLM, com fallback
- Usa sinais do perfil, matched characteristics, selected because e not ideal because

Evidências:

- `src/services/recommendation-evidence.service.ts`
- `src/services/recommendation-explainer.service.ts`

### 3.9 Controle de rollout e mudança

Há alguns mecanismos de governança de mudança:

- Feature flags
- Rollout percentual por usuário
- Prompts carregados de tabela de banco com cache
- Seed idempotente para prompts

Evidências:

- `src/lib/feature-flags.ts`
- `src/services/system-prompt.service.ts`
- `prisma/seed-prompts.ts`
- `prisma/schema.prisma`

## 4. Mapeamento para ISO/IEC 42001 e temas do EU AI Act

### Transparência

- Sim: disclosure de IA, limitações, política pública, disclaimers.

### Supervisão humana

- Sim: handoff por solicitação do usuário, por dificuldade técnica e por estagnação do fluxo.

### Accountability / rastreabilidade

- Sim: logs estruturados, eventos, mensagens persistidas, recomendações salvas, checkpoints.

### Robustez técnica

- Sim: guardrails, rate limit, circuit breakers, fallback de provedores, health checks.

### Monitoramento

- Sim: métricas Prometheus, dashboard Grafana, métricas de qualidade e alertas.

### Data governance / privacy

- Sim: masking, export/delete, política de privacidade, opt-out de follow-up.

### Risk management formal

- Parcial: há muitos controles implementados, mas não localizei um pacote formal completo de gestão de risco de IA.

## 5. Gaps honestos para falar com transparência

Esta é a parte mais importante para não soar inflado.

### 5.1 O projeto mostra governança prática, não certificação formal completa

Não localizei no repositório artefatos típicos de um programa formal completo de certificação, como:

- registro formal de riscos de IA
- AIIA/DPIA formal
- model cards
- inventário formal de fornecedores com avaliação documental
- processo formalizado de incident response de IA
- matriz RACI / owners de controles
- evidência de auditoria externa/certificação

Como falar:

> Minha experiência aqui é claramente forte em controle técnico e governança operacional embutida no produto. O ciclo documental completo de certificação e auditoria formal eu conheço conceitualmente, mas meu histórico é mais forte na implementação e operacionalização.

### 5.2 Há drift entre documentação pública e implementação de provedores

A política pública cita Groq e Jina AI, mas o código atual mostra:

- LLMs: OpenAI, Gemini e Groq
- Embeddings: OpenAI e Cohere

Arquivos:

- `src/public/privacy-policy.html`
- `src/lib/llm-router.ts`
- `src/lib/embedding-router.ts`

Como falar:

> Um ponto típico de governança que este projeto inclusive evidencia é a necessidade de manter documentação externa sincronizada com a arquitetura real de fornecedores.

### 5.3 Existe uma inconsistência de transparência em prompt interno

O greeting faz disclosure explícito de IA, o que é positivo. Porém o prompt base do agente contém a instrução "nunca mencione que você é uma IA".

Arquivos:

- `src/graph/nodes/greeting.node.ts`
- `src/agents/vehicle-expert/constants/system-prompt.ts`

Como falar:

> Isso é um exemplo real de tensão entre UX conversacional e transparência regulatória. Em governança madura, esse conflito precisa ser resolvido por política única e teste de conformidade.

### 5.4 Retenção automática de 90 dias existe na lógica, mas não achei o agendamento

Há método de limpeza de dados inativos, mas não localizei um cron/job chamando essa rotina.

Arquivos:

- `src/services/data-rights.service.ts`

Como falar:

> A política e a função existem, mas o operacional completo depende de plugar isso em scheduler/cron com evidência de execução.

## 6. Como vender sua experiência sem exagerar

Formulação recomendada:

- "Eu consigo desenhar e implementar controles concretos de IA em produto."
- "Tenho experiência prática em disclosure, guardrails, handoff humano, privacidade, logging, métricas e monitoramento."
- "Consigo traduzir princípio regulatório em requisito técnico e comportamento de sistema."
- "Minha experiência é mais forte em governança operacional e engenharia de controles do que em auditoria líder de certificação ponta a ponta."

## 7. Perguntas prováveis e respostas curtas

### "Você já trabalhou com ISO 42001?"

Resposta sugerida:

> Sim, principalmente na tradução dos princípios para implementação prática: disclosure, guardrails, logs de auditoria, direitos de dados, supervisão humana, monitoramento e controles de robustez. Minha experiência é mais prática/operacional do que de auditoria líder formal.

### "Como você trata transparência em IA?"

Resposta sugerida:

> Eu trato transparência em três camadas: aviso claro ao usuário na interface, mensagens com limitação do sistema quando necessário e documentação/política pública explicando uso de IA, provedores e direitos do titular.

### "Como você lida com risco de prompt injection?"

Resposta sugerida:

> Com camada de guardrails antes do modelo, padrões de detecção em PT-BR e EN, sanitização, bloqueio de tentativa de extração de prompt e testes dedicados de segurança.

### "Como você garante supervisão humana?"

Resposta sugerida:

> Eu não deixo isso implícito. O sistema precisa detectar pedido de humano, permitir handoff explícito e também sair para humano quando há baixa evolução, loop ou erro técnico.

### "Como você mede qualidade?"

Resposta sugerida:

> Não fico só em uptime. Eu acompanho métricas como precision@k, CTR, rejeição, conversão, drift contra baseline e alertas de degradação.

### "Você já fez processo formal de certificação?"

Resposta sugerida:

> Meu ponto forte é implementação prática e governança operacional. Já trabalhei muito próximo dos requisitos e controles, mas não venderia minha experiência como a de auditor líder que conduz sozinho uma certificação ponta a ponta.

## 8. Evidências objetivas verificadas hoje

- O repositório tem 95 arquivos de teste.
- Hoje foi executado `npm run test:unit` com sucesso.
- Resultado validado nesta sessão: 67 arquivos de teste unitário, 829 testes passando.
- Não rodei as suítes de integração/e2e nesta sessão.
- O README do projeto menciona 1028+ testes passando, mas isso não foi revalidado integralmente agora.

## 9. Melhor narrativa para a conversa

Se eu tivesse que resumir sua proposta de valor em uma frase:

> Eu sei pegar tema de governança de IA e transformar em sistema funcionando: transparência, segurança, privacidade, observabilidade, rastreabilidade, fallback e supervisão humana.

## 10. Mensagem final se ele pedir exemplos concretos

Exemplo de resposta:

> Posso te dar exemplos bem práticos. Neste projeto eu tenho disclosure explícito de IA na saudação, guardrails contra prompt injection e vazamento de sistema, rate limit por usuário, logs estruturados com mascaramento de PII, comandos de exportação e exclusão de dados pela LGPD, checkpoints e eventos para rastreabilidade, handoff para humano por solicitação ou falha de progresso, além de métricas e alertas para acompanhar qualidade da recomendação. Então minha contribuição tem sido muito de operacionalizar governança dentro do produto.
