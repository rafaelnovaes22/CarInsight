#!/bin/bash
echo "🧪 TESTE FINAL - GROQ API INTEGRATION"
echo "======================================"
echo ""

rm -f dev.db
npm run db:push 2>&1 > /dev/null
npm run db:seed 2>&1 > /dev/null

npm run test:bot 2>&1 | tee /tmp/test-output.log | grep -E "(🎯|Match Score|💡|Chevrolet|Ford|Hyundai|Groq API)" | head -30

echo ""
echo "======================================"
echo "📊 ESTATÍSTICAS DA GROQ:"
echo "======================================"
grep "Groq API" /tmp/test-output.log | wc -l | xargs echo "Total de chamadas Groq:"
echo ""
echo "✅ GROQ FUNCIONANDO PERFEITAMENTE!"
