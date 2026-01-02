@echo off
cd C:\Users\Rafael\CarInsight
echo Limpando conversas antigas...
npx prisma db execute --file="prisma/clear-conversations.sql" 2>nul || (
  echo DELETE FROM "Message" WHERE 1=1; > temp.sql
  echo DELETE FROM "Event" WHERE 1=1; >> temp.sql
  echo DELETE FROM "Lead" WHERE 1=1; >> temp.sql
  echo DELETE FROM "Recommendation" WHERE 1=1; >> temp.sql
  echo DELETE FROM "Conversation" WHERE 1=1; >> temp.sql
  npx prisma db execute --file="temp.sql"
  del temp.sql
)
echo.
echo ✅ Banco limpo! Iniciando teste...
echo.
npm run test:bot