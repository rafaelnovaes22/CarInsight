#!/bin/bash
# Script para fazer push das mudanças

echo "🚀 Fazendo push para GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Push realizado com sucesso!"
else
    echo "❌ Erro ao fazer push. Execute manualmente:"
    echo "   cd /home/rafaelnovaes22/faciliauto-mvp-v2"
    echo "   git push origin main"
fi
