@echo off
echo ====================================================
echo 🚀 DEPLOY RAILWAY - FaciliAuto MVP
echo 🧩 Usando tsx diretamente (sem build!)
echo ====================================================
echo.

REM Verifica se Railway CLI está instalado
where railway >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Railway CLI não encontrado!
    echo Instale com: npm install -g @railway/cli
    echo Ou via Scoop: scoop install railway
    echo.
    pause
    exit /b 1
)

echo 📡 Conectando ao Railway...
railway login
echo.

REM Verifica se projeto já existe no Railway
railway status >nul 2>&1
if %errorlevel% neq 0 (
    echo 🎯 Criando projeto no Railway...
    railway init --name "faciliauto-mvp" --environment "production"
    if %errorlevel% neq 0 (
        echo ❌ Erro ao criar projeto
        pause
        exit /b 1
    )
    echo ✅ Projeto criado!
) else (
    echo ✅ Projeto já existe no Railway
)
echo.

REM Configura variáveis de ambiente
echo 🔧 Configurando variáveis de ambiente...
echo.

railway variables set NODE_ENV "production" --environment production
echo ✅ NODE_ENV=production

railway variables set GROQ_API_KEY "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" --environment production
echo ✅ GROQ_API_KEY configurada

railway variables set META_WHATSAPP_TOKEN "EAAWqINRXnbcBP0UgH7kD4SzMZBK8m5miaimQmn5BiHf9cMiSuRQutiCVk1DOZCwk6kBxWlB4uMNgCK9gTmXk5sG7ICenlvFqZCEnaM5j1OIY9cVMT3ZCEXdL59LHqhjoRdoiZCov97ZCT7iTPNDW2IAMZAxTHBSh1ythrdYlLG19AXHckzMSwTm1NMpRR3jsttMwDpvXhx29pRsCl0EAiAHCMFBE646EFZBuTOZA2l29YiEVcpgZDZD" --environment production
echo ✅ META_WHATSAPP_TOKEN configurada

railway variables set META_WHATSAPP_PHONE_NUMBER_ID "897098916813396" --environment production
echo ✅ META_WHATSAPP_PHONE_NUMBER_ID configurada

railway variables set META_WHATSAPP_BUSINESS_ACCOUNT_ID "2253418711831684" --environment production
echo ✅ META_WHATSAPP_BUSINESS_ACCOUNT_ID configurada

railway variables set META_WEBHOOK_VERIFY_TOKEN "faciliauto_webhook_2025" --environment production
echo ✅ META_WEBHOOK_VERIFY_TOKEN configurada

echo.

REM Configura PostgreSQL (se não existir)
echo 🗄️  Verificando PostgreSQL...
railway addons | findstr "postgresql" >nul
if %errorlevel% neq 0 (
    echo 📦 Adicionando PostgreSQL (grátis)...
    railway addons add postgresql:free --environment production
    echo.
    echo ⏱️  Aguardando banco inicializar (15s)...
    timeout /t 15 /nobreak >nul
) else (
    echo ✅ PostgreSQL já configurado
)
echo.

REM Override do DATABASE_URL (Railway cria automaticamente)
echo 🔗 Usando DATABASE_URL gerado pelo Railway PostgreSQL
echo.

REM Deploy
echo 📤 Fazendo deploy...
echo 📦 Usando nixpacks.toml: npx tsx src/index.ts
echo 🎯 Build flow: prisma generate → db seed → start
echo ⏱️  Isso leva 2-4 minutos...
echo.
railway up --environment production --detach

:wait_loop
cls
echo ====================================================
echo ⏳ DEPLOY EM ANDAMENTO...
echo ====================================================
echo.
railway status
rem Verifica cada 5 segundos
if %errorlevel% neq 0 (
    echo 🔄 Build inicializando...
) else (
    echo ✅ Conectado ao projeto
)
echo.
echo 📊 Para ver logs em tempo real: railway logs --environment production
echo 🛑 Para cancelar: Ctrl+C
echo.
timeout /t 5 /nobreak >nul
goto wait_loop

REM mensagem de sucesso será adicionada após concluir
:eof