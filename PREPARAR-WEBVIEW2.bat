@echo off
setlocal
cd /d "%~dp0"

title Adega PDV - Preparar WebView2 V2

echo.
echo ============================================================
echo   ADEGA PDV - WEBVIEW2 V2
echo ============================================================
echo.
echo Este gerador usa Node 22 portatil.
echo Ele NAO usa seu Node 24 instalado.
echo Nao precisa instalar Python nem Visual Studio Build Tools.
echo.
echo Na primeira execucao precisa de internet para baixar:
echo - Node.js 22 LTS oficial
echo - .NET 8 SDK local
echo - dependencias npm / WebView2
echo.
pause

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0PREPARAR-WEBVIEW2.ps1"

if errorlevel 1 (
    echo.
    echo ============================================================
    echo A preparacao encontrou um erro.
    echo Veja PREPARAR-WEBVIEW2.log nesta pasta.
    echo ============================================================
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo PRONTO.
echo Abra: dist\AdegaPDV.exe
echo ============================================================
echo.
pause
