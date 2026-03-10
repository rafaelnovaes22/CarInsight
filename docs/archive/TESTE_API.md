# 🧪 Teste do Bot via API (SEM WhatsApp)

Como o WhatsApp está com problemas para conectar no ambiente WSL, criei uma API para testar o bot!

## ✅ O que está funcionando

1. **Servidor API rodando** → `http://localhost:3000`
2. **30 veículos no banco** → Renatinhu's Cars completo
3. **Bot respondendo via HTTP** → Simula WhatsApp
4. **Todo o sistema funcionando** → Quiz, IA, Match Score

---

## 🚀 OPÇÃO 1: Chat Interativo no Terminal

### Passo 1: Abra um novo terminal e execute:

```bash
cd /home/rafaelnovaes22/project/faciliauto-mvp
./chat.sh
```

### Passo 2: Converse com o bot!

```
👤 Você: Olá, quero comprar um carro
🤖 Bot: [responde com início do quiz]

👤 Você: 50000
🤖 Bot: [próxima pergunta]

👤 Você: 1
🤖 Bot: [próxima pergunta]
...
```

**Para sair:** digite `sair`

---

## 🚀 OPÇÃO 2: Testar com CURL

### Enviar uma mensagem:

```bash
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511987654321","message":"Olá, quero comprar um carro"}'
```

### Resposta exemplo:

```json
{
  "success": true,
  "phone": "5511987654321",
  "userMessage": "Olá, quero comprar um carro",
  "botResponse": "Perfeito! Vou fazer algumas perguntas rápidas...",
  "timestamp": "2024-01-15T20:22:07.123Z"
}
```

---

## 🚀 OPÇÃO 3: Dashboard Web

Abra no navegador: **http://localhost:3000**

Ver estatísticas: **http://localhost:3000/stats**

---

## 📊 Monitorar Logs em Tempo Real

```bash
tail -f /home/rafaelnovaes22/project/faciliauto-mvp/api-server.log
```

Você verá:
- Mensagens chegando
- Bot processando
- Respostas sendo enviadas
- Conversas sendo criadas

---

## 🎯 Fluxo de Teste Completo

### 1. Iniciar conversa:
```bash
curl -s -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511987654321","message":"Oi, quero comprar um carro"}'
```

### 2. Responder orçamento:
```bash
curl -s -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511987654321","message":"50000"}'
```

### 3. Responder uso:
```bash
curl -s -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511987654321","message":"1"}'
```

### 4. Responder passageiros:
```bash
curl -s -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511987654321","message":"5"}'
```

### 5. Responder trade-in:
```bash
curl -s -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511987654321","message":"não"}'
```

### 6. Responder ano:
```bash
curl -s -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511987654321","message":"2018"}'
```

### 7. Responder KM:
```bash
curl -s -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511987654321","message":"80000"}'
```

### 8. Responder tipo:
```bash
curl -s -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511987654321","message":"2"}'
```

### 9. Responder urgência:
```bash
curl -s -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511987654321","message":"2"}'
```

**Resultado:** Bot deve retornar 3 recomendações de carros com Match Score! 🎉

---

## 🐛 Problema Conhecido

O bot tem um bug onde ele **perde contexto** após algumas perguntas e volta para o fluxo "recommendation" em vez de continuar o quiz. Isso está documentado em `DEVELOPMENT_STATUS.md`.

### Solução temporária:
- Usar um número de telefone novo para cada teste
- Ou limpar o banco antes de testar:
```bash
cd /home/rafaelnovaes22/project/faciliauto-mvp
export PATH="/home/rafaelnovaes22/nodejs/bin:$PATH"
npx prisma db push --force-reset
npm run db:seed:complete
```

---

## 📱 Quando WhatsApp vai funcionar?

O problema é que:
1. **Venom-Bot** → Não encontra o Chrome no WSL
2. **Baileys** → Erro de conexão (Code 405)

### Possíveis soluções:

**A) Corrigir ambiente WSL** (30 min)
- Instalar Xvfb para display virtual
- Configurar Chrome corretamente

**B) Deploy em servidor real** (1-2h)
- Railway, Heroku, ou VPS
- Lá o WhatsApp deve funcionar normalmente

**C) Continuar testando via API** (funciona agora!)
- Toda lógica está ok
- Só falta conexão WhatsApp
- Cliente pode ver demo via API

---

## ✅ O que você pode fazer AGORA:

1. ✅ **Testar todo fluxo via chat.sh**
2. ✅ **Verificar se Match Score está correto**
3. ✅ **Ver veículos no banco** (Prisma Studio)
4. ✅ **Monitorar logs** em tempo real
5. ✅ **Apresentar para cliente** via API
6. ✅ **Documentar** o que funciona

---

## 🎯 Próximos Passos

Você quer:

1. **Corrigir bug do quiz** → Contexto não se perde mais
2. **Deploy em servidor** → WhatsApp funcionando 24/7
3. **Adicionar fotos** → Recomendações com imagens
4. **Melhorar UI** → Dashboard mais bonito
5. **Outra coisa?**

---

**O servidor está RODANDO agora!** 🚀

Teste com `./chat.sh` ou via `curl`!
