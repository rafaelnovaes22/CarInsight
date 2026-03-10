#!/bin/bash

# Script para ativar modo conversacional
# Uso: bash scripts/activate-conversational.sh [rollout_percentage]

set -e

PROJECT_DIR="/home/rafaelnovaes22/faciliauto-mvp-v2"
cd "$PROJECT_DIR"

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Ativando Modo Conversacional - FaciliAuto${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Pegar rollout percentage (default 100)
ROLLOUT="${1:-100}"

if [ "$ROLLOUT" -lt 0 ] || [ "$ROLLOUT" -gt 100 ]; then
  echo -e "${RED}❌ Rollout deve ser entre 0 e 100${NC}"
  exit 1
fi

echo -e "${YELLOW}📊 Configuração:${NC}"
echo "   - Modo Conversacional: ATIVADO"
echo "   - Rollout: ${ROLLOUT}%"
echo ""

# Verificar se .env existe
if [ ! -f .env ]; then
  echo -e "${RED}❌ Arquivo .env não encontrado${NC}"
  echo "   Criando a partir do .env.example..."
  cp .env.example .env
fi

# Backup do .env atual
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✅ Backup do .env criado${NC}"

# Atualizar variáveis
echo -e "${YELLOW}🔧 Atualizando variáveis de ambiente...${NC}"

# Usar sed para atualizar ou adicionar variáveis
if grep -q "ENABLE_CONVERSATIONAL_MODE" .env; then
  sed -i 's/ENABLE_CONVERSATIONAL_MODE=.*/ENABLE_CONVERSATIONAL_MODE="true"/' .env
else
  echo 'ENABLE_CONVERSATIONAL_MODE="true"' >> .env
fi

if grep -q "CONVERSATIONAL_ROLLOUT_PERCENTAGE" .env; then
  sed -i "s/CONVERSATIONAL_ROLLOUT_PERCENTAGE=.*/CONVERSATIONAL_ROLLOUT_PERCENTAGE=\"$ROLLOUT\"/" .env
else
  echo "CONVERSATIONAL_ROLLOUT_PERCENTAGE=\"$ROLLOUT\"" >> .env
fi

echo -e "${GREEN}✅ Variáveis atualizadas${NC}"
echo ""

# Mostrar configuração atual
echo -e "${YELLOW}📋 Configuração atual (.env):${NC}"
grep -E "ENABLE_CONVERSATIONAL_MODE|CONVERSATIONAL_ROLLOUT_PERCENTAGE" .env
echo ""

# Perguntar se deseja resetar conversas
echo -e "${YELLOW}❓ Deseja resetar todas as conversas existentes?${NC}"
echo "   (Recomendado para garantir que todos comecem no novo fluxo)"
read -p "   [s/N]: " -n 1 -r
echo ""

if [[ $REPLY =~ ^[SsYy]$ ]]; then
  echo -e "${YELLOW}🗑️  Resetando conversas...${NC}"
  npx tsx scripts/reset-conversations.ts --all
  echo ""
fi

# Verificar se servidor está rodando
echo -e "${YELLOW}🔍 Verificando servidor...${NC}"
if pgrep -f "tsx src/index.ts" > /dev/null; then
  echo -e "${YELLOW}⚠️  Servidor está rodando. Reiniciando...${NC}"
  pkill -f "tsx src/index.ts" || true
  sleep 2
fi

# Opção de iniciar servidor
echo -e "${YELLOW}❓ Deseja iniciar o servidor agora?${NC}"
read -p "   [s/N]: " -n 1 -r
echo ""

if [[ $REPLY =~ ^[SsYy]$ ]]; then
  echo -e "${GREEN}🚀 Iniciando servidor...${NC}"
  echo ""
  npm run dev
else
  echo ""
  echo -e "${GREEN}✅ Modo conversacional ativado!${NC}"
  echo ""
  echo -e "${YELLOW}📝 Próximos passos:${NC}"
  echo "   1. Iniciar servidor: npm run dev"
  echo "   2. Enviar 'oi' no WhatsApp para testar"
  echo "   3. Monitorar logs: tail -f server.log"
  echo ""
  echo -e "${YELLOW}🔄 Para reverter:${NC}"
  echo "   Restaure o backup: cp .env.backup.* .env"
  echo ""
fi
