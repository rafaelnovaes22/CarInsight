# Configuração da Meta Cloud API (WhatsApp Business)

Para utilizar o número de telefone **+55 11 91016-5356** no projeto, precisamos de duas informações essenciais que não estão visíveis apenas com o número:

1. **Identificador do número de telefone (Phone Number ID)**
2. **Token de acesso (Access Token)**

## Como obter essas informações

1. Acesse o painel onde você tirou o print: [Gerenciador do WhatsApp](https://business.facebook.com/latest/whatsapp_manager/phone_numbers)
2. Verifique se você está na conta empresarial correta (**FaciliAuto**).
3. Na lista de telefones, ao lado do número **+55 11 91016-5356**, procure por um ícone de **Configurações** (engrenagem) ou clique no próprio número se for um link.
4. Se não encontrar ali, vá para **Ferramentas de Desenvolvimento** ou **Configuração da API** no menu lateral.
5. Lá você encontrará:
   - **Identificador do número de telefone**: Uma sequência numérica (ex: `105956789012345`).
   - **Token de acesso temporário** ou instruções para gerar um **Token permanente** (recomendado).

## Atualizando o projeto

Abra o arquivo `.env` na raiz do projeto e preencha os campos:

```env
META_WHATSAPP_TOKEN="seu_token_aqui"
META_WHATSAPP_PHONE_NUMBER_ID="seu_identificador_aqui"
META_WHATSAPP_BUSINESS_ACCOUNT_ID="seu_business_id_aqui"
```

> **Nota**: O `Business Account ID` (Identificador da conta empresarial) também é útil e geralmente fica na mesma página.

## Status "Pendente"

Notei que o status do número no seu print está como **"Pendente"**. Isso geralmente significa que:
- A verificação da conta ainda não foi concluída.
- O nome de exibição ("Rafael de Novaes") ainda está em análise.
- Ou é necessário confirmar o número via SMS/Ligação.

Certifique-se de que o status mude para **"Conectado"** ou **"Ativo"** para que o envio de mensagens funcione corretamente.
