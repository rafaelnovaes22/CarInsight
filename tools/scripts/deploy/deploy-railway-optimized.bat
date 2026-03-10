@echo off
echo ====================================================
echo              RAILWAY CLI - SAFE HELPER
echo ====================================================
echo.
echo Este script NAO faz deploy.
echo.
echo Motivo:
echo - producao usa deploy automatico via GitHub
echo - usar "railway up" em paralelo gera builds duplicados
echo - este repositorio nao deve armazenar secrets em scripts
echo.
echo Fluxo correto de producao:
echo 1. Atualizar variaveis no Railway Dashboard ou via "railway variables"
echo 2. Commitar e fazer push para a branch conectada
echo 3. Acompanhar o deploy no Railway Dashboard
echo.
echo Comandos seguros via CLI:
echo - railway login
echo - railway link
echo - railway status
echo - railway logs
echo - railway variables
echo.
echo Exemplos:
echo   railway status
echo   railway logs --environment production
echo   railway variables
echo.
exit /b 1
