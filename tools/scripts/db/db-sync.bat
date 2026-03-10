@echo off
REM ============================================================
REM   SINCRONIZAR BANCO DE DADOS RAILWAY <-> LOCAL
REM ============================================================
REM
REM Para obter a URL PUBLICA do banco Railway:
REM 1. Acesse https://railway.app
REM 2. Clique no seu projeto
REM 3. Clique no servico PostgreSQL
REM 4. Aba "Connect" -> "Public Network"
REM 5. Copie a "Connection URL"
REM
REM A URL deve ser algo como:
REM postgresql://postgres:SENHA@roundhouse.proxy.rlwy.net:PORTA/railway
REM
REM ============================================================

echo.
echo ============================================================
echo    SINCRONIZAR BANCO RAILWAY
echo ============================================================
echo.

REM Verificar se tem argumento
if "%1"=="" (
    echo USO:
    echo   db-sync.bat export ^<URL_PUBLICA_RAILWAY^>
    echo   db-sync.bat import ^<arquivo.json^>
    echo.
    echo OBTER URL:
    echo   1. Railway.app ^> Seu projeto ^> PostgreSQL
    echo   2. Aba "Connect" ^> "Public Network"
    echo   3. Copie a "Connection URL"
    echo.
    pause
    exit /b 1
)

if "%1"=="export" (
    if "%2"=="" (
        echo ERRO: Informe a URL do banco
        echo Exemplo: db-sync.bat export postgresql://user:pass@host:port/db
        pause
        exit /b 1
    )
    
    echo Exportando banco de producao...
    set DATABASE_URL=%2
    node scripts/db-export.mjs
    
) else if "%1"=="import" (
    if "%2"=="" (
        echo ERRO: Informe o arquivo de backup
        echo Exemplo: db-sync.bat import scripts/db-backup-2024-01-01.json
        pause
        exit /b 1
    )
    
    echo Importando backup...
    node scripts/db-import.mjs %2
    
) else (
    echo Comando invalido: %1
    echo Use: export ou import
)

pause

