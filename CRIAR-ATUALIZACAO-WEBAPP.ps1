$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ScriptDir

$App = Join-Path $ScriptDir "app"
$Out = Join-Path $ScriptDir "atualizacoes"
$Temp = Join-Path $ScriptDir ".update-webapp-temp"

if (-not (Test-Path (Join-Path $App "server.js"))) {
    throw "app\server.js nao foi encontrado."
}

if (-not (Test-Path (Join-Path $App "node_modules"))) {
    throw "app\node_modules nao foi encontrado. Execute PREPARAR-WEBVIEW2.bat antes de gerar o WebApp."
}

if (Test-Path $Temp) {
    Remove-Item -LiteralPath $Temp -Recurse -Force
}

New-Item -ItemType Directory -Force -Path (Join-Path $Temp "app") | Out-Null
New-Item -ItemType Directory -Force -Path $Out | Out-Null

# Inclui node_modules para que o WebApp também suporte novas dependências
# sem depender de internet/npm no computador do cliente.
& robocopy.exe `
    $App `
    (Join-Path $Temp "app") `
    /E `
    /R:2 `
    /W:1 `
    /XD "database" "backups" "logs" "temp" `
    /XF "adega.db" "adega.db-wal" "adega.db-shm" `
    /NFL /NDL /NJH /NJS /NP | Out-Null

if ($LASTEXITCODE -gt 7) {
    throw "Falha ao preparar o WebApp."
}

$Atualizador = Join-Path $ScriptDir "installer\ATUALIZAR-SISTEMA.ps1"

if (Test-Path $Atualizador) {
    Copy-Item `
        -LiteralPath $Atualizador `
        -Destination (Join-Path $Temp "ATUALIZAR-SISTEMA.ps1") `
        -Force
}

$Version = "2.1.7"

$Manifest = @{
    produto = "Adega PDV"
    formato = 2
    tipo = "webapp"
    versao = $Version
    criado_em = (Get-Date).ToString("o")
    inclui_node_modules = $true
    preserva = @(
        "app/database",
        "app/backups",
        "app/logs",
        "app/temp"
    )
} | ConvertTo-Json -Depth 5

Set-Content `
    -LiteralPath (Join-Path $Temp "update-manifest.json") `
    -Value $Manifest `
    -Encoding UTF8

$BancoNoPacote =
    Get-ChildItem `
        -LiteralPath $Temp `
        -Recurse `
        -File `
        -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -in @(
            "adega.db",
            "adega.db-wal",
            "adega.db-shm"
        )
    }

if ($BancoNoPacote) {
    throw "Seguranca: banco encontrado dentro do pacote. Geracao cancelada."
}

$Zip = Join-Path $Out "AdegaPDV-Atualizacao-WebApp-$Version.zip"

if (Test-Path $Zip) {
    Remove-Item -LiteralPath $Zip -Force
}

Compress-Archive `
    -Path (Join-Path $Temp "*") `
    -DestinationPath $Zip `
    -CompressionLevel Optimal

Remove-Item -LiteralPath $Temp -Recurse -Force

Write-Host ""
Write-Host "Pacote WEBAPP criado e validado:" -ForegroundColor Green
Write-Host $Zip
Write-Host ""
Write-Host "Inclui dependencias Node para funcionar offline." -ForegroundColor Green
Write-Host "Banco e backups NAO foram incluidos." -ForegroundColor Green
