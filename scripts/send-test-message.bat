@echo off
cd C:\Users\Rafael\faciliauto-mvp
echo 📱 Enviando mensagem de teste via WhatsApp...
echo.

set /p phone="Digite seu número (ex: 5511949105033): "

if "%phone%"=="" (
  echo ❌ Número não pode estar vazio!
  exit /b 1
)

echo.
echo Enviando para: %phone%
echo.

call npx tsx src/test-meta.ts %phone% 2>&1 | findstr /V "DEBUG"

echo.
echo ────────────────────────────────────────
echo.
echo 📋 Para enviar novamente, execute:
echo    send-test-message.bat
echo.
pause