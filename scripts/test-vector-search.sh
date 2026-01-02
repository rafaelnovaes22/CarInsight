#!/bin/bash

echo "🧪 Testando busca vetorial do FaciliAuto"
echo "=========================================="
echo ""

PHONE="5511999887766"
API_URL="http://localhost:3000/message"

send_message() {
  local msg="$1"
  echo "📤 Enviando: $msg"
  curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$PHONE\",\"message\":\"$msg\"}" | jq -r '.reply' | head -20
  echo ""
  echo "---"
  echo ""
  sleep 2
}

echo "1️⃣ Iniciando conversa..."
send_message "Olá"

echo "2️⃣ Pergunta 1: Orçamento"
send_message "50000"

echo "3️⃣ Pergunta 2: Uso"
send_message "cidade"

echo "4️⃣ Pergunta 3: Pessoas"
send_message "4"

echo "5️⃣ Pergunta 4: Tipo"
send_message "sedan"

echo "6️⃣ Pergunta 5: Ano mínimo"
send_message "2015"

echo "7️⃣ Pergunta 6: KM máxima"
send_message "80000"

echo "8️⃣ Pergunta 7: Marca preferida"
send_message "volkswagen"

echo "9️⃣ Pergunta 8: Tem carro para trocar"
send_message "nao"

echo ""
echo "✅ Teste completo!"
echo ""
echo "📊 Para ver os logs detalhados:"
echo "tail -f /home/rafaelnovaes22/project/CarInsight/api-vector.log"
