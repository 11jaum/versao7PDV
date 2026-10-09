const express = require("express");
const router = express.Router();
const db = require("../database");
const registrarAuditoria = require("../utils/auditoria");
const {
    calcularUnidadesFisicasInteirasDisponiveis
} = require("../utils/fracionado");

function bloquearMovimentacaoFracionado(produto, res) {
    const tipo =
        produto?.tipo_estoque ||
        "normal";

    if (!["fracionado", "kit"].includes(tipo)) {
        return false;
    }

    res.status(400).json({
        sucesso: false,
        mensagem:
            tipo === "kit"
                ? "O estoque deste Kit/Combo é calculado automaticamente pelos produtos físicos vinculados. Movimente as cervejas, garrafas ou demais itens físicos."
                : "O estoque deste produto é calculado automaticamente pelos produtos físicos vinculados. Movimente a garrafa, energético ou outro item físico."
    });

    return true;
}

// ==========================================
// LISTAR HISTÓRICO DE MOVIMENTAÇÕES
// ==========================================
router.get("/movimentacoes", (req, res) => {
    try {
        const { produto_id, tipo } = req.query;

        let sql = `
            SELECT
                m.id,
                m.produto_id,
                p.nome AS produto,
                p.codigo_barras,
                m.tipo,
                m.quantidade,
                m.motivo,
                m.venda_id,
                m.criado_em
            FROM movimentacoes_estoque m
            INNER JOIN produtos p
                ON p.id = m.produto_id
            WHERE 1 = 1
        `;

        const parametros = [];

        if (produto_id) {
            sql += ` AND m.produto_id = ?`;
            parametros.push(produto_id);
        }

        if (tipo) {
            sql += ` AND m.tipo = ?`;
            parametros.push(tipo);
        }

        sql += ` ORDER BY m.id DESC`;

        const movimentacoes = db.prepare(sql).all(...parametros);

        res.json(movimentacoes);

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao carregar movimentações"
        });
    }
});


// ==========================================
// ENTRADA DE ESTOQUE
// ==========================================
router.post("/entrada", (req, res) => {
    try {
        const {
            produto_id,
            quantidade,
            motivo
        } = req.body;

        const qtd = Number(quantidade);

        if (!produto_id || !Number.isInteger(qtd) || qtd <= 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Produto e quantidade válida são obrigatórios"
            });
        }

        const produto = db.prepare(`
            SELECT *
            FROM produtos
            WHERE id = ?
        `).get(produto_id);

        if (!produto) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Produto não encontrado"
            });
        }

        if (Number(produto.ativo) !== 1) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Produto desativado não pode receber movimentação de estoque."
            });
        }

        if (bloquearMovimentacaoFracionado(produto, res)) {
            return;
        }

        const movimentar = db.transaction(() => {

            db.prepare(`
                UPDATE produtos
                SET quantidade = quantidade + ?
                WHERE id = ?
            `).run(qtd, produto_id);

            db.prepare(`
                INSERT INTO movimentacoes_estoque
                (
                    produto_id,
                    tipo,
                    quantidade,
                    motivo
                )
                VALUES (?, 'entrada', ?, ?)
            `).run(
                produto_id,
                qtd,
                motivo || "Entrada de estoque"
            );
        });

        movimentar();

        registrarAuditoria(req, "ESTOQUE_ENTRADA", "produto", Number(produto_id),
            `Entrada de ${qtd} unidade(s) em ${produto.nome}`, { quantidade: qtd, motivo: motivo || "Entrada de estoque" });

        const atualizado = db.prepare(`
            SELECT quantidade
            FROM produtos
            WHERE id = ?
        `).get(produto_id);

        res.json({
            sucesso: true,
            mensagem: "Entrada registrada com sucesso",
            estoque_atual: atualizado.quantidade
        });

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao registrar entrada"
        });
    }
});


// ==========================================
// SAÍDA MANUAL
// ==========================================
router.post("/saida", (req, res) => {
    try {
        const {
            produto_id,
            quantidade,
            motivo
        } = req.body;

        const qtd = Number(quantidade);

        if (!produto_id || !Number.isInteger(qtd) || qtd <= 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Produto e quantidade válida são obrigatórios"
            });
        }

        const produto = db.prepare(`
            SELECT *
            FROM produtos
            WHERE id = ?
        `).get(produto_id);

        if (!produto) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Produto não encontrado"
            });
        }

        if (Number(produto.ativo) !== 1) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Produto desativado não pode receber movimentação de estoque."
            });
        }

        if (bloquearMovimentacaoFracionado(produto, res)) {
            return;
        }

        const disponivelInteiro =
            calcularUnidadesFisicasInteirasDisponiveis(
                produto.id
            );

        if (disponivelInteiro < qtd) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    disponivelInteiro < Number(produto.quantidade || 0)
                        ? "Estoque insuficiente em unidades inteiras. Uma unidade está parcialmente consumida por um produto fracionado."
                        : "Estoque insuficiente",
                estoque_atual: produto.quantidade,
                estoque_inteiro_disponivel: disponivelInteiro
            });
        }

        const movimentar = db.transaction(() => {

            db.prepare(`
                UPDATE produtos
                SET quantidade = quantidade - ?
                WHERE id = ?
            `).run(qtd, produto_id);

            db.prepare(`
                INSERT INTO movimentacoes_estoque
                (
                    produto_id,
                    tipo,
                    quantidade,
                    motivo
                )
                VALUES (?, 'saida', ?, ?)
            `).run(
                produto_id,
                qtd,
                motivo || "Saída manual"
            );
        });

        movimentar();

        registrarAuditoria(req, "ESTOQUE_SAIDA", "produto", Number(produto_id),
            `Saída manual de ${qtd} unidade(s) de ${produto.nome}`, { quantidade: qtd, motivo: motivo || "Saída manual" });

        const atualizado = db.prepare(`
            SELECT quantidade
            FROM produtos
            WHERE id = ?
        `).get(produto_id);

        res.json({
            sucesso: true,
            mensagem: "Saída registrada com sucesso",
            estoque_atual: atualizado.quantidade
        });

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao registrar saída"
        });
    }
});


// ==========================================
// PERDA / QUEBRA / VENCIMENTO
// ==========================================
router.post("/perda", (req, res) => {
    try {
        const {
            produto_id,
            quantidade,
            motivo
        } = req.body;

        const qtd = Number(quantidade);

        if (!produto_id || !Number.isInteger(qtd) || qtd <= 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Produto e quantidade válida são obrigatórios"
            });
        }

        const produto = db.prepare(`
            SELECT *
            FROM produtos
            WHERE id = ?
        `).get(produto_id);

        if (!produto) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Produto não encontrado"
            });
        }

        if (Number(produto.ativo) !== 1) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Produto desativado não pode receber movimentação de estoque."
            });
        }

        if (bloquearMovimentacaoFracionado(produto, res)) {
            return;
        }

        const disponivelInteiro =
            calcularUnidadesFisicasInteirasDisponiveis(
                produto.id
            );

        if (disponivelInteiro < qtd) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    disponivelInteiro < Number(produto.quantidade || 0)
                        ? "A perda informada atingiria uma unidade parcialmente usada por produto fracionado. Ajuste primeiro o consumo fracionado ou mantenha essa unidade física."
                        : "Quantidade de perda maior que o estoque atual",
                estoque_atual: produto.quantidade,
                estoque_inteiro_disponivel: disponivelInteiro
            });
        }

        const movimentar = db.transaction(() => {

            db.prepare(`
                UPDATE produtos
                SET quantidade = quantidade - ?
                WHERE id = ?
            `).run(qtd, produto_id);

            db.prepare(`
                INSERT INTO movimentacoes_estoque
                (
                    produto_id,
                    tipo,
                    quantidade,
                    motivo
                )
                VALUES (?, 'perda', ?, ?)
            `).run(
                produto_id,
                qtd,
                motivo || "Perda / quebra"
            );
        });

        movimentar();

        registrarAuditoria(req, "ESTOQUE_PERDA", "produto", Number(produto_id),
            `Perda de ${qtd} unidade(s) de ${produto.nome}`, { quantidade: qtd, motivo: motivo || "Perda / quebra" });

        const atualizado = db.prepare(`
            SELECT quantidade
            FROM produtos
            WHERE id = ?
        `).get(produto_id);

        res.json({
            sucesso: true,
            mensagem: "Perda registrada com sucesso",
            estoque_atual: atualizado.quantidade
        });

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao registrar perda"
        });
    }
});


// ==========================================
// AJUSTE DE INVENTÁRIO
// ==========================================
router.post("/ajuste", (req, res) => {
    try {
        const {
            produto_id,
            quantidade_real,
            motivo
        } = req.body;

        const qtdReal = Number(quantidade_real);

        if (
            !produto_id ||
            !Number.isInteger(qtdReal) ||
            qtdReal < 0
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Produto e quantidade real válida são obrigatórios"
            });
        }

        const produto = db.prepare(`
            SELECT *
            FROM produtos
            WHERE id = ?
        `).get(produto_id);

        if (!produto) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Produto não encontrado"
            });
        }

        if (Number(produto.ativo) !== 1) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Produto desativado não pode receber movimentação de estoque."
            });
        }

        if (bloquearMovimentacaoFracionado(produto, res)) {
            return;
        }

        const estoqueAnterior = produto.quantidade;
        const diferenca = qtdReal - estoqueAnterior;

        if (diferenca === 0) {
            return res.json({
                sucesso: true,
                mensagem: "Estoque já está correto",
                estoque_anterior: estoqueAnterior,
                estoque_atual: qtdReal
            });
        }

        const tipo =
            diferenca > 0
                ? "ajuste_entrada"
                : "ajuste_saida";

        const quantidadeMovimentada = Math.abs(diferenca);

        const movimentar = db.transaction(() => {

            db.prepare(`
                UPDATE produtos
                SET quantidade = ?
                WHERE id = ?
            `).run(qtdReal, produto_id);

            if (qtdReal === 0) {
                db.prepare(`
                    UPDATE produto_fracionado_componentes
                    SET fracao_atual = 0
                    WHERE produto_estoque_id = ?
                `).run(produto_id);
            }

            db.prepare(`
                INSERT INTO movimentacoes_estoque
                (
                    produto_id,
                    tipo,
                    quantidade,
                    motivo
                )
                VALUES (?, ?, ?, ?)
            `).run(
                produto_id,
                tipo,
                quantidadeMovimentada,
                motivo || "Ajuste de inventário"
            );
        });

        movimentar();

        registrarAuditoria(req, "ESTOQUE_AJUSTE", "produto", Number(produto_id),
            `Estoque de ${produto.nome} ajustado de ${estoqueAnterior} para ${qtdReal}`,
            { estoque_anterior: estoqueAnterior, estoque_atual: qtdReal, diferenca, motivo: motivo || "Ajuste de inventário" });

        res.json({
            sucesso: true,
            mensagem: "Estoque ajustado com sucesso",
            estoque_anterior: estoqueAnterior,
            estoque_atual: qtdReal,
            diferenca: diferenca
        });

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao ajustar estoque"
        });
    }
});


// ==========================================
// RESUMO DO ESTOQUE
// ==========================================
router.get("/resumo", (req, res) => {
    try {
        const resumo = db.prepare(`
            SELECT
                COUNT(*) AS total_produtos,

                COALESCE(
                    SUM(
                        CASE
                            WHEN COALESCE(tipo_estoque, 'normal') = 'normal'
                            THEN quantidade
                            ELSE 0
                        END
                    ),
                    0
                ) AS total_itens,

                COALESCE(
                    SUM(
                        CASE
                            WHEN COALESCE(tipo_estoque, 'normal') = 'normal'
                            THEN quantidade * preco_custo
                            ELSE 0
                        END
                    ),
                    0
                ) AS valor_custo_estoque,

                COALESCE(
                    SUM(
                        CASE
                            WHEN COALESCE(tipo_estoque, 'normal') = 'normal'
                            THEN quantidade * preco_venda
                            ELSE 0
                        END
                    ),
                    0
                ) AS valor_venda_estoque,

                COALESCE(SUM(
                    CASE
                        WHEN COALESCE(tipo_estoque, 'normal') = 'normal'
                         AND quantidade <= estoque_minimo
                        THEN 1
                        ELSE 0
                    END
                ), 0) AS estoque_baixo,

                COALESCE(SUM(
                    CASE
                        WHEN COALESCE(tipo_estoque, 'normal') = 'normal'
                         AND quantidade = 0
                        THEN 1
                        ELSE 0
                    END
                ), 0) AS sem_estoque

            FROM produtos
            WHERE ativo = 1
        `).get();

        const administrador =
            req.session?.usuario?.perfil === "administrador";

        if (!administrador) {
            delete resumo.valor_custo_estoque;
        }

        res.json(resumo);

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao carregar resumo"
        });
    }
});



// ==========================================
// ALERTAS DO DASHBOARD
// ==========================================
router.get("/alertas-dashboard", (req, res) => {
    try {
        const semEstoque = db.prepare(`
            SELECT COUNT(*) AS total
            FROM produtos
            WHERE ativo = 1
              AND COALESCE(tipo_estoque, 'normal') = 'normal'
              AND quantidade <= 0
        `).get();

        const estoqueBaixo = db.prepare(`
            SELECT COUNT(*) AS total
            FROM produtos
            WHERE ativo = 1
              AND COALESCE(tipo_estoque, 'normal') = 'normal'
              AND quantidade > 0
              AND quantidade <= estoque_minimo
        `).get();

        const vencemSemana = db.prepare(`
            SELECT COUNT(*) AS total
            FROM produtos
            WHERE ativo = 1
              AND quantidade > 0
              AND data_validade IS NOT NULL
              AND DATE(data_validade) >= DATE('now', 'localtime')
              AND DATE(data_validade) <= DATE('now', 'localtime', '+7 days')
        `).get();

        const vencidos = db.prepare(`
            SELECT COUNT(*) AS total
            FROM produtos
            WHERE ativo = 1
              AND quantidade > 0
              AND data_validade IS NOT NULL
              AND DATE(data_validade) < DATE('now', 'localtime')
        `).get();

        const produtosValidade = db.prepare(`
            SELECT
                id,
                nome,
                quantidade,
                unidade,
                data_validade,
                CAST(
                    julianday(DATE(data_validade)) -
                    julianday(DATE('now', 'localtime'))
                    AS INTEGER
                ) AS dias_restantes
            FROM produtos
            WHERE ativo = 1
              AND quantidade > 0
              AND data_validade IS NOT NULL
              AND DATE(data_validade) <= DATE('now', 'localtime', '+30 days')
            ORDER BY DATE(data_validade), nome
            LIMIT 10
        `).all();

        const perdasMes = db.prepare(`
            SELECT
                COALESCE(SUM(m.quantidade), 0) AS quantidade,
                COALESCE(SUM(
                    m.quantidade * COALESCE(p.preco_custo, 0)
                ), 0) AS custo
            FROM movimentacoes_estoque m
            INNER JOIN produtos p
                ON p.id = m.produto_id
            WHERE m.tipo = 'perda'
              AND strftime('%Y-%m', m.criado_em, 'localtime')
                  = strftime('%Y-%m', 'now', 'localtime')
        `).get();

        const resposta = {
            sucesso: true,
            sem_estoque: Number(semEstoque.total || 0),
            estoque_baixo: Number(estoqueBaixo.total || 0),
            vencem_semana: Number(vencemSemana.total || 0),
            vencidos: Number(vencidos.total || 0),
            produtos_validade: produtosValidade,
            perdas_mes_quantidade: Number(perdasMes.quantidade || 0)
        };

        if (req.session?.usuario?.perfil === "administrador") {
            resposta.perdas_mes_custo = Number(perdasMes.custo || 0);
        }

        res.json(resposta);

    } catch (erro) {
        console.error("Erro ao carregar alertas do dashboard:", erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao carregar alertas do dashboard."
        });
    }
});

module.exports = router;