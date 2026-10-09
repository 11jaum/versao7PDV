@echo off
setlocal
cd /d "%~dp0"

title Adega PDV - Migrar Banco Atual

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0MIGRAR-BANCO-ATUAL.ps1"

exit /b %ERRORLEVEL%
