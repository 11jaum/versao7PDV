const express = require("express");
const router = express.Router();
const db = require("../database");

router.get("/resumo", (req, res) => {
    try {
        // Estes cards são indicadores em tempo real.
        // Nunca devem ser servidos pelo cache do WebView/navegador.
        res.set({
            "Cache-Control":
                "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma":
                "no-cache",
            "Expires":
                "0"
        });

        const vendasHoje =
            db.prepare(`
                SELECT
                    COUNT(*) AS quantidade_vendas,
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

        const vendasOntem =
            db.prepare(`
                SELECT
                    COUNT(*) AS quantidade_vendas,
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
                        'localtime',
                        '-1 day'
                      )
            `).get();

        const estoque =
            db.prepare(`
                SELECT
                    COUNT(*) AS total_produtos,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN COALESCE(
                                    tipo_estoque,
                                    'normal'
                                ) = 'normal'
                                THEN quantidade
                                ELSE 0
                            END
                        ),
                        0
                    ) AS total_itens,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN COALESCE(
                                    tipo_estoque,
                                    'normal'
                                ) = 'normal'
                                 AND quantidade <=
                                     estoque_minimo
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS estoque_baixo,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN COALESCE(
                                    tipo_estoque,
                                    'normal'
                                ) = 'normal'
                                 AND quantidade = 0
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS sem_estoque

                FROM produtos
                WHERE ativo = 1
            `).get();

        return res.json({
            sucesso: true,
            atualizado_em:
                new Date().toISOString(),

            hoje: {
                quantidade_vendas:
                    Number(
                        vendasHoje
                            .quantidade_vendas ||
                        0
                    ),
                faturamento:
                    Number(
                        vendasHoje
                            .faturamento ||
                        0
                    )
            },

            ontem: {
                quantidade_vendas:
                    Number(
                        vendasOntem
                            .quantidade_vendas ||
                        0
                    ),
                faturamento:
                    Number(
                        vendasOntem
                            .faturamento ||
                        0
                    )
            },

            estoque: {
                total_produtos:
                    Number(
                        estoque
                            .total_produtos ||
                        0
                    ),
                total_itens:
                    Number(
                        estoque
                            .total_itens ||
                        0
                    ),
                estoque_baixo:
                    Number(
                        estoque
                            .estoque_baixo ||
                        0
                    ),
                sem_estoque:
                    Number(
                        estoque
                            .sem_estoque ||
                        0
                    )
            }
        });
    } catch (erro) {
        console.error(
            "Erro ao carregar cards do dashboard:",
            erro
        );

        return res.status(500).json({
            sucesso: false,
            mensagem:
                "Não foi possível atualizar os cards do Dashboard."
        });
    }
});

module.exports = router;
