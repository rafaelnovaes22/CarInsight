# 📱 Como Iniciar o Bot no WhatsApp

## ✅ PRÉ-REQUISITOS

Antes de iniciar, certifique-se que:
- [x] Database populado (30 veículos)
- [x] Dependências instaladas
- [x] Node.js funcionando

---

## 🚀 PASSO A PASSO

### 1. Abra um terminal e execute:

```bash
cd /home/rafaelnovaes22/project/faciliauto-mvp
PATH=~/nodejs/bin:$PATH npm run dev
```

### 2. O servidor vai iniciar e mostrar:

```
✅ Database connected
🚀 Server running on port 3000
📊 Stats available at http://localhost:3000/stats
🔄 Initializing WhatsApp...
```

### 3. Em alguns segundos aparecerá um QR CODE no terminal:

```
📱 Scan QR Code:
███████████████████████████
███████████████████████████
███ [QR CODE AQUI]     ███
███████████████████████████
███████████████████████████
```

### 4. No seu celular:

1. Abra o **WhatsApp**
2. Toque nos **3 pontinhos** (menu) → **Aparelhos conectados**
3. Toque em **Conectar aparelho**
4. **Escaneie o QR Code** que apareceu no terminal

### 5. Quando conectar com sucesso, verá:

```
✅ WhatsApp connected successfully!
```

---

## 💬 TESTANDO O BOT

### Do SEU celular ou de outro número:

Envie mensagens para o WhatsApp que você conectou:

**Teste 1: Saudação**
```
Olá, quero comprar um carro
```

**Resposta esperada:**
```
Perfeito! Vou fazer algumas perguntas rápidas 
para encontrar o carro ideal para você. 🎯

São apenas 8 perguntas e leva menos de 2 minutos!

💰 Qual seu orçamento disponível para o carro?

_Exemplo: 50000 ou 50 mil_
```

**Teste 2: Complete o Quiz**
```
Você: 50000
Bot: ✅ Anotado! [próxima pergunta]

Você: 1 (cidade)
Bot: ✅ Anotado! [próxima pergunta]

Você: 5 (pessoas)
Bot: ✅ Anotado! [próxima pergunta]

Você: não (trade-in)
Bot: ✅ Anotado! [próxima pergunta]

Você: 2018 (ano mínimo)
Bot: ✅ Anotado! [próxima pergunta]

Você: 80000 (km máxima)
Bot: ✅ Anotado! [próxima pergunta]

Você: 2 (sedan)
Bot: ✅ Anotado! [próxima pergunta]

Você: 2 (até 1 mês)
Bot: 🎯 Encontrei 3 veículos perfeitos para você!
[Lista com 3 carros + Match Score]
```

**Teste 3: Agendar Visita**
```
Você: agendar
Bot: Ótimo! 🎉 Vou transferir você para nossa 
equipe de vendas para agendar sua visita.
```

---

## 🐛 PROBLEMAS COMUNS

### QR Code não aparece
- Aguarde 10-15 segundos
- Verifique se não há erro no terminal
- Tente reiniciar: Ctrl+C e rode novamente

### "Connection closed"
- Normal, o WhatsApp desconectou
- O bot vai tentar reconectar automaticamente
- Aguarde ou reinicie

### Bot não responde
- Verifique os logs no terminal
- Pode estar em modo MOCK (sem OpenAI)
- Verifique se a mensagem foi enviada

### Erro "OPENAI_API_KEY"
- Normal! Está em modo mock
- Bot funciona, mas respostas são mais simples
- Para melhorar, adicione chave real depois

---

## 📊 MONITORAMENTO

### Ver estatísticas em tempo real:

Abra no navegador:
```
http://localhost:3000/
```

Ou via API:
```bash
curl http://localhost:3000/stats
```

### Ver logs detalhados:

Todos os logs aparecem no terminal onde você rodou `npm run dev`

### Ver banco de dados:

Em outro terminal:
```bash
cd /home/rafaelnovaes22/project/faciliauto-mvp
PATH=~/nodejs/bin:$PATH npx prisma studio
```

Abre em: http://localhost:5555

---

## 🛑 PARA PARAR O BOT

No terminal onde está rodando, pressione:
```
Ctrl + C
```

---

## ✅ CHECKLIST DE SUCESSO

- [ ] QR Code apareceu no terminal
- [ ] Consegui escanear com o celular
- [ ] Apareceu "WhatsApp connected"
- [ ] Enviei mensagem de teste
- [ ] Bot respondeu com saudação
- [ ] Completei o quiz (8 perguntas)
- [ ] Recebi 3 recomendações com Match Score
- [ ] Testei comando "agendar"

Se todos os itens estão ✅, o bot está **100% funcionando!**

---

## 🎯 PRÓXIMO PASSO

Depois de testar e validar que funciona, você pode:

1. **Adicionar chave OpenAI real** → Respostas mais inteligentes
2. **Adicionar fotos nos carros** → Mais visual
3. **Deploy em servidor** → Funcionar 24/7
4. **Apresentar para o cliente** → Fechar negócio! 💰

---

Qualquer dúvida, me chame!
