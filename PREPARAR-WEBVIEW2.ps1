$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Em algumas formas de execução do PowerShell, $ScriptDir pode vir vazio.
# Resolve a pasta do próprio arquivo de forma independente.
$ScriptDir = ""

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

$NodeVersion = "22.20.0"
$NodeFolderName = "node-v$NodeVersion-win-x64"
$NodeZipUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeFolderName.zip"
$DotnetInstallUrl = "https://dot.net/v1/dotnet-install.ps1"

# Ferramentas de build ficam fora da pasta do projeto.
# Isso evita o limite de caminhos do Windows durante a extração do .NET SDK
# (DotnetTools/dotnet-watch/MSBuild/BuildHost possui caminhos muito profundos).
$BaseFerramentas =
    if (
        -not [string]::IsNullOrWhiteSpace(
            $env:LOCALAPPDATA
        )
    ) {
        Join-Path $env:LOCALAPPDATA "AdegaPDV"
    }
    else {
        Join-Path $env:TEMP "AdegaPDV"
    }

$ToolsDir =
    Join-Path $BaseFerramentas "BuildTools"

$DownloadsDir =
    Join-Path $ToolsDir "downloads"

$NodeDir =
    Join-Path $ToolsDir "node22"

$DotnetDir =
    Join-Path $ToolsDir "dotnet8"

$NugetPackagesDir =
    Join-Path $ToolsDir "nuget"

$DotnetCliHome =
    Join-Path $ToolsDir "dotnet-home"

# Também mantém os caminhos usados pelo restore/publish curtos.
$env:NUGET_PACKAGES =
    $NugetPackagesDir

$env:DOTNET_CLI_HOME =
    $DotnetCliHome

$AppDir = Join-Path $ScriptDir "app"
$LauncherDir = Join-Path $ScriptDir "launcher"
$DistDir = Join-Path $ScriptDir "dist"

function Titulo([string]$texto) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " $texto" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Etapa([string]$texto) {
    Write-Host ""
    Write-Host ">> $texto" -ForegroundColor Yellow
}

function Falhar([string]$texto) {
    Write-Host ""
    Write-Host "[ERRO] $texto" -ForegroundColor Red
    Write-Host ""
    Write-Host "Nenhuma instalacao global de Python ou Visual Studio e necessaria." -ForegroundColor DarkGray
    Write-Host "Consulte PREPARAR-WEBVIEW2.log se precisar." -ForegroundColor DarkGray
    throw $texto
}

function Download-SeNecessario(
    [string]$Url,
    [string]$Destino
) {
    if (Test-Path $Destino) {
        return
    }

    $pasta = Split-Path $Destino -Parent
    New-Item -ItemType Directory -Force -Path $pasta | Out-Null

    Write-Host "Baixando: $Url"
    Invoke-WebRequest -Uri $Url -OutFile $Destino -UseBasicParsing
}

function Remover-PastaComTentativas([string]$Pasta) {
    if (-not (Test-Path $Pasta)) {
        return
    }

    for ($i = 1; $i -le 4; $i++) {
        try {
            Remove-Item -LiteralPath $Pasta -Recurse -Force -ErrorAction Stop
            return
        }
        catch {
            if ($i -eq 4) {
                Falhar @"
Nao foi possivel remover:
$Pasta

Feche qualquer terminal, servidor Node ou explorador que esteja usando a pasta
e execute PREPARAR-WEBVIEW2.bat novamente.
"@
            }

            Start-Sleep -Milliseconds 900
        }
    }
}

$LogFile = Join-Path $ScriptDir "PREPARAR-WEBVIEW2.log"

try {
    Start-Transcript -Path $LogFile -Force | Out-Null
}
catch {
    # Continua mesmo se o transcript nao puder iniciar.
}

try {
    Titulo "ADEGA PDV - GERADOR WEBVIEW2 V2"

    Write-Host "Esta versao NAO usa o Node.js instalado no Windows." -ForegroundColor Green
    Write-Host "Ela baixa uma copia portatil e controlada do Node.js 22 LTS." -ForegroundColor Green
    Write-Host "Tambem usa um .NET SDK local, sem alterar o Windows." -ForegroundColor Green

    if (-not [Environment]::Is64BitOperatingSystem) {
        Falhar "Esta compilacao foi preparada para Windows x64."
    }

    New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
    New-Item -ItemType Directory -Force -Path $DownloadsDir | Out-Null
    New-Item -ItemType Directory -Force -Path $NugetPackagesDir | Out-Null
    New-Item -ItemType Directory -Force -Path $DotnetCliHome | Out-Null

    Write-Host "Ferramentas temporarias/localizadas em:" -ForegroundColor DarkGray
    Write-Host "  $ToolsDir" -ForegroundColor DarkGray

    # --------------------------------------------------------
    # 1) Node 22 portatil
    # --------------------------------------------------------
    Etapa "1/7 - Preparando Node.js 22 LTS portatil"

    $NodeZip = Join-Path $DownloadsDir "$NodeFolderName.zip"
    Download-SeNecessario $NodeZipUrl $NodeZip

    $NodeExe = Join-Path $NodeDir "node.exe"
    $NpmCmd = Join-Path $NodeDir "npm.cmd"

    if (-not (Test-Path $NodeExe) -or -not (Test-Path $NpmCmd)) {
        $NodeTemp = Join-Path $ToolsDir "node-temp"
        Remover-PastaComTentativas $NodeTemp
        New-Item -ItemType Directory -Force -Path $NodeTemp | Out-Null

        try {
            Expand-Archive -Path $NodeZip -DestinationPath $NodeTemp -Force
        }
        catch {
            # Se o download ficou incompleto/corrompido, remove o cache para
            # que a próxima tentativa baixe o ZIP novamente.
            Remove-Item -LiteralPath $NodeZip -Force -ErrorAction SilentlyContinue
            Remover-PastaComTentativas $NodeTemp
            Falhar "O ZIP do Node.js está incompleto ou corrompido. Execute o preparador novamente para baixar outra cópia."
        }

        $extraido = Join-Path $NodeTemp $NodeFolderName

        if (-not (Test-Path (Join-Path $extraido "node.exe"))) {
            Falhar "O pacote do Node.js foi baixado, mas node.exe nao foi encontrado."
        }

        Remover-PastaComTentativas $NodeDir
        New-Item -ItemType Directory -Force -Path $NodeDir | Out-Null

        # Não usa Move-Item aqui. Em alguns Windows/PowerShell o Move-Item
        # de uma árvore recém-extraída pode falhar no meio da operação
        # (ex.: CHANGELOG.md "não existe"), deixando a pasta parcial.
        # Robocopy é mais tolerante e faz a cópia completa antes de apagar
        # a pasta temporária.
        & robocopy.exe `
            $extraido `
            $NodeDir `
            /E `
            /R:3 `
            /W:1 `
            /COPY:DAT `
            /DCOPY:DAT `
            /NFL `
            /NDL `
            /NJH `
            /NJS `
            /NP | Out-Null

        $CodigoRobocopy = $LASTEXITCODE

        if ($CodigoRobocopy -gt 7) {
            Remover-PastaComTentativas $NodeDir
            Falhar "Falha ao copiar o Node.js portátil. Robocopy: $CodigoRobocopy"
        }

        if (
            -not (Test-Path (Join-Path $NodeDir "node.exe")) -or
            -not (Test-Path (Join-Path $NodeDir "npm.cmd"))
        ) {
            Remover-PastaComTentativas $NodeDir
            Falhar "A cópia do Node.js portátil ficou incompleta."
        }

        Remover-PastaComTentativas $NodeTemp
    }

    $NodeVersao = & $NodeExe --version
    Write-Host "Node usado pelo pacote: $NodeVersao" -ForegroundColor Green

    if ($NodeVersao -ne "v$NodeVersion") {
        Falhar "Versao inesperada do Node portatil: $NodeVersao"
    }

    # --------------------------------------------------------
    # 2) Dependencias Node
    # --------------------------------------------------------
    Etapa "2/7 - Instalando dependencias do AdegaPDV"

    $NodeModules = Join-Path $AppDir "node_modules"
    Remover-PastaComTentativas $NodeModules

    Push-Location $AppDir
    try {
        # better-sqlite3 13 inclui binarios precompilados por plataforma.
        # --ignore-scripts impede que npm tente acionar node-gyp/Python.
        & $NpmCmd ci --omit=dev --ignore-scripts --no-audit --no-fund

        if ($LASTEXITCODE -ne 0) {
            Falhar "npm ci falhou."
        }
    }
    finally {
        Pop-Location
    }

    # --------------------------------------------------------
    # 3) Teste real do SQLite
    # --------------------------------------------------------
    Etapa "3/7 - Testando better-sqlite3 sem Python/node-gyp"

    $TesteSqlite = @'
const Database = require("better-sqlite3");
const db = new Database(":memory:");
db.exec("CREATE TABLE teste (id INTEGER PRIMARY KEY, nome TEXT)");
db.prepare("INSERT INTO teste (nome) VALUES (?)").run("ok");
const linha = db.prepare("SELECT nome FROM teste WHERE id = 1").get();
if (!linha || linha.nome !== "ok") process.exit(9);
db.close();
console.log("better-sqlite3 OK");
'@

    $TesteSqlitePath = Join-Path $AppDir "__teste_sqlite_webview2.js"
    Set-Content -LiteralPath $TesteSqlitePath -Value $TesteSqlite -Encoding UTF8

    Push-Location $AppDir
    try {
        & $NodeExe $TesteSqlitePath
        $CodigoSqlite = $LASTEXITCODE
    }
    finally {
        Pop-Location
        Remove-Item -LiteralPath $TesteSqlitePath -Force -ErrorAction SilentlyContinue
    }

    if ($CodigoSqlite -ne 0) {
        Falhar @"
O better-sqlite3 foi instalado, mas o binario Windows nao carregou.

A geracao foi interrompida antes de criar um aplicativo quebrado.
"@
    }

    Write-Host "SQLite nativo: OK" -ForegroundColor Green

    # --------------------------------------------------------
    # 4) .NET 8 SDK local
    # --------------------------------------------------------
    Etapa "4/7 - Preparando .NET 8 SDK local"

    $DotnetExe = Join-Path $DotnetDir "dotnet.exe"

    if (-not (Test-Path $DotnetExe)) {
        $DotnetInstallPs1 = Join-Path $DownloadsDir "dotnet-install.ps1"
        Download-SeNecessario $DotnetInstallUrl $DotnetInstallPs1

        # Se uma tentativa anterior parou no meio da extração, não reutiliza
        # a instalação parcial.
        if (Test-Path $DotnetDir) {
            Remover-PastaComTentativas $DotnetDir
        }

        New-Item -ItemType Directory -Force -Path $DotnetDir | Out-Null

        & powershell.exe `
            -NoProfile `
            -ExecutionPolicy Bypass `
            -File $DotnetInstallPs1 `
            -Channel "8.0" `
            -Architecture "x64" `
            -InstallDir $DotnetDir `
            -NoPath

        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $DotnetExe)) {
            Falhar @"
Nao foi possivel preparar o .NET 8 SDK local.

O instalador agora usa um caminho curto fora da pasta Downloads:
$DotnetDir

Se ainda falhar, apague a pasta acima e execute PREPARAR-WEBVIEW2.bat novamente.
"@
        }
    }

    $DotnetVersao = & $DotnetExe --version
    Write-Host ".NET SDK local: $DotnetVersao" -ForegroundColor Green

    # --------------------------------------------------------
    # 5) Montagem da distribuicao
    # --------------------------------------------------------
    Etapa "5/7 - Montando a pasta dist"

    Remover-PastaComTentativas $DistDir

    New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $DistDir "app") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $DistDir "runtime") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $DistDir "data") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $DistDir "logs") | Out-Null

    # Copia a aplicacao inteira JA com node_modules validado.
    & robocopy.exe `
        $AppDir `
        (Join-Path $DistDir "app") `
        /E `
        /XD "database" "backups" "logs" `
        /NFL /NDL /NJH /NJS /NP | Out-Null

    # Robocopy usa 0-7 como sucesso.
    if ($LASTEXITCODE -gt 7) {
        Falhar "Falha ao copiar os arquivos da aplicacao."
    }

    New-Item -ItemType Directory -Force -Path (Join-Path $DistDir "app\database") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $DistDir "app\backups") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $DistDir "app\logs") | Out-Null

    Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $DistDir "runtime\node.exe") -Force

    # --------------------------------------------------------
    # 6) Compila launcher
    # --------------------------------------------------------
    Etapa "6/7 - Compilando o launcher C# + WebView2"

    $PublishDir = Join-Path $DistDir "_launcher"

    & $DotnetExe publish `
        (Join-Path $LauncherDir "AdegaPDV.Launcher.csproj") `
        -c Release `
        -r win-x64 `
        --self-contained true `
        -p:PublishSingleFile=false `
        -p:DebugType=None `
        -p:DebugSymbols=false `
        -o $PublishDir

    if ($LASTEXITCODE -ne 0) {
        Falhar "Falha ao compilar o launcher WebView2."
    }

    $ExeGerado = Join-Path $PublishDir "AdegaPDV.exe"

    if (-not (Test-Path $ExeGerado)) {
        Falhar "A compilacao terminou, mas AdegaPDV.exe nao foi encontrado."
    }

    # Mantemos todas as DLLs self-contained ao lado do exe.
    Get-ChildItem -LiteralPath $PublishDir | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $DistDir -Recurse -Force
    }

    Remover-PastaComTentativas $PublishDir

    # --------------------------------------------------------
    # 7) Teste rapido da distribuicao Node
    # --------------------------------------------------------
    Etapa "7/7 - Validando a distribuicao final"

    $DistNode = Join-Path $DistDir "runtime\node.exe"
    $DistApp = Join-Path $DistDir "app"

    $TesteFinal = @'
const Database = require("better-sqlite3");
const db = new Database(":memory:");
const linha = db.prepare("select 1 as ok").get();

if (!linha || linha.ok !== 1) {
    process.exit(9);
}

db.close();
console.log("DIST SQLite OK");
'@

    $TesteFinalPath = Join-Path $DistApp "__teste_sqlite_dist.js"
    Set-Content -LiteralPath $TesteFinalPath -Value $TesteFinal -Encoding UTF8

    Push-Location $DistApp
    try {
        & $DistNode $TesteFinalPath
        $CodigoFinal = $LASTEXITCODE
    }
    finally {
        Pop-Location
        Remove-Item -LiteralPath $TesteFinalPath -Force -ErrorAction SilentlyContinue
    }

    if ($CodigoFinal -ne 0) {
        Falhar "A pasta dist foi criada, mas o teste final do SQLite falhou."
    }

    Copy-Item `
        -LiteralPath (Join-Path $ScriptDir "LEIA-ME-WEBVIEW2.txt") `
        -Destination (Join-Path $DistDir "LEIA-ME.txt") `
        -Force

    $IconeOrigem = Join-Path $LauncherDir "Resources\AdegaPDV.ico"
    if (Test-Path $IconeOrigem) {
        Copy-Item -LiteralPath $IconeOrigem -Destination (Join-Path $DistDir "AdegaPDV.ico") -Force
    }

    $AtualizadorOrigem = Join-Path $ScriptDir "installer\ATUALIZAR-SISTEMA.ps1"
    if (Test-Path $AtualizadorOrigem) {
        Copy-Item -LiteralPath $AtualizadorOrigem -Destination (Join-Path $DistDir "ATUALIZAR-SISTEMA.ps1") -Force
    }

    $TesteEstabilidadeOrigem =
        Join-Path $ScriptDir "TESTAR-ESTABILIDADE.ps1"

    if (Test-Path $TesteEstabilidadeOrigem) {
        Copy-Item `
            -LiteralPath $TesteEstabilidadeOrigem `
            -Destination (Join-Path $DistDir "TESTAR-ESTABILIDADE.ps1") `
            -Force
    }

    Titulo "PRONTO"

    Write-Host "Aplicativo gerado em:" -ForegroundColor Green
    Write-Host "  $DistDir" -ForegroundColor White
    Write-Host ""
    Write-Host "Abra:" -ForegroundColor Green
    Write-Host "  dist\AdegaPDV.exe" -ForegroundColor White
    Write-Host ""
    Write-Host "Para manter seus dados atuais, use:" -ForegroundColor Yellow
    Write-Host "  COPIAR-BANCO-ATUAL.bat" -ForegroundColor White
    Write-Host ""
    Write-Host "Esta geracao nao exigiu Python nem Visual Studio Build Tools." -ForegroundColor Green

}
catch {
    Write-Host ""
    Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    try { Stop-Transcript | Out-Null } catch {}
}
