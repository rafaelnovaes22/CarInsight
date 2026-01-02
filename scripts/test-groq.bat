@echo off
cd C:\Users\Rafael\CarInsight
npm run test:bot 2>&1 | findstr /V "DEBUG INFO"