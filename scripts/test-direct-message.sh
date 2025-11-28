#!/bin/bash
curl -X POST "https://graph.facebook.com/v18.0/897098916813396/messages" \
  -H "Authorization: Bearer EAAMIPp5PujgBQEKIE2kVUNQySHUNb76p5ZC1KoDinJeSOh9LsSvjLflWGFfTt2JryzMXR5yWkMyacsUWseXClPJ0t6BVOJ3xiIIZAuoTzqP6QxgG8qq6xnHHuEBnLiB37fUFQYTnZBgJf0UMxEiEYZAyMP8HNIfH6FWFo89xrQnY04fcca5LXPGuVeagmuXYYgZDZD" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "5511949105033",
    "type": "text",
    "text": {
      "body": "🤖 Teste direto da API\n\nSe você está vendo essa mensagem, a integração está funcionando!\n\nResponda com qualquer coisa para continuar."
    }
  }'
