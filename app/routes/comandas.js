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

const FORMAS_PAGAMENTO = [
    "dinheiro",
    "pix",
    "debito",
    "credito"
];

function agruparItensComanda(itens) {
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

        const total =
            (agrupados.get(produtoId) || 0) +
            quantidade;

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

function obterComanda(id) {
    return db.prepare(`
        SELECT
            c.*,
            COALESCE(SUM(ci.quantidade), 0) AS quantidade_itens,
            COALESCE(SUM(ci.subtotal), 0) AS subtotal
        FROM comandas c
        LEFT JOIN comanda_itens ci
            ON ci.comanda_id = c.id
        WHERE c.id = ?
        GROUP BY c.id
    `).get(id);
}

function obterDetalhes(id) {
    const comanda = obterComanda(id);
    if (!comanda) return null;

    const itens = db.prepare(`
        SELECT
            ci.id,
            ci.produto_id,
            ci.produto_nome,
            ci.quantidade,
            ci.preco_unitario,
            ci.custo_unitario,
            ci.subtotal,
            ci.criado_em
        FROM comanda_itens ci
        WHERE ci.comanda_id = ?
        ORDER BY ci.id
    `).all(id);

    return {
        ...comanda,
        subtotal: Number(comanda.subtotal || 0),
        quantidade_itens: Number(comanda.quantidade_itens || 0),
        itens
    };
}

function validarComandaAberta(id) {
    const comanda = db.prepare(`
        SELECT *
        FROM comandas
        WHERE id = ?
    `).get(id);

    if (!comanda) {
        throw new Error("COMANDA_NAO_ENCONTRADA");
    }

    if (comanda.status !== "aberta") {
        throw new Error("COMANDA_FECHADA");
    }

    return comanda;
}

function respostaErro(res, erro) {
    const mapa = {
        COMANDA_NAO_ENCONTRADA: [404, "Comanda não encontrada."],
        COMANDA_FECHADA: [400, "Esta comanda não está mais aberta."],
        COMANDA_SEM_ITENS: [400, "A comanda está vazia."],
        ITEM_INVALIDO: [400, "Existe um item inválido."],
        PRODUTO_NAO_ENCONTRADO: [400, "Produto não encontrado ou desativado."],
        PAGAMENTOS_INVALIDOS: [400, "Os dados de pagamento são inválidos."],
        FORMA_PAGAMENTO_INVALIDA: [400, "Forma de pagamento inválida."],
        FORMAS_PAGAMENTO_IGUAIS: [400, "Escolha duas formas de pagamento diferentes."],
        TOTAL_PAGAMENTOS_DIVERGENTE: [400, "A soma dos pagamentos deve ser igual ao total da comanda."],
        VALOR_RECEBIDO_INSUFICIENTE: [400, "O valor recebido em dinheiro é insuficiente."],
        DESCONTO_INVALIDO: [400, "Desconto inválido."],
        DESCONTO_MAIOR_TOTAL: [400, "O desconto não pode ser maior que o total da comanda."],
        DESCONTO_ACIMA_LIMITE: [400, "O desconto ultrapassa o limite configurado para o PDV."],
        CAIXA_FECHADO: [400, "Abra o caixa antes de receber uma comanda."],
        TIPO_VENDA_INVALIDO: [400, "Tipo de venda inválido."],
        ITEM_COMANDA_NAO_ENCONTRADO: [404, "Item da comanda não encontrado."]
    };

    if (erro.message?.startsWith("ESTOQUE_INSUFICIENTE:")) {
        const [, nome, disponivel] = erro.message.split(":");
        return res.status(400).json({
            sucesso: false,
            mensagem: `Estoque insuficiente para ${nome}. Disponível: ${disponivel}`
        });
    }

    if (erro.message === "FRACIONADO_SEM_COMPONENTES") {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Produto fracionado sem ingredientes configurados. Revise o cadastro do produto."
        });
    }

    if (erro.message?.startsWith("ESTOQUE_FRACIONADO_INSUFICIENTE:")) {
        const partes = erro.message.split(":");
        return res.status(400).json({
            sucesso: false,
            mensagem: `Estoque fracionado insuficiente. Disponível: ${partes[2] || 0}.`
        });
    }

    if (erro.message === "KIT_SEM_COMPONENTES") {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Kit/Combo sem produtos físicos configurados. Revise o cadastro do produto."
        });
    }

    if (erro.message?.startsWith("ESTOQUE_KIT_INSUFICIENTE:")) {
        const partes = erro.message.split(":");
        return res.status(400).json({
            sucesso: false,
            mensagem: `Estoque insuficiente para o Kit/Combo. Disponível: ${partes[2] || 0}.`
        });
    }

    if (erro.message?.startsWith("ESTOQUE_KIT_COMPONENTE_INSUFICIENTE:")) {
        const partes = erro.message.split(":");
        return res.status(400).json({
            sucesso: false,
            mensagem: `Estoque insuficiente no produto ${partes[1] || "vinculado"}. Disponível: ${partes[2] || 0}; necessário: ${partes[3] || 0}.`
        });
    }

    if (erro.message?.startsWith("ESTOQUE_VINCULADO_INSUFICIENTE:")) {
        const partes = erro.message.split(":");
        return res.status(400).json({
            sucesso: false,
            mensagem: `Estoque insuficiente no ingrediente ${partes.slice(1).join(":")}.`
        });
    }

    if (mapa[erro.message]) {
        const [status, mensagem] = mapa[erro.message];
        return res.status(status).json({ sucesso: false, mensagem });
    }

    console.error(erro);
    return res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao processar a comanda."
    });
}

// LISTAR COMANDAS ABERTAS / HISTÓRICO CURTO
router.get("/", (req, res) => {
    try {
        const status = String(req.query.status || "aberta");
        const permitidos = ["aberta", "finalizada", "cancelada", "todas"];
        const filtro = permitidos.includes(status) ? status : "aberta";

        const where = filtro === "todas" ? "" : "WHERE c.status = ?";
        const params = filtro === "todas" ? [] : [filtro];

        const comandas = db.prepare(`
            SELECT
                c.id,
                c.nome,
                c.observacao,
                c.status,
                c.usuario_abertura_nome,
                c.venda_id,
                c.criado_em,
                c.atualizado_em,
                c.finalizado_em,
                COALESCE(SUM(ci.quantidade), 0) AS quantidade_itens,
                COALESCE(SUM(ci.subtotal), 0) AS subtotal
            FROM comandas c
            LEFT JOIN comanda_itens ci
                ON ci.comanda_id = c.id
            ${where}
            GROUP BY c.id
            ORDER BY
                CASE WHEN c.status = 'aberta' THEN 0 ELSE 1 END,
                c.atualizado_em DESC,
                c.id DESC
            LIMIT 200
        `).all(...params);

        res.json(comandas.map(comanda => ({
            ...comanda,
            quantidade_itens: Number(comanda.quantidade_itens || 0),
            subtotal: Number(comanda.subtotal || 0)
        })));
    } catch (erro) {
        respostaErro(res, erro);
    }
});

router.get("/:id", (req, res) => {
    try {
        const detalhes = obterDetalhes(Number(req.params.id));
        if (!detalhes) throw new Error("COMANDA_NAO_ENCONTRADA");
        res.json(detalhes);
    } catch (erro) {
        respostaErro(res, erro);
    }
});

// ABRIR NOVA COMANDA
router.post("/", (req, res) => {
    try {
        const nome = String(req.body.nome || "").trim();
        const observacao = String(req.body.observacao || "").trim();

        if (!nome) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Informe o nome, número ou identificação da comanda."
            });
        }

        const usuario = req.session?.usuario || {};
        const resultado = db.prepare(`
            INSERT INTO comandas (
                nome,
                observacao,
                usuario_abertura_id,
                usuario_abertura_nome
            )
            VALUES (?, ?, ?, ?)
        `).run(
            nome.slice(0, 80),
            observacao.slice(0, 250),
            usuario.id || null,
            usuario.nome || usuario.usuario || "Usuário"
        );

        const id = Number(resultado.lastInsertRowid);

        registrarAuditoria(
            req,
            "COMANDA_ABERTA",
            "comanda",
            id,
            `Comanda #${id} aberta: ${nome}`,
            { nome, observacao }
        );

        res.status(201).json({
            sucesso: true,
            mensagem: "Comanda aberta com sucesso.",
            comanda: obterDetalhes(id)
        });
    } catch (erro) {
        respostaErro(res, erro);
    }
});

// ADICIONAR ITENS - o estoque é reservado/baixado imediatamente
router.post("/:id/itens", (req, res) => {
    try {
        const comandaId = Number(req.params.id);
        const itens = req.body.itens;

        if (!Array.isArray(itens) || !itens.length) {
            throw new Error("ITEM_INVALIDO");
        }

        const adicionar = db.transaction(() => {
            validarComandaAberta(comandaId);

            const preparados = [];
            const itensAgrupados =
                agruparItensComanda(itens);

            for (const item of itensAgrupados) {
                const produtoId = item.produto_id;
                const quantidade = item.quantidade;

                const produto = db.prepare(`
                    SELECT *
                    FROM produtos
                    WHERE id = ? AND ativo = 1
                `).get(produtoId);

                if (!produto) throw new Error("PRODUTO_NAO_ENCONTRADO");

                const tipoEstoque =
                    produto.tipo_estoque ||
                    "normal";

                const disponivel =
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

                if (disponivel < quantidade) {
                    throw new Error(`ESTOQUE_INSUFICIENTE:${produto.nome}:${disponivel}`);
                }

                preparados.push({
                    produto,
                    quantidade,
                    subtotal: Number((Number(produto.preco_venda || 0) * quantidade).toFixed(2))
                });
            }

            const inserir = db.prepare(`
                INSERT INTO comanda_itens (
                    comanda_id,
                    produto_id,
                    produto_nome,
                    quantidade,
                    preco_unitario,
                    custo_unitario,
                    subtotal
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            const baixar = db.prepare(`
                UPDATE produtos
                SET quantidade = quantidade - ?
                WHERE id = ?
            `);

            const registrarEstoque = db.prepare(`
                INSERT INTO movimentacoes_estoque (
                    produto_id,
                    tipo,
                    quantidade,
                    motivo,
                    venda_id
                )
                VALUES (?, 'saida', ?, ?, NULL)
            `);

            for (const item of preparados) {
                inserir.run(
                    comandaId,
                    item.produto.id,
                    item.produto.nome,
                    item.quantidade,
                    Number(item.produto.preco_venda || 0),
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
                        null
                    );
                } else if (tipoEstoqueItem === "kit") {
                    consumirKit(
                        item.produto.id,
                        item.quantidade,
                        null,
                        `Comanda #${comandaId} - Kit/Combo`
                    );
                } else {
                    const disponivelInteiro =
                        calcularUnidadesFisicasInteirasDisponiveis(
                            item.produto.id
                        );

                    if (disponivelInteiro < item.quantidade) {
                        throw new Error(
                            `ESTOQUE_INSUFICIENTE:${item.produto.nome}:${disponivelInteiro}`
                        );
                    }

                    baixar.run(item.quantidade, item.produto.id);
                    registrarEstoque.run(
                        item.produto.id,
                        item.quantidade,
                        `Comanda #${comandaId}`
                    );
                }
            }

            db.prepare(`
                UPDATE comandas
                SET atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(comandaId);
        });

        adicionar();

        registrarAuditoria(
            req,
            "COMANDA_ITENS_ADICIONADOS",
            "comanda",
            comandaId,
            `Itens adicionados à comanda #${comandaId}`,
            { itens }
        );

        res.json({
            sucesso: true,
            mensagem: "Itens adicionados à comanda.",
            comanda: obterDetalhes(comandaId)
        });
    } catch (erro) {
        respostaErro(res, erro);
    }
});

// REMOVER UMA LINHA DA COMANDA E DEVOLVER ESTOQUE
router.delete("/:id/itens/:itemId", (req, res) => {
    try {
        const comandaId = Number(req.params.id);
        const itemId = Number(req.params.itemId);

        const remover = db.transaction(() => {
            validarComandaAberta(comandaId);

            const item = db.prepare(`
                SELECT
                    ci.*,
                    p.tipo_estoque
                FROM comanda_itens ci
                INNER JOIN produtos p ON p.id = ci.produto_id
                WHERE ci.id = ? AND ci.comanda_id = ?
            `).get(itemId, comandaId);

            if (!item) throw new Error("ITEM_COMANDA_NAO_ENCONTRADO");

            const tipoEstoqueItem =
                item.tipo_estoque ||
                "normal";

            if (tipoEstoqueItem === "fracionado") {
                devolverFracionado(
                    item.produto_id,
                    item.quantidade,
                    null
                );
            } else if (tipoEstoqueItem === "kit") {
                devolverKit(
                    item.produto_id,
                    item.quantidade,
                    null,
                    `Remoção da comanda #${comandaId} - Kit/Combo`
                );
            } else {
                db.prepare(`
                    UPDATE produtos
                    SET quantidade = quantidade + ?
                    WHERE id = ?
                `).run(item.quantidade, item.produto_id);

                db.prepare(`
                    INSERT INTO movimentacoes_estoque (
                        produto_id, tipo, quantidade, motivo, venda_id
                    )
                    VALUES (?, 'entrada', ?, ?, NULL)
                `).run(
                    item.produto_id,
                    item.quantidade,
                    `Remoção da comanda #${comandaId}`
                );
            }

            db.prepare(`DELETE FROM comanda_itens WHERE id = ?`).run(itemId);
            db.prepare(`
                UPDATE comandas
                SET atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(comandaId);
        });

        remover();

        registrarAuditoria(
            req,
            "COMANDA_ITEM_REMOVIDO",
            "comanda",
            comandaId,
            `Item removido da comanda #${comandaId}`,
            { item_id: itemId }
        );

        res.json({
            sucesso: true,
            mensagem: "Item removido e estoque devolvido.",
            comanda: obterDetalhes(comandaId)
        });
    } catch (erro) {
        respostaErro(res, erro);
    }
});

// CANCELAR COMANDA: devolve todo o estoque reservado
router.post("/:id/cancelar", (req, res) => {
    try {
        const comandaId = Number(req.params.id);

        const cancelar = db.transaction(() => {
            validarComandaAberta(comandaId);

            const itens = db.prepare(`
                SELECT ci.*, p.tipo_estoque
                FROM comanda_itens ci
                INNER JOIN produtos p ON p.id = ci.produto_id
                WHERE ci.comanda_id = ?
            `).all(comandaId);

            for (const item of itens) {
                const tipoEstoqueItem =
                    item.tipo_estoque ||
                    "normal";

                if (tipoEstoqueItem === "fracionado") {
                    devolverFracionado(
                        item.produto_id,
                        item.quantidade,
                        null
                    );
                } else if (tipoEstoqueItem === "kit") {
                    devolverKit(
                        item.produto_id,
                        item.quantidade,
                        null,
                        `Cancelamento da comanda #${comandaId} - Kit/Combo`
                    );
                } else {
                    db.prepare(`
                        UPDATE produtos
                        SET quantidade = quantidade + ?
                        WHERE id = ?
                    `).run(item.quantidade, item.produto_id);

                    db.prepare(`
                        INSERT INTO movimentacoes_estoque (
                            produto_id, tipo, quantidade, motivo, venda_id
                        )
                        VALUES (?, 'entrada', ?, ?, NULL)
                    `).run(
                        item.produto_id,
                        item.quantidade,
                        `Cancelamento da comanda #${comandaId}`
                    );
                }
            }

            db.prepare(`
                UPDATE comandas
                SET
                    status = 'cancelada',
                    finalizado_em = CURRENT_TIMESTAMP,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(comandaId);
        });

        cancelar();

        registrarAuditoria(
            req,
            "COMANDA_CANCELADA",
            "comanda",
            comandaId,
            `Comanda #${comandaId} cancelada e estoque restaurado`
        );

        res.json({
            sucesso: true,
            mensagem: "Comanda cancelada e estoque restaurado."
        });
    } catch (erro) {
        respostaErro(res, erro);
    }
});

// RECEBER / FINALIZAR COMANDA
router.post("/:id/finalizar", (req, res) => {
    let limiteDesconto = 100;

    try {
        const comandaId = Number(req.params.id);
        const {
            tipo_venda_id,
            desconto,
            forma_pagamento,
            valor_recebido,
            pagamentos
        } = req.body;

        const configuracao = db.prepare(`
            SELECT
                pdv_permitir_desconto,
                pdv_desconto_maximo_percentual
            FROM configuracoes
            WHERE id = 1
        `).get() || {};

        const permitirDesconto =
            Number(
                configuracao.pdv_permitir_desconto ??
                1
            ) === 1;

        limiteDesconto =
            Number(
                configuracao
                    .pdv_desconto_maximo_percentual ??
                100
            );

        if (!Number.isFinite(limiteDesconto)) {
            limiteDesconto = 100;
        }

        limiteDesconto =
            Math.max(
                0,
                Math.min(
                    100,
                    limiteDesconto
                )
            );

        const finalizar = db.transaction(() => {
            const comanda = validarComandaAberta(comandaId);

            const caixa = db.prepare(`
                SELECT *
                FROM caixas
                WHERE status = 'aberto'
                ORDER BY id DESC
                LIMIT 1
            `).get();

            if (!caixa) throw new Error("CAIXA_FECHADO");

            const tipoVenda = db.prepare(`
                SELECT id FROM tipos_venda WHERE id = ?
            `).get(Number(tipo_venda_id));

            if (!tipoVenda) throw new Error("TIPO_VENDA_INVALIDO");

            const itens = db.prepare(`
                SELECT *
                FROM comanda_itens
                WHERE comanda_id = ?
                ORDER BY id
            `).all(comandaId);

            if (!itens.length) throw new Error("COMANDA_SEM_ITENS");

            const subtotal = Number(
                itens.reduce((soma, item) => soma + Number(item.subtotal || 0), 0).toFixed(2)
            );

            const descontoNumerico = Number(desconto || 0);
            if (!Number.isFinite(descontoNumerico) || descontoNumerico < 0) {
                throw new Error("DESCONTO_INVALIDO");
            }
            if (!permitirDesconto && descontoNumerico > 0) {
                throw new Error("DESCONTO_INVALIDO");
            }
            if (descontoNumerico > subtotal) throw new Error("DESCONTO_MAIOR_TOTAL");

            const percentual = subtotal > 0 ? (descontoNumerico / subtotal) * 100 : 0;
            if (percentual > limiteDesconto + 0.0001) {
                throw new Error("DESCONTO_ACIMA_LIMITE");
            }

            const total = Number((subtotal - descontoNumerico).toFixed(2));

            let listaPagamentos;
            if (total === 0) {
                listaPagamentos = [];
            } else if (Array.isArray(pagamentos) && pagamentos.length) {
                listaPagamentos = pagamentos.map(p => ({
                    forma_pagamento: String(p.forma_pagamento || ""),
                    valor: Number(p.valor),
                    valor_recebido: Number(p.valor_recebido || 0)
                }));
            } else {
                listaPagamentos = [{
                    forma_pagamento: String(forma_pagamento || ""),
                    valor: total,
                    valor_recebido: Number(valor_recebido || 0)
                }];
            }

            if (
                total > 0 &&
                (
                    listaPagamentos.length < 1 ||
                    listaPagamentos.length > 2
                )
            ) {
                throw new Error("PAGAMENTOS_INVALIDOS");
            }

            if (
                total === 0 &&
                listaPagamentos.length !== 0
            ) {
                throw new Error("PAGAMENTOS_INVALIDOS");
            }

            for (const pagamento of listaPagamentos) {
                if (!FORMAS_PAGAMENTO.includes(pagamento.forma_pagamento)) {
                    throw new Error("FORMA_PAGAMENTO_INVALIDA");
                }
                if (!Number.isFinite(pagamento.valor) || pagamento.valor <= 0) {
                    throw new Error("PAGAMENTOS_INVALIDOS");
                }
            }

            if (
                listaPagamentos.length === 2 &&
                listaPagamentos[0].forma_pagamento === listaPagamentos[1].forma_pagamento
            ) {
                throw new Error("FORMAS_PAGAMENTO_IGUAIS");
            }

            const soma = Number(
                listaPagamentos.reduce((t, p) => t + p.valor, 0).toFixed(2)
            );
            if (Math.abs(soma - total) > 0.009) {
                throw new Error("TOTAL_PAGAMENTOS_DIVERGENTE");
            }

            let recebidoTotal = 0;
            let trocoTotal = 0;
            listaPagamentos = listaPagamentos.map(p => {
                if (p.forma_pagamento !== "dinheiro") {
                    return { ...p, valor_recebido: 0, troco: 0 };
                }
                if (!Number.isFinite(p.valor_recebido) || p.valor_recebido < p.valor) {
                    throw new Error("VALOR_RECEBIDO_INSUFICIENTE");
                }
                const troco = Number((p.valor_recebido - p.valor).toFixed(2));
                recebidoTotal += p.valor_recebido;
                trocoTotal += troco;
                return { ...p, troco };
            });

            const venda = db.prepare(`
                INSERT INTO vendas (
                    caixa_id, tipo_venda_id, subtotal, desconto, total, status
                )
                VALUES (?, ?, ?, ?, ?, 'finalizada')
            `).run(
                caixa.id,
                Number(tipo_venda_id),
                subtotal,
                descontoNumerico,
                total
            );

            const vendaId = Number(venda.lastInsertRowid);

            const inserirItem = db.prepare(`
                INSERT INTO itens_venda (
                    venda_id, produto_id, quantidade,
                    preco_unitario, custo_unitario, subtotal
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            for (const item of itens) {
                inserirItem.run(
                    vendaId,
                    item.produto_id,
                    item.quantidade,
                    item.preco_unitario,
                    item.custo_unitario,
                    item.subtotal
                );
            }

            const inserirPagamento = db.prepare(`
                INSERT INTO pagamentos_venda (
                    venda_id, forma_pagamento, valor, valor_recebido, troco
                )
                VALUES (?, ?, ?, ?, ?)
            `);

            for (const pagamento of listaPagamentos) {
                inserirPagamento.run(
                    vendaId,
                    pagamento.forma_pagamento,
                    pagamento.valor,
                    pagamento.valor_recebido || 0,
                    pagamento.troco || 0
                );
            }

            db.prepare(`
                UPDATE comandas
                SET
                    status = 'finalizada',
                    venda_id = ?,
                    finalizado_em = CURRENT_TIMESTAMP,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(vendaId, comandaId);

            return {
                venda_id: vendaId,
                comanda_id: comandaId,
                comanda_nome: comanda.nome,
                subtotal,
                desconto: descontoNumerico,
                total,
                valor_recebido: Number(recebidoTotal.toFixed(2)),
                troco: Number(trocoTotal.toFixed(2)),
                pagamentos: listaPagamentos
            };
        });

        const resultado = finalizar();

        registrarAuditoria(
            req,
            "COMANDA_FINALIZADA",
            "comanda",
            comandaId,
            `Comanda #${comandaId} recebida na venda #${resultado.venda_id} - R$ ${resultado.total.toFixed(2)}`,
            resultado
        );

        res.json({
            sucesso: true,
            mensagem: "Comanda recebida com sucesso.",
            ...resultado
        });
    } catch (erro) {
        if (erro.message === "DESCONTO_ACIMA_LIMITE") {
            return res.status(400).json({
                sucesso: false,
                mensagem: `O desconto máximo permitido é ${limiteDesconto}% do subtotal.`
            });
        }
        respostaErro(res, erro);
    }
});

module.exports = router;
