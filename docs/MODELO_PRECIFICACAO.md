# 💰 Modelo de Precificação - FaciliAuto MVP

> Documento estratégico de precificação baseado em análise competitiva e valor entregue

**Versão:** 1.0  
**Data:** 10/12/2024  
**Confidencial**

---

## 📊 Análise de Mercado

### 1. Panorama da Concorrência no Brasil (2024)

| Categoria | Faixa de Preço Mensal | Características |
|-----------|----------------------|-----------------|
| **Básico** (Chatbots simples) | R$ 97 - R$ 200/mês | Regras fixas, sem IA real, respostas prontas |
| **Intermediário** (IA Limitada) | R$ 200 - R$ 500/mês | IA básica, NLP simples, sem RAG |
| **Avançado** (IA Completa) | R$ 500 - R$ 1.500/mês | IA generativa, NLP avançado, integrações |
| **Enterprise** (Customizado) | R$ 2.000 - R$ 10.000+/mês | IA customizada, múltiplas integrações, SLA |

### 2. Concorrentes Diretos no Brasil

| Empresa | Modelo de Cobrança | Preço Médio | Diferenciais |
|---------|-------------------|-------------|--------------|
| **ChatGuru** | Planos mensais | R$ 197 - R$ 597/mês | CRM integrado, múltiplos atendentes |
| **AssistenteSmart** | Setup + mensalidade | R$ 2.000 setup + R$ 297/mês | Foco automotivo, agendamento |
| **MKon** | Por volume de mensagens | R$ 0,05 - R$ 0,15/msg | Escalável, API first |
| **Intelia** | Enterprise | R$ 1.500+/mês | Integração CRM/ERP completa |
| **Weni** | Uso + plataforma | R$ 500 - R$ 2.000/mês | Omnichannel, baixo código |

### 3. Players Internacionais (Referência)

| Empresa | Modelo | Preço USD | Notas |
|---------|--------|-----------|-------|
| **Matador AI** | Por dealership | $500 - $1.500/mês | Líder EUA, +1000 dealerships |
| **STELLA Automotive** | Voz + Chat | $300 - $800/mês | Foco em agendamento |
| **Glassix** | Seats + volume | $50 - $200/seat/mês | Omnichannel |

---

## 🎯 Posicionamento FaciliAuto

### Nossa Proposta de Valor Única

| Feature | FaciliAuto | Concorrência Básica | Concorrência Premium |
|---------|------------|---------------------|---------------------|
| **IA Generativa (GPT-4)** | ✅ GPT-4o-mini | ❌ Regras fixas | ✅ GPT-3.5 |
| **RAG com Embeddings** | ✅ OpenAI + Cohere | ❌ Sem RAG | ⚠️ Limitado |
| **Multi-LLM Fallback** | ✅ 3 providers | ❌ Provider único | ❌ Provider único |
| **Busca Semântica < 50ms** | ✅ Vector Store | ❌ SQL básico | ⚠️ 200-500ms |
| **LangGraph State Machine** | ✅ Fluxo inteligente | ❌ Linear | ⚠️ Básico |
| **ISO 42001 Compliance** | ✅ Completo | ❌ Nenhum | ⚠️ Parcial |
| **Guardrails Anti-Injection** | ✅ 30+ patterns | ❌ Nenhum | ⚠️ Básico |
| **Match Score Personalizado** | ✅ 0-100 com reasoning | ❌ Nenhum | ⚠️ Básico |
| **Simulador Financiamento** | ✅ Tempo real | ❌ Nenhum | ⚠️ Estático |
| **Detecção de Trade-in** | ✅ Automática | ❌ Manual | ❌ Manual |
| **Handoff Inteligente** | ✅ Com contexto completo | ⚠️ Básico | ✅ Completo |
| **Suporte Áudio** | ✅ Whisper + contexto | ❌ Nenhum | ⚠️ Transcrição simples |

### Cálculo do Valor Entregue

```
Custo de Oportunidade SEM o bot:
- Leads perdidos à noite/fds:    ~40% do total
- Taxa de resposta manual:       ~60% (demora)
- Taxa de qualificação manual:   ~30%
- Conversão manual:              ~2%

COM o FaciliAuto:
- Leads capturados 24/7:         100%
- Taxa de resposta:              100% (instantânea)
- Taxa de qualificação:          85%+
- Conversão esperada:            4-6%
```

---

## 💵 Modelos de Precificação Propostos

### Modelo A: Setup + Comissão por Venda (RECOMENDADO)

> **Melhor para:** Concessionárias pequenas/médias que querem baixo risco

| Componente | Valor | Descrição |
|------------|-------|-----------|
| **Setup Único** | R$ 3.000 - R$ 5.000 | Implementação completa |
| **Mensalidade Base** | R$ 0 | Sem custos fixos mensais |
| **Comissão por Venda** | R$ 500 - R$ 800 | Por venda incremental rastreada |

**Justificativa de Precificação:**
- Setup cobre: 20h de desenvolvimento + infraestrutura + configuração
- Margem média por carro usado: R$ 3.000 - R$ 5.000
- Comissão representa: 10-15% da margem (justo para ambos)

**Projeção de Revenue:**
```
Cenário Conservador (3 vendas/mês):
- Ano 1: R$ 3.000 (setup) + 36 × R$ 500 = R$ 21.000
- MRR efetivo: R$ 1.500/mês

Cenário Otimista (8 vendas/mês):
- Ano 1: R$ 3.000 + 96 × R$ 500 = R$ 51.000
- MRR efetivo: R$ 4.000/mês
```

---

### Modelo B: Mensalidade Fixa + Setup

> **Melhor para:** Concessionárias maiores com volume previsível

| Tamanho | Setup | Mensalidade | Veículos | Conversas/mês |
|---------|-------|-------------|----------|---------------|
| **Starter** | R$ 2.000 | R$ 497/mês | Até 50 | 500 |
| **Professional** | R$ 3.500 | R$ 897/mês | Até 150 | 1.500 |
| **Enterprise** | R$ 6.000 | R$ 1.497/mês | Ilimitado | Ilimitado |

**Incluso em todos os planos:**
- IA GPT-4o-mini com fallback Groq
- Busca semântica com embeddings
- Dashboard de métricas
- Suporte por WhatsApp
- Atualizações do sistema

**Adicionais pagos:**
| Recurso | Preço |
|---------|-------|
| Integração CRM (Pipedrive, RD Station) | R$ 500/mês |
| Transcrição de áudio (Whisper) | R$ 0,10/minuto |
| Multi-número WhatsApp | R$ 200/número/mês |
| Relatórios avançados | R$ 200/mês |
| SLA 24h | R$ 300/mês |

---

### Modelo C: Híbrido (Setup + Mensalidade Reduzida + Comissão)

> **Melhor para:** Equilibrar risco entre cliente e fornecedor

| Componente | Valor |
|------------|-------|
| **Setup** | R$ 2.500 |
| **Mensalidade** | R$ 297/mês |
| **Comissão por Venda** | R$ 300 |

**Vantagem:** Cliente tem custo previsível baixo + incentivo ao desempenho

---

### Modelo D: Por Uso (Pay-as-you-go)

> **Melhor para:** Concessionárias muito pequenas ou teste

| Métrica | Preço |
|---------|-------|
| **Setup** | R$ 1.500 |
| **Conversa iniciada** | R$ 0,50 |
| **Mensagem processada** | R$ 0,05 |
| **Lead qualificado** | R$ 5,00 |
| **Áudio transcrito** | R$ 0,15/min |

**Estimativa mensal (100 conversas, 1000 msgs):**
```
Conversas: 100 × R$ 0,50 = R$ 50
Mensagens: 1000 × R$ 0,05 = R$ 50
Leads: 30 × R$ 5,00 = R$ 150
Total: ~R$ 250/mês
```

---

## 📈 Tabela Comparativa de Modelos

| Modelo | Setup | Custo Mensal Mín. | Custo Mensal Máx. | Risco Cliente | Risco Nosso |
|--------|-------|-------------------|-------------------|---------------|-------------|
| **A: Comissão** | R$ 3.000 | R$ 0 | R$ 4.000+ | ⬇️ Baixo | ⬆️ Alto |
| **B: Mensalidade** | R$ 2.000 | R$ 497 | R$ 1.497 | ⬆️ Médio | ⬇️ Baixo |
| **C: Híbrido** | R$ 2.500 | R$ 297 | R$ 1.500+ | ➡️ Médio | ➡️ Médio |
| **D: Pay-as-you-go** | R$ 1.500 | R$ 50 | R$ 500+ | ⬇️ Baixo | ⬆️ Alto |

---

## 🧮 Análise de Custos (Nossa Operação)

### Custos Fixos por Cliente/Mês

| Item | Custo Estimado |
|------|----------------|
| **OpenAI GPT-4o-mini** | ~R$ 50-150/mês (500-1500 conversas) |
| **OpenAI Embeddings** | ~R$ 10/mês (geração única + updates) |
| **Groq (fallback)** | ~R$ 0-20/mês (só quando OpenAI falha) |
| **Railway Hosting** | ~R$ 30-50/mês (pro-rata entre clientes) |
| **PostgreSQL** | ~R$ 20/mês (incluído Railway) |
| **Suporte técnico** | ~R$ 100-200/mês (2-4h) |
| **Total Custo Operacional** | ~R$ 200-400/mês por cliente |

### Break-even Analysis

| Modelo | Preço Mínimo | Custo | Margem | Clientes p/ Break-even* |
|--------|--------------|-------|--------|------------------------|
| **A: Comissão** | 3 vendas = R$ 1.500 | R$ 300 | R$ 1.200 | 5 clientes |
| **B: Starter** | R$ 497 | R$ 250 | R$ 247 | 25 clientes |
| **B: Professional** | R$ 897 | R$ 350 | R$ 547 | 11 clientes |

*Para R$ 6.000/mês de receita líquida

---

## 🎯 Recomendação Estratégica

### Fase 1: Lançamento (0-6 meses) - MODELO A

**Oferta de Lançamento:**
```
R$ 3.000 de setup (único)
+
R$ 500 por venda incremental
```

**Justificativa:**
1. ✅ Baixa barreira de entrada para o cliente
2. ✅ Alinha nosso sucesso ao sucesso do cliente
3. ✅ Gera casos de sucesso para marketing
4. ✅ Valida o modelo de negócio com risco controlado

**Critérios de sucesso (após 90 dias):**
- ≥ 3 vendas incrementais/mês
- NPS ≥ 8
- Churn = 0

### Fase 2: Crescimento (6-18 meses) - MODELO B

**Migração gradual para mensalidade:**
- Clientes de Fase 1 com bom histórico → desconto na mensalidade
- Novos clientes → Modelo B (preferencial) ou A (exceção)

### Fase 3: Escala (18+ meses) - MODELO B + C

**Portfolio de opções:**
- Starter para pequenos
- Professional para médios
- Enterprise para grandes grupos
- Híbrido para leads sensíveis a preço

---

## 📋 Checklist de Precificação por Cliente

Antes de definir o preço, avaliar:

### Fatores que AUMENTAM o preço:
- [ ] +30 veículos no estoque
- [ ] Múltiplas unidades/lojas
- [ ] Integração com CRM existente
- [ ] Personalização do fluxo conversacional
- [ ] SLA de suporte premium
- [ ] Multi-número WhatsApp
- [ ] Volume alto de leads (>500/mês)

### Fatores que podem REDUZIR o preço:
- [ ] Estoque pequeno (<30 veículos)
- [ ] Disposto a ser case de sucesso
- [ ] Contrato de 12+ meses
- [ ] Indicação de outro cliente
- [ ] Early adopter/founding partner

---

## 🔢 Calculadora de Proposta

### Fórmula para Setup:
```
Setup Base: R$ 2.500
+ Veículos extras (>30): +R$ 30/veículo
+ Integração CRM: +R$ 500
+ Customização fluxo: +R$ 500-1.500
+ Multi-loja: +R$ 500/loja
= SETUP TOTAL
```

### Fórmula para Mensalidade (Modelo B):
```
Mensalidade Base: R$ 497
+ Volume extra (>500 conversas): +R$ 0,30/conversa
+ Áudio habilitado: +R$ 100
+ Relatórios avançados: +R$ 200
= MENSALIDADE TOTAL
```

### Fórmula para Comissão (Modelo A):
```
Comissão Base: R$ 500/venda

Ajustes:
- Ticket médio > R$ 60.000: Comissão R$ 700
- Ticket médio > R$ 100.000: Comissão R$ 1.000
- Volume > 10 vendas/mês: Desconto 10%
```

---

## 📊 Comparativo Visual: Nós vs Mercado

```
                    PREÇO MENSAL EFETIVO
                    
FaciliAuto (Comissão)    ████████░░░░░░░░░░░░  R$ 1.500*
FaciliAuto (Starter)     ██████████░░░░░░░░░░  R$ 497
ChatGuru Basic           ████████░░░░░░░░░░░░  R$ 397
AssistenteSmart          ██████████░░░░░░░░░░  R$ 497
Matador AI (EUA)         ████████████████████  $800+
Soluções Enterprise      ██████████████████████████████  R$ 2.000+

* Considerando média de 3 vendas/mês
```

---

## 🎁 Ofertas Especiais

### 1. Founding Partner (primeiros 5 clientes)
```
- Setup: R$ 2.000 (33% off)
- Comissão: R$ 400/venda (20% off)
- Preço bloqueado por 24 meses
- Badge "Founding Partner"
- Co-criação de features
```

### 2. Indicação
```
- Cliente indicador: 1 mês grátis OU R$ 300
- Cliente indicado: 10% off no setup
```

### 3. Contrato Anual
```
- 15% desconto na mensalidade
- 1 mês grátis
- Suporte prioritário
```

---

## 📞 Scripts de Negociação

### Quando cliente acha caro:
> "Entendo sua preocupação. Mas pense: quanto custa perder UM lead que ligou à noite e não foi atendido? Com o FaciliAuto, você captura 100% dos leads 24/7. Uma venda extra de R$ 50.000 já paga mais de um ano do sistema."

### Quando compara com concorrentes baratos:
> "Existem soluções mais baratas, sim. Mas elas usam regras fixas, não IA real. Nosso sistema usa GPT-4, o mesmo da OpenAI, com busca semântica que entende o que o cliente quer, mesmo com palavras diferentes. Isso gera recomendações que convertem mais."

### Quando quer testar grátis:
> "Oferecemos um modelo onde você só paga comissão quando vende. Ou seja, se não funcionar, você paga R$ 0. Zero risco. Só precisa do setup de R$ 3.000 para cobrir nossa implementação."

---

## 📈 Metas de Revenue

| Período | Clientes | Modelo Principal | Revenue Mensal | Revenue Anual |
|---------|----------|------------------|----------------|---------------|
| Mês 1-3 | 3 | Comissão | R$ 4.500 | - |
| Mês 4-6 | 7 | Comissão + Starter | R$ 10.500 | - |
| Mês 7-12 | 15 | Mix | R$ 15.000 | R$ 90.000 |
| Ano 2 | 40 | Mensalidade | R$ 30.000 | R$ 360.000 |
| Ano 3 | 100 | Enterprise | R$ 80.000 | R$ 960.000 |

---

## 📝 Revisão e Atualizações

| Data | Versão | Alteração |
|------|--------|-----------|
| 10/12/2024 | 1.0 | Documento inicial |

---

**Elaborado por:** Equipe FaciliAuto  
**Próxima revisão:** Após primeiros 3 clientes pagantes

---

*Este documento é confidencial e de uso interno. Não compartilhar com concorrentes ou clientes.*
