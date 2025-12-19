# FaciliAuto - Demo Login Facebook

Este é um ambiente isolado para demonstração do fluxo de login do Facebook para aprovação da Meta.

## Como usar

1.  **Configure o App ID:**
    Abra o arquivo `index.html` e substitua `'YOUR_APP_ID'` pelo ID do seu aplicativo no Painel de Desenvolvedores do Facebook.
    
    ```javascript
    const FACEBOOK_APP_ID = '1234567890'; // Coloque seu ID aqui
    ```

2.  **Execute um servidor local:**
    O Login do Facebook requer que a página seja servida via HTTP/HTTPS (não funciona direto do arquivo `file://`).
    
    Na pasta raiz do projeto, execute:
    
    ```bash
    npx serve meta-auth-demo
    ```

3.  **Acesse no navegador:**
    Abra `http://localhost:3000` (ou a porta indicada pelo comando serve).

4.  **Teste o fluxo:**
    Clique no botão "Continuar com o Facebook", autorize o aplicativo e veja seus dados básicos serem exibidos na tela.
