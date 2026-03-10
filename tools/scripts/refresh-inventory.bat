@echo off
echo ============================================================
echo    ATUALIZACAO COMPLETA DO INVENTARIO
echo ============================================================
echo.

echo [1/3] Validando URLs dos veiculos existentes...
node scripts/validate-existing-urls.mjs
if %ERRORLEVEL% NEQ 0 (
    echo ERRO na validacao de URLs existentes
    pause
    exit /b 1
)

echo.
echo [2/3] Fazendo scraping da RobustCar...
node scripts/validate-and-scrape.mjs
if %ERRORLEVEL% NEQ 0 (
    echo ERRO no scraping
    pause
    exit /b 1
)

echo.
echo [3/3] Atualizando banco de dados...
node scripts/update-vehicles-db.mjs
if %ERRORLEVEL% NEQ 0 (
    echo ERRO na atualizacao do banco
    pause
    exit /b 1
)

echo.
echo ============================================================
echo    INVENTARIO ATUALIZADO COM SUCESSO!
echo ============================================================
pause

