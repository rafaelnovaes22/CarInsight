@echo off
cd C:\Users\Rafael\CarInsight
echo 🧹 Limpando banco de dados...
echo.

:: Delete database and recreate
echo DELETE FROM "Message" WHERE 1=1; > temp.sql
echo DELETE FROM "Event" WHERE 1=1; >> temp.sql
echo DELETE FROM "Lead" WHERE 1=1; >> temp.sql
echo DELETE FROM "Recommendation" WHERE 1=1; >> temp.sql
echo DELETE FROM "Conversation" WHERE 1=1; >> temp.sql

npx prisma db execute --file="temp.sql" --schema prisma/schema.prisma
if %errorlevel% neq 0 (
  echo ❌ Erro ao limpar banco!
  del temp.sql
  exit /b 1
)

del temp.sql
echo ✅ Banco limpo!
echo.

echo 🌱 Reseeding database...
npm run db:seed > nul 2>&1
echo ✅ Database reseeded!
echo.

echo 🎯 Executando teste completo...
echo.
npx tsx src/test-system.ts 2>&1 | findstr /V "DEBUG INFO"