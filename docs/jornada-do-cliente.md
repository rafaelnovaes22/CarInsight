# Jornada do Cliente — CarInsight

> Mapeamento completo da jornada do cliente no assistente de vendas automotivas via WhatsApp.
> Baseado no framework da [CS Academy](https://www.csacademy.com.br/blog/jornada-do-cliente-guia-completo/).

---

## Visão Geral

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐    ┌─────────────┐
│  1. ATRAÇÃO  │───▶│ 2. DESCOBERTA │───▶│ 3. AVALIAÇÃO  │───▶│  4. DECISÃO  │───▶│ 5. RETENÇÃO │
│              │    │              │    │               │    │              │    │             │
│  Primeiro    │    │  Entender    │    │  Apresentar   │    │  Financiam.  │    │  Follow-up  │
│  contato     │    │  necessidade │    │  opções       │    │  Trade-in    │    │  NPS        │
│  WhatsApp    │    │  do cliente  │    │  ideais       │    │  Negociação  │    │  Indicação  │
└─────────────┘    └──────────────┘    └───────────────┘    └──────────────┘    └─────────────┘
```

---

## Etapa 1 — Atração (Primeiro Contato)

**Objetivo:** Recepcionar o cliente, criar conexão e identificar intenção inicial.

### Touchpoints
| Canal | Ação | Componente |
|-------|------|------------|
| WhatsApp | Cliente envia primeira mensagem | Webhook (`POST /webhooks/whatsapp`) |
| WhatsApp | Saudação personalizada por horário | Greeting Node |
| WhatsApp | Áudio transcrito automaticamente | Audio Transcription Service |

### Fluxo Técnico
```
Mensagem WhatsApp → Meta Webhook → Validação HMAC-SHA256
    → Deduplicação → Guardrails (anti-injection, sanitização)
    → MessageHandlerV2 → LangGraph Greeting Node
```

### O que acontece
1. **Validação de segurança** — Assinatura HMAC-SHA256, deduplicação, guardrails
2. **Saudação contextual** — Adaptada ao horário (manhã/tarde/noite/madrugada)
3. **Extração de nome** — IA identifica o nome do cliente na mensagem
4. **Detecção de intenção imediata** — Se o cliente já menciona um veículo ("Oi, tem Civic 2017?"), pula direto para busca

### Cenários de entrada
| Mensagem do Cliente | Comportamento |
|---------------------|---------------|
| "Oi, sou o Rafael" | Extrai nome → passa para Descoberta |
| "Tem Civic 2017?" | Detecta veículo → busca imediata |
| "Tenho um Gol pra trocar" | Detecta trade-in → coleta detalhes |
| (áudio) | Transcreve via Groq/Whisper → processa texto |

### Emotional Selling (quando ativado)
- **Manhã (08h-12h):** Tom profissional, focado em soluções
- **Tarde (12h-18h):** Tom amigável e descontraído
- **Noite (18h-22h):** Tom conversacional, clima de fim de dia
- **Madrugada (22h-08h):** Tom empático e motivacional

### Métricas
| Indicador | Descrição |
|-----------|-----------|
| Taxa de resposta | % de mensagens que recebem resposta automática |
| Tempo de resposta | Latência webhook → resposta WhatsApp |
| Taxa de identificação de nome | % de clientes com nome extraído na 1a interação |

---

## Etapa 2 — Descoberta (Entendimento de Necessidade)

**Objetivo:** Entender o perfil, orçamento, uso e preferências do cliente.

### Touchpoints
| Canal | Ação | Componente |
|-------|------|------------|
| WhatsApp | Perguntas sobre necessidade | Discovery Node |
| WhatsApp | Extração de preferências | PreferenceExtractorAgent |

### O que é coletado
| Dado | Exemplo | Como detecta |
|------|---------|--------------|
| **Orçamento** | "Tenho até 60 mil" | NLP — extrai valor R$ |
| **Uso** | "Pra trabalho e viagem" | Classificação: cidade/viagem/trabalho/diário/misto |
| **Família** | "Somos 5 pessoas" | Extração numérica |
| **Tipo de veículo** | "Prefiro SUV" | Classificação: sedan/hatch/SUV/pickup/minivan |
| **Câmbio** | "Automático" | Detecção: manual/automático |
| **Trade-in** | "Tenho um carro pra dar de entrada" | Detecção de intenção de troca |

### Lógica de transição
- **Perfil incompleto** (sem orçamento + uso) → continua fazendo perguntas
- **Perfil completo** → pergunta "Quer que eu te mostre algumas opções?"
- **Pedido explícito** ("me mostra opções") → avança para Avaliação
- **Pergunta informativa** ("vocês trabalham com financiamento?") → responde sem forçar recomendação

### Detecção de Handoff
Se o cliente pede "vendedor", "humano" ou "atendente" em qualquer momento, o sistema seta flag `handoff_requested` e encaminha para atendimento humano.

### Métricas
| Indicador | Descrição |
|-----------|-----------|
| Completude de perfil | % dos campos preenchidos (orçamento, uso, tipo) |
| Mensagens até perfil completo | Quantidade média de trocas até ter dados suficientes |
| Taxa de abandono na descoberta | % que sai antes de ver recomendações |

---

## Etapa 3 — Avaliação (Apresentação de Opções)

**Objetivo:** Apresentar veículos relevantes com justificativas personalizadas.

### Touchpoints
| Canal | Ação | Componente |
|-------|------|------------|
| WhatsApp | Busca de veículos | Search Node (vector + SQL) |
| WhatsApp | Apresentação do Top 3 | Recommendation Node |
| WhatsApp | Perguntas técnicas | VehicleExpertAgent |

### Busca Híbrida
```
Perfil do Cliente → Vector Search (pgvector/embeddings)
                  → SQL Filtering (preço, ano, km, tipo)
                  → Ranking por similaridade
                  → Top 3 veículos
```

### Formato da Recomendação (WhatsApp)
```
1. Honda Civic 2022 ⭐ Mais popular
   45.000 km • R$ 89.900 • Preto
   🔗 Ver detalhes
   ✅ Por que combina: econômico • espaçoso • câmbio automático
   ⚠️ Ponto de atenção: acima do orçamento informado

2. Toyota Corolla 2021 💰 Melhor custo-benefício
   52.000 km • R$ 79.900 • Prata
   🔗 Ver detalhes
   ✅ Por que combina: dentro do orçamento • confiável
```

### Estratégias de Fallback (quando não há match exato)
1. **Busca exata** → modelo + ano
2. **Anos alternativos** → mesmo modelo, anos diferentes
3. **Mesma marca** → outros modelos da marca
4. **Mesma categoria** → outros na faixa de preço/tipo
5. **Faixa de preço** → qualquer veículo compatível

### Gestão de Rejeição
| Reação do Cliente | Comportamento |
|-------------------|---------------|
| "Não gostei" / "Muito caro" | Remove veículo, busca alternativas |
| "Tem outro?" | Busca próximos no ranking |
| "Gostei do segundo" | Detalha veículo escolhido |
| "Me fala mais do Civic" | VehicleExpertAgent responde |

### Uber Eligibility
O sistema verifica automaticamente se veículos são elegíveis para Uber (Black, X, Comfort) quando detecta interesse do cliente nesse uso.

### Métricas
| Indicador | Descrição |
|-----------|-----------|
| Taxa de match | % de buscas que retornam ≥1 veículo compatível |
| CTR de recomendação | % de veículos recomendados que o cliente pede detalhes |
| Taxa de rejeição | % de recomendações rejeitadas e motivos |
| Vehicles viewed | Quantidade de veículos visualizados por sessão |

### Feedback capturado por Recomendação
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `userRating` | 1-5 | Avaliação do cliente |
| `userFeedback` | texto | "muito caro", "não gostei da cor" |
| `feedbackType` | enum | positive / negative / neutral |
| `viewDurationSec` | número | Segundos olhando o veículo |
| `askedQuestions` | boolean | Fez perguntas sobre o veículo? |
| `requestedContact` | boolean | Pediu contato com vendedor? |
| `rejectionReason` | texto | Motivo da rejeição |

---

## Etapa 4 — Decisão (Negociação e Conversão)

**Objetivo:** Apoiar o cliente na decisão de compra com financiamento, trade-in e handoff para vendedor.

### Touchpoints
| Canal | Ação | Componente |
|-------|------|------------|
| WhatsApp | Simulação de financiamento | Financing Node / FinancingAgent |
| WhatsApp | Avaliação de trade-in | Trade-in Node / TradeInAgent |
| WhatsApp | Perguntas detalhadas | Negotiation Node |
| WhatsApp | Handoff para vendedor | Link WhatsApp do vendedor |

### Financiamento
```
Cliente: "Consigo financiar o Civic? Tenho 20 mil de entrada"

Bot: 💰 Simulação de Financiamento
     Honda Civic 2022 — R$ 89.900
     Entrada: R$ 20.000
     Financiado: R$ 69.900
     48x de R$ 1.872,50*

     💡 Com 30% de entrada (R$ 26.970), você consegue as melhores taxas!
```

### Trade-in
```
Cliente: "Tenho um Gol 2018 com 80 mil km pra trocar"

Bot: Anotei! Seu Volkswagen Gol 2018 (80.000 km).
     Para uma avaliação precisa, é necessário
     uma visita presencial. Quer que eu te
     conecte com nosso vendedor?
```

### Handoff para Vendedor
Quando o cliente está pronto ou pede atendimento humano:
```
Bot: Vou te conectar com nosso especialista! 🤝
     📱 Clique para falar: [link WhatsApp vendedor]
     (Mensagem pré-preenchida com contexto da conversa)
```

### Conversion Score (0-100 pontos)
| Sinal Comportamental | Pontos |
|-----------------------|--------|
| Informou nome | +10 |
| Informou orçamento | +15 |
| Pediu modelo específico | +20 |
| Visualizou detalhes | +15 |
| Perguntou sobre financiamento | +20 |
| Mencionou trade-in | +15 |
| Sessão noturna (alta intenção) | +10 |
| Cliente retornante | +15 |
| Sessão > 5 minutos | +10 |

> Score ≥ 30 com recomendações visualizadas → agenda follow-up automático.

### Métricas
| Indicador | Descrição |
|-----------|-----------|
| Conversion score médio | Pontuação média dos leads |
| Taxa de handoff | % de conversas que pedem vendedor |
| Taxa de simulação de financiamento | % que chega a simular |
| Taxa de trade-in | % que menciona troca |
| Lead status | Distribuição: new → qualified → contacted → converted |

---

## Etapa 5 — Retenção (Pós-venda e Fidelização)

**Objetivo:** Manter relacionamento, medir satisfação e gerar indicações.

### Touchpoints
| Canal | Ação | Componente |
|-------|------|------------|
| WhatsApp | Follow-up automático | Follow-up Scheduler |
| WhatsApp | Pesquisa de satisfação (NPS) | Follow-up post_sale |
| WhatsApp | Programa de indicação | Referral follow-up |

### Sequências de Follow-up

#### Carrinho Abandonado (`abandoned_cart`)
> Acionado quando o cliente sai sem concluir.

| Seq | Delay | Mensagem |
|-----|-------|----------|
| 1 | 30 min | "Ficou alguma dúvida? Tô aqui pra ajudar!" |
| 2 | 4h | "Achei uma informação legal sobre o [veículo]..." |
| 3 | 24h | "Ainda está disponível, mas já tiveram mais pessoas interessadas..." |

#### Pós-Recomendação (`post_recommendation`)
> Acionado após apresentar veículos.

| Seq | Delay | Mensagem |
|-----|-------|----------|
| 1 | 30 min | "Você viu algumas opções com a gente. Gostou de alguma?" |
| 2 | 4h | "Se quiser agendar uma visita, é só me avisar!" |
| 3 | 24h | "Última mensagem! Se precisar de ajuda, estou por aqui." |

#### Pós-Venda (`post_sale`)
> Acionado após a compra.

| Seq | Delay | Mensagem |
|-----|-------|----------|
| 1 | 3 dias | "Como está o [carro novo]? Curtindo?" |
| 2 | 7 dias | "De 1 a 5, como foi sua experiência de compra?" |
| 3 | 14 dias | "Se tiver algum amigo procurando carro, pode indicar!" |

#### Reengajamento (`referral`)
| Seq | Delay | Mensagem |
|-----|-------|----------|
| 1 | 90 dias | "Temos novidades no estoque que combinam com seu perfil!" |

### Regras de Compliance
- **Horário silencioso:** Nunca envia entre 22h-08h (reagenda para 08h)
- **Máximo por tipo:** 3 mensagens por sequência
- **Opt-out:** Toda mensagem inclui "Digite PARAR para não receber mais"
- **Reengajamento cancela:** Se o cliente responde, cancela follow-ups pendentes

### Programa de Indicação
| Campo | Descrição |
|-------|-----------|
| `referralCode` | Código único do cliente (ex: `RAF-A3X9`) |
| `referredBy` | Código de quem indicou |
| `followUpOptIn` | Consentimento para receber follow-ups |

### Métricas
| Indicador | Descrição |
|-----------|-----------|
| NPS (satisfactionScore) | Nota 1-5 pós-compra |
| Taxa de resposta a follow-up | % que responde aos follow-ups |
| Taxa de opt-out | % que pede para parar |
| Taxa de reengajamento | % de abandonos que retornam após follow-up |
| Taxa de indicação | % de clientes que indicam outros |
| LTV estimado | Receita por cliente (compra + indicações) |

---

## Mapa Completo de Touchpoints

```
ATRAÇÃO           DESCOBERTA         AVALIAÇÃO          DECISÃO            RETENÇÃO
────────          ──────────         ─────────          ───────            ────────

WhatsApp ──────▶ Perguntas ───────▶ Top 3 veículos ──▶ Financiam. ──────▶ Follow-up 30min
Webhook          sobre perfil       com justificativa   Simulação          Follow-up 4h
Saudação         Orçamento          Detalhes técnicos   Trade-in           Follow-up 24h
Nome             Uso/Família        Uber eligibility    Handoff vendedor   NPS (3-14 dias)
Áudio            Tipo veículo       Rejeição/Aceite     Conversion score   Indicação (90d)
Guardrails       Câmbio             Feedback                               Opt-out

────────          ──────────         ─────────          ───────            ────────
Greeting Node    Discovery Node     Search Node        Financing Node     Follow-up Svc
                 PreferenceAgent    Recommendation     Trade-in Node      Scheduler
                                    VehicleExpert      Negotiation Node
                                    RecommendAgent     FinancingAgent
                                                       TradeInAgent
```

---

## Estados do Lead no Funil

```
                    ┌─────────┐
                    │   NEW   │  ← Primeiro contato
                    └────┬────┘
                         │ perfil coletado + score ≥ 30
                    ┌────▼─────┐
                    │QUALIFIED │  ← Tem orçamento, uso, interesse
                    └────┬─────┘
                         │ handoff ou contato vendedor
                    ┌────▼──────┐
                    │ CONTACTED │  ← Vendedor entrou em contato
                    └────┬──────┘
                         │ venda concluída
                    ┌────▼──────┐
                    │ CONVERTED │  ← Cliente comprou
                    └───────────┘
                         │
                    Follow-ups pós-venda
                    NPS + Indicação
```

---

## Monitoramento e Health Check

| Endpoint | Descrição |
|----------|-----------|
| `GET /health` | Status do sistema (database, vectorStore, uptime) |
| `GET /stats` | Conversas, leads, recomendações |
| `GET /debug/config` | Feature flags ativas |
| Pino Logs | Logs estruturados JSON com masking de telefone (LGPD) |

---

## Stack Técnica por Etapa

| Etapa | Tecnologias |
|-------|-------------|
| Atração | Meta WhatsApp API, Express, BullMQ, Guardrails |
| Descoberta | LangGraph, OpenAI/Groq (LLM Router), Pino |
| Avaliação | pgvector, OpenAI Embeddings/Cohere, Prisma |
| Decisão | LangGraph multi-agent, Circuit Breaker |
| Retenção | In-process Scheduler, Prisma, WhatsApp API |

---

*Documento gerado em 2026-03-03. Referência: [Jornada do Cliente — CS Academy](https://www.csacademy.com.br/blog/jornada-do-cliente-guia-completo/)*
