@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0TESTAR-ESTABILIDADE.ps1"
set ERR=%ERRORLEVEL%
echo.
if "%ERR%"=="0" (
    echo Teste de estabilidade concluido com sucesso.
) else (
    echo Foram encontradas falhas. Veja o relatorio na pasta logs.
)
echo.
pause
exit /b %ERR%
