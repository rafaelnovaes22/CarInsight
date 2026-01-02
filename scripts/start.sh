#!/bin/bash

# Script para iniciar o bot WhatsApp CarInsight
# Uso: ./start.sh

echo "🚀 Iniciando CarInsight WhatsApp Bot..."
echo ""
echo "📋 Verificando requisitos..."

# Check database
if [ -f "prisma/dev.db" ]; then
    echo "✅ Database encontrado"
else
    echo "❌ Database não encontrado!"
    echo "Execute: npm run db:seed:complete"
    exit 1
fi

# Check node_modules
if [ -d "node_modules" ]; then
    echo "✅ Dependências instaladas"
else
    echo "❌ Dependências não instaladas!"
    echo "Execute: npm install"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 INSTRUÇÕES:"
echo ""
echo "1. Aguarde o QR CODE aparecer no terminal"
echo "2. Abra WhatsApp no celular"
echo "3. Vá em: Menu → Aparelhos conectados"
echo "4. Toque em: Conectar aparelho"
echo "5. Escaneie o QR CODE"
echo ""
echo "Para parar: Ctrl + C"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Iniciando servidor..."
echo ""

# Start server
export PATH=$HOME/nodejs/bin:$PATH
npm run dev
