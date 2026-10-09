const express = require("express");
const router = express.Router();
const db = require("../database");
const registrarAuditoria = require("../utils/auditoria");
const {
    enriquecerProdutos,
    salvarComponentes,
    removerComponentes,
    listarComponentes
} = require("../utils/fracionado");
const {
    enriquecerProdutosKit,
    salvarComponentesKit,
    removerComponentesKit,
    listarComponentesKit
} = require("../utils/kit");

function texto(valor, maximo) {
    return String(valor ?? "").trim().slice(0, maximo);
}

function numeroNaoNegativo(valor, campo) {
    const numero = Number(valor ?? 0);

    if (!Number.isFinite(numero) || numero < 0) {
        throw new Error(`CAMPO_INVALIDO:${campo}`);
    }

    return numero;
}

function inteiroNaoNegativo(valor, campo) {
    const numero = Number(valor ?? 0);

    if (!Number.isInteger(numero) || numero < 0) {
        throw new Error(`CAMPO_INVALIDO:${campo}`);
    }

    return numero;
}

function idOpcional(valor, campo) {
    if (valor === undefined || valor === null || valor === "") {
        return null;
    }

    const id = Number(valor);

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`CAMPO_INVALIDO:${campo}`);
    }

    return id;
}

function validarDataOpcional(valor) {
    const data = texto(valor, 10);

    if (!data) {
        return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        throw new Error("CAMPO_INVALIDO:data_validade");
    }

    const [ano, mes, dia] = data.split("-").map(Number);
    const teste = new Date(Date.UTC(ano, mes - 1, dia));

    if (
        teste.getUTCFullYear() !== ano ||
        teste.getUTCMonth() !== mes - 1 ||
        teste.getUTCDate() !== dia
    ) {
        throw new Error("CAMPO_INVALIDO:data_validade");
    }

    return data;
}

function validarCategoria(categoriaId) {
    if (!categoriaId) return;

    const existe = db.prepare(`
        SELECT id
        FROM categorias
        WHERE id = ?
    `).get(categoriaId);

    if (!existe) {
        throw new Error("CATEGORIA_NAO_ENCONTRADA");
    }
}

function normalizarProduto(body, { produtoAtual = null, administrador = false } = {}) {
    const nome = texto(body.nome, 120);

    if (!nome) {
        throw new Error("NOME_OBRIGATORIO");
    }

    const codigoBarras = texto(body.codigo_barras, 80) || null;
    const categoriaId = idOpcional(body.categoria_id, "categoria");
    const precoVenda = numeroNaoNegativo(body.preco_venda, "preco_venda");
    const estoqueMinimo = inteiroNaoNegativo(body.estoque_minimo, "estoque_minimo");
    const unidade = texto(body.unidade, 30) || "un";
    const dataValidade = validarDataOpcional(body.data_validade);
    const tiposPermitidos = new Set([
        "normal",
        "fracionado",
        "kit"
    ]);

    const tipoEstoque =
        tiposPermitidos.has(body.tipo_estoque)
            ? body.tipo_estoque
            : "normal";

    let precoCusto = Number(produtoAtual?.preco_custo || 0);

    if (administrador) {
        precoCusto = numeroNaoNegativo(body.preco_custo, "preco_custo");
    }

    let quantidade = Number(produtoAtual?.quantidade || 0);

    if (!produtoAtual) {
        quantidade =
            ["fracionado", "kit"].includes(tipoEstoque)
                ? 0
                : inteiroNaoNegativo(body.quantidade, "quantidade");
    }

    // Ativação/desativação não é alterada pelo formulário de edição.
    // Isso evita contornar as regras de vínculo de estoque.
    const ativo = produtoAtual
        ? Number(produtoAtual.ativo)
        : 1;

    validarCategoria(categoriaId);

    return {
        codigoBarras,
        nome,
        categoriaId,
        precoCusto,
        precoVenda,
        quantidade,
        estoqueMinimo,
        unidade,
        dataValidade,
        tipoEstoque,
        ativo,
        componentesFracionados: body.componentes_fracionados,
        componentesKit: body.componentes_kit
    };
}

function validarAlteracaoFracionadoComProgresso(produtoId, novosComponentes) {
    const atuais = listarComponentes(produtoId);
    const emUso = atuais.filter(item => Number(item.fracao_atual || 0) > 0);

    if (!emUso.length) return;

    const novos = Array.isArray(novosComponentes) ? novosComponentes : [];

    for (const atual of emUso) {
        const correspondente = novos.find(
            item => Number(item?.produto_estoque_id) === Number(atual.produto_estoque_id)
        );

        if (
            !correspondente ||
            Number(correspondente.fator_conversao) !== Number(atual.fator_conversao)
        ) {
            throw new Error("FRACIONADO_EM_USO");
        }
    }
}

function normalizarComponentesKitComparacao(componentes) {
    return (Array.isArray(componentes) ? componentes : [])
        .filter(item => item && item.produto_estoque_id)
        .map(item => ({
            produto_estoque_id: Number(item.produto_estoque_id),
            quantidade_por_venda: Number(item.quantidade_por_venda)
        }))
        .sort((a, b) =>
            a.produto_estoque_id - b.produto_estoque_id
        );
}

function componentesKitForamAlterados(produtoId, novosComponentes) {
    const atuais = normalizarComponentesKitComparacao(
        listarComponentesKit(produtoId)
    );
    const novos = normalizarComponentesKitComparacao(
        novosComponentes
    );

    if (atuais.length !== novos.length) return true;

    return atuais.some((atual, indice) =>
        atual.produto_estoque_id !== novos[indice].produto_estoque_id ||
        atual.quantidade_por_venda !== novos[indice].quantidade_por_venda
    );
}

function kitPossuiHistoricoQueExigeConfiguracao(produtoId) {
    const venda = db.prepare(`
        SELECT 1
        FROM itens_venda iv
        INNER JOIN vendas v
            ON v.id = iv.venda_id
        WHERE iv.produto_id = ?
          AND v.status = 'finalizada'
        LIMIT 1
    `).get(produtoId);

    if (venda) return true;

    return Boolean(
        db.prepare(`
            SELECT 1
            FROM comanda_itens ci
            INNER JOIN comandas c
                ON c.id = ci.comanda_id
            WHERE ci.produto_id = ?
              AND c.status = 'aberta'
            LIMIT 1
        `).get(produtoId)
    );
}


function responderErroProduto(res, erro, operacao) {
    const campo = String(erro.message || "").startsWith("CAMPO_INVALIDO:")
        ? String(erro.message).split(":")[1]
        : null;

    if (campo) {
        const nomes = {
            categoria: "categoria",
            preco_custo: "preço de custo",
            preco_venda: "preço de venda",
            quantidade: "quantidade",
            estoque_minimo: "estoque mínimo",
            data_validade: "data de validade"
        };

        return res.status(400).json({
            sucesso: false,
            mensagem: `Valor inválido para ${nomes[campo] || campo}.`
        });
    }

    if (erro.message === "PRODUTO_VINCULADO_OUTRO_FRACIONADO") {
        return res.status(409).json({
            sucesso: false,
            mensagem:
                `Este produto físico já está vinculado ao produto fracionado ${erro.produtoFracionado || "existente"}. Para manter o estoque consistente, cada produto físico pode alimentar apenas um produto fracionado.`
        });
    }

    const mensagens = {
        NOME_OBRIGATORIO:
            "Nome do produto é obrigatório.",
        CATEGORIA_NAO_ENCONTRADA:
            "A categoria selecionada não existe.",
        COMPONENTES_FRACIONADOS_INVALIDOS:
            "Produto fracionado precisa ter de 1 a 3 produtos físicos vinculados, com fator válido.",
        PRODUTO_FRACIONADO_AUTO_VINCULO:
            "Um produto fracionado não pode consumir ele mesmo.",
        PRODUTO_FRACIONADO_DUPLICADO:
            "Selecione produtos físicos diferentes nos vínculos.",
        PRODUTO_VINCULADO_NAO_ENCONTRADO:
            "Um dos produtos físicos vinculados não foi encontrado.",
        PRODUTO_VINCULADO_DEVE_SER_FISICO:
            "O produto vinculado precisa ser um item físico de estoque.",
        ESTOQUE_ANTES_FRACIONAR:
            "Zere o estoque físico deste produto antes de transformá-lo em produto fracionado.",
        FRACIONADO_EM_USO:
            "Este produto fracionado possui consumo parcial em andamento. Mantenha os mesmos ingredientes e fatores até o progresso voltar a zero.",
        PRODUTO_VINCULADO_ATIVO:
            "Este produto físico está vinculado a um produto automático ativo e não pode ser desativado. Remova o vínculo primeiro.",
        COMPONENTES_KIT_INVALIDOS:
            "Produto Kit/Combo precisa ter de 1 a 3 produtos físicos vinculados, com quantidade por venda válida.",
        PRODUTO_KIT_AUTO_VINCULO:
            "Um Kit/Combo não pode consumir ele mesmo.",
        PRODUTO_KIT_DUPLICADO:
            "Selecione produtos físicos diferentes no Kit/Combo.",
        PRODUTO_KIT_VINCULADO_NAO_ENCONTRADO:
            "Um dos produtos físicos do Kit/Combo não foi encontrado.",
        PRODUTO_KIT_VINCULADO_DEVE_SER_FISICO:
            "O produto vinculado ao Kit/Combo precisa ser um item físico normal.",
        ESTOQUE_ANTES_AUTOMATICO:
            "Zere o estoque próprio deste produto antes de transformá-lo em produto automático (Fracionado ou Kit/Combo).",
        KIT_CONFIG_COM_HISTORICO:
            "Este Kit/Combo já possui venda finalizada ou está em uma comanda aberta. Para preservar cancelamentos e devoluções de estoque, não altere os produtos/quantidades vinculados. Crie um novo Kit/Combo se precisar mudar a composição."
    };

    if (mensagens[erro.message]) {
        return res.status(
            erro.message === "PRODUTO_VINCULADO_ATIVO" ? 409 : 400
        ).json({
            sucesso: false,
            mensagem: mensagens[erro.message]
        });
    }

    if (
        erro.code === "SQLITE_CONSTRAINT_UNIQUE" ||
        String(erro.message || "").includes("UNIQUE constraint failed: produtos.codigo_barras")
    ) {
        return res.status(409).json({
            sucesso: false,
            mensagem: "Este código de barras já está cadastrado em outro produto."
        });
    }

    console.error(`Erro ao ${operacao} produto:`, erro);

    return res.status(500).json({
        sucesso: false,
        mensagem: `Erro ao ${operacao} produto.`
    });
}

// LISTAR PRODUTOS
router.get("/", (req, res) => {
    try {
        const administrador =
            req.session?.usuario?.perfil === "administrador";

        const campoCusto =
            administrador
                ? ", p.preco_custo"
                : "";

        const produtos = db.prepare(`
            SELECT
                p.id,
                p.codigo_barras,
                p.nome,
                p.categoria_id
                ${campoCusto},
                p.preco_venda,
                p.quantidade,
                p.estoque_minimo,
                p.unidade,
                p.data_validade,
                p.ativo,
                p.tipo_estoque,
                c.nome AS categoria
            FROM produtos p
            LEFT JOIN categorias c
                ON c.id = p.categoria_id
            WHERE p.ativo = 1
            ORDER BY p.nome COLLATE NOCASE
        `).all();

        return res.json(
            enriquecerProdutosKit(
                enriquecerProdutos(produtos)
            )
        );
    } catch (erro) {
        console.error("Erro ao listar produtos:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao listar produtos."
        });
    }
});

// CADASTRAR PRODUTO
router.post("/", (req, res) => {
    try {
        const administrador =
            req.session?.usuario?.perfil === "administrador";

        const dados = normalizarProduto(req.body, { administrador });

        const cadastrar = db.transaction(() => {
            const resultado = db.prepare(`
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
                    tipo_estoque
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                dados.codigoBarras,
                dados.nome,
                dados.categoriaId,
                dados.precoCusto,
                dados.precoVenda,
                dados.quantidade,
                dados.estoqueMinimo,
                dados.unidade,
                dados.dataValidade,
                dados.tipoEstoque
            );

            const produtoId = Number(resultado.lastInsertRowid);

            if (dados.tipoEstoque === "fracionado") {
                salvarComponentes(
                    produtoId,
                    dados.componentesFracionados
                );
            } else if (dados.tipoEstoque === "kit") {
                salvarComponentesKit(
                    produtoId,
                    dados.componentesKit
                );
            } else if (dados.quantidade > 0) {
                db.prepare(`
                    INSERT INTO movimentacoes_estoque (
                        produto_id,
                        tipo,
                        quantidade,
                        motivo
                    )
                    VALUES (?, 'entrada', ?, 'Estoque inicial')
                `).run(
                    produtoId,
                    dados.quantidade
                );
            }

            return produtoId;
        });

        const id = cadastrar();

        registrarAuditoria(
            req,
            "PRODUTO_CRIADO",
            "produto",
            id,
            `Produto ${dados.nome} cadastrado.`,
            {
                tipo_estoque: dados.tipoEstoque,
                quantidade: dados.quantidade,
                preco_venda: dados.precoVenda
            }
        );

        return res.status(201).json({
            sucesso: true,
            mensagem: "Produto cadastrado com sucesso.",
            id
        });
    } catch (erro) {
        return responderErroProduto(res, erro, "cadastrar");
    }
});

// EDITAR PRODUTO
router.put("/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Produto inválido."
            });
        }

        const produto = db.prepare(`
            SELECT *
            FROM produtos
            WHERE id = ?
        `).get(id);

        if (!produto) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Produto não encontrado."
            });
        }

        const administrador =
            req.session?.usuario?.perfil === "administrador";

        const dados = normalizarProduto(
            req.body,
            {
                produtoAtual: produto,
                administrador
            }
        );

        const tipoAnterior = produto.tipo_estoque || "normal";

        if (
            tipoAnterior === "normal" &&
            dados.tipoEstoque !== "normal"
        ) {
            const usadoPorFracionado = db.prepare(`
                SELECT pf.id
                FROM produto_fracionado_componentes pfc
                INNER JOIN produtos pf
                    ON pf.id = pfc.produto_id
                WHERE pfc.produto_estoque_id = ?
                  AND pf.ativo = 1
                LIMIT 1
            `).get(id);

            const usadoPorKit = db.prepare(`
                SELECT pk.id
                FROM produto_kit_componentes pkc
                INNER JOIN produtos pk
                    ON pk.id = pkc.produto_id
                WHERE pkc.produto_estoque_id = ?
                  AND pk.ativo = 1
                LIMIT 1
            `).get(id);

            if (usadoPorFracionado || usadoPorKit) {
                throw new Error("PRODUTO_VINCULADO_ATIVO");
            }
        }

        if (
            tipoAnterior === "normal" &&
            ["fracionado", "kit"].includes(
                dados.tipoEstoque
            ) &&
            Number(produto.quantidade || 0) > 0
        ) {
            throw new Error("ESTOQUE_ANTES_AUTOMATICO");
        }

        if (tipoAnterior === "kit") {
            const alterandoConfiguracao =
                dados.tipoEstoque !== "kit" ||
                componentesKitForamAlterados(
                    id,
                    dados.componentesKit
                );

            if (
                alterandoConfiguracao &&
                kitPossuiHistoricoQueExigeConfiguracao(id)
            ) {
                throw new Error("KIT_CONFIG_COM_HISTORICO");
            }
        }

        if (
            tipoAnterior === "fracionado" &&
            dados.tipoEstoque !== "fracionado"
        ) {
            const possuiProgresso = listarComponentes(id).some(
                componente => Number(componente.fracao_atual || 0) > 0
            );

            if (possuiProgresso) {
                throw new Error("FRACIONADO_EM_USO");
            }
        }

        if (dados.tipoEstoque === "fracionado") {
            validarAlteracaoFracionadoComProgresso(
                id,
                dados.componentesFracionados
            );
        }

        const editar = db.transaction(() => {
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
                    ativo = ?,
                    tipo_estoque = ?,
                    quantidade = CASE
                        WHEN ? IN ('fracionado', 'kit') THEN 0
                        ELSE quantidade
                    END
                WHERE id = ?
            `).run(
                dados.codigoBarras,
                dados.nome,
                dados.categoriaId,
                dados.precoCusto,
                dados.precoVenda,
                dados.estoqueMinimo,
                dados.unidade,
                dados.dataValidade,
                dados.ativo,
                dados.tipoEstoque,
                dados.tipoEstoque,
                id
            );

            if (dados.tipoEstoque === "fracionado") {
                salvarComponentes(
                    id,
                    dados.componentesFracionados
                );
                removerComponentesKit(id);
            } else if (dados.tipoEstoque === "kit") {
                salvarComponentesKit(
                    id,
                    dados.componentesKit
                );
                removerComponentes(id);
            } else {
                removerComponentes(id);
                removerComponentesKit(id);
            }
        });

        editar();

        registrarAuditoria(
            req,
            "PRODUTO_EDITADO",
            "produto",
            id,
            `Produto ${dados.nome} atualizado.`,
            {
                tipo_anterior: tipoAnterior,
                tipo_novo: dados.tipoEstoque,
                preco_venda: dados.precoVenda,
                estoque_minimo: dados.estoqueMinimo
            }
        );

        return res.json({
            sucesso: true,
            mensagem: "Produto atualizado com sucesso."
        });
    } catch (erro) {
        return responderErroProduto(res, erro, "atualizar");
    }
});

// DESATIVAR PRODUTO
router.delete("/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Produto inválido."
            });
        }

        const produto = db.prepare(`
            SELECT *
            FROM produtos
            WHERE id = ?
        `).get(id);

        if (!produto) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Produto não encontrado."
            });
        }

        if (Number(produto.ativo) !== 1) {
            return res.json({
                sucesso: true,
                mensagem: "Produto já estava desativado."
            });
        }

        if (
            (produto.tipo_estoque || "normal") ===
            "fracionado"
        ) {
            const possuiProgresso =
                listarComponentes(id).some(
                    componente =>
                        Number(
                            componente.fracao_atual ||
                            0
                        ) > 0
                );

            if (possuiProgresso) {
                throw new Error(
                    "FRACIONADO_EM_USO"
                );
            }
        }

        const vinculoAtivo = db.prepare(`
            SELECT
                pf.id,
                pf.nome
            FROM produto_fracionado_componentes pfc
            INNER JOIN produtos pf
                ON pf.id = pfc.produto_id
            WHERE pfc.produto_estoque_id = ?
              AND pf.ativo = 1
            LIMIT 1
        `).get(id);

        const vinculoKitAtivo = db.prepare(`
            SELECT
                pk.id,
                pk.nome
            FROM produto_kit_componentes pkc
            INNER JOIN produtos pk
                ON pk.id = pkc.produto_id
            WHERE pkc.produto_estoque_id = ?
              AND pk.ativo = 1
            LIMIT 1
        `).get(id);

        if (vinculoAtivo || vinculoKitAtivo) {
            throw new Error("PRODUTO_VINCULADO_ATIVO");
        }

        db.prepare(`
            UPDATE produtos
            SET ativo = 0
            WHERE id = ?
        `).run(id);

        registrarAuditoria(
            req,
            "PRODUTO_DESATIVADO",
            "produto",
            id,
            `Produto ${produto.nome} desativado.`
        );

        return res.json({
            sucesso: true,
            mensagem: "Produto desativado com sucesso."
        });
    } catch (erro) {
        return responderErroProduto(res, erro, "desativar");
    }
});

module.exports = router;
