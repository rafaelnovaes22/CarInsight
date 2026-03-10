@echo off
REM Script para fazer backup do banco de produção
REM Requer: PostgreSQL instalado (pg_dump no PATH)

echo ============================================================
echo    BACKUP DO BANCO DE PRODUCAO
echo ============================================================
echo.

REM Configurar a URL do banco de produção (URL PUBLICA do Railway)
REM Formato: postgresql://user:password@host:port/database
set DATABASE_URL_PROD=postgresql://postgres:ODLFmFwtKwajpoAyQuyyoaLaVTBJPoaq@roundhouse.proxy.rlwy.net:24647/railway

REM Nome do arquivo de backup
set BACKUP_FILE=backup_%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%.sql
set BACKUP_FILE=%BACKUP_FILE: =0%

echo Conectando ao banco de producao...
echo Arquivo: %BACKUP_FILE%
echo.

pg_dump "%DATABASE_URL_PROD%" --no-owner --no-acl -f "scripts/%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo    BACKUP CONCLUIDO COM SUCESSO!
    echo    Arquivo: scripts/%BACKUP_FILE%
    echo ============================================================
) else (
    echo.
    echo ERRO ao fazer backup. Verifique:
    echo 1. PostgreSQL instalado e pg_dump no PATH
    echo 2. URL do banco correta
    echo 3. Conexao com internet
)

pause

