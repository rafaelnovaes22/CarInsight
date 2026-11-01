#!/bin/bash

# Interactive WhatsApp Bot Chat Simulator
# Usage: ./chat.sh

API_URL="http://localhost:3000/message"
PHONE="5511987654321"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 FaciliAuto Bot - Chat Simulator"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Digite suas mensagens e pressione ENTER"
echo "Digite 'sair' para encerrar"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Função para enviar mensagem
send_message() {
    local message="$1"
    
    # Envia mensagem para API
    response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"phone\":\"$PHONE\",\"message\":\"$message\"}")
    
    # Extrai resposta do bot
    bot_response=$(echo "$response" | grep -o '"botResponse":"[^"]*"' | sed 's/"botResponse":"//;s/"$//' | sed 's/\\n/\n/g')
    
    # Mostra resposta
    echo ""
    echo "🤖 Bot:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$bot_response"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# Loop de conversação
while true; do
    # Lê mensagem do usuário
    echo -n "👤 Você: "
    read -r user_message
    
    # Verifica se quer sair
    if [ "$user_message" = "sair" ] || [ "$user_message" = "exit" ] || [ "$user_message" = "quit" ]; then
        echo ""
        echo "👋 Até logo!"
        echo ""
        exit 0
    fi
    
    # Envia mensagem se não for vazia
    if [ -n "$user_message" ]; then
        send_message "$user_message"
    fi
done
