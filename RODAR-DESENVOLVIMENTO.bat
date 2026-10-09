@echo off
setlocal
cd /d "%~dp0"

if not exist ".tools\node\node.exe" (
    echo Execute PREPARAR-WEBVIEW2.bat primeiro.
    pause
    exit /b 1
)

if not exist ".tools\dotnet\dotnet.exe" (
    echo Execute PREPARAR-WEBVIEW2.bat primeiro.
    pause
    exit /b 1
)

start "" /b ".tools\node\node.exe" "app\server.js"
timeout /t 2 /nobreak >nul

".tools\dotnet\dotnet.exe" run --project "launcher\AdegaPDV.Launcher.csproj"

pause
