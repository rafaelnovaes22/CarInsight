#!/bin/bash

set -euo pipefail

: "${META_WHATSAPP_TOKEN:?META_WHATSAPP_TOKEN nao definido}"
: "${META_WHATSAPP_PHONE_NUMBER_ID:?META_WHATSAPP_PHONE_NUMBER_ID nao definido}"
: "${META_TEST_RECIPIENT:?META_TEST_RECIPIENT nao definido}"

curl -X POST "https://graph.facebook.com/v18.0/${META_WHATSAPP_PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer ${META_WHATSAPP_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"messaging_product\": \"whatsapp\",
    \"to\": \"${META_TEST_RECIPIENT}\",
    \"type\": \"text\",
    \"text\": {
      \"body\": \"Teste direto da API\\n\\nSe voce esta vendo essa mensagem, a integracao esta funcionando.\\n\\nResponda com qualquer coisa para continuar.\"
    }
  }"
