param(
    [Parameter(Mandatory=$true)]
    [string]$ZipAtualizacao,

    [int]$ProcessId = 0,

    [string]$Executavel = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = [System.IO.Path]::GetFullPath($AppDir)
$ZipAtualizacao = [System.IO.Path]::GetFullPath($ZipAtualizacao)

if ([string]::IsNullOrWhiteSpace($Executavel)) {
    $Executavel = Join-Path $AppDir "AdegaPDV.exe"
}
else {
    $Executavel = [System.IO.Path]::GetFullPath($Executavel)
}

$LogDir = Join-Path $AppDir "logs"
$LogFile = Join-Path $LogDir "atualizacao.log"
$DbDir = Join-Path $AppDir "app\database"
$Db = Join-Path $DbDir "adega.db"
$Backups = Join-Path $AppDir "app\backups\antes-atualizacao"
$Temp = Join-Path $env:TEMP ("AdegaPDV-Update-" + [Guid]::NewGuid().ToString("N"))
$MetadataPendente = Join-Path $AppDir "app\temp\atualizacao-pendente.json"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Log([string]$Texto) {
    $linha = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Texto
    Add-Content -LiteralPath $LogFile -Value $linha -Encoding UTF8
}

function Encontrar-RaizPacote([string]$PastaExtraida) {
    $direto = Join-Path $PastaExtraida "update-manifest.json"

    if (Test-Path $direto) {
        return $PastaExtraida
    }

    # Aceita ZIP com uma ou mais pastas "embrulho", sem depender do nome.
    $manifestos = @(
        Get-ChildItem `
            -LiteralPath $PastaExtraida `
            -Recurse `
            -File `
            -Filter "update-manifest.json" `
            -ErrorAction SilentlyContinue |
        Sort-Object { $_.FullName.Length }
    )

    foreach ($manifesto in $manifestos) {
        $raiz = Split-Path -Parent $manifesto.FullName

        if (Test-Path (Join-Path $raiz "app\server.js")) {
            return $raiz
        }
    }

    return $null
}

function Ler-Manifesto([string]$Raiz) {
    $manifestPath = Join-Path $Raiz "update-manifest.json"

    if (-not (Test-Path $manifestPath)) {
        throw "Pacote invalido: update-manifest.json nao foi encontrado."
    }

    try {
        return (
            Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 |
            ConvertFrom-Json
        )
    }
    catch {
        throw "Pacote invalido: o manifesto da atualizacao esta corrompido."
    }
}

function Validar-Pacote(
    [string]$Raiz,
    $Manifesto
) {
    if ($Manifesto.produto -ne "Adega PDV") {
        throw "Pacote rejeitado: produto incorreto no manifesto."
    }

    $tipo =
        if ($Manifesto.tipo) {
            ([string]$Manifesto.tipo).ToLowerInvariant()
        }
        else {
            "full"
        }

    if (
        $tipo -ne "full" -and
        $tipo -ne "webapp"
    ) {
        throw "Pacote rejeitado: tipo deve ser full ou webapp."
    }

    if (-not (Test-Path (Join-Path $Raiz "app\server.js"))) {
        throw "Pacote incompleto: app\server.js nao foi encontrado."
    }

    if (
        $tipo -eq "full" -and
        -not (Test-Path (Join-Path $Raiz "AdegaPDV.exe"))
    ) {
        throw "Pacote FULL incompleto: AdegaPDV.exe nao foi encontrado."
    }

    $bancoNoPacote =
        Get-ChildItem `
            -LiteralPath $Raiz `
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

    if ($bancoNoPacote) {
        throw "Pacote rejeitado por seguranca: a atualizacao contem arquivos do banco."
    }

    return $tipo
}

function Tentar-CheckpointBanco {
    if (-not (Test-Path $Db)) {
        return
    }

    $Node = Join-Path $AppDir "runtime\node.exe"
    $Better = Join-Path $AppDir "app\node_modules\better-sqlite3"

    if (
        -not (Test-Path $Node) -or
        -not (Test-Path $Better)
    ) {
        Log "Checkpoint SQLite ignorado: runtime/modulo nao disponivel."
        return
    }

    $ScriptCheckpoint =
        Join-Path $env:TEMP ("adega-checkpoint-" + [Guid]::NewGuid().ToString("N") + ".js")

    @'
const path = require("path");
const appDir = process.argv[2];
const dbPath = process.argv[3];
const Database = require(path.join(appDir, "node_modules", "better-sqlite3"));
const db = new Database(dbPath);
db.pragma("wal_checkpoint(TRUNCATE)");
db.close();
'@ | Set-Content -LiteralPath $ScriptCheckpoint -Encoding UTF8

    try {
        & $Node $ScriptCheckpoint (Join-Path $AppDir "app") $Db | Out-Null

        if ($LASTEXITCODE -eq 0) {
            Log "Checkpoint SQLite concluido."
        }
        else {
            Log "Checkpoint SQLite retornou codigo $LASTEXITCODE. Sera criado snapshot incluindo WAL/SHM."
        }
    }
    catch {
        Log ("Checkpoint SQLite falhou: " + $_.Exception.Message)
    }
    finally {
        Remove-Item -LiteralPath $ScriptCheckpoint -Force -ErrorAction SilentlyContinue
    }
}


function Criar-BackupSqliteConsistente(
    [string]$Destino
) {
    if (-not (Test-Path $Db)) {
        return $false
    }

    $Node = Join-Path $AppDir "runtime\node.exe"
    $Better = Join-Path $AppDir "app\node_modules\better-sqlite3"

    if (
        -not (Test-Path $Node) -or
        -not (Test-Path $Better)
    ) {
        Log "Backup SQLite via API indisponivel: runtime/modulo nao encontrado."
        return $false
    }

    $ScriptBackup =
        Join-Path $env:TEMP ("adega-backup-seguro-" + [Guid]::NewGuid().ToString("N") + ".js")

    @'
const path = require("path");

(async () => {
    const appDir = process.argv[2];
    const dbPath = process.argv[3];
    const destino = process.argv[4];

    const Database = require(
        path.join(
            appDir,
            "node_modules",
            "better-sqlite3"
        )
    );

    const db =
        new Database(
            dbPath,
            {
                fileMustExist: true
            }
        );

    try {
        await db.backup(destino);
    }
    finally {
        db.close();
    }

    const teste =
        new Database(
            destino,
            {
                readonly: true,
                fileMustExist: true
            }
        );

    try {
        const resultado =
            teste.pragma(
                "integrity_check",
                {
                    simple: true
                }
            );

        if (resultado !== "ok") {
            throw new Error(
                "integrity_check retornou: " +
                resultado
            );
        }
    }
    finally {
        teste.close();
    }
})().catch(erro => {
    console.error(erro);
    process.exit(1);
});
'@ | Set-Content -LiteralPath $ScriptBackup -Encoding UTF8

    try {
        & $Node `
            $ScriptBackup `
            (Join-Path $AppDir "app") `
            $Db `
            $Destino | Out-Null

        if (
            $LASTEXITCODE -eq 0 -and
            (Test-Path $Destino) -and
            (Get-Item -LiteralPath $Destino).Length -gt 0
        ) {
            Log "Backup SQLite consistente criado e validado."
            return $true
        }

        Log "Backup SQLite via API falhou. Sera usado fallback com snapshot."
        Remove-Item -LiteralPath $Destino -Force -ErrorAction SilentlyContinue
        return $false
    }
    catch {
        Log ("Backup SQLite via API falhou: " + $_.Exception.Message)
        Remove-Item -LiteralPath $Destino -Force -ErrorAction SilentlyContinue
        return $false
    }
    finally {
        Remove-Item -LiteralPath $ScriptBackup -Force -ErrorAction SilentlyContinue
    }
}

function Criar-BackupBanco {
    if (-not (Test-Path $Db)) {
        Log "Banco principal nao existe; backup pre-atualizacao nao necessario."
        return
    }

    New-Item -ItemType Directory -Force -Path $Backups | Out-Null

    Tentar-CheckpointBanco

    $Stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $Snapshot = Join-Path $Backups "snapshot_$Stamp"

    New-Item -ItemType Directory -Force -Path $Snapshot | Out-Null

    foreach ($nome in @("adega.db", "adega.db-wal", "adega.db-shm")) {
        $origem = Join-Path $DbDir $nome

        if (Test-Path $origem) {
            Copy-Item `
                -LiteralPath $origem `
                -Destination (Join-Path $Snapshot $nome) `
                -Force
        }
    }

    # Mantém também o formato .db já conhecido pelo sistema/usuário.
    # Prioriza a API de backup do SQLite, que continua consistente mesmo
    # em modo WAL. O snapshot DB/WAL/SHM permanece como segunda camada.
    $BackupDb = Join-Path $Backups "adega_antes_atualizacao_$Stamp.db"

    $BackupConsistente =
        Criar-BackupSqliteConsistente $BackupDb

    if (-not $BackupConsistente) {
        Copy-Item -LiteralPath $Db -Destination $BackupDb -Force
        Log "Backup .db criado por fallback apos snapshot SQLite."
    }

    if (
        -not (Test-Path $BackupDb) -or
        (Get-Item -LiteralPath $BackupDb).Length -le 0
    ) {
        throw "Falha ao validar o backup do banco antes da atualizacao."
    }

    Log "Backup do banco criado: $BackupDb"
    Log "Snapshot SQLite criado: $Snapshot"
}

function Copiar-ComRobocopy(
    [string]$Origem,
    [string]$Destino,
    [string[]]$ExcluirPastas
) {
    $args = @(
        $Origem,
        $Destino,
        "/E",
        "/R:2",
        "/W:1",
        "/COPY:DAT",
        "/DCOPY:DAT",
        "/NFL",
        "/NDL",
        "/NJH",
        "/NJS",
        "/NP",
        "/XF",
        "adega.db",
        "adega.db-wal",
        "adega.db-shm"
    )

    if ($ExcluirPastas.Count -gt 0) {
        $args += "/XD"
        $args += $ExcluirPastas
    }

    & robocopy.exe @args | Out-Null

    if ($LASTEXITCODE -gt 7) {
        throw "Falha ao copiar os arquivos da atualizacao. Robocopy: $LASTEXITCODE"
    }
}


function Validar-ZipAntesExtrair {
    $Node = Join-Path $AppDir "runtime\node.exe"
    $Validator = Join-Path $AppDir "app\utils\validarPacoteAtualizacao.js"

    if (
        -not (Test-Path $Node) -or
        -not (Test-Path $Validator)
    ) {
        Log "Validador pre-extracao indisponivel; sera usada a validacao estrutural posterior."
        return
    }

    $ScriptValidacao =
        Join-Path $env:TEMP ("adega-validar-update-" + [Guid]::NewGuid().ToString("N") + ".js")

    @'
const { validarPacoteAtualizacao } =
    require(process.argv[2]);

try {
    const resultado =
        validarPacoteAtualizacao(
            process.argv[3]
        );

    console.log(
        JSON.stringify(
            resultado
        )
    );
}
catch (erro) {
    console.error(
        erro &&
        erro.message
            ? erro.message
            : erro
    );

    process.exit(1);
}
'@ | Set-Content -LiteralPath $ScriptValidacao -Encoding UTF8

    try {
        & $Node `
            $ScriptValidacao `
            $Validator `
            $ZipAtualizacao | Out-Null

        if ($LASTEXITCODE -ne 0) {
            throw "Pacote rejeitado pela validacao de seguranca antes da extracao."
        }

        Log "Pacote passou pela validacao de seguranca pre-extracao."
    }
    finally {
        Remove-Item `
            -LiteralPath $ScriptValidacao `
            -Force `
            -ErrorAction SilentlyContinue
    }
}

try {
    Log "Iniciando atualizacao."

    if (-not (Test-Path $ZipAtualizacao)) {
        throw "Pacote de atualizacao nao encontrado."
    }

    Validar-ZipAntesExtrair

    if ($ProcessId -gt 0) {
        Log "Aguardando processo $ProcessId encerrar."

        $limite = (Get-Date).AddSeconds(45)

        while (
            (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) -and
            ((Get-Date) -lt $limite)
        ) {
            Start-Sleep -Milliseconds 350
        }

        if (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
            throw "O Adega PDV nao fechou a tempo. Feche-o e tente novamente."
        }
    }

    Criar-BackupBanco

    New-Item -ItemType Directory -Force -Path $Temp | Out-Null

    Log "Extraindo pacote."
    Expand-Archive -LiteralPath $ZipAtualizacao -DestinationPath $Temp -Force

    $RaizPacote = Encontrar-RaizPacote $Temp

    if (-not $RaizPacote) {
        throw @"
Pacote rejeitado: estrutura de atualizacao do Adega PDV nao encontrada.

O ZIP precisa conter:
- update-manifest.json
- app\server.js

Pacote FULL tambem precisa conter AdegaPDV.exe.

Gere pelo proprio projeto com:
CRIAR-PACOTE-ATUALIZACAO.bat
ou
CRIAR-ATUALIZACAO-WEBAPP.bat
"@
    }

    $Manifesto = Ler-Manifesto $RaizPacote
    $TipoPacote = Validar-Pacote $RaizPacote $Manifesto

    Log "Pacote validado: tipo=$TipoPacote versao=$($Manifesto.versao)."

    if ($TipoPacote -eq "full") {
        Log "Aplicando pacote FULL."

        Copiar-ComRobocopy `
            $RaizPacote `
            $AppDir `
            @(
                "database",
                "backups",
                "data",
                "logs",
                "temp"
            )
    }
    else {
        Log "Aplicando pacote WEBAPP."

        $OrigemApp = Join-Path $RaizPacote "app"
        $DestinoApp = Join-Path $AppDir "app"

        Copiar-ComRobocopy `
            $OrigemApp `
            $DestinoApp `
            @(
                "database",
                "backups",
                "logs",
                "temp"
            )

        $AtualizadorNovo =
            Join-Path $RaizPacote "ATUALIZAR-SISTEMA.ps1"

        if (Test-Path $AtualizadorNovo) {
            Copy-Item `
                -LiteralPath $AtualizadorNovo `
                -Destination (Join-Path $AppDir "ATUALIZAR-SISTEMA.ps1") `
                -Force
        }
    }

    # Validação pós-cópia sem tocar nos dados.
    if (-not (Test-Path (Join-Path $AppDir "app\server.js"))) {
        throw "Validacao pos-atualizacao falhou: app\server.js ausente."
    }

    if (-not (Test-Path $Executavel)) {
        throw "Validacao pos-atualizacao falhou: AdegaPDV.exe ausente."
    }

    if (Test-Path $Db) {
        Log "Banco preservado apos atualizacao: $Db"
    }

    Log "Atualizacao concluida com sucesso."

    Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $ZipAtualizacao -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $MetadataPendente -Force -ErrorAction SilentlyContinue

    Log "Reiniciando Adega PDV."
    Start-Process -FilePath $Executavel -WorkingDirectory $AppDir
}
catch {
    Log ("ERRO: " + $_.Exception.Message)

    Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue

    Add-Type -AssemblyName PresentationFramework -ErrorAction SilentlyContinue

    try {
        [System.Windows.MessageBox]::Show(
            "A atualizacao nao pode ser concluida.`n`n$($_.Exception.Message)`n`nSeu banco e seus backups nao foram substituidos.`nVeja logs\atualizacao.log.",
            "Adega PDV - Atualizacao",
            "OK",
            "Error"
        ) | Out-Null
    }
    catch {}

    if (Test-Path $Executavel) {
        Start-Process -FilePath $Executavel -WorkingDirectory $AppDir
    }

    exit 1
}
