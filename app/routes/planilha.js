const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const db = require("../database");
const registrarAuditoria =
    require("../utils/auditoria");

const {
    parseXlsxBuffer
} = require(
    "../utils/xlsxLeitor"
);

const router = express.Router();

const pastaTemp =
    path.join(
        __dirname,
        "..",
        "temp"
    );

fs.mkdirSync(
    pastaTemp,
    {
        recursive: true
    }
);

const upload = multer({
    dest: pastaTemp,
    limits: {
        fileSize:
            30 * 1024 * 1024
    }
});

const COLUNAS = [
    "codigo_barras",
    "nome",
    "categoria",
    "preco_custo",
    "preco_venda",
    "quantidade",
    "estoque_minimo",
    "unidade",
    "data_validade",
    "ativo",
    "tipo_estoque"
];

const PREVIEW_TTL_MS =
    30 * 60 * 1000;

function normalizarCabecalho(
    valor
) {
    return String(valor || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-z0-9]+/g,
            "_"
        )
        .replace(
            /^_+|_+$/g,
            ""
        );
}

function csvEscape(
    valor
) {
    const texto =
        valor === null ||
        valor === undefined
            ? ""
            : String(valor);

    if (
        texto.includes(";") ||
        texto.includes('"') ||
        texto.includes("\n") ||
        texto.includes("\r")
    ) {
        return `"${texto.replace(
            /"/g,
            '""'
        )}"`;
    }

    return texto;
}

function parseCsv(
    texto
) {
    texto =
        String(texto || "")
            .replace(
                /^\uFEFF/,
                ""
            );

    const primeiraLinha =
        texto.split(
            /\r?\n/,
            1
        )[0] || "";

    const delimitador =
        (
            primeiraLinha.match(
                /;/g
            ) || []
        ).length >=
        (
            primeiraLinha.match(
                /,/g
            ) || []
        ).length
            ? ";"
            : ",";

    const linhas = [];
    let linha = [];
    let campo = "";
    let emAspas = false;

    for (
        let i = 0;
        i < texto.length;
        i++
    ) {
        const char =
            texto[i];

        if (emAspas) {
            if (
                char === '"'
            ) {
                if (
                    texto[i + 1] ===
                    '"'
                ) {
                    campo += '"';
                    i++;
                } else {
                    emAspas = false;
                }
            } else {
                campo += char;
            }

            continue;
        }

        if (char === '"') {
            emAspas = true;
        } else if (
            char === delimitador
        ) {
            linha.push(campo);
            campo = "";
        } else if (
            char === "\n"
        ) {
            linha.push(
                campo.replace(
                    /\r$/,
                    ""
                )
            );

            linhas.push(
                linha
            );

            linha = [];
            campo = "";
        } else {
            campo += char;
        }
    }

    if (
        campo.length ||
        linha.length
    ) {
        linha.push(
            campo.replace(
                /\r$/,
                ""
            )
        );

        linhas.push(
            linha
        );
    }

    return linhas.filter(
        atual =>
            atual.some(
                valor =>
                    String(
                        valor || ""
                    ).trim() !== ""
            )
    );
}

function xmlDecode(
    valor
) {
    return String(valor || "")
        .replace(
            /&lt;/g,
            "<"
        )
        .replace(
            /&gt;/g,
            ">"
        )
        .replace(
            /&quot;/g,
            '"'
        )
        .replace(
            /&apos;/g,
            "'"
        )
        .replace(
            /&amp;/g,
            "&"
        );
}

function parseSpreadsheetMl(
    texto
) {
    if (
        !/<Workbook[\s>]/i
            .test(texto) ||
        !/<Worksheet[\s>]/i
            .test(texto)
    ) {
        throw new Error(
            "EXCEL_NAO_SUPORTADO"
        );
    }

    const linhas = [];

    const rows =
        texto.match(
            /<Row\b[^>]*>[\s\S]*?<\/Row>/gi
        ) || [];

    for (
        const row of rows
    ) {
        const cells =
            row.match(
                /<Cell\b[^>]*>[\s\S]*?<\/Cell>/gi
            ) || [];

        const linha =
            cells.map(
                cell => {
                    const data =
                        cell.match(
                            /<Data\b[^>]*>([\s\S]*?)<\/Data>/i
                        );

                    return data
                        ? xmlDecode(
                            data[1]
                                .replace(
                                    /<!\[CDATA\[([\s\S]*?)\]\]>/g,
                                    "$1"
                                )
                        )
                        : "";
                }
            );

        linhas.push(
            linha
        );
    }

    return linhas;
}

function linhasParaObjetos(
    linhas
) {
    if (!linhas.length) {
        return [];
    }

    const cabecalhos =
        linhas[0].map(
            normalizarCabecalho
        );

    const aliases = {
        codigo:
            "codigo_barras",
        codigo_de_barras:
            "codigo_barras",
        cod_barras:
            "codigo_barras",
        produto:
            "nome",
        categoria_nome:
            "categoria",
        custo:
            "preco_custo",
        preco_de_custo:
            "preco_custo",
        preco:
            "preco_venda",
        venda:
            "preco_venda",
        preco_de_venda:
            "preco_venda",
        estoque:
            "quantidade",
        qtd:
            "quantidade",
        minimo:
            "estoque_minimo",
        estoque_min:
            "estoque_minimo",
        validade:
            "data_validade",
        tipo:
            "tipo_estoque"
    };

    const nomes =
        cabecalhos.map(
            valor =>
                aliases[valor] ||
                valor
        );

    if (
        !nomes.includes(
            "nome"
        )
    ) {
        throw new Error(
            "COLUNA_NOME_AUSENTE"
        );
    }

    return linhas
        .slice(1)
        .map(
            (linha, indice) => {
                const objeto = {
                    __linha:
                        indice + 2
                };

                nomes.forEach(
                    (
                        nome,
                        coluna
                    ) => {
                        if (!nome) {
                            return;
                        }

                        objeto[nome] =
                            linha[
                                coluna
                            ] ?? "";
                    }
                );

                return objeto;
            }
        )
        .filter(
            item =>
                Object.keys(item)
                    .some(
                        chave =>
                            chave !==
                                "__linha" &&
                            String(
                                item[chave] ??
                                ""
                            ).trim() !== ""
                    )
        );
}

function numero(
    valor,
    padrao = 0
) {
    if (
        valor === null ||
        valor === undefined ||
        String(valor)
            .trim() === ""
    ) {
        return padrao;
    }

    let texto =
        String(valor)
            .trim()
            .replace(
                /\s/g,
                ""
            );

    if (
        texto.includes(",") &&
        texto.includes(".")
    ) {
        texto =
            texto.lastIndexOf(
                ","
            ) >
            texto.lastIndexOf(
                "."
            )
                ? texto
                    .replace(
                        /\./g,
                        ""
                    )
                    .replace(
                        ",",
                        "."
                    )
                : texto.replace(
                    /,/g,
                    ""
                );
    } else if (
        texto.includes(",")
    ) {
        texto =
            texto.replace(
                ",",
                "."
            );
    }

    const resultado =
        Number(texto);

    return Number.isFinite(
        resultado
    )
        ? resultado
        : padrao;
}

function numeroValido(
    valor
) {
    if (
        valor === null ||
        valor === undefined ||
        String(valor)
            .trim() === ""
    ) {
        return true;
    }

    let texto =
        String(valor)
            .trim()
            .replace(
                /\s/g,
                ""
            );

    if (
        texto.includes(",") &&
        texto.includes(".")
    ) {
        texto =
            texto.lastIndexOf(
                ","
            ) >
            texto.lastIndexOf(
                "."
            )
                ? texto
                    .replace(
                        /\./g,
                        ""
                    )
                    .replace(
                        ",",
                        "."
                    )
                : texto.replace(
                    /,/g,
                    ""
                );
    } else if (
        texto.includes(",")
    ) {
        texto =
            texto.replace(
                ",",
                "."
            );
    }

    return Number.isFinite(
        Number(texto)
    );
}

function inteiro(
    valor,
    padrao = 0
) {
    return Math.trunc(
        numero(
            valor,
            padrao
        )
    );
}

function ativo(
    valor
) {
    const texto =
        String(
            valor ?? "1"
        )
            .trim()
            .toLowerCase();

    return ![
        "0",
        "nao",
        "não",
        "false",
        "inativo"
    ].includes(
        texto
    );
}

function dataIso(
    valor
) {
    const texto =
        String(
            valor || ""
        ).trim();

    if (!texto) {
        return null;
    }

    if (
        /^\d{4}-\d{2}-\d{2}$/
            .test(texto)
    ) {
        const [
            ano,
            mes,
            dia
        ] =
            texto
                .split("-")
                .map(Number);

        const data =
            new Date(
                Date.UTC(
                    ano,
                    mes - 1,
                    dia
                )
            );

        if (
            data.getUTCFullYear() ===
                ano &&
            data.getUTCMonth() ===
                mes - 1 &&
            data.getUTCDate() ===
                dia
        ) {
            return texto;
        }

        return null;
    }

    const br =
        texto.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
        );

    if (br) {
        const normalizada = [
            br[3],
            br[2].padStart(
                2,
                "0"
            ),
            br[1].padStart(
                2,
                "0"
            )
        ].join("-");

        return dataIso(
            normalizada
        );
    }

    const serial =
        Number(texto);

    if (
        Number.isFinite(
            serial
        ) &&
        serial > 0 &&
        serial < 100000
    ) {
        const epoch =
            Date.UTC(
                1899,
                11,
                30
            );

        const data =
            new Date(
                epoch +
                Math.round(
                    serial *
                    86400000
                )
            );

        return data
            .toISOString()
            .slice(
                0,
                10
            );
    }

    return null;
}

function xmlEscape(
    valor
) {
    return String(
        valor ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&apos;"
        );
}

function buscarProdutosExportacao() {
    return db.prepare(`
        SELECT
            p.codigo_barras,
            p.nome,
            COALESCE(
                c.nome,
                ''
            ) AS categoria,
            p.preco_custo,
            p.preco_venda,
            p.quantidade,
            p.estoque_minimo,
            p.unidade,
            COALESCE(
                p.data_validade,
                ''
            ) AS data_validade,
            p.ativo,
            COALESCE(
                p.tipo_estoque,
                'normal'
            ) AS tipo_estoque
        FROM produtos p
        LEFT JOIN categorias c
            ON c.id =
               p.categoria_id
        ORDER BY p.nome
    `).all();
}

function lerArquivoPlanilha(
    caminho,
    original
) {
    const nome =
        String(
            original || ""
        ).toLowerCase();

    if (
        nome.endsWith(
            ".xlsx"
        )
    ) {
        return parseXlsxBuffer(
            fs.readFileSync(
                caminho
            )
        );
    }

    const conteudo =
        fs.readFileSync(
            caminho,
            "utf8"
        );

    if (
        nome.endsWith(
            ".csv"
        ) ||
        nome.endsWith(
            ".txt"
        )
    ) {
        return parseCsv(
            conteudo
        );
    }

    if (
        nome.endsWith(
            ".xls"
        ) ||
        nome.endsWith(
            ".xml"
        )
    ) {
        return parseSpreadsheetMl(
            conteudo
        );
    }

    throw new Error(
        "FORMATO_NAO_SUPORTADO"
    );
}

function buscarExistente(
    item
) {
    const codigo =
        String(
            item.codigo_barras ||
            ""
        ).trim();

    const nome =
        String(
            item.nome ||
            ""
        ).trim();

    let existente = null;

    if (codigo) {
        existente =
            db.prepare(`
                SELECT
                    p.*,
                    COALESCE(
                        c.nome,
                        ''
                    ) AS categoria_nome
                FROM produtos p
                LEFT JOIN categorias c
                    ON c.id =
                       p.categoria_id
                WHERE p.codigo_barras = ?
                LIMIT 1
            `).get(
                codigo
            );
    }

    if (
        !existente &&
        nome
    ) {
        existente =
            db.prepare(`
                SELECT
                    p.*,
                    COALESCE(
                        c.nome,
                        ''
                    ) AS categoria_nome
                FROM produtos p
                LEFT JOIN categorias c
                    ON c.id =
                       p.categoria_id
                WHERE LOWER(
                    p.nome
                ) = LOWER(?)
                ORDER BY p.id
                LIMIT 1
            `).get(
                nome
            );
    }

    return existente;
}

function normalizarItem(
    item,
    existente = null
) {
    const nome =
        String(
            item.nome ||
            ""
        ).trim();

    const codigo =
        String(
            item.codigo_barras ||
            ""
        ).trim() || null;

    const categoria =
        String(
            item.categoria ||
            ""
        ).trim();

    const tipo =
        String(
            item.tipo_estoque ||
            existente?.tipo_estoque ||
            "normal"
        )
            .trim()
            .toLowerCase() ||
        "normal";

    const precoCusto =
        Math.max(
            0,
            numero(
                item.preco_custo,
                existente?.preco_custo ||
                0
            )
        );

    const precoVenda =
        Math.max(
            0,
            numero(
                item.preco_venda,
                existente?.preco_venda ||
                0
            )
        );

    const quantidade =
        Math.max(
            0,
            inteiro(
                item.quantidade,
                existente?.quantidade ||
                0
            )
        );

    const estoqueMinimo =
        Math.max(
            0,
            inteiro(
                item.estoque_minimo,
                existente?.estoque_minimo ||
                0
            )
        );

    const unidade =
        String(
            item.unidade ||
            existente?.unidade ||
            "un"
        ).trim() || "un";

    const validade =
        dataIso(
            item.data_validade
        );

    const ativoValor =
        ativo(
            item.ativo
        )
            ? 1
            : 0;

    return {
        nome,
        codigo_barras:
            codigo,
        categoria,
        preco_custo:
            precoCusto,
        preco_venda:
            precoVenda,
        quantidade,
        estoque_minimo:
            estoqueMinimo,
        unidade,
        data_validade:
            validade,
        ativo:
            ativoValor,
        tipo_estoque:
            tipo
    };
}

function validarLinha(
    item
) {
    const erros = [];

    const nome =
        String(
            item.nome ||
            ""
        ).trim();

    if (!nome) {
        erros.push(
            "Nome obrigatório"
        );
    }

    const numericos = [
        [
            "preco_custo",
            "Preço de custo"
        ],
        [
            "preco_venda",
            "Preço de venda"
        ],
        [
            "quantidade",
            "Quantidade"
        ],
        [
            "estoque_minimo",
            "Estoque mínimo"
        ]
    ];

    numericos.forEach(
        ([chave, rotulo]) => {
            if (
                !numeroValido(
                    item[chave]
                )
            ) {
                erros.push(
                    `${rotulo} inválido`
                );
            } else if (
                String(
                    item[chave] ?? ""
                ).trim() !== "" &&
                numero(
                    item[chave]
                ) < 0
            ) {
                erros.push(
                    `${rotulo} não pode ser negativo`
                );
            }
        }
    );

    const validadeTexto =
        String(
            item.data_validade ||
            ""
        ).trim();

    if (
        validadeTexto &&
        !dataIso(
            validadeTexto
        )
    ) {
        erros.push(
            "Data de validade inválida"
        );
    }

    const tipo =
        String(
            item.tipo_estoque ||
            "normal"
        )
            .trim()
            .toLowerCase();

    if (
        ![
            "",
            "normal",
            "fracionado",
            "kit"
        ].includes(
            tipo
        )
    ) {
        erros.push(
            "Tipo de estoque inválido"
        );
    }

    return erros;
}

function igualTexto(
    a,
    b
) {
    return String(
        a ?? ""
    ).trim() ===
        String(
            b ?? ""
        ).trim();
}

function analisarItem(
    item,
    contexto
) {
    const linha =
        Number(
            item.__linha ||
            0
        );

    const erros =
        validarLinha(
            item
        );

    const nome =
        String(
            item.nome ||
            ""
        ).trim();

    const codigo =
        String(
            item.codigo_barras ||
            ""
        ).trim();

    const chaveCodigo =
        codigo
            ? codigo.toLowerCase()
            : "";

    const chaveNome =
        nome.toLowerCase();

    if (
        chaveCodigo &&
        contexto.codigos.has(
            chaveCodigo
        )
    ) {
        erros.push(
            `Código duplicado na planilha (linha ${contexto.codigos.get(
                chaveCodigo
            )})`
        );
    }

    if (
        chaveNome &&
        contexto.nomes.has(
            chaveNome
        )
    ) {
        erros.push(
            `Nome duplicado na planilha (linha ${contexto.nomes.get(
                chaveNome
            )})`
        );
    }

    if (chaveCodigo) {
        contexto.codigos.set(
            chaveCodigo,
            linha
        );
    }

    if (chaveNome) {
        contexto.nomes.set(
            chaveNome,
            linha
        );
    }

    let existente =
        null;

    if (!erros.length) {
        const existenteCodigo =
            codigo
                ? db.prepare(`
                    SELECT id
                    FROM produtos
                    WHERE codigo_barras = ?
                    LIMIT 1
                `).get(
                    codigo
                )
                : null;

        const existenteNome =
            nome
                ? db.prepare(`
                    SELECT id
                    FROM produtos
                    WHERE LOWER(nome) = LOWER(?)
                    ORDER BY id
                    LIMIT 1
                `).get(
                    nome
                )
                : null;

        if (
            existenteCodigo &&
            existenteNome &&
            Number(
                existenteCodigo.id
            ) !==
            Number(
                existenteNome.id
            )
        ) {
            erros.push(
                "Conflito: o código de barras pertence a outro produto com nome diferente"
            );
        } else {
            existente =
                buscarExistente(
                    item
                );
        }
    }

    const normalizado =
        normalizarItem(
            item,
            existente
        );

    if (
        erros.length
    ) {
        return {
            linha,
            acao:
                "erro",
            nome:
                nome || "—",
            codigo:
                codigo || "",
            categoria:
                String(
                    item.categoria ||
                    ""
                ).trim(),
            quantidade:
                String(
                    item.quantidade ??
                    ""
                ),
            motivo:
                erros.join(
                    " • "
                ),
            item
        };
    }

    if (
        !existente &&
        ["fracionado", "kit"].includes(
            normalizado.tipo_estoque
        )
    ) {
        return {
            linha,
            acao:
                "erro",
            nome:
                normalizado.nome,
            codigo:
                normalizado.codigo_barras ||
                "",
            categoria:
                normalizado.categoria,
            quantidade:
                normalizado.quantidade,
            motivo:
                "Produto de estoque automático (fracionado ou Kit/Combo) novo deve ser cadastrado pelo sistema para definir seus componentes.",
            item
        };
    }

    if (!existente) {
        return {
            linha,
            acao:
                "criar",
            nome:
                normalizado.nome,
            codigo:
                normalizado.codigo_barras ||
                "",
            categoria:
                normalizado.categoria,
            quantidade:
                normalizado.quantidade,
            motivo:
                "Novo produto",
            item
        };
    }

    const estoqueAutomatico =
        ["fracionado", "kit"].includes(
            String(
                existente.tipo_estoque ||
                "normal"
            )
        );

    const alteracoes = [];

    if (
        !igualTexto(
            existente.codigo_barras,
            normalizado.codigo_barras
        )
    ) {
        alteracoes.push(
            "código"
        );
    }

    if (
        !igualTexto(
            existente.nome,
            normalizado.nome
        )
    ) {
        alteracoes.push(
            "nome"
        );
    }

    if (
        !igualTexto(
            existente.categoria_nome,
            normalizado.categoria
        )
    ) {
        alteracoes.push(
            "categoria"
        );
    }

    if (
        Number(
            existente.preco_custo ||
            0
        ) !==
        Number(
            normalizado.preco_custo
        )
    ) {
        alteracoes.push(
            "custo"
        );
    }

    if (
        Number(
            existente.preco_venda ||
            0
        ) !==
        Number(
            normalizado.preco_venda
        )
    ) {
        alteracoes.push(
            "preço"
        );
    }

    if (
        Number(
            existente.estoque_minimo ||
            0
        ) !==
        Number(
            normalizado.estoque_minimo
        )
    ) {
        alteracoes.push(
            "estoque mínimo"
        );
    }

    if (
        !igualTexto(
            existente.unidade,
            normalizado.unidade
        )
    ) {
        alteracoes.push(
            "unidade"
        );
    }

    if (
        !igualTexto(
            existente.data_validade,
            normalizado.data_validade
        )
    ) {
        alteracoes.push(
            "validade"
        );
    }

    if (
        Number(
            existente.ativo ||
            0
        ) !==
        Number(
            normalizado.ativo
        )
    ) {
        alteracoes.push(
            "status"
        );
    }

    if (
        !estoqueAutomatico &&
        Number(
            existente.quantidade ||
            0
        ) !==
        Number(
            normalizado.quantidade
        )
    ) {
        alteracoes.push(
            "estoque"
        );
    }

    if (
        estoqueAutomatico &&
        Number(
            existente.quantidade ||
            0
        ) !==
        Number(
            normalizado.quantidade
        )
    ) {
        alteracoes.push(
            "estoque ignorado (automático)"
        );
    }

    const alteracoesReais =
        alteracoes.filter(
            itemAlterado =>
                itemAlterado !==
                "estoque ignorado (automático)"
        );

    if (
        !alteracoesReais.length
    ) {
        return {
            linha,
            acao:
                "ignorar",
            nome:
                normalizado.nome,
            codigo:
                normalizado.codigo_barras ||
                "",
            categoria:
                normalizado.categoria,
            quantidade:
                estoqueAutomatico
                    ? Number(
                        existente.quantidade ||
                        0
                    )
                    : normalizado.quantidade,
            motivo:
                alteracoes.length
                    ? "Somente o estoque de produto automático seria alterado; essa quantidade é protegida."
                    : "Sem alterações",
            produto_id:
                existente.id,
            item
        };
    }

    return {
        linha,
        acao:
            "atualizar",
        nome:
            normalizado.nome,
        codigo:
            normalizado.codigo_barras ||
            "",
        categoria:
            normalizado.categoria,
        quantidade:
            estoqueAutomatico
                ? Number(
                    existente.quantidade ||
                    0
                )
                : normalizado.quantidade,
        motivo:
            `Alterar: ${alteracoes.join(
                ", "
            )}`,
        produto_id:
            existente.id,
        item
    };
}

function analisarItens(
    itens
) {
    const contexto = {
        codigos:
            new Map(),
        nomes:
            new Map()
    };

    const linhas =
        itens.map(
            item =>
                analisarItem(
                    item,
                    contexto
                )
        );

    const resumo = {
        total:
            linhas.length,
        criar: 0,
        atualizar: 0,
        ignorar: 0,
        erro: 0
    };

    linhas.forEach(
        linha => {
            if (
                Object.prototype
                    .hasOwnProperty
                    .call(
                        resumo,
                        linha.acao
                    )
            ) {
                resumo[
                    linha.acao
                ]++;
            }
        }
    );

    return {
        resumo,
        linhas
    };
}

function caminhoPreview(
    token
) {
    return path.join(
        pastaTemp,
        `planilha-preview-${token}.json`
    );
}

function limparPreviewsAntigos() {
    const agora =
        Date.now();

    try {
        fs.readdirSync(
            pastaTemp,
            {
                withFileTypes:
                    true
            }
        )
            .filter(
                item =>
                    item.isFile() &&
                    item.name
                        .startsWith(
                            "planilha-preview-"
                        ) &&
                    item.name
                        .endsWith(
                            ".json"
                        )
            )
            .forEach(
                item => {
                    const caminho =
                        path.join(
                            pastaTemp,
                            item.name
                        );

                    const stat =
                        fs.statSync(
                            caminho
                        );

                    if (
                        agora -
                        stat.mtimeMs >
                        PREVIEW_TTL_MS
                    ) {
                        fs.unlinkSync(
                            caminho
                        );
                    }
                }
            );
    } catch {}
}

function gerarPreview(
    itens,
    nomeArquivo
) {
    limparPreviewsAntigos();

    const token =
        crypto
            .randomBytes(18)
            .toString("hex");

    const analise =
        analisarItens(
            itens
        );

    fs.writeFileSync(
        caminhoPreview(
            token
        ),
        JSON.stringify(
            {
                criado_em:
                    Date.now(),
                nome_arquivo:
                    nomeArquivo,
                itens
            }
        ),
        "utf8"
    );

    return {
        token,
        nome_arquivo:
            nomeArquivo,
        ...analise
    };
}

function carregarPreview(
    token
) {
    if (
        !/^[a-f0-9]{36}$/i
            .test(
                String(
                    token || ""
                )
            )
    ) {
        throw new Error(
            "PREVIEW_INVALIDO"
        );
    }

    const caminho =
        caminhoPreview(
            token
        );

    if (
        !fs.existsSync(
            caminho
        )
    ) {
        throw new Error(
            "PREVIEW_EXPIRADO"
        );
    }

    const dados =
        JSON.parse(
            fs.readFileSync(
                caminho,
                "utf8"
            )
        );

    if (
        Date.now() -
        Number(
            dados.criado_em ||
            0
        ) >
        PREVIEW_TTL_MS
    ) {
        try {
            fs.unlinkSync(
                caminho
            );
        } catch {}

        throw new Error(
            "PREVIEW_EXPIRADO"
        );
    }

    return {
        caminho,
        dados
    };
}

function obterCategoriaId(
    categoriaNome
) {
    const nome =
        String(
            categoriaNome ||
            ""
        ).trim();

    if (!nome) {
        return null;
    }

    db.prepare(`
        INSERT OR IGNORE
        INTO categorias (
            nome
        )
        VALUES (?)
    `).run(
        nome
    );

    return db.prepare(`
        SELECT id
        FROM categorias
        WHERE nome = ?
    `).get(
        nome
    )?.id || null;
}

function aplicarItem(
    item,
    resumo
) {
    const existente =
        buscarExistente(
            item
        );

    const normalizado =
        normalizarItem(
            item,
            existente
        );

    if (
        !existente &&
        ["fracionado", "kit"].includes(
            normalizado.tipo_estoque
        )
    ) {
        resumo.ignorados++;
        resumo.erros.push(
            `Linha ${item.__linha}: produto de estoque automático novo precisa ser cadastrado pelo sistema.`
        );
        return;
    }

    const categoriaId =
        obterCategoriaId(
            normalizado.categoria
        );

    if (!existente) {
        const info =
            db.prepare(`
                INSERT INTO produtos (
                    codigo_barras,
                    nome,
                    categoria_id,
                    preco_custo,
                    preco_venda,
                    quantidade,
                    estoque_minimo,
                    unidade,
                    data_validade,
                    ativo,
                    tipo_estoque
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, 'normal'
                )
            `).run(
                normalizado.codigo_barras,
                normalizado.nome,
                categoriaId,
                normalizado.preco_custo,
                normalizado.preco_venda,
                normalizado.quantidade,
                normalizado.estoque_minimo,
                normalizado.unidade,
                normalizado.data_validade,
                normalizado.ativo
            );

        if (
            normalizado.quantidade >
            0
        ) {
            db.prepare(`
                INSERT INTO movimentacoes_estoque (
                    produto_id,
                    tipo,
                    quantidade,
                    motivo
                )
                VALUES (
                    ?,
                    'entrada',
                    ?,
                    'Importação de planilha'
                )
            `).run(
                info.lastInsertRowid,
                normalizado.quantidade
            );

            resumo.estoque_ajustado++;
        }

        resumo.criados++;
        return;
    }

    const tipoExistente =
        existente.tipo_estoque ||
        "normal";

    const quantidadeNova =
        ["fracionado", "kit"].includes(
            tipoExistente
        )
            ? Number(
                existente.quantidade ||
                0
            )
            : normalizado.quantidade;

    db.prepare(`
        UPDATE produtos
        SET
            codigo_barras = ?,
            nome = ?,
            categoria_id = ?,
            preco_custo = ?,
            preco_venda = ?,
            estoque_minimo = ?,
            unidade = ?,
            data_validade = ?,
            ativo = ?
        WHERE id = ?
    `).run(
        normalizado.codigo_barras,
        normalizado.nome,
        categoriaId,
        normalizado.preco_custo,
        normalizado.preco_venda,
        normalizado.estoque_minimo,
        normalizado.unidade,
        normalizado.data_validade,
        normalizado.ativo,
        existente.id
    );

    if (
        !["fracionado", "kit"].includes(
            tipoExistente
        ) &&
        quantidadeNova !==
            Number(
                existente.quantidade ||
                0
            )
    ) {
        const diferenca =
            quantidadeNova -
            Number(
                existente.quantidade ||
                0
            );

        db.prepare(`
            UPDATE produtos
            SET quantidade = ?
            WHERE id = ?
        `).run(
            quantidadeNova,
            existente.id
        );

        db.prepare(`
            INSERT INTO movimentacoes_estoque (
                produto_id,
                tipo,
                quantidade,
                motivo
            )
            VALUES (
                ?, ?, ?,
                'Importação de planilha'
            )
        `).run(
            existente.id,
            diferenca > 0
                ? "entrada"
                : "saida",
            Math.abs(
                diferenca
            )
        );

        resumo.estoque_ajustado++;
    }

    resumo.atualizados++;
}

function mensagemErro(
    codigo
) {
    const mensagens = {
        COLUNA_NOME_AUSENTE:
            'A planilha precisa ter a coluna "nome".',
        PLANILHA_VAZIA:
            "A planilha não possui produtos para importar.",
        EXCEL_NAO_SUPORTADO:
            "Esse arquivo .xls não está no formato compatível.",
        FORMATO_NAO_SUPORTADO:
            "Formato não suportado. Use CSV, XLS, XML ou XLSX.",
        XLSX_INVALIDO:
            "O arquivo .xlsx está inválido ou corrompido.",
        XLSX_ZIP_INVALIDO:
            "O arquivo .xlsx está corrompido.",
        XLSX_SEM_PLANILHA:
            "O arquivo .xlsx não possui uma planilha legível.",
        XLSX_COMPRESSAO_NAO_SUPORTADA:
            "O .xlsx usa uma compressão não suportada.",
        PREVIEW_INVALIDO:
            "A pré-visualização informada é inválida.",
        PREVIEW_EXPIRADO:
            "A pré-visualização expirou. Selecione a planilha novamente."
    };

    return (
        mensagens[codigo] ||
        "Não foi possível processar a planilha."
    );
}

router.get(
    "/exportar",
    (req, res) => {
        try {
            const formato =
                String(
                    req.query.formato ||
                    "csv"
                ).toLowerCase();

            const produtos =
                buscarProdutosExportacao();

            const stamp =
                new Date()
                    .toISOString()
                    .slice(
                        0,
                        10
                    );

            if (
                formato ===
                    "xls" ||
                formato ===
                    "excel"
            ) {
                const linhas = [
                    COLUNAS,
                    ...produtos.map(
                        produto =>
                            COLUNAS.map(
                                coluna =>
                                    produto[
                                        coluna
                                    ] ?? ""
                            )
                    )
                ];

                const rows =
                    linhas
                        .map(
                            linha =>
                                `<Row>${linha.map(
                                    valor =>
                                        `<Cell><Data ss:Type="String">${xmlEscape(
                                            valor
                                        )}</Data></Cell>`
                                ).join("")}</Row>`
                        )
                        .join("");

                const xml =
`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
 xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Produtos">
  <Table>${rows}</Table>
 </Worksheet>
</Workbook>`;

                res.setHeader(
                    "Content-Type",
                    "application/vnd.ms-excel; charset=utf-8"
                );

                res.setHeader(
                    "Content-Disposition",
                    `attachment; filename="AdegaPDV-produtos-${stamp}.xls"`
                );

                return res.send(
                    xml
                );
            }

            const csv =
                "\uFEFF" +
                [
                    COLUNAS.join(
                        ";"
                    ),
                    ...produtos.map(
                        produto =>
                            COLUNAS
                                .map(
                                    coluna =>
                                        csvEscape(
                                            produto[
                                                coluna
                                            ]
                                        )
                                )
                                .join(
                                    ";"
                                )
                    )
                ].join(
                    "\r\n"
                );

            res.setHeader(
                "Content-Type",
                "text/csv; charset=utf-8"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="AdegaPDV-produtos-${stamp}.csv"`
            );

            res.send(
                csv
            );

        } catch (erro) {
            console.error(
                "Erro exportação:",
                erro
            );

            res.status(500)
                .json({
                    sucesso:
                        false,
                    mensagem:
                        "Não foi possível exportar os produtos."
                });
        }
    }
);

router.post(
    "/preview",
    upload.single(
        "arquivo"
    ),
    (req, res) => {
        const arquivo =
            req.file?.path;

        if (!arquivo) {
            return res
                .status(400)
                .json({
                    sucesso:
                        false,
                    mensagem:
                        "Selecione uma planilha para importar."
                });
        }

        try {
            const original =
                String(
                    req.file.originalname ||
                    ""
                );

            const linhas =
                lerArquivoPlanilha(
                    arquivo,
                    original
                );

            const itens =
                linhasParaObjetos(
                    linhas
                );

            if (!itens.length) {
                throw new Error(
                    "PLANILHA_VAZIA"
                );
            }

            const preview =
                gerarPreview(
                    itens,
                    original
                );

            res.json({
                sucesso:
                    true,
                mensagem:
                    "Pré-visualização gerada.",
                ...preview
            });

        } catch (erro) {
            console.error(
                "Erro preview de planilha:",
                erro
            );

            res.status(400)
                .json({
                    sucesso:
                        false,
                    mensagem:
                        mensagemErro(
                            erro.message
                        )
                });

        } finally {
            try {
                if (
                    arquivo &&
                    fs.existsSync(
                        arquivo
                    )
                ) {
                    fs.unlinkSync(
                        arquivo
                    );
                }
            } catch {}
        }
    }
);

router.post(
    "/importar",
    (req, res) => {
        try {
            const token =
                String(
                    req.body?.token ||
                    ""
                );

            const {
                caminho,
                dados
            } =
                carregarPreview(
                    token
                );

            const analiseAtual =
                analisarItens(
                    dados.itens
                );

            if (
                analiseAtual.resumo.erro >
                0
            ) {
                return res
                    .status(409)
                    .json({
                        sucesso:
                            false,
                        mensagem:
                            "A importação não foi aplicada porque existem linhas com erro. Corrija a planilha e gere uma nova pré-visualização.",
                        resumo:
                            analiseAtual.resumo,
                        linhas:
                            analiseAtual.linhas
                    });
            }

            const resumo = {
                criados: 0,
                atualizados: 0,
                estoque_ajustado: 0,
                ignorados:
                    analiseAtual.resumo.ignorar,
                erros: []
            };

            const linhasAplicar =
                analiseAtual.linhas
                    .filter(
                        linha =>
                            linha.acao ===
                                "criar" ||
                            linha.acao ===
                                "atualizar"
                    );

            const importar =
                db.transaction(
                    linhas => {
                        linhas.forEach(
                            linha => {
                                aplicarItem(
                                    linha.item,
                                    resumo
                                );
                            }
                        );
                    }
                );

            importar(
                linhasAplicar
            );

            registrarAuditoria(
                req,
                "PLANILHA_PRODUTOS_IMPORTADA",
                "produto",
                null,
                `Importação confirmada: ${resumo.criados} criados, ${resumo.atualizados} atualizados, ${resumo.ignorados} ignorados.`,
                {
                    ...resumo,
                    arquivo:
                        dados.nome_arquivo,
                    total:
                        analiseAtual.resumo.total
                }
            );

            try {
                fs.unlinkSync(
                    caminho
                );
            } catch {}

            res.json({
                sucesso:
                    true,
                mensagem:
                    "Importação concluída.",
                resumo
            });

        } catch (erro) {
            console.error(
                "Erro importação de planilha:",
                erro
            );

            res.status(400)
                .json({
                    sucesso:
                        false,
                    mensagem:
                        mensagemErro(
                            erro.message
                        )
                });
        }
    }
);

module.exports = router;
