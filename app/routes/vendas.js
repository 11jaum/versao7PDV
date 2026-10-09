const express = require("express");
const router = express.Router();
const db = require("../database");
const registrarAuditoria = require("../utils/auditoria");
const {
    calcularDisponibilidade,
    calcularUnidadesFisicasInteirasDisponiveis,
    consumirFracionado,
    devolverFracionado
} = require("../utils/fracionado");
const {
    calcularDisponibilidadeKit,
    consumirKit,
    devolverKit
} = require("../utils/kit");


function agruparItensVenda(itens) {
    const agrupados = new Map();

    for (const item of itens) {
        const produtoId = Number(item?.produto_id);
        const quantidade = Number(item?.quantidade);

        if (
            !Number.isInteger(produtoId) ||
            produtoId <= 0 ||
            !Number.isInteger(quantidade) ||
            quantidade <= 0
        ) {
            throw new Error("ITEM_INVALIDO");
        }

        const atual = agrupados.get(produtoId) || 0;
        const total = atual + quantidade;

        if (!Number.isSafeInteger(total) || total <= 0) {
            throw new Error("ITEM_INVALIDO");
        }

        agrupados.set(produtoId, total);
    }

    return Array.from(
        agrupados,
        ([produto_id, quantidade]) => ({
            produto_id,
            quantidade
        })
    );
}


// ==========================================
// LISTAR TIPOS DE VENDA
// ==========================================
router.get("/tipos", (req, res) => {
    try {
        const tipos = db.prepare(`
            SELECT *
            FROM tipos_venda
            ORDER BY nome
        `).all();

        res.json(tipos);

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao carregar tipos de venda"
        });
    }
});


// ==========================================
// FINALIZAR VENDA
// ==========================================
router.post("/", (req, res) => {
    let descontoMaximoPercentual = 100;

    try {

        const {
            tipo_venda_id,
            itens,
            desconto,
            forma_pagamento,
            valor_recebido,
            pagamentos
        } = req.body;


        // ======================================
        // VALIDAR CAIXA
        // ======================================

        const caixa = db.prepare(`
            SELECT *
            FROM caixas
            WHERE status = 'aberto'
            ORDER BY id DESC
            LIMIT 1
        `).get();


        if (!caixa) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Abra o caixa antes de realizar uma venda"
            });
        }


        // ======================================
        // VALIDAR TIPO DA VENDA
        // ======================================

        if (!tipo_venda_id) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Tipo de venda é obrigatório"
            });
        }


        const tipoVenda = db.prepare(`
            SELECT *
            FROM tipos_venda
            WHERE id = ?
        `).get(tipo_venda_id);


        if (!tipoVenda) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Tipo de venda inválido"
            });
        }


        // ======================================
        // VALIDAR ITENS
        // ======================================

        if (
            !Array.isArray(itens) ||
            itens.length === 0
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Adicione produtos à venda"
            });
        }


        // ======================================
        // VALIDAR PAGAMENTO
        // ======================================

        const formasPermitidas = [
            "dinheiro",
            "pix",
            "debito",
            "credito"
        ];
        const descontoNumerico =
            Number(desconto || 0);


        if (
            !Number.isFinite(descontoNumerico) ||
            descontoNumerico < 0
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Desconto inválido"
            });
        }

        const configuracaoPDV =
            db.prepare(`
                SELECT
                    pdv_permitir_desconto,
                    pdv_desconto_maximo_percentual
                FROM configuracoes
                WHERE id = 1
            `).get() || {};

        const permitirDesconto =
            Number(
                configuracaoPDV
                    .pdv_permitir_desconto ?? 1
            ) === 1;

        descontoMaximoPercentual =
            Number(
                configuracaoPDV
                    .pdv_desconto_maximo_percentual ??
                100
            );

        if (
            !Number.isFinite(
                descontoMaximoPercentual
            )
        ) {
            descontoMaximoPercentual =
                100;
        }

        descontoMaximoPercentual =
            Math.max(
                0,
                Math.min(
                    100,
                    descontoMaximoPercentual
                )
            );

        if (
            !permitirDesconto &&
            descontoNumerico > 0
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    "Descontos estão desativados nas configurações do PDV."
            });
        }


        // ======================================
        // TRANSAÇÃO
        // ======================================

        const finalizarVenda =
            db.transaction(() => {

                let subtotal = 0;

                const produtosVenda = [];


                // ==================================
                // VALIDAR PRODUTOS / ESTOQUE
                // ==================================

                const itensAgrupados =
                    agruparItensVenda(itens);

                for (const item of itensAgrupados) {

                    const produtoId =
                        item.produto_id;

                    const quantidade =
                        item.quantidade;


                    const produto =
                        db.prepare(`
                            SELECT *
                            FROM produtos
                            WHERE
                                id = ?
                                AND ativo = 1
                        `).get(produtoId);


                    if (!produto) {
                        throw new Error(
                            "PRODUTO_NAO_ENCONTRADO"
                        );
                    }


                    const tipoEstoque =
                        produto.tipo_estoque ||
                        "normal";

                    const estoqueDisponivel =
                        tipoEstoque === "fracionado"
                            ? calcularDisponibilidade(
                                produto.id
                            )
                            : tipoEstoque === "kit"
                                ? calcularDisponibilidadeKit(
                                    produto.id
                                )
                                : calcularUnidadesFisicasInteirasDisponiveis(
                                    produto.id
                                );


                    if (
                        estoqueDisponivel <
                        quantidade
                    ) {
                        throw new Error(
                            `ESTOQUE_INSUFICIENTE:${produto.nome}:${estoqueDisponivel}`
                        );
                    }


                    const valorItem =
                        Number(
                            (
                                produto.preco_venda *
                                quantidade
                            ).toFixed(2)
                        );


                    subtotal += valorItem;


                    produtosVenda.push({
                        produto,
                        quantidade,
                        subtotal: valorItem
                    });
                }


                subtotal =
                    Number(
                        subtotal.toFixed(2)
                    );


                const percentualDesconto =
                    subtotal > 0
                        ? (
                            descontoNumerico /
                            subtotal
                        ) * 100
                        : 0;

                if (
                    percentualDesconto >
                    descontoMaximoPercentual +
                    0.0001
                ) {
                    throw new Error(
                        "DESCONTO_ACIMA_LIMITE"
                    );
                }


                if (
                    descontoNumerico >
                    subtotal
                ) {
                    throw new Error(
                        "DESCONTO_MAIOR_TOTAL"
                    );
                }


                const total =
                    Number(
                        (
                            subtotal -
                            descontoNumerico
                        ).toFixed(2)
                    );
                // ==================================
                // PAGAMENTOS
                // ==================================

                let pagamentosVenda;

                if (total === 0) {
                    // Venda totalmente descontada: não existe valor a receber,
                    // portanto nenhum lançamento de pagamento é necessário.
                    pagamentosVenda = [];
                } else if (
                    Array.isArray(pagamentos) &&
                    pagamentos.length > 0
                ) {
                    pagamentosVenda =
                        pagamentos.map(
                            pagamento => ({
                                forma_pagamento:
                                    String(
                                        pagamento.forma_pagamento || ""
                                    ),

                                valor:
                                    Number(pagamento.valor),

                                valor_recebido:
                                    Number(
                                        pagamento.valor_recebido || 0
                                    )
                            })
                        );
                } else {
                    // Compatibilidade com clientes antigos.
                    pagamentosVenda = [{
                        forma_pagamento,
                        valor: total,
                        valor_recebido:
                            Number(valor_recebido || 0)
                    }];
                }

                if (
                    total > 0 &&
                    (
                        pagamentosVenda.length < 1 ||
                        pagamentosVenda.length > 2
                    )
                ) {
                    throw new Error("PAGAMENTOS_INVALIDOS");
                }

                if (
                    total === 0 &&
                    pagamentosVenda.length !== 0
                ) {
                    throw new Error("PAGAMENTOS_INVALIDOS");
                }

                for (const pagamento of pagamentosVenda) {
                    if (
                        !formasPermitidas.includes(
                            pagamento.forma_pagamento
                        )
                    ) {
                        throw new Error(
                            "FORMA_PAGAMENTO_INVALIDA"
                        );
                    }

                    if (
                        !Number.isFinite(pagamento.valor) ||
                        pagamento.valor <= 0
                    ) {
                        throw new Error(
                            "PAGAMENTOS_INVALIDOS"
                        );
                    }
                }

                if (
                    pagamentosVenda.length === 2 &&
                    pagamentosVenda[0].forma_pagamento ===
                    pagamentosVenda[1].forma_pagamento
                ) {
                    throw new Error(
                        "FORMAS_PAGAMENTO_IGUAIS"
                    );
                }

                const somaPagamentos =
                    Number(
                        pagamentosVenda
                            .reduce(
                                (soma, pagamento) =>
                                    soma + pagamento.valor,
                                0
                            )
                            .toFixed(2)
                    );

                if (
                    Math.abs(
                        somaPagamentos - total
                    ) > 0.009
                ) {
                    throw new Error(
                        "TOTAL_PAGAMENTOS_DIVERGENTE"
                    );
                }

                let recebido = 0;
                let troco = 0;

                pagamentosVenda =
                    pagamentosVenda.map(
                        pagamento => {

                            if (
                                pagamento.forma_pagamento !==
                                "dinheiro"
                            ) {
                                return {
                                    ...pagamento,
                                    valor_recebido: 0,
                                    troco: 0
                                };
                            }

                            const recebidoDinheiro =
                                Number(
                                    pagamento.valor_recebido || 0
                                );

                            if (
                                !Number.isFinite(recebidoDinheiro) ||
                                recebidoDinheiro < pagamento.valor
                            ) {
                                throw new Error(
                                    "VALOR_RECEBIDO_INSUFICIENTE"
                                );
                            }

                            const trocoDinheiro =
                                Number(
                                    (
                                        recebidoDinheiro -
                                        pagamento.valor
                                    ).toFixed(2)
                                );

                            recebido += recebidoDinheiro;
                            troco += trocoDinheiro;

                            return {
                                ...pagamento,
                                valor_recebido: recebidoDinheiro,
                                troco: trocoDinheiro
                            };
                        }
                    );

                recebido = Number(recebido.toFixed(2));
                troco = Number(troco.toFixed(2));

// ==================================
                // CRIAR VENDA
                // ==================================

                const resultadoVenda =
                    db.prepare(`
                        INSERT INTO vendas (
                            caixa_id,
                            tipo_venda_id,
                            subtotal,
                            desconto,
                            total,
                            status
                        )
                        VALUES (
                            ?,
                            ?,
                            ?,
                            ?,
                            ?,
                            'finalizada'
                        )
                    `).run(
                        caixa.id,
                        tipo_venda_id,
                        subtotal,
                        descontoNumerico,
                        total
                    );


                const vendaId =
                    resultadoVenda.lastInsertRowid;


                // ==================================
                // ITENS + BAIXA DE ESTOQUE
                // ==================================

                const inserirItem =
                db.prepare(`
                    INSERT INTO itens_venda (
                        venda_id,
                        produto_id,
                        quantidade,
                        preco_unitario,
                        custo_unitario,
                        subtotal
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                const baixarEstoque =
                    db.prepare(`
                        UPDATE produtos
                        SET quantidade =
                            quantidade - ?
                        WHERE id = ?
                    `);


                const registrarEstoque =
                    db.prepare(`
                        INSERT INTO movimentacoes_estoque (
                            produto_id,
                            tipo,
                            quantidade,
                            motivo,
                            venda_id
                        )
                        VALUES (
                            ?,
                            'saida',
                            ?,
                            'Venda',
                            ?
                        )
                    `);


                for (
                    const item
                    of produtosVenda
                ) {

                    inserirItem.run(
                    vendaId,
                    item.produto.id,
                    item.quantidade,
                    item.produto.preco_venda,
                    Number(item.produto.preco_custo || 0),
                    item.subtotal
                );

                    const tipoEstoqueItem =
                        item.produto.tipo_estoque ||
                        "normal";

                    if (tipoEstoqueItem === "fracionado") {
                        consumirFracionado(
                            item.produto.id,
                            item.quantidade,
                            vendaId
                        );

                    } else if (tipoEstoqueItem === "kit") {
                        consumirKit(
                            item.produto.id,
                            item.quantidade,
                            vendaId
                        );

                    } else {
                        const disponivelInteiro =
                            calcularUnidadesFisicasInteirasDisponiveis(
                                item.produto.id
                            );

                        if (
                            disponivelInteiro <
                            item.quantidade
                        ) {
                            throw new Error(
                                `ESTOQUE_INSUFICIENTE:${item.produto.nome}:${disponivelInteiro}`
                            );
                        }

                        baixarEstoque.run(
                            item.quantidade,
                            item.produto.id
                        );

                        registrarEstoque.run(
                            item.produto.id,
                            item.quantidade,
                            vendaId
                        );
                    }
                }
                // ==================================
                // PAGAMENTOS
                // ==================================

                const inserirPagamento =
                    db.prepare(`
                        INSERT INTO pagamentos_venda (
                            venda_id,
                            forma_pagamento,
                            valor,
                            valor_recebido,
                            troco
                        )
                        VALUES (?, ?, ?, ?, ?)
                    `);

                for (const pagamento of pagamentosVenda) {
                    inserirPagamento.run(
                        vendaId,
                        pagamento.forma_pagamento,
                        pagamento.valor,
                        pagamento.valor_recebido || 0,
                        pagamento.troco || 0
                    );
                }

                const descricaoPagamentos =
                    pagamentosVenda.length
                        ? pagamentosVenda
                            .map(
                                pagamento =>
                                    `${pagamento.forma_pagamento}: R$ ${pagamento.valor.toFixed(2)}`
                            )
                            .join(" + ")
                        : "sem cobrança";

                registrarAuditoria(
                    req,
                    "VENDA_FINALIZADA",
                    "venda",
                    vendaId,
                    `Venda #${vendaId} finalizada - R$ ${total.toFixed(2)} - ${descricaoPagamentos}`,
                    {
                        caixa_id: caixa.id,
                        total,
                        pagamentos:
                            pagamentosVenda.map(
                                pagamento => ({
                                    forma_pagamento:
                                        pagamento.forma_pagamento,
                                    valor:
                                        pagamento.valor
                                })
                            ),
                        itens: produtosVenda.length
                    }
                );

                return {
                    venda_id: vendaId,
                    subtotal,
                    desconto: descontoNumerico,
                    total,
                    valor_recebido: recebido,
                    troco,
                    pagamentos: pagamentosVenda
                };
            });


        const resultado =
            finalizarVenda();


        res.json({
            sucesso: true,
            mensagem:
                "Venda finalizada com sucesso",
            ...resultado
        });


    } catch (erro) {

        console.error(erro);


        if (
            erro.message ===
            "ITEM_INVALIDO"
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    "Existe um item inválido na venda"
            });
        }


        if (
            erro.message ===
            "PRODUTO_NAO_ENCONTRADO"
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    "Produto não encontrado ou desativado"
            });
        }


        if (
            erro.message.startsWith(
                "ESTOQUE_INSUFICIENTE:"
            )
        ) {

            const partes =
                erro.message.split(":");

            return res.status(400).json({
                sucesso: false,
                mensagem:
                    `Estoque insuficiente para ${partes[1]}. Disponível: ${partes[2]}`
            });
        }


        if (
            erro.message ===
            "DESCONTO_MAIOR_TOTAL"
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    "O desconto não pode ser maior que o valor da venda"
            });
        }


        if (
            erro.message ===
            "DESCONTO_ACIMA_LIMITE"
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    `O desconto máximo permitido é ${descontoMaximoPercentual}% do subtotal.`
            });
        }


        if (
            erro.message ===
            "VALOR_RECEBIDO_INSUFICIENTE"
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    "O valor recebido em dinheiro é menor que a parte paga em dinheiro."
            });
        }


        if (
            erro.message ===
            "FORMA_PAGAMENTO_INVALIDA"
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    "Forma de pagamento inválida."
            });
        }


        if (
            erro.message ===
            "FORMAS_PAGAMENTO_IGUAIS"
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    "No pagamento dividido, escolha duas formas diferentes."
            });
        }


        if (
            erro.message ===
            "TOTAL_PAGAMENTOS_DIVERGENTE"
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    "A soma das formas de pagamento deve ser igual ao total da venda."
            });
        }


        if (
            erro.message ===
            "PAGAMENTOS_INVALIDOS"
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    "Os dados das formas de pagamento são inválidos."
            });
        }

        if (
            erro.message === "FRACIONADO_SEM_COMPONENTES"
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    "Produto fracionado sem ingredientes configurados. Revise o cadastro do produto."
            });
        }

        if (
            String(erro.message || "").startsWith(
                "ESTOQUE_FRACIONADO_INSUFICIENTE:"
            )
        ) {
            const partes = String(erro.message).split(":");
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    `Estoque fracionado insuficiente. Disponível: ${partes[2] || 0}.`
            });
        }

        if (
            erro.message === "KIT_SEM_COMPONENTES"
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    "Kit/Combo sem produtos físicos configurados. Revise o cadastro do produto."
            });
        }

        if (
            String(erro.message || "").startsWith(
                "ESTOQUE_KIT_INSUFICIENTE:"
            )
        ) {
            const partes =
                String(erro.message).split(":");

            return res.status(400).json({
                sucesso: false,
                mensagem:
                    `Estoque insuficiente para o Kit/Combo. Disponível: ${partes[2] || 0}.`
            });
        }

        if (
            String(erro.message || "").startsWith(
                "ESTOQUE_KIT_COMPONENTE_INSUFICIENTE:"
            )
        ) {
            const partes =
                String(erro.message).split(":");

            return res.status(400).json({
                sucesso: false,
                mensagem:
                    `Estoque insuficiente no produto ${partes[1] || "vinculado"}. Disponível: ${partes[2] || 0}; necessário: ${partes[3] || 0}.`
            });
        }

        if (
            String(erro.message || "").startsWith(
                "ESTOQUE_VINCULADO_INSUFICIENTE:"
            )
        ) {
            const partes = String(erro.message).split(":");
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    `Estoque insuficiente no ingrediente ${partes.slice(1).join(":")}.`
            });
        }


        res.status(500).json({
            sucesso: false,
            mensagem:
                "Erro ao finalizar venda"
        });
    }
});


// ==========================================
// VENDAS DE HOJE
// ==========================================
router.get("/hoje", (req, res) => {
    try {

        const dados = db.prepare(`
            SELECT
                COUNT(*) AS quantidade_vendas,
                COALESCE(
                    SUM(total),
                    0
                ) AS faturamento
            FROM vendas
            WHERE
                status = 'finalizada'
                AND DATE(criado_em)
                    = DATE('now', 'localtime')
        `).get();


        res.json(dados);

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem:
                "Erro ao carregar vendas do dia"
        });
    }
});


// ==========================================
// ÚLTIMAS VENDAS
// ==========================================
// =====================================================
// HISTÓRICO DE VENDAS COM PAGINAÇÃO
// =====================================================

router.get("/", (req, res) => {
    try {

        const pagina =
            Math.max(
                Number(req.query.pagina || 1),
                1
            );

        const limite =
            Math.min(
                Math.max(
                    Number(req.query.limite || 20),
                    1
                ),
                100
            );

        const offset =
            (pagina - 1) * limite;


        const totalRegistro =
            db.prepare(`
                SELECT COUNT(*) AS total
                FROM vendas
            `).get();


        const vendas =
            db.prepare(`
                SELECT
                    v.id,
                    v.subtotal,
                    v.desconto,
                    v.total,
                    v.status,
                    v.criado_em,
                    tv.nome AS tipo_venda
                FROM vendas v

                INNER JOIN tipos_venda tv
                    ON tv.id = v.tipo_venda_id

                ORDER BY v.id DESC

                LIMIT ?
                OFFSET ?
            `).all(
                limite,
                offset
            );


        const total =
            Number(
                totalRegistro.total || 0
            );

        const totalPaginas =
            Math.max(
                Math.ceil(
                    total / limite
                ),
                1
            );


        res.json({
            sucesso: true,

            pagina,

            limite,

            total,

            total_paginas:
                totalPaginas,

            dados:
                vendas
        });


    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem:
                "Erro ao carregar vendas"
        });

    }
});


// =====================================================
// DETALHES DE UMA VENDA
// =====================================================
// ROTAS ESTÁTICAS DO PDV
// Devem ficar antes de /:id para não serem interpretadas como ID.
// =====================================================

router.get("/pdv/destaques", (req, res) => {
    try {
        const config = db.prepare(`
            SELECT
                pdv_exibir_destaques,
                pdv_quantidade_destaques
            FROM configuracoes
            WHERE id = 1
        `).get() || {};

        if (
            Number(
                config.pdv_exibir_destaques ?? 1
            ) !== 1
        ) {
            return res.json({
                sucesso: true,
                produtos: []
            });
        }

        const limite = Math.max(
            1,
            Math.min(
                12,
                Number(
                    config.pdv_quantidade_destaques ??
                    8
                )
            )
        );

        const produtos = db.prepare(`
            SELECT
                p.id,
                p.nome,
                p.codigo_barras,
                p.preco_venda,
                p.quantidade,
                p.estoque_minimo,
                p.categoria_id,
                COALESCE(SUM(iv.quantidade), 0) AS quantidade_vendida
            FROM produtos p
            LEFT JOIN itens_venda iv
                ON iv.produto_id = p.id
            LEFT JOIN vendas v
                ON v.id = iv.venda_id
               AND v.status = 'finalizada'
               AND DATE(v.criado_em, 'localtime') >= DATE('now', 'localtime', '-29 days')
            GROUP BY
                p.id, p.nome, p.codigo_barras, p.preco_venda,
                p.quantidade, p.estoque_minimo, p.categoria_id
            HAVING quantidade_vendida > 0
            ORDER BY quantidade_vendida DESC, p.nome ASC
            LIMIT ?
        `).all(limite);

        res.json({
            sucesso: true,
            produtos
        });
    } catch (erro) {
        console.error("Erro ao carregar destaques do PDV:", erro);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao carregar produtos mais vendidos."
        });
    }
});

router.get("/ultima/repetir", (req, res) => {
    try {
        const venda = db.prepare(`
            SELECT
                id,
                tipo_venda_id,
                desconto,
                total,
                criado_em
            FROM vendas
            WHERE status = 'finalizada'
            ORDER BY id DESC
            LIMIT 1
        `).get();

        if (!venda) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Ainda não existe uma venda finalizada para repetir."
            });
        }

        const itens = db.prepare(`
            SELECT
                iv.produto_id,
                iv.quantidade,
                p.nome,
                p.preco_venda,
                p.quantidade AS estoque_atual
            FROM itens_venda iv
            INNER JOIN produtos p
                ON p.id = iv.produto_id
            WHERE iv.venda_id = ?
            ORDER BY iv.id
        `).all(venda.id);

        res.json({
            sucesso: true,
            venda,
            itens
        });
    } catch (erro) {
        console.error("Erro ao carregar última venda:", erro);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao carregar a última venda."
        });
    }
});

// =====================================================

router.get("/:id", (req, res) => {
    try {
        const vendaId = Number(req.params.id);

        const venda = db.prepare(`
            SELECT
                v.id,
                v.subtotal,
                v.desconto,
                v.total,
                v.status,
                v.criado_em,
                tv.nome AS tipo_venda
            FROM vendas v
            INNER JOIN tipos_venda tv
                ON tv.id = v.tipo_venda_id
            WHERE v.id = ?
        `).get(vendaId);

        if (!venda) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Venda não encontrada"
            });
        }

        const itens = db.prepare(`
            SELECT
                iv.produto_id,
                p.nome,
                p.codigo_barras,
                iv.quantidade,
                iv.preco_unitario,
                iv.subtotal
            FROM itens_venda iv
            INNER JOIN produtos p
                ON p.id = iv.produto_id
            WHERE iv.venda_id = ?
            ORDER BY iv.id
        `).all(vendaId);

        const pagamentos = db.prepare(`
            SELECT
                forma_pagamento,
                valor,
                valor_recebido,
                troco
            FROM pagamentos_venda
            WHERE venda_id = ?
        `).all(vendaId);

        res.json({
            sucesso: true,
            venda,
            itens,
            pagamentos
        });

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao carregar venda"
        });
    }
});


// =====================================================
// CANCELAR VENDA
// =====================================================

router.post("/:id/cancelar", (req, res) => {
    try {
        const vendaId = Number(req.params.id);

        const cancelarVenda = db.transaction(() => {

            const venda = db.prepare(`
                SELECT *
                FROM vendas
                WHERE id = ?
            `).get(vendaId);

            if (!venda) {
                throw new Error("VENDA_NAO_ENCONTRADA");
            }

            if (venda.status === "cancelada") {
                throw new Error("VENDA_JA_CANCELADA");
            }

            const itens = db.prepare(`
                SELECT
                    iv.produto_id,
                    iv.quantidade,
                    p.tipo_estoque
                FROM itens_venda iv
                INNER JOIN produtos p
                    ON p.id = iv.produto_id
                WHERE iv.venda_id = ?
            `).all(vendaId);

            const devolverEstoque = db.prepare(`
                UPDATE produtos
                SET quantidade = quantidade + ?
                WHERE id = ?
            `);

            const registrarMovimentacao = db.prepare(`
                INSERT INTO movimentacoes_estoque
                (
                    produto_id,
                    tipo,
                    quantidade,
                    motivo,
                    venda_id
                )
                VALUES (
                    ?,
                    'entrada',
                    ?,
                    'Cancelamento de venda',
                    ?
                )
            `);

            for (const item of itens) {

                const tipoEstoqueItem =
                    item.tipo_estoque ||
                    "normal";

                if (tipoEstoqueItem === "fracionado") {
                    devolverFracionado(
                        item.produto_id,
                        item.quantidade,
                        vendaId
                    );

                } else if (tipoEstoqueItem === "kit") {
                    devolverKit(
                        item.produto_id,
                        item.quantidade,
                        vendaId
                    );

                } else {
                    devolverEstoque.run(
                        item.quantidade,
                        item.produto_id
                    );

                    registrarMovimentacao.run(
                        item.produto_id,
                        item.quantidade,
                        vendaId
                    );
                }
            }

            db.prepare(`
                UPDATE vendas
                SET status = 'cancelada'
                WHERE id = ?
            `).run(vendaId);

            const pagamentosCancelados =
                db.prepare(`
                    SELECT
                        forma_pagamento,
                        valor
                    FROM pagamentos_venda
                    WHERE venda_id = ?
                    ORDER BY id
                `).all(vendaId);

            registrarAuditoria(
                req, "VENDA_CANCELADA", "venda", vendaId,
                `Venda #${vendaId} cancelada e estoque restaurado`,
                {
                    itens_restaurados: itens.length,
                    total: venda.total,
                    pagamentos: pagamentosCancelados
                }
            );
        });

        cancelarVenda();

        res.json({
            sucesso: true,
            mensagem: "Venda cancelada e estoque restaurado"
        });

    } catch (erro) {
        console.error(erro);

        if (erro.message === "VENDA_NAO_ENCONTRADA") {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Venda não encontrada"
            });
        }

        if (erro.message === "VENDA_JA_CANCELADA") {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Esta venda já foi cancelada"
            });
        }

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao cancelar venda"
        });
    }
});



// =====================================================
// DESTAQUES DO PDV
// Produtos mais vendidos nos últimos 30 dias
// =====================================================

// =====================================================
// ÚLTIMA VENDA PARA REPETIÇÃO NO PDV
// Apenas devolve a composição da venda; não finaliza nada.
// =====================================================

module.exports = router;
