@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Adega PDV - Gerar Instalador

echo.
echo ============================================================
echo   ADEGA PDV - GERAR SETUP.EXE
echo ============================================================
echo.

if not exist "dist\AdegaPDV.exe" (
    echo [ERRO] A pasta dist ainda nao foi gerada.
    echo Execute PREPARAR-WEBVIEW2.bat primeiro.
    pause
    exit /b 1
)

set "ISCC="
if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if exist "%LocalAppData%\Programs\Inno Setup 6\ISCC.exe" set "ISCC=%LocalAppData%\Programs\Inno Setup 6\ISCC.exe"

if not defined ISCC (
    where winget.exe >nul 2>nul
    if not errorlevel 1 (
        echo Inno Setup nao encontrado.
        echo Tentando instalar automaticamente pelo winget...
        echo.
        winget install --id JRSoftware.InnoSetup -e --accept-source-agreements --accept-package-agreements

        if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
        if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
        if exist "%LocalAppData%\Programs\Inno Setup 6\ISCC.exe" set "ISCC=%LocalAppData%\Programs\Inno Setup 6\ISCC.exe"
    )
)

if not defined ISCC (
    echo.
    echo [ERRO] Inno Setup 6 nao foi encontrado.
    echo Instale o Inno Setup 6 e execute este arquivo novamente.
    pause
    exit /b 1
)

if exist "installer\seed\adega.db" del /q "installer\seed\adega.db"

echo.
echo Deseja incluir o seu banco de dados ATUAL no instalador?
echo.
echo [1] SIM - este Setup ja instala seus produtos, usuarios e vendas.
echo [2] NAO - gera um Setup limpo, sem seus dados.
echo.
choice /C 12 /N /M "Escolha 1 ou 2: "

if errorlevel 2 goto sem_dados

if exist "dist\app\database\adega.db" (
    copy /y "dist\app\database\adega.db" "installer\seed\adega.db" >nul
    echo.
    echo Banco atual incluido apenas para PRIMEIRA instalacao.
    echo Atualizacoes futuras nao sobrescrevem esse banco.
) else (
    echo.
    echo [AVISO] Nao existe dist\app\database\adega.db.
    echo O instalador sera criado sem banco inicial.
)

:sem_dados
echo.
echo Compilando instalador...
echo.

"%ISCC%" "installer\AdegaPDV.iss"

if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao gerar o instalador.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo PRONTO.
echo.
echo Instalador:
echo installer\output\AdegaPDV-Setup-2.1.7.exe
echo.
echo IMPORTANTE:
echo Se voce escolheu incluir seu banco, NAO compartilhe esse Setup
echo com outros clientes, pois ele contem seus dados.
echo ============================================================
echo.
pause
