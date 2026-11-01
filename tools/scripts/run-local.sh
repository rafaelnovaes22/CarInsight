#!/bin/bash

# Script para rodar comandos locais com Node.js correto
# Uso: ./run-local.sh [comando]

PROJECT_DIR="/home/rafaelnovaes22/faciliauto-mvp-v2"
NODE_BIN="/home/rafaelnovaes22/nodejs/bin/node"
TSX_BIN="$PROJECT_DIR/node_modules/.bin/tsx"

cd "$PROJECT_DIR"

case "$1" in
  dev)
    echo "🚀 Iniciando servidor de desenvolvimento..."
    "$NODE_BIN" "$TSX_BIN" src/index.ts
    ;;
  reset)
    echo "🗑️ Resetando conversa..."
    "$NODE_BIN" "$TSX_BIN" scripts/reset-conversations.ts "${2:-5511910165356}"
    ;;
  reset-all)
    echo "🗑️ Resetando TODAS as conversas..."
    "$NODE_BIN" "$TSX_BIN" scripts/reset-conversations.ts --all
    ;;
  prisma-studio)
    echo "🎨 Abrindo Prisma Studio..."
    "$NODE_BIN" node_modules/.bin/prisma studio
    ;;
  test)
    echo "🧪 Rodando testes..."
    "$NODE_BIN" node_modules/.bin/vitest
    ;;
  *)
    echo "Uso: ./run-local.sh [comando]"
    echo ""
    echo "Comandos disponíveis:"
    echo "  dev           - Iniciar servidor de desenvolvimento"
    echo "  reset [phone] - Resetar conversa específica (padrão: 5511910165356)"
    echo "  reset-all     - Resetar todas as conversas"
    echo "  prisma-studio - Abrir Prisma Studio"
    echo "  test          - Rodar testes"
    echo ""
    echo "Exemplos:"
    echo "  ./run-local.sh dev"
    echo "  ./run-local.sh reset 5511910165356"
    echo "  ./run-local.sh reset-all"
    exit 1
    ;;
esac
