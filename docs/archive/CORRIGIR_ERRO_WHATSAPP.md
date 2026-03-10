# 🚨 SOLUÇÃO RÁPIDA - Erro ao Registrar Número WhatsApp

## ❌ Erro
```
Object with ID '797794190095237' does not exist, cannot be loaded due to missing permissions
```

---

## ⚡ Solução Rápida (10 minutos)

### 1️⃣ Identificar o WhatsApp Business Account CORRETO

**Acesse:** https://business.facebook.com/wa/manage/home/

Você verá suas contas WhatsApp. Clique na que quer usar.

**Na URL, copie o número após `waba_id=`**

Exemplo: `business.facebook.com/wa/manage/home/?waba_id=123456789`
→ Seu WABA ID correto é: **123456789**

---

### 2️⃣ Criar NOVO App (Recomendado - Evita Conflitos)

**Acesse:** https://developers.facebook.com/apps/

1. **Criar App** → Tipo: **"Empresa"**
2. Nome: **"FaciliAuto WhatsApp"**
3. Criar
4. Adicionar produto: **"WhatsApp"** → Configurar
5. Escolher: **"Usar uma conta existente"** ou **"Criar nova"**
6. Autorizar permissões quando solicitado

---

### 3️⃣ Adicionar o Número +55 11 91016-5356

No seu App recém-criado:

1. **WhatsApp → API Setup**
2. Seção **"From"** → **"Add phone number"**
3. Inserir: **+55 11 91016-5356**
4. Escolher verificação: **SMS**
5. Digitar código recebido
6. Aguardar aprovação (geralmente instantâneo)

---

### 4️⃣ Copiar Credenciais CORRETAS

Ainda em **WhatsApp → API Setup**:

**a) Phone Number ID:**
- Dropdown "From" → Selecione o número
- Copie o ID grande embaixo (ex: `897098916813396`)

**b) Access Token:**
- Clique em **"Generate access token"** (token permanente)
- Ou copie **"Temporary access token"** (teste 24h)
- **GUARDE ESSE TOKEN!**

**c) Business Account ID:**
- Procure **"WhatsApp Business Account ID"** na página
- Copie (ex: `2253418711831684`)

---

### 5️⃣ Atualizar .env

```bash
META_WHATSAPP_TOKEN="EAA...seu_token_NOVO_aqui"
META_WHATSAPP_PHONE_NUMBER_ID="897098...seu_phone_id_NOVO"
META_WHATSAPP_BUSINESS_ACCOUNT_ID="2253418...seu_waba_id_NOVO"
META_WEBHOOK_VERIFY_TOKEN="faciliauto_webhook_2025"
```

---

### 6️⃣ Testar

```bash
npm run test:new-number 5511910165356
```

Deve mostrar: **✅ Mensagem enviada com sucesso!**

---

## 🔍 Por Que o Erro Aconteceu?

O ID `797794190095237` provavelmente era de:
- Uma conta antiga que você não tem mais acesso
- Um Business Account deletado
- Configuração de um app antigo sem permissões

**Solução:** Criar novo app com novas credenciais = caminho limpo e sem conflitos.

---

## 📞 Ainda Com Erro?

### Se erro persistir:

1. **Verifique se o número já está registrado em outro lugar:**
   - WhatsApp Business App (celular)
   - Outro WhatsApp Business Account
   - Outra API da Meta

2. **Remova o número de outros lugares primeiro:**
   - WhatsApp Business App: Configurações → Conta → Excluir conta
   - Outro Account: Business Manager → Remover número

3. **Token sem permissões:**
   - Graph API Explorer: https://developers.facebook.com/tools/explorer/
   - Adicione permissões: `whatsapp_business_management`, `whatsapp_business_messaging`
   - Generate Access Token novamente

---

## 📚 Documentação Completa

Para detalhes: `docs/TROUBLESHOOTING_NUMERO_WHATSAPP.md`

---

**Dica Final:** Começar do zero (novo app + novo account) é geralmente mais rápido que debugar permissões antigas! 🚀
