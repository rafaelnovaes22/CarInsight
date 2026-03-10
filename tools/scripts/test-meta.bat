@echo off
cd C:\Users\Rafael\faciliauto-mvp
echo Testing Meta Cloud API connection...
echo.
echo This will send a test message to the configured WhatsApp number.
echo.
set /p testNumber="Enter test phone number (with country code, e.g., 5511999999999): "

tsx src/test-meta.ts %testNumber%