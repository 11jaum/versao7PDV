@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0CRIAR-PACOTE-ATUALIZACAO.ps1"
echo.
pause
