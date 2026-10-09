const fs = require("fs");
const zlib = require("zlib");

const LIMITE_ARQUIVOS = 50000;
const LIMITE_DESCOMPRIMIDO = 2 * 1024 * 1024 * 1024; // 2 GiB
const LIMITE_ENTRADA = 1024 * 1024 * 1024; // 1 GiB

function caminhoSeguroZip(nome) {
    const bruto =
        String(nome || "")
            .replace(/\\/g, "/");

    if (
        !bruto ||
        bruto.includes("\0") ||
        bruto.startsWith("/") ||
        /^[a-zA-Z]:\//.test(bruto)
    ) {
        return false;
    }

    const partes =
        bruto.split("/");

    return !partes.some(
        parte =>
            parte === ".."
    );
}

function localizarEOCD(buffer) {
    const assinatura = 0x06054b50;
    const minimo = Math.max(
        0,
        buffer.length - 0xffff - 22
    );

    for (
        let i = buffer.length - 22;
        i >= minimo;
        i--
    ) {
        if (
            buffer.readUInt32LE(i) ===
            assinatura
        ) {
            return i;
        }
    }

    throw new Error(
        "ZIP_EOCD_NAO_ENCONTRADO"
    );
}

function lerDiretorioCentral(caminho) {
    const buffer =
        fs.readFileSync(caminho);

    const eocd =
        localizarEOCD(buffer);

    const quantidade =
        buffer.readUInt16LE(
            eocd + 10
        );

    const offsetCentral =
        buffer.readUInt32LE(
            eocd + 16
        );

    const entradas = [];
    let cursor =
        offsetCentral;

    for (
        let i = 0;
        i < quantidade;
        i++
    ) {
        if (
            buffer.readUInt32LE(cursor) !==
            0x02014b50
        ) {
            throw new Error(
                "ZIP_DIRETORIO_INVALIDO"
            );
        }

        const metodo =
            buffer.readUInt16LE(
                cursor + 10
            );

        const comprimido =
            buffer.readUInt32LE(
                cursor + 20
            );

        const original =
            buffer.readUInt32LE(
                cursor + 24
            );

        const tamanhoNome =
            buffer.readUInt16LE(
                cursor + 28
            );

        const tamanhoExtra =
            buffer.readUInt16LE(
                cursor + 30
            );

        const tamanhoComentario =
            buffer.readUInt16LE(
                cursor + 32
            );

        const offsetLocal =
            buffer.readUInt32LE(
                cursor + 42
            );

        const nome =
            buffer
                .subarray(
                    cursor + 46,
                    cursor + 46 +
                        tamanhoNome
                )
                .toString("utf8")
                .replace(/\\/g, "/");

        entradas.push({
            nome,
            metodo,
            comprimido,
            original,
            offsetLocal
        });

        cursor +=
            46 +
            tamanhoNome +
            tamanhoExtra +
            tamanhoComentario;
    }

    return {
        buffer,
        entradas
    };
}

function lerEntrada(
    zip,
    entrada
) {
    const buffer =
        zip.buffer;

    const cursor =
        entrada.offsetLocal;

    if (
        buffer.readUInt32LE(cursor) !==
        0x04034b50
    ) {
        throw new Error(
            "ZIP_ENTRADA_INVALIDA"
        );
    }

    const tamanhoNome =
        buffer.readUInt16LE(
            cursor + 26
        );

    const tamanhoExtra =
        buffer.readUInt16LE(
            cursor + 28
        );

    const inicio =
        cursor +
        30 +
        tamanhoNome +
        tamanhoExtra;

    const dados =
        buffer.subarray(
            inicio,
            inicio +
                entrada.comprimido
        );

    if (entrada.metodo === 0) {
        return Buffer.from(dados);
    }

    if (entrada.metodo === 8) {
        return zlib.inflateRawSync(
            dados
        );
    }

    throw new Error(
        "ZIP_COMPRESSAO_NAO_SUPORTADA"
    );
}

function normalizarNome(nome) {
    return String(nome || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
}

function validarPacoteAtualizacao(
    caminho
) {
    const zip =
        lerDiretorioCentral(caminho);

    const entradas =
        zip.entradas.filter(
            entrada =>
                entrada.nome &&
                !entrada.nome.endsWith("/")
        );

    if (entradas.length > LIMITE_ARQUIVOS) {
        throw new Error(
            "PACOTE_GRANDE"
        );
    }

    let totalOriginal = 0;
    const nomesVistos = new Set();

    for (const entrada of entradas) {
        if (!caminhoSeguroZip(entrada.nome)) {
            throw new Error(
                "CAMINHO_INSEGURO"
            );
        }

        if (
            entrada.original >
            LIMITE_ENTRADA
        ) {
            throw new Error(
                "PACOTE_GRANDE"
            );
        }

        totalOriginal +=
            entrada.original;

        if (
            totalOriginal >
            LIMITE_DESCOMPRIMIDO
        ) {
            throw new Error(
                "PACOTE_GRANDE"
            );
        }

        const nomeChave =
            normalizarNome(
                entrada.nome
            ).toLowerCase();

        if (nomesVistos.has(nomeChave)) {
            throw new Error(
                "ARQUIVO_DUPLICADO"
            );
        }

        nomesVistos.add(nomeChave);
    }

    const manifestos =
        entradas.filter(
            entrada =>
                normalizarNome(
                    entrada.nome
                )
                    .toLowerCase()
                    .endsWith(
                        "update-manifest.json"
                    )
        );

    if (!manifestos.length) {
        throw new Error(
            "MANIFESTO_AUSENTE"
        );
    }

    manifestos.sort(
        (a, b) =>
            a.nome.split("/").length -
            b.nome.split("/").length
    );

    const entradaManifesto =
        manifestos[0];

    const nomeManifesto =
        normalizarNome(
            entradaManifesto.nome
        );

    const prefixo =
        nomeManifesto.slice(
            0,
            nomeManifesto.length -
                "update-manifest.json"
                    .length
        );

    let manifesto;

    try {
        manifesto =
            JSON.parse(
                lerEntrada(
                    zip,
                    entradaManifesto
                ).toString("utf8")
                    .replace(
                        /^\uFEFF/,
                        ""
                    )
            );
    } catch {
        throw new Error(
            "MANIFESTO_INVALIDO"
        );
    }

    if (
        manifesto.produto !==
        "Adega PDV"
    ) {
        throw new Error(
            "PRODUTO_INVALIDO"
        );
    }

    const tipo =
        String(
            manifesto.tipo ||
            "full"
        ).toLowerCase();

    if (
        tipo !== "full" &&
        tipo !== "webapp"
    ) {
        throw new Error(
            "TIPO_INVALIDO"
        );
    }

    const nomes =
        new Set(
            entradas.map(
                entrada =>
                    normalizarNome(
                        entrada.nome
                    ).toLowerCase()
            )
        );

    const exige =
        nome =>
            nomes.has(
                (
                    prefixo +
                    nome
                ).toLowerCase()
            );

    if (
        !exige(
            "app/server.js"
        )
    ) {
        throw new Error(
            "APP_INCOMPLETO"
        );
    }

    if (
        tipo === "full" &&
        !exige(
            "AdegaPDV.exe"
        )
    ) {
        throw new Error(
            "FULL_SEM_EXE"
        );
    }

    const arquivosBanco =
        entradas.filter(
            entrada => {
                const nome =
                    normalizarNome(
                        entrada.nome
                    ).toLowerCase();

                return (
                    nome.endsWith(
                        "/adega.db"
                    ) ||
                    nome.endsWith(
                        "/adega.db-wal"
                    ) ||
                    nome.endsWith(
                        "/adega.db-shm"
                    ) ||
                    nome === "adega.db" ||
                    nome ===
                        "adega.db-wal" ||
                    nome ===
                        "adega.db-shm"
                );
            }
        );

    if (arquivosBanco.length) {
        throw new Error(
            "PACOTE_CONTEM_BANCO"
        );
    }

    return {
        produto:
            manifesto.produto,
        tipo,
        versao:
            String(
                manifesto.versao ||
                ""
            ),
        criado_em:
            manifesto.criado_em ||
            null,
        prefixo,
        arquivos:
            entradas.length
    };
}

module.exports = {
    validarPacoteAtualizacao
};
