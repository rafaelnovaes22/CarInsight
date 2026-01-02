@echo off
echo =================================================================
echo                DEPLOY FACILIAUTO MVP NO RAILWAY
echo =================================================================
echo.
echo ⚠️  PRÉ-REQUISITOS:
echo    1. Conta Railway (https://railway.app)
echo    2. App conectado ao GitHub
echo    3. Codigo já enviado (git push)
echo.

set /p passo="Qual passo você está? (1, 2, 3, 4, 5, 6 ou 'help'): "

if "%passo%"=="help" goto ajuda
if "%passo%"=="1" goto passo1
if "%passo%"=="2" goto passo2
if "%passo%"=="3" goto passo3
if "%passo%"=="4" goto passo4
if "%passo%"=="5" goto passo5
if "%passo%"=="6" goto passo6

echo ❌ Opção inválida!
goto fim

:ajuda
echo.
echo 📚 GUIA RÁPIDO:
echo.
echo [1] Criar projeto no Railway
echo [2] Configurar variáveis (tokens)
echo [3] Verificar deploy
echo [4] Testar webhook
echo [5] Status final
echo [6] Teste completo
echo.
goto fim

:passo1
echo.
echo =========================================
echo PASSO 1: CRIAR PROJETO NO RAILWAY
echo =========================================
echo.
echo 1. Acesse: https://railway.app/new
echo 2. Clique em "Deploy from GitHub repo"
echo 3. Selecione: rafaelnovaes22/CarInsight
echo 4. Clique: "Deploy Now"
echo.
echo ✅ Aguarde 2-3 minutos o deploy inicial
echo ❌ PODE FALHAR por falta de variáveis - NORMAL
echo.
echo ──────────────────────────────────────
echo Próximo: execute este script e digite 2
echo ──────────────────────────────────────
echo.
goto fim

:passo2
echo.
echo =========================================
echo PASSO 2: CONFIGURAR VARIÁVEIS
echo =========================================
echo.
echo ⚠️  Acesse seu projeto no Railway
echo ⚠️  Vá em "Variables" e adicione UMA POR UMA:
echo.

echo      ┌─────────────────────────────────┐
echo      │ Variáveis OBRIGATÓRIAS:         │
echo      ├─────────────────────────────────┤
echo      │ GROQ_API_KEY                    │
echo      │ META_WHATSAPP_TOKEN             │
echo      │ META_WHATSAPP_PHONE_NUMBER_ID   │
echo      │ META_WEBHOOK_VERIFY_TOKEN       │
echo      └─────────────────────────────────┘

echo.
echo 💡 DICA: Copie do arquivo .env local
echo.
echo ──────────────────────────────────────
echo Próximo: execute este script e digite 3
echo ──────────────────────────────────────
echo.
goto fim

:passo3
echo.
echo =========================================
echo PASSO 3: REDEPLOY E VERIFICAR
echo =========================================
echo.
echo 1. No Railway, clique em "Redeploy"
echo 2. Aguarde 2-3 minutos
echo 3. Status deve mudar para: ✅ Deployed
echo.
echo ──────────────────────────────────────
echo Para ver logs: clique em "View Logs"
echo ──────────────────────────────────────
echo.
echo Próximo: execute este script e digite 4
echo.
goto fim

:passo4
echo.
echo =========================================
echo PASSO 4: CONFIGURAR WEBHOOK NO META
echo =========================================
echo.
echo 1. Copie o domínio do Railway:
echo    └─ Vá em "Settings" > "Networking"
echo    └─ Opcional: "Generate Domain"
echo.
echo 2. Acesse: developers.facebook.com
echo 3. Selecione seu App
echo 4. Vá para: WhatsApp > Configuration
echo 5. Em "Webhook", clique "Edit"
echo 6. URL: https://SEU_DOMINIO/webhooks/whatsapp
echo 7. Verify Token: faciliauto_webhook_2025
echo 8. Clique: "Verify and Save"
echo.
goto fim

:passo5
echo.
echo =========================================
echo PASSO 5: STATUS FINAL
echo =========================================
echo.
echo ✅ Pronto para testes!
echo.
echo URL do webhook:
echo    https://SEU_DOMINIO/webhooks/whatsapp
echo.
echo URL base:
echo    https://SEU_DOMINIO
echo.
echo Health Check:
echo    https://SEU_DOMINIO/health
echo.
goto fim

:passo6
echo.
echo =========================================
echo PASSO 6: TESTE COMPLETO
echo =========================================
echo.
echo Testando conexão...
echo.
start https://SEU_DOMINIO/health
start https://SEU_DOMINIO
echo.  
echo ✅ Se as páginas abrirem, o deploy funcionou!
echo.
echo Próximo passo: teste com WhatsApp real
echo Enviar "Olá" para o número configurado
echo.
goto fim

:fim
echo.
echo =================================================================
echo                 DOCUMENTAÇÃO: RAILWAY_DEPLOY.md
echo =================================================================
echo.