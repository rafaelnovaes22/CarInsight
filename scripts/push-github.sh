#!/bin/bash

clear

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║         📤 PUSH PARA GITHUB - FaciliAuto MVP 📤              ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

cd /home/rafaelnovaes22/project/faciliauto-mvp

# Verificar remote
echo "🔍 Verificando configuração..."
REMOTE=$(git remote get-url origin 2>/dev/null)

if [ -z "$REMOTE" ]; then
    echo "❌ Remote não configurado!"
    exit 1
fi

echo "✅ Remote configurado: $REMOTE"
echo ""

# Verificar se há commits
COMMITS=$(git log --oneline 2>/dev/null | wc -l)
echo "📊 Total de commits: $COMMITS"
echo ""

# Escolher método
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Escolha o método de autenticação:"
echo ""
echo "1) GitHub CLI (gh) - Recomendado se já instalado"
echo "2) Personal Access Token - Recomendado (mais fácil)"
echo "3) SSH Key - Para usuários avançados"
echo "4) Cancelar"
echo ""
read -p "Escolha (1-4): " METHOD

case $METHOD in
    1)
        echo ""
        echo "🔐 Verificando GitHub CLI..."
        if ! command -v gh &> /dev/null; then
            echo "❌ GitHub CLI não instalado!"
            echo ""
            echo "Instale com:"
            echo "  sudo apt update && sudo apt install gh"
            exit 1
        fi
        
        echo "✅ GitHub CLI encontrado!"
        echo ""
        echo "Fazendo login..."
        gh auth login
        
        echo ""
        echo "🚀 Fazendo push..."
        git branch -M main
        git push -u origin main
        ;;
        
    2)
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "📝 INSTRUÇÕES:"
        echo ""
        echo "1. Gere um Personal Access Token:"
        echo "   https://github.com/settings/tokens"
        echo ""
        echo "2. Click em 'Generate new token (classic)'"
        echo "3. Nome: faciliauto-deploy"
        echo "4. Selecione: 'repo' (full control)"
        echo "5. Generate token"
        echo "6. COPIE O TOKEN!"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        read -p "Pressione ENTER quando tiver o token pronto..."
        
        echo ""
        echo "🔐 Configurando credential helper..."
        git config credential.helper store
        
        echo ""
        echo "🚀 Fazendo push..."
        echo ""
        echo "⚠️  IMPORTANTE:"
        echo "   Username: rafaelnovaes22"
        echo "   Password: COLE SEU TOKEN (não a senha do GitHub!)"
        echo ""
        
        git branch -M main
        git push -u origin main
        ;;
        
    3)
        echo ""
        echo "🔑 Método SSH selecionado"
        echo ""
        
        if [ ! -f ~/.ssh/id_ed25519.pub ] && [ ! -f ~/.ssh/id_rsa.pub ]; then
            echo "📝 Gerando chave SSH..."
            ssh-keygen -t ed25519 -C "rafael@carinsight.com" -f ~/.ssh/id_ed25519 -N ""
            echo ""
            echo "✅ Chave gerada!"
        fi
        
        echo ""
        echo "📋 Sua chave pública SSH:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        cat ~/.ssh/id_ed25519.pub 2>/dev/null || cat ~/.ssh/id_rsa.pub
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "📝 COPIE a chave acima e:"
        echo "1. Acesse: https://github.com/settings/keys"
        echo "2. Click em 'New SSH key'"
        echo "3. Cole a chave"
        echo "4. Salve"
        echo ""
        read -p "Pressione ENTER quando terminar..."
        
        echo ""
        echo "🔧 Mudando remote para SSH..."
        git remote set-url origin git@github.com:rafaelnovaes22/CarInsight.git
        
        echo "🚀 Fazendo push..."
        git branch -M main
        git push -u origin main
        ;;
        
    4)
        echo ""
        echo "❌ Cancelado"
        exit 0
        ;;
        
    *)
        echo ""
        echo "❌ Opção inválida"
        exit 1
        ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar se push foi bem-sucedido
if [ $? -eq 0 ]; then
    echo "✅ PUSH BEM-SUCEDIDO! 🎉"
    echo ""
    echo "📊 Verifique em:"
    echo "   https://github.com/rafaelnovaes22/CarInsight"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🚀 PRÓXIMO PASSO: Deploy no Railway"
    echo ""
    echo "1. Acesse: https://railway.app"
    echo "2. New Project → Deploy from GitHub repo"
    echo "3. Selecione: CarInsight"
    echo "4. Leia: DEPLOY_INSTRUCTIONS.md"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "❌ ERRO NO PUSH!"
    echo ""
    echo "📖 Leia: PUSH_TO_GITHUB.md para mais informações"
    echo ""
    echo "💡 Dicas:"
    echo "   - Use Personal Access Token (opção 2)"
    echo "   - Não use sua senha do GitHub, use o token!"
    echo ""
fi
