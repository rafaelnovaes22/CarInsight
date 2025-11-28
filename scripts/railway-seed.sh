#!/bin/bash
# Script para executar seed e embeddings no Railway
# IMPORTANTE: Execute via Railway Dashboard ou CLI

set -e

echo "🚀 Iniciando seed no Railway..."

# 1. Seed do banco
echo "📦 Populando banco com veículos Robust Car..."
npm run db:seed:robustcar

# 2. Gerar embeddings
echo "🔄 Gerando embeddings OpenAI..."
npm run embeddings:generate

echo "✅ Migração concluída no Railway!"
