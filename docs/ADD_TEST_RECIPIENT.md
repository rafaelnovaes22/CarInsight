# 📱 Como Adicionar Número de Teste no Meta Cloud API

> **Tempo estimado**: 5 minutos

## Passo 1: Acesse o App

1. Vá para: https://developers.facebook.com/apps
2. Faça login se necessário
3. Clique no seu app: **FaciliAuto Bot**

---

## Passo 2: Via até WhatsApp API Setup

1. No menu lateral esquerdo, clique em  **"WhatsApp"**  
2. Vá para a aba  **"API Setup"**  

---

## Passo 3: Adicione seu Número

1. Na seção  **"Test phone numbers"**  , clique em **"    ➕  Add phone number"**  
2. **Digite seu número**: `5511949105033`
3. Clique em  **"Send confirmation code"**  

---

## Passo 4: Confirme via SMS

1. Espere o SMS chegar no seu celular
2. Digite o código de 6 dígitos no campo
3. Clique em  **"Verify"**  

---

## Passo 5: Teste

Volte para o terminal e execute:

```bash
cd C:\Users\Rafael\faciliauto-mvp
npx tsx src/test-meta.ts 5511949105033
```

**Deve receber a mensagem no WhatsApp em até 10 segundos!**

---

## 🛠️ Problemas Comuns

### **Não recebeu o SMS?**
- Espere 2-3 minutos
- Verifique se o número está correto
- Clique em "Resend confirmation code"

### **Erro ao enviar?**
- Verifique se o número foi adicionado corretamente na lista
- O número deve aparecer em "Test phone numbers"

### **Quer testar com outro número?**
Repetir os passos 3-4 para cada número desejado.

---

**✅ Assim que adicionar e confirmar, me avise que testamos novamente!**