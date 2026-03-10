# 🎯 Onboarding e Contextos de Uso

**Versão:** 2.0  
**Data:** 2025-11-28

---

## 📋 O que foi implementado

### 1. Sistema de Onboarding Inteligente

O bot agora tem um fluxo de boas-vindas estruturado que:

1. **Saúda o cliente** de forma amigável
2. **Coleta o nome** para personalização
3. **Identifica o contexto de uso** (Uber, família, trabalho, viagem)
4. **Adapta a conversa** baseado no contexto

---

## 🔄 Fluxo de Onboarding

### Passo 1: Saudação Inicial

**Cliente envia:**
```
oi
```

**Bot responde:**
```
Olá! 😊 Bem-vindo à Robust Car!

Sou especialista em veículos usados e vou te ajudar a encontrar o carro ideal.

Antes de começarmos, como posso te chamar?
```

### Passo 2: Coleta de Nome

**Cliente envia:**
```
João
```

**Bot responde:**
```
Prazer, João! 🤝

Agora me conta: qual é a sua necessidade?

Por exemplo:
🚖 Uber/99: Carros aptos para aplicativos
👨‍👩‍👧‍👦 Família: Espaço, conforto, segurança
💼 Trabalho: Economia, confiabilidade
🏞️ Viagens: Conforto, porta-malas

Qual é o seu caso?
```

### Passo 3: Contexto de Uso

**Cliente envia:**
```
Preciso para Uber
```

**Bot responde:**
```
Entendi, João! Você quer um carro para trabalhar com aplicativos. 🚖

Para Uber/99, temos modelos que atendem os requisitos:
• Ano mínimo (2012+ para Uber X, 2018+ para Black)
• Ar-condicionado obrigatório
• 4 portas
• Documentação em dia

Qual categoria você pretende trabalhar?
1️⃣ Uber X / 99Pop (carros mais acessíveis)
2️⃣ Uber Comfort (sedans médios)
3️⃣ Uber Black (sedans premium)

E qual seu orçamento aproximado?
```

---

## 🚖 Contextos de Uso Suportados

### 1. Uber / Aplicativos

**Gatilhos:**
- "preciso para uber"
- "quero trabalhar com 99"
- "carro para aplicativo"
- "vou fazer uber"

**Critérios automáticos aplicados:**
- Ano mínimo: 2012+ (Uber X) ou 2018+ (Black)
- Ar-condicionado: Obrigatório
- Portas: 4+
- Tipo: Sedan ou Hatch (X) ou apenas Sedan (Black/Comfort)

**Subcategorias:**
- **Uber X / 99Pop:** Mais acessíveis, ano 2012+
- **Uber Comfort:** Sedans médios, ano 2015+
- **Uber Black:** Sedans premium, ano 2018+

### 2. Família

**Gatilhos:**
- "para a família"
- "uso familiar"
- "tenho esposa e filhos"
- "preciso de espaço"

**Critérios automáticos aplicados:**
- Carroceria: SUV, Sedan, Minivan
- Portas: 4+
- Espaço: Prioridade
- Segurança: Airbags, ABS

### 3. Trabalho

**Gatilhos:**
- "para trabalho"
- "uso diário"
- "para ir ao trabalho"
- "cidade"

**Critérios automáticos aplicados:**
- Economia: Alta prioridade
- Tipo: Hatch, Sedan compacto
- Facilidade de estacionamento

### 4. Viagem

**Gatilhos:**
- "para viagens"
- "viajar"
- "longas distâncias"
- "estrada"

**Critérios automáticos aplicados:**
- Conforto: Alta prioridade
- Porta-malas: Grande
- Tipo: SUV, Sedan médio/grande
- Motor: Potência adequada

---

## 🗄️ Schema do Banco de Dados

### Novos campos em `Vehicle`:

```prisma
// Contextos de uso
aptoUber          Boolean  @default(false)  // Apto para Uber/99/apps
aptoUberBlack     Boolean  @default(false)  // Apto para Uber Black
aptoFamilia       Boolean  @default(true)   // Recomendado para família
aptoTrabalho      Boolean  @default(true)   // Bom para trabalho/cidade
economiaCombustivel String?              // baixa, media, alta
```

---

## 🛠️ Como Atualizar Veículos para Uber

### Executar script de atualização:

```bash
# Local
npm run vehicles:update-uber

# Ou diretamente
npx tsx scripts/update-uber-eligibility.ts
```

### O que o script faz:

1. **Analisa todos os veículos** do banco
2. **Aplica critérios Uber:**
   - Uber X: ano ≥ 2012, ar-cond, 4 portas, sedan/hatch
   - Uber Black: ano ≥ 2018, ar-cond, 4 portas, sedan premium
3. **Calcula economia de combustível:**
   - Alta: Hatch, baixa km
   - Média: Sedan médio
   - Baixa: SUV, alta km
4. **Marca aptidões:**
   - `aptoFamilia`: SUVs, Sedans, Minivans
   - `aptoTrabalho`: Econômicos com ar-cond
5. **Gera relatório** com estatísticas

### Exemplo de saída:

```
🚖 Atualizando elegibilidade Uber...

✅ Toyota Corolla 2018 - Uber X, Uber Black
   Preço: R$ 65.000
   Categoria: Sedan
   KM: 70.123

✅ Honda Civic 2019 - Uber X, Uber Black
   Preço: R$ 78.000
   Categoria: Sedan
   KM: 45.230

📊 RESUMO:
🚖 Aptos Uber X / 99Pop: 23 veículos
🚖 Aptos Uber Black / 99TOP: 8 veículos
👨‍👩‍👧‍👦 Recomendados para família: 45 veículos
💼 Bons para trabalho: 52 veículos

✅ Atualização concluída!
```

---

## 🤖 Como o Bot Usa Contextos

### No PreferenceExtractor:

```typescript
// Detecta contexto automaticamente
{
  "usoPrincipal": "uber",
  "tipoUber": "black",
  "minYear": 2018,  // Aplicado automaticamente
  "priorities": ["apto_uber"]
}
```

### No VehicleExpert:

```typescript
// Filtra veículos baseado no contexto
if (profile.usoPrincipal === 'uber') {
  // Busca apenas veículos com aptoUber = true
  // Considera tipoUber (X, Comfort, Black)
  // Explica requisitos e documentação
}
```

### Nas Recomendações:

```
🚖 **Carros Aptos para Uber X:**

1. Honda Civic 2018 - R$ 65.000
   ✅ Apto Uber X e Black
   ✅ Ar-condicionado
   ✅ 4 portas
   ✅ Econômico
   📍 Ver detalhes: [link]

2. Toyota Corolla 2019 - R$ 72.000
   ✅ Apto Uber Black
   ✅ Baixa quilometragem (45k)
   ✅ Sedan premium
   📍 Ver detalhes: [link]
```

---

## 📊 Fluxos Completos

### Fluxo Uber Completo:

```
Cliente: oi
Bot: Olá! Bem-vindo... Como posso te chamar?

Cliente: João
Bot: Prazer, João! Qual sua necessidade? (mostra opções)

Cliente: Uber
Bot: Entendi! Para Uber, temos... Qual categoria? (X, Comfort, Black)

Cliente: Uber X, até 50 mil
Bot: Perfeito! Encontrei 5 carros aptos para Uber X até R$ 50.000:
     [Lista com detalhes de cada veículo]
     
     Posso te mostrar fotos ou mais detalhes de algum?

Cliente: Quero ver o primeiro
Bot: [Envia fotos e detalhes completos do Honda Civic]
     
     Esse Civic 2018 é ótimo para Uber X porque:
     • Ano dentro dos requisitos (2012+)
     • Ar-condicionado original
     • Econômico (flex, 12km/l cidade)
     • Documentação em dia
     • Já pode começar a trabalhar!
```

### Fluxo Família:

```
Cliente: oi
Bot: Olá! Bem-vindo... Como posso te chamar?

Cliente: Maria
Bot: Prazer, Maria! Qual sua necessidade?

Cliente: Carro para a família, 5 pessoas
Bot: Perfeito! Para 5 pessoas, temos SUVs e Sedans espaçosos.
     
     Prefere:
     🚙 SUV: Mais espaço, posição elevada
     🚗 Sedan: Conforto, porta-malas grande
     
     E qual seu orçamento?

Cliente: SUV até 70 mil
Bot: Encontrei 8 SUVs até R$ 70.000 perfeitos para família:
     [Lista personalizada]
```

---

## 🎯 Benefícios

### Para o Cliente:
- ✅ Onboarding personalizado
- ✅ Recomendações mais precisas
- ✅ Explicações contextualizadas (ex: requisitos Uber)
- ✅ Economia de tempo

### Para a Loja:
- ✅ Maior qualificação de leads
- ✅ Menos fricção na conversa
- ✅ Maior taxa de conversão
- ✅ Dados estruturados sobre uso

---

## 🚀 Deploy e Testes

### 1. Aplicar mudanças no banco:

```bash
# Push schema
npx prisma db push

# Atualizar elegibilidade Uber
npm run vehicles:update-uber

# Regenerar embeddings (se necessário)
npm run embeddings:generate
```

### 2. Testar fluxos:

```bash
# Resetar conversa
npm run conversations:reset 5511910165356

# Iniciar servidor
npm run dev

# Testar no WhatsApp:
# 1. "oi"
# 2. "João"
# 3. "preciso para uber"
# 4. "uber x até 50 mil"
```

### 3. Validar no banco:

```bash
# Abrir Prisma Studio
npm run db:studio

# Verificar:
# - Vehicles: aptoUber, aptoUberBlack
# - Conversations: customerName, profileData (JSON)
```

---

## 📚 Arquivos Relacionados

- `src/services/onboarding-handler.service.ts` - Lógica de onboarding
- `src/services/conversational-handler.service.ts` - Integração
- `src/agents/preference-extractor.agent.ts` - Extração de contextos
- `src/agents/vehicle-expert.agent.ts` - Prompts com critérios Uber
- `scripts/update-uber-eligibility.ts` - Atualização de dados
- `prisma/schema.prisma` - Schema atualizado

---

## 🔮 Melhorias Futuras

- [ ] Adicionar mais contextos (taxi, entregador, etc)
- [ ] Integrar com API de documentação Uber/99
- [ ] Calcular ROI para cada veículo (payback)
- [ ] Adicionar simulador de ganhos Uber
- [ ] Criar dashboard de carros mais vendidos por contexto

---

**Criado:** 2025-11-28  
**Status:** ✅ Implementado e pronto para deploy  
**Versão:** 2.0 (Onboarding + Contextos)
