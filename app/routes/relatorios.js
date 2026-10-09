const express = require("express");
const router = express.Router();

const db = require("../database");


// =====================================================
// RESUMO GERAL
// =====================================================

router.get("/resumo", (req, res) => {

    try {

        const hoje = db.prepare(`
            SELECT
                COUNT(*) AS quantidade_vendas,
                COALESCE(SUM(total), 0) AS faturamento
            FROM vendas
            WHERE status = 'finalizada'
            AND DATE(criado_em, 'localtime') =
                DATE('now', 'localtime')
        `).get();


        const ticketMedio =
            hoje.quantidade_vendas > 0
                ? hoje.faturamento /
                  hoje.quantidade_vendas
                : 0;


        const canceladas = db.prepare(`
            SELECT COUNT(*) AS total
            FROM vendas
            WHERE status = 'cancelada'
            AND DATE(criado_em, 'localtime') =
                DATE('now', 'localtime')
        `).get();


        res.json({
            sucesso: true,

            faturamento: hoje.faturamento,

            quantidade_vendas:
                hoje.quantidade_vendas,

            ticket_medio:
                ticketMedio,

            vendas_canceladas:
                canceladas.total
        });


    } catch (erro) {

        console.error(
            "Erro relatório resumo:",
            erro
        );

        res.status(500).json({
            sucesso: false,
            mensagem:
                "Erro ao carregar resumo"
        });

    }

});


// =====================================================
// FATURAMENTO POR FORMA DE PAGAMENTO
// =====================================================

router.get("/pagamentos", (req, res) => {

    try {

        const dados = db.prepare(`
            SELECT
                pv.forma_pagamento,
                COUNT(DISTINCT v.id)
                    AS quantidade_vendas,
                COALESCE(
                    SUM(pv.valor),
                    0
                ) AS total

            FROM pagamentos_venda pv

            INNER JOIN vendas v
                ON v.id = pv.venda_id

            WHERE v.status = 'finalizada'

            AND DATE(
                v.criado_em,
                'localtime'
            ) =
            DATE(
                'now',
                'localtime'
            )

            GROUP BY
                pv.forma_pagamento

            ORDER BY total DESC
        `).all();


        res.json({
            sucesso: true,
            dados
        });


    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem:
                "Erro ao carregar pagamentos"
        });

    }

});


// =====================================================
// VENDAS POR TIPO
// =====================================================

router.get("/tipos-venda", (req, res) => {

    try {

        const dados = db.prepare(`
            SELECT
                tv.nome,
                COUNT(v.id)
                    AS quantidade_vendas,
                COALESCE(
                    SUM(v.total),
                    0
                ) AS faturamento

            FROM vendas v

            INNER JOIN tipos_venda tv
                ON tv.id =
                   v.tipo_venda_id

            WHERE
                v.status =
                'finalizada'

            AND DATE(
                v.criado_em,
                'localtime'
            ) =
            DATE(
                'now',
                'localtime'
            )

            GROUP BY
                tv.id,
                tv.nome

            ORDER BY
                faturamento DESC
        `).all();


        res.json({
            sucesso: true,
            dados
        });


    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem:
                "Erro ao carregar tipos de venda"
        });

    }

});


// =====================================================
// PRODUTOS MAIS VENDIDOS
// =====================================================

router.get("/produtos", (req, res) => {

    try {

        const dados = db.prepare(`
            SELECT
                p.id,
                p.nome,

                SUM(iv.quantidade)
                    AS quantidade,

                SUM(iv.subtotal)
                    AS faturamento

            FROM itens_venda iv

            INNER JOIN vendas v
                ON v.id =
                   iv.venda_id

            INNER JOIN produtos p
                ON p.id =
                   iv.produto_id

            WHERE
                v.status =
                'finalizada'

            AND DATE(
                v.criado_em,
                'localtime'
            ) =
            DATE(
                'now',
                'localtime'
            )

            GROUP BY
                p.id,
                p.nome

            ORDER BY
                quantidade DESC

            LIMIT 10
        `).all();


        res.json({
            sucesso: true,
            dados
        });


    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem:
                "Erro ao carregar produtos vendidos"
        });

    }

});


// =====================================================
// ESTOQUE BAIXO
// =====================================================

router.get("/estoque-baixo", (req, res) => {

    try {

        const produtos = db.prepare(`
            SELECT
                id,
                nome,
                quantidade,
                estoque_minimo,
                unidade

            FROM produtos

            WHERE ativo = 1

            AND COALESCE(tipo_estoque, 'normal') = 'normal'

            AND quantidade <=
                estoque_minimo

            ORDER BY
                quantidade ASC,
                nome ASC
        `).all();


        res.json({
            sucesso: true,
            produtos
        });


    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem:
                "Erro ao carregar estoque baixo"
        });

    }

});

// =====================================================
// LUCRO DO DIA
// =====================================================

router.get("/lucro", (req, res) => {

    try {

        // Faturamento e descontos
        const vendas = db.prepare(`
            SELECT
                COUNT(*) AS total_vendas,

                COALESCE(
                    SUM(subtotal),
                    0
                ) AS subtotal,

                COALESCE(
                    SUM(desconto),
                    0
                ) AS descontos,

                COALESCE(
                    SUM(total),
                    0
                ) AS faturamento

            FROM vendas

            WHERE status = 'finalizada'

            AND DATE(
                criado_em,
                'localtime'
            ) =
            DATE(
                'now',
                'localtime'
            )
        `).get();


        // Custo dos produtos vendidos
        const custos = db.prepare(`
            SELECT

                COALESCE(
                    SUM(
                        iv.custo_unitario *
                        iv.quantidade
                    ),
                    0
                ) AS custo_total

            FROM itens_venda iv

            INNER JOIN vendas v
                ON v.id = iv.venda_id

            WHERE
                v.status = 'finalizada'

            AND DATE(
                v.criado_em,
                'localtime'
            ) =
            DATE(
                'now',
                'localtime'
            )
        `).get();


        const faturamento =
            Number(
                vendas.faturamento || 0
            );

        const custo =
            Number(
                custos.custo_total || 0
            );


        const lucro =
            faturamento - custo;


        const margem =
            faturamento > 0
                ? (
                    lucro /
                    faturamento
                ) * 100
                : 0;


        res.json({

            sucesso: true,

            faturamento:
                Number(
                    faturamento.toFixed(2)
                ),

            custo:
                Number(
                    custo.toFixed(2)
                ),

            lucro:
                Number(
                    lucro.toFixed(2)
                ),

            margem:
                Number(
                    margem.toFixed(2)
                ),

            descontos:
                Number(
                    Number(
                        vendas.descontos || 0
                    ).toFixed(2)
                ),

            total_vendas:
                vendas.total_vendas

        });


    } catch (erro) {

        console.error(
            "Erro relatório lucro:",
            erro
        );

        res.status(500).json({
            sucesso: false,
            mensagem:
                "Erro ao calcular lucro."
        });

    }

});


// =====================================================
// PRODUTOS MAIS LUCRATIVOS
// =====================================================

router.get(
    "/produtos-lucrativos",
    (req, res) => {

        try {

            const produtos =
                db.prepare(`
                    SELECT

                        p.id,
                        p.nome,

                        SUM(
                            iv.quantidade
                        ) AS quantidade_vendida,

                        SUM(
                            iv.preco_unitario *
                            iv.quantidade
                        ) AS faturamento_bruto,

                        SUM(
                            iv.custo_unitario *
                            iv.quantidade
                        ) AS custo,

                        SUM(
                            (
                                iv.preco_unitario -
                                iv.custo_unitario
                            ) *
                            iv.quantidade
                        ) AS lucro_bruto

                    FROM itens_venda iv

                    INNER JOIN vendas v
                        ON v.id =
                           iv.venda_id

                    INNER JOIN produtos p
                        ON p.id =
                           iv.produto_id

                    WHERE
                        v.status =
                        'finalizada'

                    AND DATE(
                        v.criado_em,
                        'localtime'
                    ) =
                    DATE(
                        'now',
                        'localtime'
                    )

                    GROUP BY
                        p.id,
                        p.nome

                    ORDER BY
                        lucro_bruto DESC

                    LIMIT 10
                `)
                .all();


            const dados =
                produtos.map(
                    produto => {

                        const faturamento =
                            Number(
                                produto
                                    .faturamento_bruto ||
                                0
                            );

                        const custo =
                            Number(
                                produto.custo ||
                                0
                            );

                        const lucro =
                            Number(
                                produto
                                    .lucro_bruto ||
                                0
                            );


                        const margem =
                            faturamento > 0
                                ? (
                                    lucro /
                                    faturamento
                                ) * 100
                                : 0;


                        return {

                            id:
                                produto.id,

                            nome:
                                produto.nome,

                            quantidade_vendida:
                                produto
                                    .quantidade_vendida,

                            faturamento:
                                Number(
                                    faturamento
                                        .toFixed(2)
                                ),

                            custo:
                                Number(
                                    custo
                                        .toFixed(2)
                                ),

                            lucro:
                                Number(
                                    lucro
                                        .toFixed(2)
                                ),

                            margem:
                                Number(
                                    margem
                                        .toFixed(2)
                                )

                        };

                    }
                );


            res.json({
                sucesso: true,
                dados
            });


        } catch (erro) {

            console.error(
                "Erro produtos lucrativos:",
                erro
            );

            res.status(500).json({
                sucesso: false,
                mensagem:
                    "Erro ao calcular produtos mais lucrativos."
            });

        }

    }
);

// =====================================================
// LUCRO POR PERÍODO
// =====================================================

router.get(
    "/lucro-periodo",
    (req, res) => {

        try {

            const inicio =
                req.query.inicio;

            const fim =
                req.query.fim;


            if (!inicio || !fim) {

                return res
                    .status(400)
                    .json({
                        sucesso: false,
                        mensagem:
                            "Informe a data inicial e final."
                    });
            }


            const vendas =
                db.prepare(`
                    SELECT

                        COUNT(*) AS total_vendas,

                        COALESCE(
                            SUM(v.total),
                            0
                        ) AS faturamento,

                        COALESCE(
                            SUM(v.desconto),
                            0
                        ) AS descontos

                    FROM vendas v

                    WHERE
                        v.status =
                        'finalizada'

                    AND DATE(
                        v.criado_em,
                        'localtime'
                    )
                    BETWEEN ? AND ?
                `)
                .get(
                    inicio,
                    fim
                );


            const custos =
                db.prepare(`
                    SELECT

                        COALESCE(
                            SUM(
                                iv.custo_unitario *
                                iv.quantidade
                            ),
                            0
                        ) AS custo

                    FROM itens_venda iv

                    INNER JOIN vendas v
                        ON v.id =
                           iv.venda_id

                    WHERE
                        v.status =
                        'finalizada'

                    AND DATE(
                        v.criado_em,
                        'localtime'
                    )
                    BETWEEN ? AND ?
                `)
                .get(
                    inicio,
                    fim
                );


            const faturamento =
                Number(
                    vendas.faturamento ||
                    0
                );

            const custo =
                Number(
                    custos.custo ||
                    0
                );

            const lucro =
                faturamento -
                custo;

            const margem =
                faturamento > 0
                    ? (
                        lucro /
                        faturamento
                    ) * 100
                    : 0;


            res.json({

                sucesso: true,

                periodo: {
                    inicio,
                    fim
                },

                total_vendas:
                    vendas.total_vendas,

                faturamento:
                    Number(
                        faturamento
                            .toFixed(2)
                    ),

                custo:
                    Number(
                        custo
                            .toFixed(2)
                    ),

                lucro:
                    Number(
                        lucro
                            .toFixed(2)
                    ),

                margem:
                    Number(
                        margem
                            .toFixed(2)
                    ),

                descontos:
                    Number(
                        Number(
                            vendas.descontos ||
                            0
                        ).toFixed(2)
                    )

            });


        } catch (erro) {

            console.error(
                "Erro lucro período:",
                erro
            );

            res.status(500).json({
                sucesso: false,
                mensagem:
                    "Erro ao calcular lucro do período."
            });

        }

    }
);




// =====================================================
// DASHBOARD AVANÇADO
// =====================================================
router.get("/dashboard-avancado", (req, res) => {
    try {
        const config = db.prepare(`
            SELECT dias_produto_parado
            FROM configuracoes
            WHERE id = 1
        `).get() || {};

        const diasProdutoParado =
            Math.max(
                1,
                Number(
                    config.dias_produto_parado ??
                    30
                )
            );

        const modificadorProdutoParado =
            `-${diasProdutoParado} days`;

        const resumo7 = db.prepare(`
            SELECT
                COUNT(*) AS vendas,
                COALESCE(SUM(total), 0) AS faturamento
            FROM vendas
            WHERE status = 'finalizada'
              AND DATE(criado_em, 'localtime') >= DATE('now', 'localtime', '-6 days')
        `).get();

        const hoje = db.prepare(`
            SELECT COUNT(*) AS vendas, COALESCE(SUM(total), 0) AS faturamento
            FROM vendas
            WHERE status = 'finalizada'
              AND DATE(criado_em, 'localtime') = DATE('now', 'localtime')
        `).get();

        const ontem = db.prepare(`
            SELECT COUNT(*) AS vendas, COALESCE(SUM(total), 0) AS faturamento
            FROM vendas
            WHERE status = 'finalizada'
              AND DATE(criado_em, 'localtime') = DATE('now', 'localtime', '-1 day')
        `).get();

        const serie = db.prepare(`
            WITH RECURSIVE dias(data) AS (
                SELECT DATE('now', 'localtime', '-6 days')
                UNION ALL
                SELECT DATE(data, '+1 day') FROM dias
                WHERE data < DATE('now', 'localtime')
            )
            SELECT
                dias.data,
                COUNT(v.id) AS vendas,
                COALESCE(SUM(v.total), 0) AS faturamento
            FROM dias
            LEFT JOIN vendas v
              ON DATE(v.criado_em, 'localtime') = dias.data
             AND v.status = 'finalizada'
            GROUP BY dias.data
            ORDER BY dias.data
        `).all();

        const maisVendidos = db.prepare(`
            SELECT
                p.id, p.nome,
                COALESCE(SUM(iv.quantidade), 0) AS quantidade,
                COALESCE(SUM(iv.subtotal), 0) AS faturamento
            FROM itens_venda iv
            INNER JOIN vendas v ON v.id = iv.venda_id
            INNER JOIN produtos p ON p.id = iv.produto_id
            WHERE v.status = 'finalizada'
              AND DATE(v.criado_em, 'localtime') >= DATE('now', 'localtime', '-29 days')
            GROUP BY p.id, p.nome
            ORDER BY quantidade DESC, faturamento DESC
            LIMIT 5
        `).all();

        const estoqueBaixo = db.prepare(`
            SELECT id, nome, quantidade, estoque_minimo, unidade
            FROM produtos
            WHERE ativo = 1
              AND COALESCE(tipo_estoque, 'normal') = 'normal'
              AND quantidade <= estoque_minimo
            ORDER BY quantidade ASC, nome ASC
            LIMIT 8
        `).all();

        const produtosParados = db.prepare(`
            SELECT
                p.id, p.nome, p.quantidade, p.unidade,
                MAX(CASE WHEN v.status = 'finalizada' THEN v.criado_em END) AS ultima_venda
            FROM produtos p
            LEFT JOIN itens_venda iv ON iv.produto_id = p.id
            LEFT JOIN vendas v ON v.id = iv.venda_id
            GROUP BY p.id, p.nome, p.quantidade, p.unidade
            HAVING ultima_venda IS NULL
                OR DATE(ultima_venda, 'localtime') < DATE('now', 'localtime', ?)
            ORDER BY ultima_venda IS NULL DESC, ultima_venda ASC
            LIMIT 8
        `).all(modificadorProdutoParado);

        const totalParados = db.prepare(`
            SELECT COUNT(*) AS total
            FROM produtos p
            WHERE NOT EXISTS (
                SELECT 1
                FROM itens_venda iv
                INNER JOIN vendas v ON v.id = iv.venda_id
                WHERE iv.produto_id = p.id
                  AND v.status = 'finalizada'
                  AND DATE(v.criado_em, 'localtime') >= DATE('now', 'localtime', ?)
            )
        `).get(modificadorProdutoParado);

        res.json({
            sucesso: true,
            resumo_7_dias: {
                vendas: Number(resumo7.vendas || 0),
                faturamento: Number(resumo7.faturamento || 0),
                ticket_medio: Number(resumo7.vendas || 0) > 0
                    ? Number(resumo7.faturamento || 0) / Number(resumo7.vendas)
                    : 0
            },
            hoje,
            ontem,
            serie_7_dias: serie,
            produtos_mais_vendidos: maisVendidos,
            estoque_baixo: estoqueBaixo,
            produtos_parados: produtosParados,
            total_produtos_parados: Number(totalParados.total || 0),
            dias_produto_parado: diasProdutoParado
        });
    } catch (erro) {
        console.error("Erro dashboard avançado:", erro);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao carregar o dashboard avançado."
        });
    }
});



// ==========================================
// FECHAMENTO MENSAL
// ==========================================
router.get("/fechamento-mensal", (req, res) => {
    try {
        const mesRecebido = String(req.query.mes || "").trim();
        const mesAtual = db.prepare(`
            SELECT strftime('%Y-%m', 'now', 'localtime') AS mes
        `).get().mes;
        const mes = /^\d{4}-\d{2}$/.test(mesRecebido) ? mesRecebido : mesAtual;

        const vendas = db.prepare(`
            SELECT
                COUNT(*) AS quantidade_vendas,
                COALESCE(SUM(total), 0) AS faturamento,
                COALESCE(SUM(desconto), 0) AS descontos,
                COALESCE(AVG(total), 0) AS ticket_medio
            FROM vendas
            WHERE status = 'finalizada'
              AND strftime('%Y-%m', criado_em, 'localtime') = ?
        `).get(mes);

        const custo = db.prepare(`
            SELECT COALESCE(SUM(iv.quantidade * COALESCE(iv.custo_unitario, 0)), 0) AS total
            FROM itens_venda iv
            INNER JOIN vendas v ON v.id = iv.venda_id
            WHERE v.status = 'finalizada'
              AND strftime('%Y-%m', v.criado_em, 'localtime') = ?
        `).get(mes);

        const pagamentosBrutos = db.prepare(`
            SELECT LOWER(p.forma_pagamento) AS forma, COALESCE(SUM(p.valor), 0) AS total
            FROM pagamentos_venda p
            INNER JOIN vendas v ON v.id = p.venda_id
            WHERE v.status = 'finalizada'
              AND strftime('%Y-%m', v.criado_em, 'localtime') = ?
            GROUP BY LOWER(p.forma_pagamento)
            ORDER BY total DESC
        `).all(mes);

        const pagamentos = { dinheiro: 0, pix: 0, debito: 0, credito: 0, outros: 0 };
        for (const item of pagamentosBrutos) {
            const forma = String(item.forma || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const valor = Number(item.total || 0);
            if (forma === 'dinheiro') pagamentos.dinheiro += valor;
            else if (forma === 'pix') pagamentos.pix += valor;
            else if (forma === 'debito') pagamentos.debito += valor;
            else if (forma === 'credito') pagamentos.credito += valor;
            else pagamentos.outros += valor;
        }

        // Compatível tanto com a tela específica de perdas quanto com o histórico antigo.
        const temTabelaPerdas = db.prepare(`
            SELECT 1 AS existe FROM sqlite_master
            WHERE type = 'table' AND name = 'perdas_estoque'
        `).get();

        let perdas = { quantidade: 0, custo: 0 };
        if (temTabelaPerdas) {
            perdas = db.prepare(`
                SELECT
                    COALESCE(SUM(quantidade), 0) AS quantidade,
                    COALESCE(SUM(quantidade * COALESCE(custo_unitario, 0)), 0) AS custo
                FROM perdas_estoque
                WHERE status = 'ativa'
                  AND strftime('%Y-%m', criado_em, 'localtime') = ?
            `).get(mes);
        } else {
            perdas = db.prepare(`
                SELECT
                    COALESCE(SUM(m.quantidade), 0) AS quantidade,
                    COALESCE(SUM(m.quantidade * COALESCE(p.preco_custo, 0)), 0) AS custo
                FROM movimentacoes_estoque m
                INNER JOIN produtos p ON p.id = m.produto_id
                WHERE m.tipo = 'perda'
                  AND strftime('%Y-%m', m.criado_em, 'localtime') = ?
            `).get(mes);
        }

        const dias = db.prepare(`
            SELECT
                DATE(criado_em, 'localtime') AS data,
                COUNT(*) AS vendas,
                COALESCE(SUM(total), 0) AS faturamento
            FROM vendas
            WHERE status = 'finalizada'
              AND strftime('%Y-%m', criado_em, 'localtime') = ?
            GROUP BY DATE(criado_em, 'localtime')
            ORDER BY data
        `).all(mes);

        const faturamento = Number(vendas.faturamento || 0);
        const custoMercadoria = Number(custo.total || 0);
        const custoPerdas = Number(perdas.custo || 0);
        const lucroBruto = faturamento - custoMercadoria;
        const resultadoAposPerdas = lucroBruto - custoPerdas;
        const margem = faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0;

        res.json({
            sucesso: true,
            mes,
            resumo: {
                quantidade_vendas: Number(vendas.quantidade_vendas || 0),
                faturamento,
                descontos: Number(vendas.descontos || 0),
                ticket_medio: Number(vendas.ticket_medio || 0),
                custo_mercadoria: custoMercadoria,
                lucro_bruto: lucroBruto,
                margem_bruta: margem,
                perdas_quantidade: Number(perdas.quantidade || 0),
                perdas_custo: custoPerdas,
                resultado_apos_perdas: resultadoAposPerdas
            },
            pagamentos,
            dias: dias.map(d => ({
                data: d.data,
                vendas: Number(d.vendas || 0),
                faturamento: Number(d.faturamento || 0)
            }))
        });
    } catch (erro) {
        console.error('Erro no fechamento mensal:', erro);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Não foi possível gerar o fechamento mensal.'
        });
    }
});

module.exports = router;