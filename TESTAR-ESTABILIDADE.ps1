param(
    [int]$CiclosBackup = 20
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)

$DistCandidate = Join-Path $ProjectRoot "dist"

if (
    Test-Path (
        Join-Path $DistCandidate "runtime\node.exe"
    )
) {
    $Root = $DistCandidate
}
else {
    $Root = $ProjectRoot
}

$Node = Join-Path $Root "runtime\node.exe"
$App = Join-Path $Root "app"
$Db = Join-Path $App "database\adega.db"
$Better = Join-Path $App "node_modules\better-sqlite3"
$Validator = Join-Path $App "utils\validarPacoteAtualizacao.js"
$Logs = Join-Path $Root "logs"

New-Item -ItemType Directory -Force -Path $Logs | Out-Null

$Stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$Report = Join-Path $Logs "teste-estabilidade-$Stamp.txt"
$Temp = Join-Path $env:TEMP ("AdegaPDV-Stability-" + [Guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Force -Path $Temp | Out-Null

$Passed = 0
$Failed = 0

function Registrar(
    [string]$Nome,
    [bool]$Ok,
    [string]$Detalhe = ""
) {
    if ($Ok) {
        $script:Passed++
        $status = "OK"
    }
    else {
        $script:Failed++
        $status = "FALHA"
    }

    $linha = "[{0}] {1} - {2}" -f $status, $Nome, $Detalhe
    Write-Host $linha
    Add-Content -LiteralPath $Report -Value $linha -Encoding UTF8
}

function ExigirArquivo(
    [string]$Nome,
    [string]$Caminho
) {
    $ok = Test-Path $Caminho
    Registrar $Nome $ok $Caminho

    if (-not $ok) {
        throw "Arquivo obrigatório ausente: $Caminho"
    }
}

try {
    Add-Content -LiteralPath $Report -Value "ADEGA PDV - TESTE DE ESTABILIDADE" -Encoding UTF8
    Add-Content -LiteralPath $Report -Value ("Data: " + (Get-Date)) -Encoding UTF8
    Add-Content -LiteralPath $Report -Value "" -Encoding UTF8

    ExigirArquivo "Runtime Node" $Node
    ExigirArquivo "Banco principal" $Db
    ExigirArquivo "better-sqlite3" $Better
    ExigirArquivo "Validador de atualização" $Validator

    $ScriptNode = Join-Path $Temp "stability-test.js"

    @'
const fs = require("fs");
const path = require("path");

(async () => {
    const appDir = process.argv[2];
    const dbPath = process.argv[3];
    const tempDir = process.argv[4];
    const cycles = Number(process.argv[5] || 20);

    const Database = require(
        path.join(
            appDir,
            "node_modules",
            "better-sqlite3"
        )
    );

    function validar(caminho) {
        const db =
            new Database(
                caminho,
                {
                    readonly: true,
                    fileMustExist: true
                }
            );

        try {
            const integrity =
                db.pragma(
                    "integrity_check",
                    {
                        simple: true
                    }
                );

            if (integrity !== "ok") {
                throw new Error(
                    "integrity_check=" +
                    integrity
                );
            }

            for (const tabela of ["produtos", "vendas"]) {
                const row =
                    db.prepare(`
                        SELECT name
                        FROM sqlite_master
                        WHERE type='table'
                        AND name=?
                    `).get(tabela);

                if (!row) {
                    throw new Error(
                        "Tabela ausente: " +
                        tabela
                    );
                }
            }
        }
        finally {
            db.close();
        }
    }

    validar(dbPath);

    for (let i = 1; i <= cycles; i++) {
        const origem =
            new Database(
                dbPath,
                {
                    fileMustExist: true
                }
            );

        const destino =
            path.join(
                tempDir,
                `backup-${i}.db`
            );

        try {
            await origem.backup(destino);
        }
        finally {
            origem.close();
        }

        validar(destino);

        const restaurado =
            path.join(
                tempDir,
                `restaurado-${i}.db`
            );

        fs.copyFileSync(
            destino,
            restaurado
        );

        validar(restaurado);

        fs.unlinkSync(destino);
        fs.unlinkSync(restaurado);
    }

    // Garante que lixo/corrupção não passe como banco válido.
    const corrompido =
        path.join(
            tempDir,
            "corrompido.db"
        );

    fs.writeFileSync(
        corrompido,
        Buffer.from(
            "NAO_E_SQLITE_" +
            Date.now()
        )
    );

    let corrupcaoRejeitada = false;

    try {
        validar(corrompido);
    }
    catch {
        corrupcaoRejeitada = true;
    }

    if (!corrupcaoRejeitada) {
        throw new Error(
            "Arquivo corrompido foi aceito."
        );
    }

    console.log(
        JSON.stringify({
            sucesso: true,
            ciclos: cycles,
            corrupcaoRejeitada: true
        })
    );
})().catch(erro => {
    console.error(
        erro &&
        erro.stack
            ? erro.stack
            : erro
    );

    process.exit(1);
});
'@ | Set-Content -LiteralPath $ScriptNode -Encoding UTF8

    & $Node `
        $ScriptNode `
        $App `
        $Db `
        $Temp `
        $CiclosBackup

    Registrar `
        "Backup/restauração em banco descartável" `
        ($LASTEXITCODE -eq 0) `
        "$CiclosBackup ciclos + integrity_check"

    # Validação estática de arquivos críticos.
    $ArquivosCriticos = @(
        "app\server.js",
        "app\routes\backup.js",
        "app\routes\atualizacao.js",
        "app\utils\validarPacoteAtualizacao.js",
        "ATUALIZAR-SISTEMA.ps1",
        "launcher\MainForm.cs"
    )

    foreach ($rel in $ArquivosCriticos) {
        $path = Join-Path $Root $rel
        Registrar `
            ("Arquivo crítico: " + $rel) `
            (Test-Path $path) `
            $path
    }

    $Resumo =
        "RESULTADO: $Passed OK / $Failed FALHAS"

    Add-Content -LiteralPath $Report -Value "" -Encoding UTF8
    Add-Content -LiteralPath $Report -Value $Resumo -Encoding UTF8

    Write-Host ""
    Write-Host $Resumo
    Write-Host "Relatório: $Report"

    if ($Failed -gt 0) {
        exit 1
    }

    exit 0
}
catch {
    Registrar "Execução do teste" $false $_.Exception.Message
    Write-Host "Relatório: $Report"
    exit 1
}
finally {
    Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue
}
