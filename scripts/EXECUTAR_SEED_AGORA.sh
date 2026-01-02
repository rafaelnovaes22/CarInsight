#!/bin/bash
# Execute este script para popular o banco com veículos Robust Car

cd /home/rafaelnovaes22/CarInsight

echo "🚀 Populando banco com 70 veículos Robust Car..."
npm run db:seed:robustcar

echo ""
echo "🔄 Gerando embeddings OpenAI..."
npm run embeddings:generate

echo ""
echo "✅ Concluído! Verifique com: npm run db:studio"
