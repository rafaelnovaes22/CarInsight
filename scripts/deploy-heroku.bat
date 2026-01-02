@echo off
echo 🚀 Deploy CarInsight MVP no Heroku
echo ========================================
echo.

REM Verifica se Heroku CLI está instalado
where heroku >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Heroku CLI não encontrado!
    echo Instale em: https://devcenter.heroku.com/articles/heroku-cli
    pause
    exit /b 1
)

echo 📋 Configurando app para Heroku...

REM Cria app Heroku se não existir
heroku apps:info --app carinsight-mvp >nul 2>&1
if %errorlevel% neq 0 (
    echo 🎯 Criando app carinsight-mvp no Heroku...
    heroku apps:create carinsight-mvp
    if %errorlevel% neq 0 (
        echo ⚠️  Não foi possível criar app com esse nome.
        echo    O nome:carinsight-mvp do app não está disponível heroku!
        echo    O deploy vai continuar com o nome atual do git.
    )
)

echo.
echo 🔧 Configurando buildpacks...
heroku buildpacks:set heroku/nodejs --app carinsight-mvp
echo.

echo 🔧 Configurando variáveis de ambiente...
heroku config:set NODE_ENV=production --app carinsight-mvp >nul 2>&1
echo ✅ NODE_ENV=production
echo.

echo 📤 Fazendo push para Heroku...
echo    Isso pode demorar 2-4 minutos...
echo.

REM Fazer push limpo
git push heroku main --force
echo.

REM Verificar logs heroku config:set NPM_CONFIG_PRODUCTION=false --app carinsight-mvp
echo ✅ Verificando deploy...
echo.

echo ⏱️  Aguardando build inicializar... (30s)
timeout /t 30 /nobreak >nul
echo.

REM Mostrar status tail
start heroku ps --app carinsight-mvp
echo.
echo 🎯 Para ver logs em tempo real, execute:
echo    heroku logs --tail --app carinsight-mvp
echo.
echo 🌐 Para abrir app:
echo    heroku open --app carinsight-mvp
echo.
echo 🌐 Para também pode ser configurado aqui: https://carinsight-mvp.herokuapp.com/
echo.
echo ========================================
echo ✅ Deploy configurado!
echo.
pause