#!/bin/bash

# 🚀 Script de Teste - Meta WhatsApp API
# Envia mensagem de teste para número registrado

# Credenciais do .env
TOKEN="EAAMIPp5PujgBQEKIE2kVUNQySHUNb76p5ZC1KoDinJeSOh9LsSvjLflWGFfTt2JryzMXR5yWkMyacsUWseXClPJ0t6BVOJ3xiIIZAuoTzqP6QxgG8qq6xnHHuEBnLiB37fUFQYTnZBgJf0UMxEiEYZAyMP8HNIfH6FWFo89xrQnY04fcca5LXPGuVeagmuXYYgZDZD"
PHONE_ID="897098916813396"

# Número que vai RECEBER a mensagem (deve estar cadastrado como test recipient no Meta)
TO_NUMBER="5511949105033"

echo "📱 Enviando mensagem de teste via Meta WhatsApp API..."
echo "📤 Remetente (Meta): 5511910165356"
echo "📥 Destinatário: $TO_NUMBER"
echo ""

# Enviar mensagem
RESPONSE=$(curl -s -X POST "https://graph.facebook.com/v18.0/${PHONE_ID}/messages" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"messaging_product\": \"whatsapp\",
    \"to\": \"${TO_NUMBER}\",
    \"type\": \"text\",
    \"text\": {
      \"body\": \"🤖 Teste FaciliAuto\\n\\nServidor conectado com sucesso!\\n✅ 28 veículos carregados\\n✅ Meta Cloud API funcionando\\n\\nResponda 'oi' para iniciar conversa!\"
    }
  }")

echo "📩 Resposta da API:"
echo "$RESPONSE"
echo ""

# Verificar sucesso
if echo "$RESPONSE" | grep -q '"messages"'; then
  echo "✅ Mensagem enviada com sucesso!"
  echo "📱 Verifique o WhatsApp do número $TO_NUMBER"
else
  echo "❌ Erro ao enviar mensagem"
  echo ""
  echo "⚠️  Verifique se o número $TO_NUMBER está cadastrado como destinatário de teste no Meta:"
  echo "   https://developers.facebook.com/apps → WhatsApp → Primeiros Passos → Gerenciar números"
fi
