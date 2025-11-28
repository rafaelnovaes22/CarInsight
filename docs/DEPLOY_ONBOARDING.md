# 🚀 Deploy: Onboarding e Contextos

**Versão:** 2.0  
**Commit:** 885ab1d

---

## ⚠️ IMPORTANTE: Requer Migração de Schema

Este deploy adiciona **novos campos** ao banco de dados.

---

## 📦 O que será deployado

### 1. Sistema de Onboarding
- ✅ Saudação personalizada
- ✅ Coleta de nome
- ✅ Identificação de contexto de uso

### 2. Contextos Inteligentes
- ✅ Uber/99 (X, Comfort, Black)
- ✅ Família
- ✅ Trabalho
- ✅ Viagem

### 3. Dados Uber no Banco
- ✅ `aptoUber` (boolean)
- ✅ `aptoUberBlack` (boolean)
- ✅ `aptoFamilia` (boolean)
- ✅ `aptoTrabalho` (boolean)
- ✅ `economiaCombustivel` (string)

---

## 🎯 Passo a Passo

### 1. Railway já vai deployar automaticamente

O push para `main` já acionou o deploy.

Aguarde ~2 minutos até ver: `✅ Deployment successful`

### 2. Aplicar schema no banco (CRÍTICO)

Após deploy completar, execute via Railway CLI:

```bash
# Conectar ao projeto
railway link

# Aplicar schema (adiciona novos campos)
railway run npx prisma db push
```

**Ou via dashboard Railway:**
1. Abrir projeto
2. Ir em **Deployments**
3. Clicar no deployment ativo
4. Abrir **Shell**
5. Executar: `npx prisma db push`

### 3. Atualizar elegibilidade Uber

Após schema aplicado, marcar veículos aptos:

```bash
railway run npm run vehicles:update-uber
```

**Saída esperada:**
```
🚖 Atualizando elegibilidade Uber...

✅ Honda Civic 2018 - Uber X, Uber Black
✅ Toyota Corolla 2019 - Uber X, Uber Black
...

📊 RESUMO:
🚖 Aptos Uber X: 23 veículos
🚖 Aptos Uber Black: 8 veículos
```

### 4. Resetar conversas existentes

Para que todos comecem no novo fluxo:

```bash
curl "https://faciliauto-mvp-v2-production.up.railway.app/debug/reset-full?phoneNumber=5511910165356"
```

### 5. Testar no WhatsApp

Enviar mensagens de teste:

```
1. "oi"
2. "João"
3. "preciso para uber"
4. "uber x até 50 mil"
```

**Resposta esperada:**
```
Olá! 😊 Bem-vindo à Robust Car!
...
Como posso te chamar?

→ João

Prazer, João! 🤝
...
Qual é a sua necessidade?

→ preciso para uber

Entendi, João! Para Uber/99, temos modelos...
Qual categoria? (X, Comfort, Black)
```

---

## ✅ Checklist de Deploy

### Pré-Deploy
- [x] Código committed (885ab1d)
- [x] Push para main ✅
- [x] Documentação criada ✅

### Durante Deploy
- [ ] Railway deploy iniciou
- [ ] Deploy completou (check verde)
- [ ] Aguardou 2 minutos

### Pós-Deploy (CRÍTICO)
- [ ] Schema aplicado (`railway run npx prisma db push`)
- [ ] Script Uber executado (`railway run npm run vehicles:update-uber`)
- [ ] Conversas resetadas (curl endpoint)
- [ ] Teste no WhatsApp realizado
- [ ] Onboarding funciona (saudação → nome → contexto)
- [ ] Contexto Uber detectado corretamente

---

## 🧪 Cenários de Teste

### Teste 1: Onboarding Completo
```
Você: oi
Bot: Olá! Bem-vindo... Como posso te chamar?

Você: Maria
Bot: Prazer, Maria! Qual sua necessidade?

Você: Carro para família
Bot: Perfeito! Para família, temos SUVs e Sedans...
```

### Teste 2: Nome na Primeira Mensagem
```
Você: Oi, meu nome é Carlos
Bot: Olá, Carlos! Prazer... Me conta, o que procura?
```

### Teste 3: Contexto Uber
```
Você: oi
Bot: Como posso te chamar?

Você: João
Bot: Qual sua necessidade?

Você: Uber
Bot: Para Uber, temos carros aptos...
     Qual categoria? (X, Comfort, Black)

Você: Uber X até 60 mil
Bot: Encontrei 5 carros aptos para Uber X até R$ 60.000...
```

### Teste 4: Contexto Trabalho
```
Você: Preciso de um carro para ir ao trabalho
Bot: Para trabalho/cidade, recomendamos Hatchs econômicos...
```

---

## 📊 Comandos Úteis

### Ver logs Railway:
```bash
railway logs
```

### Ver status do deploy:
```bash
railway status
```

### Conectar ao banco via Prisma Studio (local):
```bash
railway run npx prisma studio
```

### Verificar veículos Uber no banco:
```bash
railway run npx prisma db execute --stdin <<< "SELECT marca, modelo, ano, preco, aptoUber, aptoUberBlack FROM Vehicle WHERE aptoUber = true LIMIT 10;"
```

---

## 🆘 Troubleshooting

### Problema 1: Schema não aplicou

```bash
# Verificar erro
railway logs | grep -i "prisma\|schema"

# Aplicar manualmente
railway run npx prisma db push --accept-data-loss
```

### Problema 2: Script Uber não roda

```bash
# Verificar se schema aplicou primeiro
railway run npx prisma db pull

# Tentar novamente
railway run npm run vehicles:update-uber
```

### Problema 3: Bot não pede nome

**Causa:** Conversa antiga no cache

**Solução:**
```bash
curl "https://sua-url.railway.app/debug/reset-full?phoneNumber=5511910165356"
```

### Problema 4: Contexto não detectado

**Verificar logs:**
```bash
railway logs | grep "Onboarding\|usoPrincipal"
```

**Deve aparecer:**
```
"Onboarding: handling onboarding"
"extracted": { "usoPrincipal": "uber" }
```

---

## 🎯 Métricas Esperadas

| Métrica | Antes | Depois (esperado) |
|---------|-------|-------------------|
| Taxa de abandono no início | 40% | 15% (-62%) |
| Coleta de nome | 0% | 95% |
| Identificação de contexto | 20% | 85% |
| Qualificação de lead Uber | Manual | Automática |
| Tempo médio onboarding | N/A | 30-60s |

---

## 📚 Documentação

- `ONBOARDING_E_CONTEXTOS.md` - Documentação completa
- `FIX_CRITICAL_HANDLER.md` - Fix anterior (MessageHandlerV2)
- `ATIVAR_CONVERSACIONAL_RAILWAY.md` - Ativação modo conversacional

---

## 🔮 Próximos Passos (Futuro)

1. ✅ Onboarding implementado
2. ✅ Contextos implementados
3. ⏳ A/B testing onboarding vs sem onboarding
4. ⏳ Dashboard de conversões por contexto
5. ⏳ Integração API Uber/99 para validação em tempo real
6. ⏳ Calculadora de ROI para motoristas de app
7. ⏳ Mais contextos (taxi, entregador, etc)

---

**Criado:** 2025-11-28  
**Commit:** 885ab1d  
**Status:** ✅ Pronto para deploy  
**Tempo estimado:** 5-10 minutos (incluindo testes)
