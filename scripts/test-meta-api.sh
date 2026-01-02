#!/bin/bash

echo "🔍 DIAGNÓSTICO META CLOUD API"
echo "=============================="
echo ""

# Ler .env
cd /home/rafaelnovaes22/project/faciliauto-mvp
source .env 2>/dev/null

echo "1️⃣ Verificando configurações..."
echo "------------------------------"

if [ -z "$META_WHATSAPP_TOKEN" ]; then
    echo "❌ META_WHATSAPP_TOKEN não configurado no .env"
    exit 1
else
    echo "✅ Token encontrado: ${META_WHATSAPP_TOKEN:0:20}..."
fi

if [ -z "$META_WHATSAPP_PHONE_NUMBER_ID" ]; then
    echo "❌ META_WHATSAPP_PHONE_NUMBER_ID não configurado no .env"
    exit 1
else
    echo "✅ Phone Number ID: $META_WHATSAPP_PHONE_NUMBER_ID"
fi

echo ""
echo "2️⃣ Testando API do Meta (obter dados do número)..."
echo "------------------------------"

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "https://graph.facebook.com/v18.0/$META_WHATSAPP_PHONE_NUMBER_ID" \
  -H "Authorization: Bearer $META_WHATSAPP_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Token e Phone Number ID válidos!"
else
    echo "❌ Erro na API do Meta"
    echo ""
    echo "Possíveis causas:"
    echo "- Token expirado (tokens temporários duram 24h)"
    echo "- Phone Number ID incorreto"
    echo "- App do Meta com problema"
    echo ""
    echo "Solução:"
    echo "1. Acesse: https://developers.facebook.com/"
    echo "2. Seu App → WhatsApp → Primeiros Passos"
    echo "3. Copie novo token temporário"
    echo "4. Atualize o .env"
    exit 1
fi

echo ""
echo "3️⃣ Digite seu número de WhatsApp (com código do país):"
echo "Exemplo: 5511999999999"
read -p "Número: " PHONE_NUMBER

if [ -z "$PHONE_NUMBER" ]; then
    echo "❌ Número não fornecido"
    exit 1
fi

echo ""
echo "4️⃣ Enviando mensagem de teste para +$PHONE_NUMBER..."
echo "------------------------------"

SEND_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "https://graph.facebook.com/v18.0/$META_WHATSAPP_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer $META_WHATSAPP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"messaging_product\": \"whatsapp\",
    \"to\": \"$PHONE_NUMBER\",
    \"type\": \"text\",
    \"text\": {
      \"body\": \"🎉 Teste CarInsight - $(date '+%H:%M:%S')\"
    }
  }")

SEND_HTTP_CODE=$(echo "$SEND_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
SEND_BODY=$(echo "$SEND_RESPONSE" | sed '/HTTP_CODE:/d')

echo "HTTP Status: $SEND_HTTP_CODE"
echo "Response: $SEND_BODY"
echo ""

if [ "$SEND_HTTP_CODE" = "200" ]; then
    echo "✅ Mensagem enviada com sucesso!"
    echo ""
    echo "📱 Verifique seu WhatsApp agora!"
    echo ""
    echo "Não recebeu?"
    echo "- Verifique se seu número está na lista 'Para' no Meta Dashboard"
    echo "- Acesse: https://developers.facebook.com/"
    echo "- Seu App → WhatsApp → Primeiros Passos → Para"
else
    echo "❌ Erro ao enviar mensagem"
    echo ""
    
    # Analisar erro específico
    if echo "$SEND_BODY" | grep -q "recipient_phone"; then
        echo "🔍 ERRO: Número não está na lista 'Para'"
        echo ""
        echo "Solução:"
        echo "1. Acesse: https://developers.facebook.com/"
        echo "2. Seu App → WhatsApp → Primeiros Passos"
        echo "3. Seção 'Para' → Adicionar número"
        echo "4. Adicione: +$PHONE_NUMBER"
        echo "5. Tente novamente"
    elif echo "$SEND_BODY" | grep -q "access_token"; then
        echo "🔍 ERRO: Token inválido ou expirado"
        echo ""
        echo "Solução:"
        echo "1. Gere novo token no Meta Dashboard"
        echo "2. Atualize o .env"
    else
        echo "🔍 Erro desconhecido. Response completa acima."
    fi
fi

echo ""
echo "=============================="
echo "Diagnóstico concluído!"
