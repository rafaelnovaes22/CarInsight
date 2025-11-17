#!/bin/bash

# 🚀 Script de Deploy Rápido - FaciliAuto MVP
# Execute este script para fazer push para GitHub

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║           🚀 FACILIAUTO MVP - DEPLOY RÁPIDO 🚀               ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Verificar se já tem remote configurado
if git remote get-url origin &>/dev/null; then
    echo "✅ Remote origin já configurado"
    REMOTE_URL=$(git remote get-url origin)
    echo "   URL: $REMOTE_URL"
    echo ""
else
    echo "⚠️  Remote origin NÃO configurado"
    echo ""
    echo "📝 Configure o remote primeiro:"
    echo ""
    echo "Opção 1 - Via GitHub CLI (recomendado):"
    echo "  gh repo create faciliauto-mvp --public --source=. --remote=origin --push"
    echo ""
    echo "Opção 2 - Via Git manual:"
    echo "  1. Criar repo em https://github.com/new"
    echo "  2. git remote add origin https://github.com/SEU-USUARIO/faciliauto-mvp.git"
    echo "  3. git branch -M main"
    echo "  4. git push -u origin main"
    echo ""
    exit 1
fi

# Verificar se há mudanças
if [[ -z $(git status -s) ]]; then
    echo "✅ Sem mudanças para commit"
else
    echo "📝 Há mudanças não commitadas:"
    git status -s
    echo ""
    echo "Deseja fazer commit? (y/n)"
    read -r REPLY
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "Digite a mensagem do commit:"
        read -r COMMIT_MSG
        git add .
        git commit -m "$COMMIT_MSG"
        echo "✅ Commit feito!"
    fi
fi

echo ""
echo "🚀 Fazendo push para GitHub..."
git push origin main

echo ""
echo "✅ Push concluído!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PRÓXIMO PASSO:"
echo ""
echo "1. Acesse https://railway.app"
echo "2. New Project → Deploy from GitHub repo"
echo "3. Selecione 'faciliauto-mvp'"
echo "4. Adicione PostgreSQL (+New → Database → PostgreSQL)"
echo "5. Aguarde deploy (2-3 min)"
echo "6. Veja logs e escaneie QR Code do WhatsApp"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 Documentação:"
echo "   → DEPLOY_INSTRUCTIONS.md (guia rápido)"
echo "   → DEPLOY_RAILWAY.md (guia completo)"
echo ""
echo "🎉 Boa sorte com o deploy!"
