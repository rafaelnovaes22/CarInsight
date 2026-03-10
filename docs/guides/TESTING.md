# 🧪 Guia de Testes - FaciliAuto MVP

## 📋 Testes Disponíveis

### 1. Teste do Bot (Sem WhatsApp)

Simula uma conversa completa com o bot sem precisar do WhatsApp conectado:

```bash
PATH=~/nodejs/bin:$PATH npm run test:bot
```

**O que o teste faz:**
- Simula um cliente iniciando conversa
- Responde ao quiz completo (8 perguntas)
- Gera recomendações de veículos
- Mostra todo o fluxo no terminal

**Resultado esperado:**
```
🧪 Starting bot test...
👤 User: Olá, quero comprar um carro
🤖 Bot: Perfeito! Vou fazer algumas perguntas...
...
✅ Bot test completed!
```

---

### 2. Teste da API REST

Com o servidor rodando, teste os endpoints:

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Estatísticas:**
```bash
curl http://localhost:3000/stats
```

**Dashboard Web:**
Abra no navegador: http://localhost:3000/

---

### 3. Teste do Database

**Visualizar dados com Prisma Studio:**
```bash
PATH=~/nodejs/bin:$PATH npx prisma studio
```

Abre em: http://localhost:5555

**Verificar veículos no banco:**
```bash
sqlite3 prisma/dev.db "SELECT marca, modelo, ano, preco FROM Vehicle LIMIT 5;"
```

---

## 🎯 Teste Completo (Fluxo de Conversa)

### Cenário 1: Cliente qualificado

```
Cliente: Olá, quero comprar um carro
Bot: [Saudação + oferece quiz]

Cliente: sim
Bot: [Inicia quiz - Pergunta 1]

Cliente: 50000
Bot: [Pergunta 2]

Cliente: 1
Bot: [Pergunta 3]

... (continua até pergunta 8)

Bot: [Mostra 3 recomendações com Match Score]

Cliente: agendar
Bot: [Cria lead e oferece contato humano]
```

### Cenário 2: Cliente quer falar com humano

```
Cliente: Quero falar com um vendedor
Bot: [Identifica intenção HUMANO]
Bot: Vou conectar você com um vendedor...
```

### Cenário 3: Cliente com dúvida

```
Cliente: Vocês aceitam financiamento?
Bot: [Identifica intenção DUVIDA]
Bot: [Responde usando GPT-4]
```

---

## 📊 Verificar Dados Gerados

Após rodar o teste, verifique no banco:

**Conversas criadas:**
```sql
SELECT id, phoneNumber, currentStep, status FROM Conversation;
```

**Eventos registrados:**
```sql
SELECT eventType, timestamp FROM Event ORDER BY timestamp DESC LIMIT 10;
```

**Recomendações geradas:**
```sql
SELECT r.matchScore, v.marca, v.modelo 
FROM Recommendation r 
JOIN Vehicle v ON r.vehicleId = v.id 
ORDER BY r.matchScore DESC;
```

**Leads gerados:**
```sql
SELECT name, phone, budget, status FROM Lead;
```

---

## 🐛 Debug

### Ver logs em tempo real:

O bot usa logger estruturado (pino). Logs são exibidos no console.

### Modo Mock (Desenvolvimento sem OpenAI):

Se você não tem chave da OpenAI, o sistema usa respostas mock automaticamente.

Verifique no log:
```
🤖 Using MOCK mode (no OpenAI API key)
```

### Testar fluxo específico:

Edite `src/test-bot.ts` e mude as respostas simuladas.

---

## ✅ Checklist de Validação

Antes de colocar em produção:

- [ ] Teste do bot executa sem erros
- [ ] API /health retorna `{"status":"ok"}`
- [ ] API /stats retorna números corretos
- [ ] Dashboard web carrega corretamente
- [ ] Banco de dados tem 10 veículos
- [ ] Quiz completo funciona (8 perguntas)
- [ ] Recomendações são geradas (3 carros)
- [ ] Match Score está entre 0-100
- [ ] Leads são criados corretamente
- [ ] Eventos são registrados

---

## 🚀 Próximos Passos

1. **Adicionar chave OpenAI real** (edite `.env`)
2. **Conectar WhatsApp** (execute `npm run dev`)
3. **Testar com número real** (envie mensagem)
4. **Popular catálogo completo** (37 veículos reais)
5. **Configurar webhook CRM** (opcional)

---

## 🆘 Troubleshooting

**Erro: "OPENAI_API_KEY not found"**
→ Normal em modo mock. Para produção, adicione chave real no `.env`

**Erro: "Database not found"**
→ Execute: `PATH=~/nodejs/bin:$PATH npx prisma db push`

**Erro: "No vehicles available"**
→ Execute: `PATH=~/nodejs/bin:$PATH npm run db:seed`

**WhatsApp não conecta**
→ Delete pasta `baileys_auth_info` e reinicie

**Bot não responde**
→ Verifique logs, pode ser rate limit da OpenAI
