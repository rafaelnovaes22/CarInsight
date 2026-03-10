# 🔧 Troubleshooting - Erro ao Registrar Número WhatsApp

## ❌ Erro Encontrado

```
Unsupported post request. Object with ID '797794190095237' does not exist, 
cannot be loaded due to missing permissions, or does not support this operation.
```

**Número tentando registrar:** +55 (11) 91016-5356

---

## 🔍 Causas Possíveis

### 1. **Conta Business Incorreta ou Sem Permissões** ⚠️
O ID `797794190095237` provavelmente é um WhatsApp Business Account ID que:
- Não existe mais
- Você não tem permissão de acesso
- Não está vinculado ao seu App

### 2. **App do Facebook Não Configurado Corretamente**
O App no Meta for Developers pode não estar configurado com as permissões corretas.

### 3. **Número Já Registrado em Outra Conta**
O número pode já estar registrado em outro WhatsApp Business Account.

---

## ✅ Solução Passo a Passo

### 🎯 PASSO 1: Verificar Seu WhatsApp Business Account (5 min)

#### 1.1 Acessar Meta Business Manager
👉 https://business.facebook.com/

#### 1.2 Verificar Conta Business
1. Menu **"Configurações do Negócio"** (ícone de engrenagem)
2. Sidebar: **"Contas → WhatsApp Business"**
3. Você verá uma lista de contas WhatsApp vinculadas

#### 1.3 Identificar o Account ID Correto
1. Clique na conta WhatsApp que você quer usar
2. Na URL, você verá algo como: `business.facebook.com/wa/manage/accounts/?waba_id=123456789`
3. **Copie esse `waba_id`** - esse é o correto!

---

### 🎯 PASSO 2: Criar/Verificar App no Meta for Developers (10 min)

#### 2.1 Acessar Meta for Developers
👉 https://developers.facebook.com/apps/

#### 2.2 Criar NOVO App (Recomendado)
Se você está tendo problemas, é mais fácil começar do zero:

1. **Crie novo App:**
   - Clique em **"Criar App"**
   - Tipo: **"Empresa"**
   - Nome: **"FaciliAuto WhatsApp API"**
   - Email de contato
   - Clique **"Criar App"**

2. **Adicionar Produto WhatsApp:**
   - No dashboard do app, procure **"WhatsApp"**
   - Clique em **"Configurar"**

3. **Vincular WhatsApp Business Account:**
   - Selecione **"Usar uma conta WhatsApp Business existente"**
   - Escolha a conta correta da lista
   - Ou clique em **"Criar uma nova conta WhatsApp Business"**

#### 2.3 Se Usar App Existente
1. Acesse o App existente
2. Vá em **"Configurações do App → Básico"**
3. Role até **"WhatsApp"**
4. Verifique se está vinculado ao Business Account correto

---

### 🎯 PASSO 3: Obter Credenciais Corretas (5 min)

#### 3.1 No App que você acabou de configurar

1. **Sidebar: WhatsApp → API Setup**

2. **Passo A: Obter Phone Number ID**
   - Você verá **"From"** com um dropdown
   - Se não tiver número ainda, clique em **"Add phone number"**
   - Siga o fluxo para adicionar: **+55 11 91016-5356**
   - Depois de adicionar, copie o **Phone Number ID**

3. **Passo B: Obter Token de Acesso**
   - Na mesma página, procure **"Access token"**
   - Clique em **"Generate token"** (permanente)
   - Ou copie o **"Temporary access token"** (24h para teste)
   - **Guarde esse token!**

4. **Passo C: Obter Business Account ID Correto**
   - Ainda em **"API Setup"**
   - Procure **"WhatsApp Business Account ID"**
   - **Copie esse ID** (não use o ID antigo!)

---

### 🎯 PASSO 4: Adicionar Número ao WhatsApp Business (Crucial!)

#### 4.1 Opção A: Adicionar via Meta for Developers

1. No seu App: **WhatsApp → API Setup**
2. Clique em **"Add phone number"**
3. Escolha método de verificação:
   - **SMS** (recomendado)
   - **Chamada de voz**
4. Insira: **+55 11 91016-5356**
5. Digite o código de verificação recebido
6. Aguarde aprovação (pode ser instantânea ou levar alguns minutos)

#### 4.2 Opção B: Adicionar via Business Manager

1. Acesse: https://business.facebook.com/wa/manage/phone-numbers/
2. Clique em **"Adicionar número de telefone"**
3. Siga o wizard de verificação
4. Insira: **+55 11 91016-5356**
5. Verifique via SMS/chamada

---

### 🎯 PASSO 5: Atualizar Variáveis de Ambiente (2 min)

Depois de obter as credenciais CORRETAS, atualize:

```bash
# .env
META_WHATSAPP_TOKEN="EAA...novo_token_aqui"
META_WHATSAPP_PHONE_NUMBER_ID="123456789012345"  # NOVO ID do número
META_WHATSAPP_BUSINESS_ACCOUNT_ID="987654321098"  # NOVO Account ID correto
META_WEBHOOK_VERIFY_TOKEN="faciliauto_webhook_2025"
```

---

### 🎯 PASSO 6: Verificar Permissões do Token (Importante!)

#### 6.1 Testar Token no Graph API Explorer

1. Acesse: https://developers.facebook.com/tools/explorer/
2. Selecione seu App no dropdown
3. Em **"User or Page"**, selecione o App
4. Cole o token gerado
5. Teste com essa query:
   ```
   GET /{PHONE_NUMBER_ID}
   ```
6. Deve retornar dados do número sem erro

#### 6.2 Verificar Permissões Necessárias

O token DEVE ter essas permissões:
- ✅ `whatsapp_business_management`
- ✅ `whatsapp_business_messaging`

Para adicionar permissões:
1. Graph API Explorer → Permissions
2. Busque e marque as permissões acima
3. Clique em **"Generate Access Token"**
4. Autorize quando solicitado

---

### 🎯 PASSO 7: Configurar Nome de Exibição (Se Ainda Não Foi)

1. **WhatsApp → Getting Started**
2. Procure **"Display name"**
3. Clique em **"Edit"**
4. Insira o nome desejado (ex: "FaciliAuto")
5. Envie para revisão
6. Aguarde aprovação (1-3 dias úteis)

---

## 🧪 PASSO 8: Testar Nova Configuração

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2

# Atualizar .env com novas credenciais

# Testar envio
npm run test:new-number 5511910165356
```

Se funcionar, você verá:
```
✅ Mensagem enviada com sucesso!
```

---

## 📊 Verificação Final - Checklist

Antes de considerar resolvido:

- [ ] Tenho um WhatsApp Business Account ativo
- [ ] App no Meta for Developers está vinculado a esse Account
- [ ] Número +55 11 91016-5356 está adicionado e verificado
- [ ] Token de acesso foi gerado com permissões corretas
- [ ] Phone Number ID está correto (copiado do Meta Dashboard)
- [ ] Business Account ID está correto (não é o ID antigo)
- [ ] Todas as variáveis no .env estão atualizadas
- [ ] Teste de envio funcionou sem erros

---

## 🔍 Como Identificar o Problema Específico

### Se o erro mencionar "does not exist":
→ O ID está errado. Copie novamente do Meta Dashboard.

### Se o erro mencionar "missing permissions":
→ Token não tem permissões. Regenere com as permissões corretas.

### Se o erro mencionar "does not support this operation":
→ Você está tentando usar um endpoint que o Account não suporta. Verifique se está usando WhatsApp **Cloud API** (não On-Premise).

---

## 📞 Suporte Adicional

Se após todos os passos ainda tiver problema:

1. **Logs Detalhados do Erro:**
   ```bash
   npm run test:new-number 5511910165356 2>&1 | tee error.log
   ```

2. **Verificar Status da API:**
   👉 https://developers.facebook.com/status/

3. **Suporte Meta:**
   👉 https://business.facebook.com/business/help

4. **Documentação Oficial:**
   👉 https://developers.facebook.com/docs/whatsapp/cloud-api/get-started

---

## 💡 Dica Pro

**Comece do Zero (Método Mais Confiável):**
1. Crie NOVO App no Meta for Developers
2. Crie NOVA WhatsApp Business Account
3. Adicione o número nessa nova conta
4. Use as credenciais geradas
5. Isso evita conflitos de permissões antigas

---

**Data:** 2025-01-18  
**Versão:** 1.0  
**Status:** Aguardando feedback após aplicação das soluções
