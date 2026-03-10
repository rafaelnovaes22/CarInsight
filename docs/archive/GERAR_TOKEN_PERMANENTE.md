# 🔑 Como Gerar Token Permanente - Meta Cloud API

## ⚠️ Problema
Token temporário expira em 24 horas, causando erro 401.

## ✅ Solução: Token Permanente (System User)

### Passo 1: Criar System User (5 min)

1. Acesse: https://business.facebook.com/settings/system-users
2. Clique em **"Adicionar"**
3. Nome: `FaciliAuto Bot System User`
4. Função: **Admin**
5. Clique em **"Criar usuário do sistema"**

### Passo 2: Adicionar Permissões WhatsApp (2 min)

1. Clique no System User criado
2. Clique em **"Adicionar ativos"**
3. Selecione **"Apps"**
4. Encontre seu app **"FaciliAuto WhatsApp Bot"**
5. Marque:
   - ✅ **Gerenciar app** (Full control)
6. Clique em **"Salvar alterações"**

### Passo 3: Adicionar Conta WhatsApp Business (2 min)

1. Ainda no System User, clique em **"Adicionar ativos"** novamente
2. Selecione **"Contas do WhatsApp Business"**
3. Encontre sua conta WhatsApp Business
4. Marque:
   - ✅ **Gerenciar contas do WhatsApp Business** (Full control)
5. Clique em **"Salvar alterações"**

### Passo 4: Gerar Token Permanente (3 min)

1. Ainda no System User, clique em **"Gerar novo token"**
2. Selecione seu app: **"FaciliAuto WhatsApp Bot"**
3. Marque as permissões:
   - ✅ `whatsapp_business_management`
   - ✅ `whatsapp_business_messaging`
   - ✅ `business_management`
4. Clique em **"Gerar token"**
5. **COPIE O TOKEN** (você só verá uma vez!)
6. Guarde em local seguro (1Password, Bitwarden, etc)

### Passo 5: Atualizar Variáveis de Ambiente (1 min)

**Local (.env):**
```bash
META_WHATSAPP_TOKEN="SEU_TOKEN_PERMANENTE_AQUI"
```

**Railway/Render:**
1. Acesse seu projeto no Railway
2. Vá em **Variables**
3. Edite `META_WHATSAPP_TOKEN`
4. Cole o novo token
5. Clique em **Save**
6. O serviço vai reiniciar automaticamente

### Passo 6: Testar (2 min)

```bash
# Testar com curl
curl -X GET "https://graph.facebook.com/v18.0/SEU_PHONE_NUMBER_ID" \
  -H "Authorization: Bearer SEU_TOKEN_PERMANENTE"

# Deve retornar:
{
  "verified_name": "FaciliAuto",
  "display_phone_number": "+55 11 9XXXX-XXXX",
  "id": "897098916813396",
  ...
}
```

## 🎯 Vantagens do Token Permanente

✅ **Nunca expira** (a menos que você revogue)  
✅ **Mais seguro** (vinculado ao System User, não ao usuário pessoal)  
✅ **Produção-ready** (não precisa renovar manualmente)  
✅ **Melhor controle** (pode revogar a qualquer momento)

## 🔒 Segurança

⚠️ **NUNCA commite o token no Git**
⚠️ **Use variáveis de ambiente**
⚠️ **Guarde em gerenciador de senhas**
⚠️ **Rotacione se comprometido**

## 📚 Referências

- [Meta - System Users](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/system-users)
- [WhatsApp Cloud API - Authentication](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#1--acquire-an-access-token-using-a-system-user-or-facebook-login)

## ❓ Troubleshooting

**Erro 190 - Token inválido:**
- Token copiado errado (espaços extras)
- Token revogado
- Permissões insuficientes

**Erro 400 - Bad Request:**
- Phone Number ID incorreto
- Formato de mensagem inválido

**Erro 429 - Rate Limit:**
- Muitas requisições por minuto
- Aguarde 1 minuto e tente novamente
