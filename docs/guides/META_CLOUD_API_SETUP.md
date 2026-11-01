# Configuração da Meta Cloud API (WhatsApp Business)

Este guia contém o passo a passo completo para disponibilizar, configurar e ativar uma conta do WhatsApp Business (como o número **+55 11 91016-5356**) utilizando a API Oficial da Meta (Cloud API), partindo da criação do app até a configuração no projeto.

## 1. Criação do Aplicativo na Meta for Developers

1. Acesse o painel [Meta for Developers](https://developers.facebook.com/) e faça login.
2. Clique em **Meus Aplicativos** (My Apps) no canto superior direito e depois no botão **Criar Aplicativo**.
3. Selecione o tipo de aplicativo **Outro** e clique em Avançar. Em seguida, escolha **Empresa** (Business).
4. Dê um nome ao aplicativo (ex: `CarInsight WhatsApp`) e adicione um e-mail de contato válido.
5. Em **Conta Empresarial (Business Portfolio)**, selecione a conta da **FaciliAuto**.
6. Clique em **Criar Aplicativo** (pode ser exigida a senha do seu Facebook).

## 2. Adição do Produto WhatsApp

1. Após a criação, você será redirecionado ao painel do aplicativo. Role a página principal até encontrar a lista de "Adicionar produtos ao seu aplicativo".
2. Localize o card do **WhatsApp** e clique em **Configurar**.
3. Se solicitado, confirme a vinculação com a sua Conta Empresarial da Meta.
4. O menu lateral esquerdo será atualizado mostrando a seção **WhatsApp**.

## 3. Adicionando e Verificando o Número de Telefone

Por padrão, a Meta fornece um número de teste. Para adicionar e disponibilizar o seu número real:

1. No menu lateral do aplicativo, expanda **WhatsApp** e clique em **Configuração da API**.
2. Role a página até a seção de adição de telefones e clique no botão **Adicionar número de telefone**.
3. Siga o fluxo de preenchimento do perfil:
   - **Nome de exibição:** (ex: "FaciliAuto" ou "Rafael de Novaes"). *Atenção: este nome passará por uma análise pelas políticas da Meta.*
   - **Categoria e Descrição:** Preencha os dados adequados ao negócio.
4. Insira o número de telefone com DDI e DDD (ex: `+55 11 91016-5356`).
5. Escolha como quer receber o código de verificação: **Mensagem de Texto (SMS)** ou **Ligação Telefônica**. (Certifique-se de que o chip de celular está ativo e tem sinal para receber).
6. Digite o código de 6 dígitos recebido.
7. Após este processo, o status do número deve mudar de **"Pendente"** para **"Conectado"** ou **"Ativo"** no [Gerenciador do WhatsApp](https://business.facebook.com/latest/whatsapp_manager/phone_numbers).

## 4. Geração do Token de Acesso Permanente (Recomendado)

O token mostrado na página "Configuração da API" é temporário e expira em 24h. Para colocar o sistema em produção, crie um token permanente vinculado a um usuário de sistema:

1. Acesse as [Configurações do Negócio da Meta](https://business.facebook.com/settings/).
2. Certifique-se de estar na conta empresarial correspondente (**FaciliAuto**).
3. No menu lateral esquerdo, vá em **Usuários** > **Usuários do sistema**.
4. Clique no botão **Adicionar**. Dê um nome (ex: `Sistema CarInsight`) e selecione a função **Administrador do sistema**. Clique em *Criar usuário do sistema*.
5. Selecione o usuário recém-criado na lista e clique no botão **Adicionar ativos**.
6. No modal, acesse **Tipos de ativos > Aplicativos**, selecione o aplicativo do WhatsApp criado no Passo 1 e habilite o **Controle total (Gerenciar aplicativo)**. Salve as alterações.
7. Ainda no usuário do sistema, clique em **Gerar novo token**.
8. Selecione o seu aplicativo e no campo de vencimento escolha **Nunca** (se disponível, ou gere um de prazo estendido conformando com as novas políticas que podem exigir renovação periódica via API).
9. Nas permissões obrigatórias, role e marque estas duas:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
10. Clique em **Gerar token**.
11. **IMPORTANTE:** Copie o token exibido e guarde em local seguro. Ele não será mostrado novamente.

## 5. Capturando os Códigos Identificadores

Além do token, para enviar requisições pela API precisamos dos IDs.

1. Torne ao portal [Meta for Developers](https://developers.facebook.com/).
2. No seu aplicativo, vá em **WhatsApp** > **Configuração da API**.
3. Na seção "Enviar e receber mensagens", verifique se no campo "De:" está selecionado o seu número verificado.
4. Copie os dados logo abaixo dele:
   - **Identificador do número de telefone (Phone Number ID)**
   - **Identificador da conta do WhatsApp Business (Business Account ID)**

## 6. Configuração de Pagamento (Importante)

Para que o número não tenha os limites rígidos de teste iniciais e possa iniciar conversas formalmente fora da janela de contato de 24h do usuário, você precisa cadastrar um método de cobrança.

1. Dentro de [Configurações do Negócio](https://business.facebook.com/settings/), vá em **Contas** > **Contas do WhatsApp**.
2. Clique na sua conta e vá em **Configurações**.
3. Clique em **Gerenciador do WhatsApp**.
4. No Gerenciador, encontre a aba **Ferramentas da conta** no painel esquerdo e clique em **Cobrança/Pagamentos**.
5. Adicione um Cartão de Crédito válido. Sem isso, as mensagens fora do "limite gratuito" test-tier podem falhar.

## 7. Atualizando as Variáveis de Ambiente no Projeto

Agora que você tem as três informações cruciais para a conta funcionar, abra o arquivo `.env` localizado na raiz do seu projeto `CarInsight` e assegure-se de preencher as variáveis abaixo:

```env
# Exemplo de configuração final
META_WHATSAPP_TOKEN="seu_token_permanente_gerado_no_passo_4"
META_WHATSAPP_PHONE_NUMBER_ID="seu_identificador_de_numero_copiado_no_passo_5"
META_WHATSAPP_BUSINESS_ACCOUNT_ID="seu_business_id_copiado_no_passo_5"
```

Feito isso, a conta está totalmente disponibilizada e integrada à Cloud API da Meta para uso pela aplicação CarInsight.
