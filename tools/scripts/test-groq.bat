@echo off
cd C:\Users\Rafael\faciliauto-mvp
npm run test:bot 2>&1 | findstr /V "DEBUG INFO"