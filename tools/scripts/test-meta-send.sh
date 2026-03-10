#!/bin/bash

set -euo pipefail

# Script de teste da Meta WhatsApp API.
# Requer:
# - META_WHATSAPP_TOKEN
# - META_WHATSAPP_PHONE_NUMBER_ID
# - META_TEST_RECIPIENT

: "${META_WHATSAPP_TOKEN:?META_WHATSAPP_TOKEN nao definido}"
: "${META_WHATSAPP_PHONE_NUMBER_ID:?META_WHATSAPP_PHONE_NUMBER_ID nao definido}"
: "${META_TEST_RECIPIENT:?META_TEST_RECIPIENT nao definido}"

echo "Enviando mensagem de teste via Meta WhatsApp API..."
echo "Destinatario: ${META_TEST_RECIPIENT}"
echo ""

response=$(curl -s -X POST "https://graph.facebook.com/v18.0/${META_WHATSAPP_PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer ${META_WHATSAPP_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"messaging_product\": \"whatsapp\",
    \"to\": \"${META_TEST_RECIPIENT}\",
    \"type\": \"text\",
    \"text\": {
      \"body\": \"Teste FaciliAuto\\n\\nServidor conectado com sucesso.\\nMeta Cloud API funcionando.\\n\\nResponda 'oi' para iniciar conversa.\"
    }
  }")

echo "Resposta da API:"
echo "${response}"
echo ""

if echo "${response}" | grep -q '"messages"'; then
  echo "Mensagem enviada com sucesso."
  echo "Verifique o WhatsApp do numero ${META_TEST_RECIPIENT}"
else
  echo "Erro ao enviar mensagem."
  echo "Verifique se ${META_TEST_RECIPIENT} esta cadastrado como destinatario de teste no Meta."
fi
