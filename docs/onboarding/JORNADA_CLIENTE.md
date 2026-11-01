# Jornada do Cliente — NovAIs

> Mapa completo de touchpoints: do primeiro contato ao acompanhamento contínuo.
> Inspirado no modelo de jornada visual de concessionárias (ex: SerNissan).

---

## Visão Geral — Fluxo de Touchpoints

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FASE 1 — ATRAÇÃO E PRIMEIRO CONTATO                     │
│                                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │    01     │   │    02    │   │    03    │   │    04    │   │    05    │     │
│  │Propaganda │→ │Indicação │→ │  Busca   │→ │ 1º Cont. │→ │  Demo   │     │
│  │ Digital   │   │Boca-a-  │   │ Ativa   │   │ Comercial│   │ ao Vivo │     │
│  └──────────┘   │  Boca    │   └──────────┘   └──────────┘   └──────────┘     │
│                  └──────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FASE 2 — DISCOVERY E PROPOSTA                           │
│                                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │    06     │   │    07    │   │    08    │   │    09    │   │    10    │     │
│  │Envio do  │→ │Formulário│→ │ Análise  │→ │ Reunião  │→ │ Escopo  │     │
│  │Formulário│   │Preenchido│   │ Técnica  │   │Alinhament│   │ Técnico │     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│                                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                                   │
│  │    11     │   │    12    │   │    13    │                                   │
│  │ Proposta │→ │Negociação│→ │Assinatura│                                   │
│  │ Comercial│   │ de Valor │   │ Contrato │                                   │
│  └──────────┘   └──────────┘   └──────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FASE 3 — CONFIGURAÇÃO E BUILD                           │
│                                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │    14     │   │    15    │   │    16    │   │    17    │   │    18    │     │
│  │ Receber  │→ │ Importar │→ │Criar     │→ │Configurar│→ │Configurar│     │
│  │ Catálogo │   │ Dados    │   │ Plugin   │   │ Prompts  │   │WhatsApp  │     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   │   API    │     │
│                                                                └──────────┘     │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐                    │
│  │    19     │   │    20    │   │    21    │   │    22    │                    │
│  │Configurar│→ │Configurar│→ │Config.   │→ │ Build    │                    │
│  │Guardrails│   │ FAQ/Base │   │ Mídia    │   │ Completo │                    │
│  │ & LGPD   │   │Conhecim. │   │          │   │          │                    │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FASE 4 — VALIDAÇÃO E TESTES                             │
│                                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │    23     │   │    24    │   │    25    │   │    26    │   │    27    │     │
│  │ Deploy   │→ │ Envio do │→ │ Cliente  │→ │ Coleta   │→ │ Ajustes  │     │
│  │ Staging  │   │ Roteiro  │   │  Testa   │   │ Feedback │   │ e Refino │     │
│  └──────────┘   │de Testes │   └──────────┘   └──────────┘   └──────────┘     │
│                  └──────────┘                                                   │
│  ┌──────────┐   ┌──────────┐                                                   │
│  │    28     │   │    29    │                                                   │
│  │ 2ª Rodada│→ │Aprovação │                                                   │
│  │ de Testes│   │  Formal  │                                                   │
│  └──────────┘   └──────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         FASE 5 — GO-LIVE E LANÇAMENTO                          │
│                                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │    30     │   │    31    │   │    32    │   │    33    │   │    34    │     │
│  │ Deploy   │→ │Rollout   │→ │Rollout   │→ │Rollout   │→ │Comunicação│    │
│  │ Produção │   │  10%     │   │  50%     │   │  100%    │   │ à Equipe │     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      FASE 6 — ACOMPANHAMENTO E EVOLUÇÃO                        │
│                                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │    35     │   │    36    │   │    37    │   │    38    │   │    39    │     │
│  │Monitora- │→ │Relatório │→ │ Revisão  │→ │Atualizar │→ │ Tratar   │     │
│  │mento     │   │ Semanal  │   │ Mensal   │   │ Catálogo │   │Problemas │     │
│  │ Contínuo │   │          │   │          │   │/Promoções│   │          │     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│                                                                                 │
│  ┌──────────┐   ┌──────────┐                                                   │
│  │    40     │   │    41    │                                                   │
│  │ Evolução │→ │Expansão/ │                                                   │
│  │do Agente │   │ Upsell   │                                                   │
│  └──────────┘   └──────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Prazo total estimado: 12 a 14 dias úteis** do envio do formulário até o assistente em produção.

---

## Fase 1 — Atração e Primeiro Contato (Dia 0)

> O cliente descobre a NovAIs e tem o primeiro contato comercial.

| # | Touchpoint | Descrição | Responsável | Canal | Sentimento do Cliente |
|---|-----------|-----------|-------------|-------|----------------------|
| 01 | **Propaganda Digital** | Cliente vê anúncio, post no LinkedIn, conteúdo em redes sociais ou artigo sobre IA para negócios | Marketing NovAIs | LinkedIn, Instagram, Google Ads | Curiosidade — "Isso pode funcionar pra mim?" |
| 02 | **Indicação / Boca a Boca** | Cliente recebe indicação de outro empresário que já usa a NovAIs, ou ouve falar em evento/networking | Cliente existente | Pessoal, WhatsApp | Confiança — "Se funcionou pra ele, pode funcionar pra mim" |
| 03 | **Busca Ativa** | Cliente pesquisa soluções de IA/chatbot para WhatsApp, compara concorrentes, visita site da NovAIs | Cliente | Google, site NovAIs | Avaliação — "Quais são as opções no mercado?" |
| 04 | **1º Contato Comercial** | Consultor NovAIs entra em contato (inbound ou outbound), faz apresentação inicial, entende a dor do cliente | Consultor NovAIs | WhatsApp, telefone, email | Interesse — "Quero saber mais" |
| 05 | **Demo ao Vivo** | Demonstração personalizada com vertical similar à do cliente (ex: automotivo, saúde). Cliente vê o assistente funcionando em tempo real | Consultor NovAIs | Google Meet, presencial | Empolgação — "É exatamente isso que eu preciso!" |

### Entregáveis da Fase 1
- Apresentação comercial enviada
- Link do formulário de onboarding compartilhado
- Interesse formal registrado

### O que o cliente precisa fazer
- Assistir à demonstração
- Tirar dúvidas iniciais
- Decidir se quer avançar

---

## Fase 2 — Discovery e Proposta (Dias 1 a 3)

> Entendimento profundo do negócio, definição de escopo e fechamento comercial.

| # | Touchpoint | Descrição | Responsável | Canal | Sentimento do Cliente |
|---|-----------|-----------|-------------|-------|----------------------|
| 06 | **Envio do Formulário** | Consultor envia o formulário de onboarding (19 seções) com instruções claras de preenchimento | Consultor NovAIs | Email, WhatsApp | Comprometimento — "Vou investir tempo nisso" |
| 07 | **Formulário Preenchido** | Cliente preenche todas as seções: identidade, produtos, tom de voz, FAQ, compliance, métricas baseline, etc. | Cliente | Formulário digital | Reflexão — "Nunca pensei nisso com tanto detalhe" |
| 08 | **Análise Técnica** | Equipe NovAIs analisa o formulário, identifica complexidades, prepara perguntas de aprofundamento e define escopo preliminar | Equipe técnica | Interno | *(cliente aguarda)* |
| 09 | **Reunião de Alinhamento** | Reunião de 30-60min para tirar dúvidas, alinhar expectativas, validar entendimento. Decisões-chave são tomadas aqui | Consultor + Técnico | Google Meet | Segurança — "Eles entenderam meu negócio" |
| 10 | **Escopo Técnico** | Definição detalhada: quais nodes, integrações, customizações, idiomas, filiais. Documento técnico compartilhado com o cliente | Equipe técnica | Documento compartilhado | Clareza — "Sei exatamente o que vou receber" |
| 11 | **Proposta Comercial** | Envio da proposta com escopo, prazo, investimento e condições de pagamento | Consultor NovAIs | Email, PDF | Avaliação — "Vale o investimento?" |
| 12 | **Negociação** | Discussão de valores, escopo, prazos. Ajustes na proposta se necessário | Consultor NovAIs | WhatsApp, reunião | Decisão — "Preciso avaliar com meus sócios" |
| 13 | **Assinatura do Contrato** | Fechamento formal. Contrato assinado, pagamento inicial processado, kickoff oficializado | Consultor NovAIs | Email, assinatura digital | Expectativa — "Agora vai começar!" |

### Decisões-chave desta fase
- Qual vertical/segmento será configurado
- Quais funcionalidades o assistente terá (vendas, agendamento, suporte, etc.)
- Nome e personalidade do assistente
- Integrações necessárias (catálogo, CRM, ERP)
- Número de filiais e idiomas
- Regras de escalação e transferência
- Cronograma de entrega acordado

### O que o cliente precisa fazer
- Preencher o formulário com atenção e detalhes
- Participar da reunião de alinhamento
- Envolver stakeholders na aprovação
- Assinar contrato e processar pagamento

---

## Fase 3 — Configuração e Build (Dias 4 a 8)

> A equipe técnica constrói o assistente personalizado com base em tudo que foi coletado.

| # | Touchpoint | Descrição | Responsável | Canal | Sentimento do Cliente |
|---|-----------|-----------|-------------|-------|----------------------|
| 14 | **Receber Catálogo** | Cliente envia catálogo de produtos/serviços no formato combinado (planilha, API, site para scraping) | Cliente + Técnico | Email, Drive, API | Colaboração — "Estou contribuindo pro resultado" |
| 15 | **Importar Dados** | Equipe importa e estrutura os dados: produtos, preços, categorias, fotos, condições de pagamento. Validação de qualidade dos dados | Equipe técnica | Interno | *(cliente aguarda)* |
| 16 | **Criar Plugin de Domínio** | Configuração do plugin específico para o segmento do cliente (automotive, healthcare, etc.) com nodes e fluxos personalizados | Equipe técnica | Interno | *(cliente aguarda)* |
| 17 | **Configurar Prompts e Personalidade** | Criação dos prompts do assistente com tom de voz, nome, gênero, emojis, expressões regionais, bordões. Tudo conforme o formulário | Equipe técnica | Interno | *(cliente aguarda)* |
| 18 | **Configurar WhatsApp API** | Conexão do número do cliente com a API oficial do WhatsApp Business. Configuração de webhook, templates de mensagem | Equipe técnica | Meta Business Suite | Ansiedade positiva — "Está tomando forma" |
| 19 | **Configurar Guardrails e LGPD** | Implementação de mensagens de consentimento, restrições regulatórias, limites de comportamento, detecção de injection | Equipe técnica | Interno | *(cliente aguarda)* |
| 20 | **Configurar FAQ e Base de Conhecimento** | Importação das perguntas frequentes, respostas ideais, material de treinamento. Configuração de respostas para fora-do-escopo | Equipe técnica | Interno | *(cliente aguarda)* |
| 21 | **Configurar Mídia e Conteúdo** | Setup de envio de fotos, PDFs, vídeos, links. Configuração de interpretação de mídia recebida (se aplicável) | Equipe técnica | Interno | *(cliente aguarda)* |
| 22 | **Build Completo** | Integração final de todos os componentes. Testes internos de sanidade. Assistente pronto para staging | Equipe técnica | Interno | Expectativa — "Quando vou poder testar?" |

### Mapeamento: Formulário → Configuração

| Seção do Formulário | O que configuramos | Touchpoint |
|---------------------|-------------------|------------|
| S1. Identidade da Empresa | Identidade visual nas mensagens e saudação | #17 |
| S2. Produtos e Serviços | Base de dados, preços, condições de pagamento | #14, #15 |
| S3. Canais de Venda | Conexão WhatsApp, comportamento fora do horário | #18 |
| S4. Filosofia de Atendimento | Instruções de comportamento e limites | #17, #19 |
| S5. Tom de Voz | Estilo de escrita, emojis, gírias | #17 |
| S6. Objetivo do Assistente | Funcionalidades ativas (vendas, agendamento, etc.) | #16 |
| S7. Jornada do Cliente | Fases da conversa e fluxo de perguntas | #16 |
| S8. FAQ | Base de conhecimento e respostas prontas | #20 |
| S9. Mídia e Conteúdo | Envio de fotos, PDFs, vídeos | #21 |
| S10. Promoções | Regras de divulgação de ofertas | #15, #20 |
| S11. Concorrência | Instruções de posicionamento | #17, #19 |
| S12. Filiais | Roteamento de clientes para unidades | #16 |
| S13. Escalação | Regras de transferência para humanos | #16, #19 |
| S14. Idiomas | Suporte multilíngue | #17 |
| S15. Métricas Baseline | Referência para medir impacto | #22 (documentado) |
| S16. Catálogo e Dados | Integração de dados (planilha, API, scraping) | #14, #15 |
| S17. Compliance | Guardrails, LGPD, consentimento | #19 |
| S18. Expectativas | Prazo e cronograma | #10 (já definido) |
| S19. Pós-Venda e Retenção | Jornada dos 100 dias, indicação, grupo VIP, UGC | #35, #40 |

### O que o cliente precisa fazer
- Enviar o catálogo no formato combinado
- Disponibilizar acesso ao WhatsApp Business (se já existir)
- Enviar banco de imagens/mídias (se houver)
- Responder dúvidas pontuais da equipe técnica (WhatsApp)

### Checkpoints de comunicação
| Dia | Comunicação | Canal |
|-----|------------|-------|
| Dia 4 | "Recebemos seus dados, estamos começando a configuração" | WhatsApp |
| Dia 6 | "Progresso: prompts e fluxo configurados, falta integrar catálogo" | WhatsApp |
| Dia 8 | "Build completo! Amanhã enviaremos o acesso para testes" | WhatsApp |

---

## Fase 4 — Validação e Testes (Dias 9 a 11)

> O cliente testa o assistente em ambiente seguro e dá feedback para refinamento.

| # | Touchpoint | Descrição | Responsável | Canal | Sentimento do Cliente |
|---|-----------|-----------|-------------|-------|----------------------|
| 23 | **Deploy em Staging** | Assistente é publicado em ambiente de teste com número separado. Dados reais, ambiente seguro | Equipe técnica | Interno | *(cliente aguarda)* |
| 24 | **Envio do Roteiro de Testes** | Cliente recebe checklist detalhado de cenários para testar, com instruções passo a passo | Equipe técnica | Email, WhatsApp | Empoderamento — "Sei exatamente o que testar" |
| 25 | **Cliente Testa o Assistente** | Cliente interage com o assistente simulando cenários reais: saudação, busca, FAQ, limites, transferência | Cliente | WhatsApp (número teste) | Descoberta — "Está bem parecido com o que eu queria" |
| 26 | **Coleta de Feedback** | Cliente documenta ajustes necessários: tom incorreto, respostas faltantes, fluxo confuso, erros | Cliente + Consultor | WhatsApp, formulário de feedback | Honestidade — "Precisa ajustar isso e aquilo" |
| 27 | **Ajustes e Refino** | Equipe técnica implementa os ajustes solicitados: prompts, fluxo, respostas, tom de voz | Equipe técnica | Interno | Confiança — "Eles ouviram meu feedback" |
| 28 | **2ª Rodada de Testes** | Cliente retesta os cenários ajustados. Verifica se os problemas foram resolvidos | Cliente | WhatsApp (número teste) | Satisfação — "Agora sim ficou bom!" |
| 29 | **Aprovação Formal** | Cliente dá o OK final para ir para produção. Registro formal de aprovação | Cliente | Email, WhatsApp | Decisão — "Estou pronto para lançar" |

### Roteiro de Testes Detalhado

O cliente deve testar pelo menos os seguintes cenários:

| # | Cenário | O que testar | Resultado esperado |
|---|---------|-------------|-------------------|
| T1 | **Saudação** | Envie "Olá", "Boa tarde", "Oi" | Resposta no tom definido, com nome do assistente |
| T2 | **Busca específica** | Peça um produto/serviço que existe no catálogo | Apresentação com detalhes, preço, condições |
| T3 | **Busca genérica** | "O que vocês têm?", "Me ajuda a escolher" | Perguntas de discovery para entender a necessidade |
| T4 | **FAQ** | Faça perguntas frequentes reais dos seus clientes | Respostas corretas e no tom adequado |
| T5 | **Pagamento** | "Parcela em quantas vezes?", "Aceita Pix?" | Informações corretas de formas de pagamento |
| T6 | **Transferência** | Peça para falar com um humano, gerente, etc. | Handoff correto com mensagem de transição |
| T7 | **Fora do horário** | Teste fora do horário comercial | Comportamento conforme configurado |
| T8 | **Limites** | Tente fazer o assistente falar algo que não deve | Guardrails funcionando, respostas seguras |
| T9 | **Consentimento** | Verifique se a mensagem de LGPD aparece | Mensagem de consentimento exibida corretamente |
| T10 | **Fora do escopo** | Pergunte sobre algo que não é do negócio | Resposta educada redirecionando para o escopo |
| T11 | **Concorrente** | Mencione um concorrente | Posicionamento conforme configurado |
| T12 | **Mídia** | Envie uma foto ou peça um PDF/catálogo | Comportamento correto com mídias |
| T13 | **Idioma** | Mande mensagem em outro idioma (se aplicável) | Resposta no idioma correto |
| T14 | **Filial** | Pergunte sobre localização/filial (se aplicável) | Roteamento correto para a unidade |

### O que o cliente precisa fazer
- Dedicar 1-2 horas para testar o assistente (1ª rodada)
- Documentar tudo que precisa ser ajustado
- Retornar para 2ª rodada após ajustes (30-60min)
- Dar a aprovação formal por escrito

---

## Fase 5 — Go-Live e Lançamento (Dias 12 a 14)

> O assistente entra em produção de forma gradual, monitorada e segura.

| # | Touchpoint | Descrição | Responsável | Canal | Sentimento do Cliente |
|---|-----------|-----------|-------------|-------|----------------------|
| 30 | **Deploy em Produção** | Assistente é publicado em produção, conectado ao número oficial do WhatsApp do cliente | Equipe técnica | Interno | Ansiedade — "E se der problema?" |
| 31 | **Rollout 10%** | Apenas 10% dos atendimentos são direcionados para o assistente. Monitoramento intensivo de erros e métricas | Equipe técnica | Dashboard interno | Cautela — "Vamos ver como se comporta" |
| 32 | **Rollout 50%** | Com métricas estáveis e feedback positivo, metade dos atendimentos passa pelo assistente | Equipe técnica | Dashboard interno | Confiança crescente — "Está funcionando bem!" |
| 33 | **Rollout 100%** | Todos os atendimentos passam pelo assistente. Monitoramento continua ativo | Equipe técnica | Dashboard interno | Orgulho — "Meu negócio está mais moderno" |
| 34 | **Comunicação à Equipe** | Cliente informa sua equipe humana sobre o novo assistente: o que ele faz, quando transfere, como monitorar | Cliente + Consultor | Reunião interna do cliente | Alinhamento — "Todo mundo sabe como funciona" |

### Estratégia de Rollout

| Etapa | Volume | Duração | Critério de avanço | Critério de rollback |
|-------|--------|---------|-------------------|---------------------|
| 1 | 10% dos atendimentos | 1-2 dias | Sem erros críticos, feedback positivo | Taxa de erro > 5%, feedback negativo |
| 2 | 50% dos atendimentos | 1-2 dias | Métricas estáveis, cliente satisfeito | Queda na satisfação, erros recorrentes |
| 3 | 100% dos atendimentos | Contínuo | Tudo funcionando conforme esperado | Problema grave → volta para 50% |

### Suporte Prioritário (Primeira Semana)
- Canal direto com a equipe técnica NovAIs via WhatsApp
- Tempo de resposta: até 30 minutos em horário comercial
- Ajustes emergenciais em até 2 horas
- Monitoramento proativo de métricas pela equipe NovAIs

### O que o cliente precisa fazer
- Monitorar o atendimento nos primeiros dias
- Reportar qualquer problema imediatamente
- Informar sua equipe humana sobre o assistente
- Acompanhar as métricas iniciais

---

## Fase 6 — Acompanhamento e Evolução (Contínuo)

> Monitoramento constante, ajustes e evolução do assistente ao longo do tempo.

| # | Touchpoint | Descrição | Responsável | Canal | Sentimento do Cliente |
|---|-----------|-----------|-------------|-------|----------------------|
| 35 | **Monitoramento Contínuo** | Acompanhamento diário de métricas: latência, erros, volume de atendimentos, taxa de transferência | Equipe técnica | Dashboard | Tranquilidade — "Alguém está de olho" |
| 36 | **Relatório Semanal** | Envio de relatório com métricas da semana: leads gerados, conversões, satisfação, tempo de resposta | Equipe NovAIs | Email, WhatsApp | Visibilidade — "Sei o retorno do investimento" |
| 37 | **Revisão Mensal** | Reunião de 30min para revisar resultados, comparar com baseline, definir próximos ajustes e metas | Consultor + Cliente | Google Meet | Parceria — "Estamos evoluindo juntos" |
| 38 | **Atualizar Catálogo/Promoções** | Cliente informa mudanças no catálogo, preços, promoções. Equipe atualiza o assistente | Cliente + Técnico | WhatsApp, planilha | Controle — "Meu assistente está sempre atualizado" |
| 39 | **Tratar Problemas/Reclamações** | Quando um cliente final reporta problema com o assistente, equipe NovAIs analisa, corrige e reporta | Equipe técnica | WhatsApp, email | Confiança — "Resolvem rápido" |
| 40 | **Evolução do Assistente** | Melhorias contínuas: novos fluxos, novas funcionalidades, refinamento de prompts com base em dados reais | Equipe técnica | Interno + reunião | Crescimento — "Meu assistente fica melhor com o tempo" |
| 41 | **Expansão / Upsell** | Oportunidades de expansão: novo canal (Instagram), nova filial, novo idioma, novo módulo (pós-venda, agendamento) | Consultor NovAIs | Reunião | Ambição — "Quero mais!" |

### Jornada Automatizada dos 100 Dias (Cliente Final)

Após uma venda ser concluída, o assistente inicia automaticamente uma sequência de 7 mensagens ao longo de 100 dias para reter e fidelizar o cliente final. Todas as mensagens incluem opt-out (LGPD) e respeitam horário silencioso (22h-08h).

| Seq | Dia | Objetivo | Conteúdo |
|-----|-----|----------|----------|
| 1 | Dia 0 | Parabéns pela compra | Confirmação + próximos passos (documentação, seguro, revisão) |
| 2 | Dia 3 | Check de satisfação | "Como está o carro novo?" |
| 3 | Dia 7 | NPS | Nota de 1 a 5 sobre a experiência de compra |
| 4 | Dia 14 | Dicas + indicação | Cuidados com o veículo + código de indicação com benefício |
| 5 | Dia 30 | Conteúdo da marca | História/valores da empresa + convite para grupo VIP |
| 6 | Dia 60 | UGC + revisão | Pedido de foto/depoimento + lembrete de revisão |
| 7 | Dia 90 | Re-engagement | Novidades do estoque + reforço do programa de indicação |

> **Configuração:** Os conteúdos das mensagens (dicas, benefício de indicação, grupo VIP) são personalizados conforme as respostas do formulário de onboarding (Seção 19).

### Métricas Acompanhadas

| Métrica | O que mede | Frequência | Meta típica |
|---------|-----------|-----------|-------------|
| Leads qualificados | Contatos gerados pelo assistente | Semanal | +30% vs. baseline |
| Taxa de conversão | % de conversas → venda/agendamento | Semanal | +20% vs. baseline |
| Tempo médio de resposta | Velocidade do assistente | Diário | < 5 segundos |
| Satisfação do cliente final | Feedback dos clientes atendidos | Semanal | > 4.0/5.0 |
| Taxa de transferência | % que precisou de humano | Semanal | < 30% |
| Disponibilidade | % de uptime do assistente | Diário | > 99.5% |
| Taxa de resolução | % resolvido sem humano | Semanal | > 70% |
| Tempo de fechamento | Dias até a conversão | Mensal | Redução vs. baseline |

### Calendário de Acompanhamento

| Atividade | Frequência | Responsável | Entregável |
|-----------|-----------|-------------|------------|
| Monitoramento de métricas | Diário | Equipe técnica | Alertas automáticos se fora do padrão |
| Relatório de performance | Semanal | Equipe NovAIs | PDF/email com métricas e insights |
| Análise de conversas | Quinzenal | Equipe técnica | Lista de melhorias identificadas |
| Revisão de resultados | Mensal | Consultor + Cliente | Ata com metas e próximos passos |
| Atualização de catálogo | Conforme necessidade | Cliente + Equipe | Dados atualizados no sistema |
| Ajustes de prompts/fluxo | Sob demanda | Equipe técnica | Versão refinada do assistente |
| Review estratégico | Trimestral | Consultor + Cliente | Plano de evolução e expansão |

### O que o cliente precisa fazer
- Participar das revisões mensais
- Manter catálogo e promoções atualizados
- Compartilhar feedback dos clientes finais
- Comunicar mudanças no negócio que afetem o assistente
- Reportar problemas assim que identificados

---

## Resumo Completo — 41 Touchpoints em 6 Fases

| Fase | Touchpoints | Duração | Acumulado |
|------|------------|---------|-----------|
| 1. Atração e Primeiro Contato | #01 a #05 (5 touchpoints) | Dia 0 | Dia 0 |
| 2. Discovery e Proposta | #06 a #13 (8 touchpoints) | 3 dias | Dia 3 |
| 3. Configuração e Build | #14 a #22 (9 touchpoints) | 5 dias | Dia 8 |
| 4. Validação e Testes | #23 a #29 (7 touchpoints) | 3 dias | Dia 11 |
| 5. Go-Live e Lançamento | #30 a #34 (5 touchpoints) | 3 dias | Dia 14 |
| 6. Acompanhamento e Evolução | #35 a #41 (7 touchpoints) | Contínuo | — |

**Total: 41 touchpoints mapeados**

> **Nota:** Os prazos podem variar conforme a complexidade do projeto e a velocidade de resposta do cliente. Projetos com integrações complexas (API de ERP, catálogos grandes, múltiplas filiais) podem levar mais tempo na Fase 3.

---

## Mapa de Sentimentos do Cliente

```
Fase 1          Fase 2          Fase 3          Fase 4          Fase 5          Fase 6
Curiosidade  → Comprometimento → Expectativa → Descoberta   → Ansiedade    → Tranquilidade
Confiança    → Segurança       → Ansiedade   → Satisfação   → Confiança    → Parceria
Empolgação   → Clareza         → Positiva    → Confiança    → Orgulho      → Crescimento
              → Expectativa    →             → Decisão      →              → Ambição
```

> O objetivo é que o sentimento predominante evolua de **curiosidade** para **parceria** ao longo de toda a jornada.

---

## Contato

Dúvidas sobre o processo? Fale com seu consultor NovAIs por WhatsApp ou email.
