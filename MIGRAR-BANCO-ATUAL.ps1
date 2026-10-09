$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($ScriptDir)) {
    if ($MyInvocation.MyCommand.Path) {
        $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    }
}

if ([string]::IsNullOrWhiteSpace($ScriptDir)) {
    $ScriptDir = (Get-Location).Path
}

$ScriptDir = [System.IO.Path]::GetFullPath($ScriptDir)
Set-Location -LiteralPath $ScriptDir

function Pausar {
    Write-Host ""
    Read-Host "Pressione ENTER para continuar"
}

function Falhar([string]$texto) {
    Write-Host ""
    Write-Host "[ERRO] $texto" -ForegroundColor Red
    Pausar
    exit 1
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  ADEGA PDV - MIGRAR BANCO ATUAL" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este utilitario faz um BACKUP SQLite consistente do banco antigo" -ForegroundColor Green
Write-Host "para a versao WebView2." -ForegroundColor Green
Write-Host ""
Write-Host "Feche o AdegaPDV antigo e o novo antes de continuar." -ForegroundColor Yellow
Write-Host ""

$DistDir = Join-Path $ScriptDir "dist"
$NodeExe = Join-Path $DistDir "runtime\node.exe"
$DistApp = Join-Path $DistDir "app"
$DestinoDb = Join-Path $DistApp "database\adega.db"
$MigradorJs = Join-Path $ScriptDir "MIGRAR-BANCO.js"

if (-not (Test-Path $NodeExe)) {
    Falhar "Nao encontrei dist\runtime\node.exe. Execute PREPARAR-WEBVIEW2.bat primeiro."
}

if (-not (Test-Path $MigradorJs)) {
    Falhar "Nao encontrei MIGRAR-BANCO.js."
}

$origemEntrada = Read-Host "Digite a pasta do seu AdegaPDV ANTIGO (ex.: C:\AdegaPDV)"

$origemEntrada = $origemEntrada.Trim().Trim('"')

if ([string]::IsNullOrWhiteSpace($origemEntrada)) {
    Falhar "Nenhuma pasta foi informada."
}

$candidatos = @(
    (Join-Path $origemEntrada "database\adega.db"),
    (Join-Path $origemEntrada "app\database\adega.db"),
    (Join-Path $origemEntrada "dist\app\database\adega.db"),
    (Join-Path $origemEntrada "adega.db")
)

$OrigemDb = $null

foreach ($candidato in $candidatos) {
    if (Test-Path $candidato) {
        $OrigemDb = [System.IO.Path]::GetFullPath($candidato)
        break
    }
}

if (-not $OrigemDb) {
    Write-Host ""
    Write-Host "Nao encontrei adega.db automaticamente." -ForegroundColor Yellow
    Write-Host "Procurei em:" -ForegroundColor DarkGray
    foreach ($candidato in $candidatos) {
        Write-Host "  $candidato" -ForegroundColor DarkGray
    }
    Write-Host ""
    $arquivoDireto = Read-Host "Digite o caminho COMPLETO do arquivo adega.db"

    $arquivoDireto = $arquivoDireto.Trim().Trim('"')

    if (-not (Test-Path $arquivoDireto)) {
        Falhar "O arquivo informado nao existe."
    }

    $OrigemDb = [System.IO.Path]::GetFullPath($arquivoDireto)
}

$DestinoDb = [System.IO.Path]::GetFullPath($DestinoDb)

if ($OrigemDb -eq $DestinoDb) {
    Falhar "O banco de origem e o banco de destino sao o mesmo arquivo."
}

Write-Host ""
Write-Host "Banco encontrado:" -ForegroundColor Green
Write-Host "  $OrigemDb"
Write-Host ""
Write-Host "Destino WebView2:" -ForegroundColor Green
Write-Host "  $DestinoDb"
Write-Host ""

$confirmacao = Read-Host "Deseja continuar? (S/N)"

if ($confirmacao -notmatch '^[SsYy]') {
    Write-Host "Migracao cancelada."
    Pausar
    exit 0
}

# Backup do banco atual da versão WebView2 antes de substituir
$DestinoDir = Split-Path -Parent $DestinoDb
New-Item -ItemType Directory -Force -Path $DestinoDir | Out-Null

if (Test-Path $DestinoDb) {
    $BackupDir = Join-Path $DistApp "backups\antes-migracao"
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

    $stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $BackupDestino = Join-Path $BackupDir "adega_antes_migracao_$stamp.db"

    Copy-Item -LiteralPath $DestinoDb -Destination $BackupDestino -Force

    Write-Host ""
    Write-Host "Backup do banco WebView2 atual criado em:" -ForegroundColor Yellow
    Write-Host "  $BackupDestino"
}

# Faz o backup consistente via better-sqlite3
Write-Host ""
Write-Host "Migrando..." -ForegroundColor Cyan

Push-Location $DistApp
try {
    & $NodeExe $MigradorJs $OrigemDb $DestinoDb $DistApp
    $codigo = $LASTEXITCODE
}
finally {
    Pop-Location
}

if ($codigo -ne 0) {
    Falhar "A migracao do banco falhou."
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " BANCO MIGRADO COM SUCESSO" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Agora abra:" -ForegroundColor White
Write-Host "  dist\AdegaPDV.exe" -ForegroundColor White
Write-Host ""
Write-Host "Na primeira abertura, o proprio sistema aplicara as migracoes" -ForegroundColor DarkGray
Write-Host "de estrutura que forem necessarias ao seu banco antigo." -ForegroundColor DarkGray

Pausar
