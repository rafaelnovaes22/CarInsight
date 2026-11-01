#!/bin/bash

# Script de migração para Robust Car
# Execute: bash executar-migracao.sh

set -e

echo "🚀 Iniciando migração para Robust Car..."
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    echo "Por favor, instale Node.js 18+ primeiro."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado!"
    echo "Por favor, instale npm primeiro."
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo "✅ npm: $(npm --version)"
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: package.json não encontrado!"
    echo "Execute este script do diretório: /home/rafaelnovaes22/faciliauto-mvp-v2"
    exit 1
fi

echo "📁 Diretório: $(pwd)"
echo ""

# Verificar se o arquivo JSON existe
if [ ! -f "scripts/robustcar-vehicles.json" ]; then
    echo "❌ Erro: scripts/robustcar-vehicles.json não encontrado!"
    exit 1
fi

echo "✅ Arquivo de veículos encontrado"
echo ""

# Passo 1: Seed do banco
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 1/3: Popular banco de dados com veículos Robust Car"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run db:seed:robustcar

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Erro ao executar seed!"
    exit 1
fi

echo ""
echo "✅ Seed concluído com sucesso!"
echo ""

# Passo 2: Gerar embeddings
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 2/3: Gerar embeddings OpenAI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run embeddings:generate

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Erro ao gerar embeddings!"
    exit 1
fi

echo ""
echo "✅ Embeddings gerados com sucesso!"
echo ""

# Passo 3: Verificar resultados
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 3/3: Verificação"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run embeddings:stats

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Próximos passos:"
echo ""
echo "1. Testar localmente:"
echo "   npm run dev"
echo ""
echo "2. Ver dados no Prisma Studio:"
echo "   npm run db:studio"
echo ""
echo "3. Fazer deploy no Railway:"
echo "   git add ."
echo "   git commit -m 'feat: migrar para 70 veículos Robust Car'"
echo "   git push origin main"
echo "   railway run npm run db:seed:robustcar"
echo "   railway run npm run embeddings:generate"
echo ""
echo "🎉 Tudo pronto!"
