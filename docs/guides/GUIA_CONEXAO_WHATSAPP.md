# 📱 Guia de Conexão WhatsApp (Evolution API)

Este guia explica como conectar o número do cliente ao Evolution API usando o método de **Código de Pareamento** (Pairing Code), que é mais fácil para atendimentos remotos do que o QR Code.

## 👨‍💻 Para o Desenvolvedor (Você)

O código de pareamento expira rápido. Combine com o cliente para que ele esteja com o celular na mão.

1. Abra o terminal no projeto.
2. Execute o script de configuração:
   ```bash
   npx ts-node scripts/setup-evolution.ts
   ```
3. Escolha a **Opção 2** (Pairing Code).
4. Digite o número do cliente (com DDD, ex: `5511999999999`).
5. Copie o código gerado (ex: `ABC1-23XZ`).
6. Envie imediatamente para o cliente.

---

## 👤 Para o Cliente (Texto para Copiar e Enviar)

Você pode enviar a mensagem abaixo para guiar o cliente passo a passo:

---

**Olá! Para ativarmos o assistente inteligente no seu número, precisamos fazer uma conexão rápida pelo próprio WhatsApp. É o mesmo processo de conectar no computador.**

Siga estes passos:

1. Abra o **WhatsApp** no seu celular (pode ser o Business ou normal).
2. Acesse o menu de **Configurações**:
   - **Android:** Toque nos três pontinhos (`⋮`) no canto superior direito.
   - **iPhone:** Toque em "Configurações" no canto inferior direito.
3. Toque em **Aparelhos Conectados**.
4. Toque no botão **Conectar um aparelho**.
5. **⚠️ Importante:** Vai abrir a câmera. **NÃO precisa escanear nada**.
6. Olhe na parte de baixo da tela e toque na opção: **"Conectar com número de telefone"**.
7. Vai aparecer um espaço para digitar um código. **Me avise quando chegar nessa tela.**

Assim que você estiver pronto, eu gero o código aqui e te envio. Ele vale por poucos segundos, então precisamos fazer juntos, ok?

---
