# 🚀 Integração com Groq (Substituindo OpenAI)

## 📌 Por que Groq?

### Vantagens sobre OpenAI:
- **⚡ 18x mais rápido** - Inferência ultra-rápida (até 800 tokens/segundo)
- **💰 Mais econômico** - Preços mais baixos que OpenAI
- **🎯 Modelos especializados** - LLaMA 3.3 otimizado para conversação
- **🆓 Tier gratuito generoso** - Ideal para desenvolvimento e MVPs
- **🔒 Open source friendly** - Usa modelos open source (LLaMA, Mixtral)

### Comparação de Custos:

| Modelo | Provedor | Input (1M tokens) | Output (1M tokens) | Velocidade |
|--------|----------|-------------------|-------------------|------------|
| GPT-4 | OpenAI | $30.00 | $60.00 | ~50 tokens/s |
| GPT-3.5 Turbo | OpenAI | $0.50 | $1.50 | ~100 tokens/s |
| **LLaMA 3.3 70B** | **Groq** | **$0.59** | **$0.79** | **~800 tokens/s** |
| Mixtral 8x7B | Groq | $0.24 | $0.24 | ~700 tokens/s |
| Gemma 2 9B | Groq | $0.20 | $0.20 | ~850 tokens/s |

---

## 🤖 Modelos Disponíveis no Groq

### 1. **llama-3.3-70b-versatile** (Recomendado) ⭐
- **Uso**: Conversação, raciocínio complexo, atendimento ao cliente
- **Pontos fortes**: Melhor custo-benefício, entende português muito bem
- **Velocidade**: ~800 tokens/segundo
- **Contexto**: 128k tokens
- **Ideal para**: Nosso chatbot de vendas, classificação de intenções

### 2. **llama-3.1-70b-versatile**
- **Uso**: Propósito geral, raciocínio
- **Pontos fortes**: Versão anterior estável do 3.3
- **Velocidade**: ~750 tokens/segundo
- **Contexto**: 128k tokens

### 3. **mixtral-8x7b-32768**
- **Uso**: Tarefas rápidas, classificação
- **Pontos fortes**: Mais barato, muito rápido
- **Velocidade**: ~700 tokens/segundo
- **Contexto**: 32k tokens
- **Ideal para**: Extração de intenção rápida

### 4. **gemma-2-9b-it**
- **Uso**: Tarefas simples, chatbot básico
- **Pontos fortes**: Menor custo, extremamente rápido
- **Velocidade**: ~850 tokens/segundo
- **Contexto**: 8k tokens
- **Ideal para**: Respostas rápidas e curtas

---

## 🛠️ Implementação

### Arquivos Criados/Modificados:

1. **`src/lib/groq.ts`** - Nova biblioteca de integração com Groq
   - `chatCompletion()` - Função genérica de chat
   - `salesChatCompletion()` - Chat otimizado para vendas
   - `extractIntent()` - Extração de intenção do usuário
   - `generateRecommendationReasoning()` - Geração de explicações

2. **`src/config/env.ts`** - Adicionado `GROQ_API_KEY`

3. **`src/agents/orchestrator.agent.ts`** - Migrado para Groq

4. **`src/agents/recommendation.agent.ts`** - Migrado para Groq

### Arquivos Mantidos:
- `src/lib/openai.ts` - Mantido para compatibilidade futura

---

## 🔑 Como Obter a API Key

1. Acesse: https://console.groq.com/
2. Crie uma conta gratuita
3. Vá em **API Keys** → **Create API Key**
4. Copie a chave (formato: `gsk-...`)
5. Adicione no `.env`:

```bash
GROQ_API_KEY="gsk-sua-chave-aqui"
```

### Tier Gratuito Groq:
- **30 requests/min** para LLaMA 3.3 70B
- **14,400 tokens/min** de input
- **Sem limite de uso mensal**
- Ideal para desenvolvimento e testes

---

## 📊 Funções Implementadas

### 1. `chatCompletion(messages, options)`
Função genérica para chat completion.

```typescript
import { chatCompletion } from './lib/groq';

const response = await chatCompletion([
  { role: 'system', content: 'Você é um assistente útil.' },
  { role: 'user', content: 'Olá!' }
], {
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 500
});
```

### 2. `salesChatCompletion(userMessage, context)`
Chat otimizado para vendas com prompt pré-configurado.

```typescript
import { salesChatCompletion } from './lib/groq';

const response = await salesChatCompletion(
  'Quero um carro para família',
  'Cliente já respondeu quiz, orçamento 50k'
);
```

### 3. `extractIntent(userMessage)`
Extrai intenção do usuário (QUALIFICAR, HUMANO, DUVIDA, OUTRO).

```typescript
import { extractIntent } from './lib/groq';

const intent = await extractIntent('Quero comprar um carro');
// Retorna: 'QUALIFICAR'
```

### 4. `generateRecommendationReasoning(vehicleInfo, userProfile, matchScore)`
Gera explicação personalizada para recomendação de veículo.

```typescript
import { generateRecommendationReasoning } from './lib/groq';

const reasoning = await generateRecommendationReasoning(
  'Onix LT 2020, 42.000 km, R$ 48.000',
  'Orçamento R$ 50.000, uso cidade, 5 pessoas',
  95
);
```

---

## 🧪 Modo MOCK (Desenvolvimento sem API Key)

O sistema continua funcionando sem API key para testes locais:

```bash
# .env
GROQ_API_KEY="gsk-mock-key-for-development"
```

Quando em modo MOCK:
- Retorna respostas pré-definidas
- Não consome API calls
- Ideal para testes de fluxo

---

## 🎯 Prompt Engineering para Groq

### Boas Práticas:

1. **Seja específico e direto**
   ```typescript
   // ❌ Ruim
   "Fale sobre carros"
   
   // ✅ Bom
   "Você é um vendedor de carros usados. Explique em 1 frase por que este Onix 2020 é bom para cidade."
   ```

2. **Use system prompts estruturados**
   ```typescript
   const systemPrompt = `Você é um assistente de vendas.
   
   REGRAS:
   - Seja breve (máx 3 linhas)
   - Use tom profissional
   - Não invente informações`;
   ```

3. **Temperature apropriada**
   - `0.3` - Tarefas de classificação (intent)
   - `0.7` - Conversação natural
   - `0.9` - Criatividade (descrições de produtos)

4. **Limite de tokens**
   - Intent: 10 tokens
   - Reasoning: 50 tokens
   - Chat: 300 tokens

---

## 📈 Performance Esperada

### Antes (OpenAI GPT-4):
- Latência: ~2-3 segundos por resposta
- Custo: $0.03 por 1k tokens (input)
- Timeout: Comum em horários de pico

### Depois (Groq LLaMA 3.3 70B):
- Latência: ~200-400ms por resposta ⚡
- Custo: $0.00059 por 1k tokens (input) 💰
- Timeout: Raro (infraestrutura LPU dedicada)

### Melhoria:
- **7-15x mais rápido**
- **50x mais barato**
- **Experiência do usuário muito melhor**

---

## 🔄 Migração de OpenAI → Groq

### Compatibilidade:
O código é quase idêntico, pois Groq usa o mesmo formato de API do OpenAI.

```typescript
// Antes (OpenAI)
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: 'sk-...' });

// Depois (Groq)
import Groq from 'groq-sdk';
const groq = new Groq({ apiKey: 'gsk-...' });
```

### Diferenças principais:
1. **Models**: `gpt-4` → `llama-3.3-70b-versatile`
2. **API Key**: `sk-...` → `gsk-...`
3. **Endpoint**: Automático via SDK

---

## 🚀 Deploy no Railway

O Railway já suporta Groq nativamente. Basta adicionar a env var:

```bash
# Railway Environment Variables
GROQ_API_KEY=gsk-sua-chave-aqui
```

---

## 📚 Recursos

- **Documentação oficial**: https://console.groq.com/docs
- **Playground**: https://groq.com/
- **Modelos disponíveis**: https://console.groq.com/docs/models
- **Rate limits**: https://console.groq.com/docs/rate-limits
- **Pricing**: https://wow.groq.com/pricing/

---

## ⚠️ Limitações e Considerações

### Limitações do Tier Gratuito:
- 30 requests/min (LLaMA 3.3 70B)
- Sem garantia de SLA
- Pode ter throttling em picos

### Quando usar OpenAI ainda:
- Produção em escala (tier pago Groq)
- Necessita GPT-4 Vision (Groq não tem)
- Funcionalidades específicas do OpenAI (function calling avançado)

### Recomendação:
- **Desenvolvimento**: Groq (rápido e barato)
- **MVP/Beta**: Groq (tier gratuito suficiente)
- **Produção**: Groq tier pago ou OpenAI (depende da escala)

---

## ✅ Checklist de Migração

- [x] Instalar `groq-sdk`
- [x] Criar `src/lib/groq.ts`
- [x] Adicionar `GROQ_API_KEY` no `.env`
- [x] Migrar `OrchestratorAgent`
- [x] Migrar `RecommendationAgent`
- [x] Manter modo MOCK funcionando
- [x] Documentar mudanças
- [ ] Obter API key real do Groq
- [ ] Testar com API key real
- [ ] Fazer commit das mudanças
- [ ] Deploy no Railway

---

**Pronto para usar Groq! 🚀**

Execute o teste com:
```bash
npm run test:bot
```
