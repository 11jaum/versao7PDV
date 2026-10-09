const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const appDir =
    path.resolve(
        __dirname,
        ".."
    );

const ignorarPastas =
    new Set([
        "node_modules",
        "database",
        "backups",
        "temp",
        "logs"
    ]);

function listarJs(pasta) {
    const arquivos = [];

    for (
        const entrada of
        fs.readdirSync(
            pasta,
            {
                withFileTypes: true
            }
        )
    ) {
        if (
            entrada.isDirectory() &&
            ignorarPastas.has(
                entrada.name
            )
        ) {
            continue;
        }

        const completo =
            path.join(
                pasta,
                entrada.name
            );

        if (entrada.isDirectory()) {
            arquivos.push(
                ...listarJs(
                    completo
                )
            );
            continue;
        }

        if (
            entrada.isFile() &&
            entrada.name
                .toLowerCase()
                .endsWith(".js")
        ) {
            arquivos.push(
                completo
            );
        }
    }

    return arquivos;
}

function verificarJavaScript() {
    const arquivos =
        listarJs(
            appDir
        );

    const falhas = [];

    for (
        const arquivo of
        arquivos
    ) {
        const resultado =
            spawnSync(
                process.execPath,
                [
                    "--check",
                    arquivo
                ],
                {
                    encoding:
                        "utf8"
                }
            );

        if (
            resultado.status !== 0
        ) {
            falhas.push({
                arquivo:
                    path.relative(
                        appDir,
                        arquivo
                    ),
                erro:
                    String(
                        resultado.stderr ||
                        resultado.stdout ||
                        "Erro de sintaxe"
                    ).trim()
            });
        }
    }

    return {
        arquivos:
            arquivos.length,
        falhas
    };
}

function verificarIdsHtml() {
    const arquivo =
        path.join(
            appDir,
            "public",
            "index.html"
        );

    const html =
        fs.readFileSync(
            arquivo,
            "utf8"
        );

    const regex =
        /\bid="([^"]+)"/g;

    const contagem =
        new Map();

    let match;

    while (
        (
            match =
                regex.exec(html)
        )
    ) {
        const id =
            match[1];

        contagem.set(
            id,
            (
                contagem.get(id) ||
                0
            ) + 1
        );
    }

    return Array.from(
        contagem.entries()
    )
        .filter(
            ([, total]) =>
                total > 1
        )
        .map(
            ([id, total]) => ({
                id,
                total
            })
        );
}

const js =
    verificarJavaScript();

const idsDuplicados =
    verificarIdsHtml();

console.log(
    `JavaScript verificado: ${js.arquivos} arquivo(s).`
);

if (js.falhas.length) {
    for (
        const falha of
        js.falhas
    ) {
        console.error(
            `ERRO: ${falha.arquivo}`
        );
        console.error(
            falha.erro
        );
    }
}

if (idsDuplicados.length) {
    for (
        const item of
        idsDuplicados
    ) {
        console.error(
            `ID HTML duplicado: ${item.id} (${item.total}x)`
        );
    }
}

if (
    js.falhas.length ||
    idsDuplicados.length
) {
    process.exit(1);
}

console.log(
    "Verificação concluída sem erros."
);
