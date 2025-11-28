# 🔐 Configurar ADMIN_SECRET no Railway

**Método:** Via Dashboard (mais fácil)  
**Tempo:** 30 segundos

---

## 📋 Passo a Passo Visual

### 1. Acessar Railway Dashboard

Abra no navegador:
```
https://railway.app/
```

### 2. Selecionar Projeto

Clique no projeto: **faciliauto-mvp-v2**

### 3. Abrir Variables

1. No menu lateral esquerdo, procure por **Variables** (ícone de ⚙️ engrenagem)
2. Ou clique na aba **Variables** no topo

### 4. Adicionar Nova Variável

1. Clique em **+ New Variable** ou **Raw Editor**
2. Adicione a linha:
   ```
   ADMIN_SECRET=faciliauto2025
   ```
3. Clique em **Add** ou **Save**

### 5. Deploy Automático

Railway vai automaticamente redeploar o serviço.

Aguarde ~30 segundos até ver:
```
✅ Deployment successful
```

---

## ✅ Verificar se Funcionou

Teste o endpoint health:

```bash
curl -s "https://faciliauto-mvp-v2-production.up.railway.app/admin/health"
```

Deve retornar:
```json
{
  "status": "ok",
  "endpoints": { ... }
}
```

---

## 🚀 Executar Migrações

Agora que o secret está configurado, execute:

### Passo 1: Schema Push

```bash
curl -X POST "https://faciliauto-mvp-v2-production.up.railway.app/admin/schema-push?secret=faciliauto2025"
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Schema applied successfully"
}
```

### Passo 2: Update Uber

```bash
curl -X POST "https://faciliauto-mvp-v2-production.up.railway.app/admin/update-uber?secret=faciliauto2025"
```

**Resposta esperada:**
```json
{
  "success": true,
  "summary": {
    "totalVehicles": 57,
    "uberX": 23,
    "uberBlack": 8,
    "familia": 45,
    "trabalho": 52
  }
}
```

### Passo 3: Verificar Veículos

```bash
curl "https://faciliauto-mvp-v2-production.up.railway.app/admin/vehicles-uber?secret=faciliauto2025&type=x"
```

### Passo 4: Reset Conversas

```bash
curl "https://faciliauto-mvp-v2-production.up.railway.app/debug/reset-full?phoneNumber=5511910165356"
```

---

## 📱 Testar no WhatsApp

Agora teste o fluxo completo:

```
Você: oi
Bot: Olá! Bem-vindo à Robust Car!
     Como posso te chamar?

Você: João
Bot: Prazer, João! 🤝
     Qual é a sua necessidade?
     (mostra opções: Uber, Família, Trabalho, Viagem)

Você: Uber
Bot: Para Uber, temos modelos aptos...
     Qual categoria? (X, Comfort, Black)

Você: Uber X até 60 mil
Bot: Encontrei X carros aptos para Uber X...
     [Lista com critérios]
```

---

## 🔧 Alternativa: Via API do Railway

Se preferir usar a API do Railway diretamente:

```bash
# 1. Obter token em: https://railway.app/account/tokens
RAILWAY_TOKEN="your_token_here"

# 2. Listar projetos
curl -H "Authorization: Bearer $RAILWAY_TOKEN" \
  https://backboard.railway.app/graphql/v2 \
  -d '{"query":"{ me { projects { edges { node { id name } } } } }"}'

# 3. Adicionar variável
curl -H "Authorization: Bearer $RAILWAY_TOKEN" \
  https://backboard.railway.app/graphql/v2 \
  -d '{
    "query": "mutation { variableUpsert(input: { 
      projectId: \"YOUR_PROJECT_ID\",
      environmentId: \"YOUR_ENV_ID\",
      name: \"ADMIN_SECRET\",
      value: \"faciliauto2025\"
    }) { id } }"
  }'
```

Mas o **Dashboard é mais fácil!** 😊

---

## 📊 Screenshot Guide (Referência)

1. **Dashboard inicial:**
   ```
   [Seus Projetos]
   └─ faciliauto-mvp-v2 ← Clicar aqui
   ```

2. **Menu do projeto:**
   ```
   Settings
   Variables ← Clicar aqui
   Deployments
   Metrics
   ```

3. **Tela de Variables:**
   ```
   [Raw Editor]  [+ New Variable]
   
   DATABASE_URL=postgresql://...
   OPENAI_API_KEY=sk-...
   META_WHATSAPP_TOKEN=EAA...
   
   ADMIN_SECRET=faciliauto2025 ← Adicionar esta linha
   
   [Save]
   ```

---

## ✅ Checklist Final

- [ ] Acessou Railway Dashboard
- [ ] Abriu projeto faciliauto-mvp-v2
- [ ] Clicou em Variables
- [ ] Adicionou `ADMIN_SECRET=faciliauto2025`
- [ ] Salvou e aguardou redeploy (30s)
- [ ] Executou schema-push (curl)
- [ ] Executou update-uber (curl)
- [ ] Resetou conversas (curl)
- [ ] Testou no WhatsApp
- [ ] ✅ **Onboarding funcionando!**

---

## 🆘 Troubleshooting

### Não encontro Variables

- Verifique se está no projeto correto
- Procure por ícone de engrenagem ⚙️
- Ou procure aba "Settings" → "Variables"

### Variável não aparece depois de salvar

- Aguarde o redeploy completar (~30s)
- Recarregue a página
- Verifique nos logs: `railway logs`

### Secret ainda não funciona

- Verifique se digitou corretamente: `ADMIN_SECRET` (sem espaços)
- Valor: `faciliauto2025` (sem aspas extras)
- Aguarde deploy: veja indicador de status

---

**Criado:** 2025-11-28  
**Método:** Via Dashboard (recomendado)  
**Secret:** `ADMIN_SECRET=faciliauto2025`  
**Próximo:** Executar migrações via curl 🚀
