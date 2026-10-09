$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ScriptDir

$Dist = Join-Path $ScriptDir "dist"
$Out = Join-Path $ScriptDir "atualizacoes"
$Temp = Join-Path $ScriptDir ".update-temp"

if (-not (Test-Path (Join-Path $Dist "AdegaPDV.exe"))) {
    throw "Execute PREPARAR-WEBVIEW2.bat antes de criar o pacote completo."
}

if (-not (Test-Path (Join-Path $Dist "app\server.js"))) {
    throw "A pasta dist esta incompleta: app\server.js nao foi encontrado."
}

if (Test-Path $Temp) {
    Remove-Item -LiteralPath $Temp -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $Temp | Out-Null
New-Item -ItemType Directory -Force -Path $Out | Out-Null

& robocopy.exe `
    $Dist `
    $Temp `
    /E `
    /R:2 `
    /W:1 `
    /XD "database" "backups" "data" "logs" "temp" `
    /XF "adega.db" "adega.db-wal" "adega.db-shm" `
    /NFL /NDL /NJH /NJS /NP | Out-Null

if ($LASTEXITCODE -gt 7) {
    throw "Falha ao preparar os arquivos da atualizacao."
}

$Version = "2.1.7"

$Manifest = @{
    produto = "Adega PDV"
    formato = 2
    tipo = "full"
    versao = $Version
    criado_em = (Get-Date).ToString("o")
    preserva = @(
        "app/database",
        "app/backups",
        "data",
        "logs",
        "temp"
    )
} | ConvertTo-Json -Depth 5

Set-Content `
    -LiteralPath (Join-Path $Temp "update-manifest.json") `
    -Value $Manifest `
    -Encoding UTF8

# Segurança: pacote de atualização nunca pode carregar o banco.
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

$Zip = Join-Path $Out "AdegaPDV-Atualizacao-$Version.zip"

if (Test-Path $Zip) {
    Remove-Item -LiteralPath $Zip -Force
}

Compress-Archive `
    -Path (Join-Path $Temp "*") `
    -DestinationPath $Zip `
    -CompressionLevel Optimal

Remove-Item -LiteralPath $Temp -Recurse -Force

Write-Host ""
Write-Host "Pacote FULL criado e validado:" -ForegroundColor Green
Write-Host $Zip
Write-Host ""
Write-Host "Banco, backups, data, logs e temp NAO foram incluidos." -ForegroundColor Green
Write-Host "Selecione esse ZIP em Sistema > Atualizacao." -ForegroundColor Yellow
