# 🚀 Como Obter sua Groq API Key (2 minutos)

## 🎯 Por que Groq?

- **⚡ 18x mais rápido** que GPT-4 (~800 tokens/segundo)
- **💰 50x mais barato** ($0.59/1M tokens vs $30/1M do GPT-4)
- **🆓 Tier gratuito generoso** - Perfeito para MVPs
- **🔓 Open source** - Usa LLaMA 3.3 70B (Meta)

---

## 📝 Passo a Passo

### 1. Acessar Groq Console
Abra seu navegador e acesse:
👉 **https://console.groq.com/**

### 2. Criar Conta Gratuita
- Clique em **"Sign Up"** ou **"Get Started"**
- Opções de cadastro:
  - Gmail
  - GitHub
  - Email/Senha

### 3. Verificar Email (se necessário)
- Verifique sua caixa de entrada
- Clique no link de confirmação

### 4. Gerar API Key
1. No dashboard, vá em **"API Keys"** (menu lateral)
2. Clique em **"Create API Key"**
3. Dê um nome: `FaciliAuto MVP`
4. **COPIE A CHAVE** (formato: `gsk-...`)
   - ⚠️ Você só verá esta chave UMA VEZ
   - Se perder, precisa gerar uma nova

### 5. Adicionar ao Projeto
Abra o arquivo `.env` do projeto e cole a chave:

```bash
GROQ_API_KEY="gsk-sua-chave-aqui-cole-sem-aspas"
```

### 6. Testar
Execute o teste do bot:

```bash
npm run test:bot
```

Se aparecer `🤖 Using MOCK mode (no Groq API key)`, a chave não foi configurada corretamente.

Se aparecer mensagens sem MOCK, está funcionando! 🎉

---

## 📊 Limites do Tier Gratuito

### LLaMA 3.3 70B Versatile (Recomendado)
- **30 requests/minuto**
- **14,400 tokens/minuto** de input
- **6,000 tokens/minuto** de output
- **Sem limite mensal** 🤯

### Para 99% dos MVPs, isso é MAIS que suficiente!

**Exemplo prático:**
- 1 atendimento = ~3 requests
- 1 request = ~200 tokens
- **Capacidade: ~600 atendimentos/hora no tier gratuito** 🚀

---

## 🔄 Se precisar de mais...

### Groq Paid Tier (quando escalar)
- **300 requests/minuto** (10x mais)
- **120,000 tokens/minuto** (8x mais)
- Ainda **50x mais barato** que OpenAI

---

## ⚙️ Trocar o Modelo (opcional)

Por padrão usamos `llama-3.3-70b-versatile`, mas você pode trocar:

No arquivo `src/lib/groq.ts`, altere:

```typescript
// Opções de modelos:
model: 'llama-3.3-70b-versatile'   // Melhor custo-benefício (recomendado)
model: 'llama-3.1-70b-versatile'   // Versão anterior estável
model: 'mixtral-8x7b-32768'        // Mais barato e rápido
model: 'gemma-2-9b-it'             // Ultra rápido, tarefas simples
```

---

## 🐛 Troubleshooting

### Erro: "Invalid API Key"
- ✅ Verifique se a chave começa com `gsk-`
- ✅ Confirme que não tem espaços antes/depois
- ✅ Tente gerar uma nova chave

### Erro: "Rate limit exceeded"
- ✅ Você excedeu 30 requests/min
- ✅ Aguarde 1 minuto e tente novamente
- ✅ Considere fazer upgrade (se necessário)

### Ainda usando MOCK mode?
- ✅ Confirme que o `.env` tem `GROQ_API_KEY`
- ✅ Reinicie o servidor (`npm run dev`)
- ✅ Verifique se não tem outro `.env` conflitante

---

## 📚 Recursos Úteis

- **Dashboard**: https://console.groq.com/
- **Documentação**: https://console.groq.com/docs
- **Modelos disponíveis**: https://console.groq.com/docs/models
- **Pricing**: https://wow.groq.com/pricing/
- **Playground**: https://groq.com/ (testar modelos)

---

## ✅ Checklist Final

- [ ] Conta criada no Groq
- [ ] API Key gerada e copiada
- [ ] `.env` atualizado com a chave
- [ ] Teste executado com sucesso (`npm run test:bot`)
- [ ] Sem mensagens de MOCK mode
- [ ] Recomendações sendo geradas corretamente

---

**Tempo total: ~2 minutos** ⏱️

**Pronto para usar o LLM mais rápido do mercado! 🚀⚡**
