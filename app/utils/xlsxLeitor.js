const zlib = require("zlib");

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
        "XLSX_ZIP_INVALIDO"
    );
}

function lerDiretorioCentral(buffer) {
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

    const entradas =
        new Map();

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
                "XLSX_ZIP_INVALIDO"
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

        entradas.set(
            nome.toLowerCase(),
            {
                nome,
                metodo,
                comprimido,
                offsetLocal
            }
        );

        cursor +=
            46 +
            tamanhoNome +
            tamanhoExtra +
            tamanhoComentario;
    }

    return entradas;
}

function extrairEntrada(
    buffer,
    entrada
) {
    if (!entrada) {
        return null;
    }

    const cursor =
        entrada.offsetLocal;

    if (
        buffer.readUInt32LE(cursor) !==
        0x04034b50
    ) {
        throw new Error(
            "XLSX_ZIP_INVALIDO"
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
        return Buffer.from(
            dados
        );
    }

    if (entrada.metodo === 8) {
        return zlib.inflateRawSync(
            dados
        );
    }

    throw new Error(
        "XLSX_COMPRESSAO_NAO_SUPORTADA"
    );
}

function xmlDecode(valor) {
    return String(valor || "")
        .replace(/&#(\d+);/g, (_, n) =>
            String.fromCodePoint(
                Number(n)
            )
        )
        .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
            String.fromCodePoint(
                parseInt(n, 16)
            )
        )
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
}

function textosTagT(xml) {
    const valores = [];
    const regex =
        /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/gi;

    let match;

    while (
        (match = regex.exec(xml))
    ) {
        valores.push(
            xmlDecode(
                match[1]
            )
        );
    }

    return valores.join("");
}

function lerSharedStrings(
    buffer,
    entradas
) {
    const entrada =
        entradas.get(
            "xl/sharedstrings.xml"
        );

    if (!entrada) {
        return [];
    }

    const xml =
        extrairEntrada(
            buffer,
            entrada
        ).toString("utf8");

    const valores = [];
    const regex =
        /<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/gi;

    let match;

    while (
        (match = regex.exec(xml))
    ) {
        valores.push(
            textosTagT(
                match[1]
            )
        );
    }

    return valores;
}

function colunaParaIndice(
    referencia
) {
    const letras =
        String(referencia || "")
            .match(/^[A-Z]+/i)?.[0]
            ?.toUpperCase() || "";

    let indice = 0;

    for (
        const letra of letras
    ) {
        indice =
            indice * 26 +
            (
                letra.charCodeAt(0) -
                64
            );
    }

    return Math.max(
        0,
        indice - 1
    );
}

function normalizarTarget(
    target
) {
    let valor =
        String(target || "")
            .replace(/\\/g, "/")
            .replace(/^\/+/, "");

    valor =
        valor.replace(
            /^\.\//,
            ""
        );

    while (
        valor.startsWith("../")
    ) {
        valor =
            valor.slice(3);
    }

    if (
        valor.startsWith(
            "xl/"
        )
    ) {
        return valor;
    }

    return `xl/${valor}`
        .replace(
            /\/+/g,
            "/"
        );
}

function localizarPrimeiraPlanilha(
    buffer,
    entradas
) {
    const workbook =
        entradas.get(
            "xl/workbook.xml"
        );

    const rels =
        entradas.get(
            "xl/_rels/workbook.xml.rels"
        );

    if (
        workbook &&
        rels
    ) {
        const workbookXml =
            extrairEntrada(
                buffer,
                workbook
            ).toString("utf8");

        const sheet =
            workbookXml.match(
                /<(?:\w+:)?sheet\b[^>]*\br:id="([^"]+)"[^>]*>/i
            );

        if (sheet) {
            const relsXml =
                extrairEntrada(
                    buffer,
                    rels
                ).toString("utf8");

            const regex =
                /<Relationship\b([^>]*)\/?>/gi;

            let rel;

            while (
                (rel = regex.exec(relsXml))
            ) {
                const attrs =
                    rel[1];

                const id =
                    attrs.match(
                        /\bId="([^"]+)"/i
                    )?.[1];

                const target =
                    attrs.match(
                        /\bTarget="([^"]+)"/i
                    )?.[1];

                if (
                    id === sheet[1] &&
                    target
                ) {
                    const caminho =
                        normalizarTarget(
                            target
                        );

                    const entrada =
                        entradas.get(
                            caminho.toLowerCase()
                        );

                    if (entrada) {
                        return entrada;
                    }
                }
            }
        }
    }

    const candidatas =
        [...entradas.values()]
            .filter(
                entrada =>
                    /^xl\/worksheets\/sheet\d+\.xml$/i
                        .test(
                            entrada.nome
                        )
            )
            .sort(
                (a, b) =>
                    a.nome.localeCompare(
                        b.nome,
                        undefined,
                        {
                            numeric: true
                        }
                    )
            );

    return candidatas[0] || null;
}

function valorCelula(
    xml,
    sharedStrings
) {
    const tipo =
        xml.match(
            /<(?:\w+:)?c\b[^>]*\bt="([^"]+)"/i
        )?.[1] || "";

    if (
        tipo === "inlineStr"
    ) {
        return textosTagT(
            xml
        );
    }

    const valor =
        xml.match(
            /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/i
        )?.[1] ?? "";

    const decodificado =
        xmlDecode(
            valor
        );

    if (tipo === "s") {
        const indice =
            Number(
                decodificado
            );

        return Number.isInteger(
            indice
        )
            ? (
                sharedStrings[
                    indice
                ] ?? ""
            )
            : "";
    }

    if (tipo === "b") {
        return decodificado === "1"
            ? "1"
            : "0";
    }

    if (
        tipo === "str" ||
        tipo === "e"
    ) {
        return decodificado;
    }

    return decodificado;
}

function parseXlsxBuffer(
    buffer
) {
    if (
        !Buffer.isBuffer(
            buffer
        ) ||
        buffer.length < 4 ||
        buffer[0] !== 0x50 ||
        buffer[1] !== 0x4b
    ) {
        throw new Error(
            "XLSX_INVALIDO"
        );
    }

    const entradas =
        lerDiretorioCentral(
            buffer
        );

    if (
        !entradas.has(
            "[content_types].xml"
        )
    ) {
        throw new Error(
            "XLSX_INVALIDO"
        );
    }

    const sharedStrings =
        lerSharedStrings(
            buffer,
            entradas
        );

    const planilha =
        localizarPrimeiraPlanilha(
            buffer,
            entradas
        );

    if (!planilha) {
        throw new Error(
            "XLSX_SEM_PLANILHA"
        );
    }

    const xml =
        extrairEntrada(
            buffer,
            planilha
        ).toString("utf8");

    const linhas = [];
    const rows =
        xml.match(
            /<(?:\w+:)?row\b[^>]*>[\s\S]*?<\/(?:\w+:)?row>/gi
        ) || [];

    for (
        const row of rows
    ) {
        const linha = [];

        // Células vazias auto-fechadas precisam ser reconhecidas
        // ANTES das células com conteúdo. Caso contrário, um trecho como:
        // <c r="I2" /><c r="J2"><v>1</v></c>
        // pode ser interpretado como se o valor de J2 pertencesse a I2.
        const regexCelula =
            /<(?:\w+:)?c\b[^>]*\br="([^"]+)"[^>]*\/>|<(?:\w+:)?c\b[^>]*\br="([^"]+)"[^>]*>[\s\S]*?<\/(?:\w+:)?c>/gi;

        let cell;

        while (
            (cell =
                regexCelula.exec(row))
        ) {
            const referencia =
                cell[1] ||
                cell[2] ||
                "";

            const indice =
                colunaParaIndice(
                    referencia
                );

            linha[indice] =
                valorCelula(
                    cell[0],
                    sharedStrings
                );
        }

        while (
            linha.length &&
            (
                linha[
                    linha.length - 1
                ] === undefined ||
                linha[
                    linha.length - 1
                ] === ""
            )
        ) {
            linha.pop();
        }

        linhas.push(
            linha.map(
                valor =>
                    valor === undefined
                        ? ""
                        : valor
            )
        );
    }

    return linhas.filter(
        linha =>
            linha.some(
                valor =>
                    String(
                        valor ?? ""
                    ).trim() !== ""
            )
    );
}

module.exports = {
    parseXlsxBuffer
};
