const express = require("express");
const router = express.Router();
const db = require("../database");
const registrarAuditoria = require("../utils/auditoria");
const PDFDocument = require("pdfkit");

function usuarioSessao(req) {
    return req.session?.usuario || null;
}

function podeFecharCaixa(req, caixa) {
    const usuario = usuarioSessao(req);

    if (!usuario) {
        return false;
    }

    if (usuario.perfil === "administrador") {
        return true;
    }

    // Caixas antigos, criados antes deste recurso, não têm responsável gravado.
    // Nesse caso o operador atual ainda pode fechá-los para não travar o sistema.
    if (!caixa.usuario_abertura_id) {
        return true;
    }

    return Number(caixa.usuario_abertura_id) === Number(usuario.id);
}

// ==========================================
// CAIXA ABERTO ATUAL
// ==========================================
router.get("/aberto", (req, res) => {
    try {
        const caixa = db.prepare(`
            SELECT *
            FROM caixas
            WHERE status = 'aberto'
            ORDER BY id DESC
            LIMIT 1
        `).get();

        if (!caixa) {
            return res.json({
                aberto: false
            });
        }

        const resumo = calcularResumoCaixa(caixa.id);

        res.json({
            aberto: true,
            caixa,
            resumo,
            pode_fechar: podeFecharCaixa(req, caixa)
        });

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao consultar caixa"
        });
    }
});


// ==========================================
// ABRIR CAIXA
// ==========================================
router.post("/abrir", (req, res) => {
    try {
        const { valor_inicial } = req.body;

        const valorInicial = Number(valor_inicial);

        if (
            !Number.isFinite(valorInicial) ||
            valorInicial < 0
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Valor inicial inválido"
            });
        }

        const caixaAberto = db.prepare(`
            SELECT id
            FROM caixas
            WHERE status = 'aberto'
            LIMIT 1
        `).get();

        if (caixaAberto) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Já existe um caixa aberto"
            });
        }

        const usuario = usuarioSessao(req);

        const abrirCaixa = db.transaction(() => {
            const resultado = db.prepare(`
                INSERT INTO caixas (
                    valor_inicial,
                    status,
                    usuario_abertura_id,
                    usuario_abertura_nome
                )
                VALUES (?, 'aberto', ?, ?)
            `).run(
                valorInicial,
                usuario.id,
                usuario.nome
            );

            if (valorInicial > 0) {
                db.prepare(`
                    INSERT INTO movimentacoes_caixa (
                        caixa_id,
                        tipo,
                        valor,
                        descricao
                    )
                    VALUES (?, 'abertura', ?, 'Valor inicial do caixa')
                `).run(
                    resultado.lastInsertRowid,
                    valorInicial
                );
            }

            return resultado;
        });

        const resultado = abrirCaixa();

        registrarAuditoria(req, "CAIXA_ABERTO", "caixa", Number(resultado.lastInsertRowid),
            `Caixa #${resultado.lastInsertRowid} aberto por ${usuario.nome} com R$ ${valorInicial.toFixed(2)}`, { valor_inicial: valorInicial });

        res.json({
            sucesso: true,
            mensagem: "Caixa aberto com sucesso",
            caixa_id: resultado.lastInsertRowid
        });

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao abrir caixa"
        });
    }
});


// ==========================================
// SUPRIMENTO
// ==========================================
router.post("/suprimento", (req, res) => {
    try {
        const {
            valor,
            descricao
        } = req.body;

        const valorNumerico = Number(valor);

        if (
            !Number.isFinite(valorNumerico) ||
            valorNumerico <= 0
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Valor inválido"
            });
        }

        const caixa = obterCaixaAberto();

        if (!caixa) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Não existe caixa aberto"
            });
        }

        db.prepare(`
            INSERT INTO movimentacoes_caixa (
                caixa_id,
                tipo,
                valor,
                descricao
            )
            VALUES (?, 'suprimento', ?, ?)
        `).run(
            caixa.id,
            valorNumerico,
            descricao || "Suprimento de caixa"
        );

        registrarAuditoria(req, "CAIXA_SUPRIMENTO", "caixa", caixa.id,
            `Suprimento de R$ ${valorNumerico.toFixed(2)} no caixa #${caixa.id}`, { valor: valorNumerico, descricao: descricao || "Suprimento de caixa" });

        res.json({
            sucesso: true,
            mensagem: "Suprimento registrado"
        });

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao registrar suprimento"
        });
    }
});


// ==========================================
// SANGRIA
// ==========================================
router.post("/sangria", (req, res) => {
    try {
        const {
            valor,
            descricao
        } = req.body;

        const valorNumerico = Number(valor);

        if (
            !Number.isFinite(valorNumerico) ||
            valorNumerico <= 0
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Valor inválido"
            });
        }

        const caixa = obterCaixaAberto();

        if (!caixa) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Não existe caixa aberto"
            });
        }

        const resumo = calcularResumoCaixa(caixa.id);

        if (valorNumerico > resumo.dinheiro_esperado) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Sangria maior que o valor disponível em dinheiro"
            });
        }

        db.prepare(`
            INSERT INTO movimentacoes_caixa (
                caixa_id,
                tipo,
                valor,
                descricao
            )
            VALUES (?, 'sangria', ?, ?)
        `).run(
            caixa.id,
            valorNumerico,
            descricao || "Sangria de caixa"
        );

        registrarAuditoria(req, "CAIXA_SANGRIA", "caixa", caixa.id,
            `Sangria de R$ ${valorNumerico.toFixed(2)} no caixa #${caixa.id}`, { valor: valorNumerico, descricao: descricao || "Sangria de caixa" });

        res.json({
            sucesso: true,
            mensagem: "Sangria registrada"
        });

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao registrar sangria"
        });
    }
});


// ==========================================
// MOVIMENTAÇÕES DO CAIXA
// ==========================================
router.get("/movimentacoes", (req, res) => {
    try {
        const caixa = obterCaixaAberto();

        if (!caixa) {
            return res.json([]);
        }

        const movimentacoes = db.prepare(`
            SELECT *
            FROM movimentacoes_caixa
            WHERE caixa_id = ?
            ORDER BY id DESC
        `).all(caixa.id);

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
// RESUMO DO CAIXA
// ==========================================
router.get("/resumo", (req, res) => {
    try {
        const caixa = obterCaixaAberto();

        if (!caixa) {
            return res.json({
                aberto: false
            });
        }

        const resumo = calcularResumoCaixa(caixa.id);

        res.json({
            aberto: true,
            caixa,
            resumo
        });

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao carregar resumo"
        });
    }
});


// ==========================================
// FECHAR CAIXA
// ==========================================
router.post("/fechar", (req, res) => {
    try {
        const {
            valor_contado
        } = req.body;

        const valorContado = Number(valor_contado);

        if (
            !Number.isFinite(valorContado) ||
            valorContado < 0
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Valor contado inválido"
            });
        }

        const caixa = obterCaixaAberto();

        if (!caixa) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Não existe caixa aberto"
            });
        }

        const usuario = usuarioSessao(req);

        if (!podeFecharCaixa(req, caixa)) {
            return res.status(403).json({
                sucesso: false,
                mensagem:
                    `Este caixa foi aberto por ${caixa.usuario_abertura_nome || "outro usuário"}. Somente esse usuário ou um administrador pode fechá-lo.`
            });
        }

        const resumo = calcularResumoCaixa(caixa.id);

        const valorEsperado =
            resumo.dinheiro_esperado;

        const diferenca =
            valorContado - valorEsperado;

        db.prepare(`
            UPDATE caixas
            SET
                data_fechamento = CURRENT_TIMESTAMP,
                valor_final_informado = ?,
                valor_esperado = ?,
                diferenca = ?,
                status = 'fechado',
                usuario_fechamento_id = ?,
                usuario_fechamento_nome = ?
            WHERE id = ?
        `).run(
            valorContado,
            valorEsperado,
            diferenca,
            usuario.id,
            usuario.nome,
            caixa.id
        );

        registrarAuditoria(req, "CAIXA_FECHADO", "caixa", caixa.id,
            `Caixa #${caixa.id} fechado por ${usuario.nome} - diferença R$ ${diferenca.toFixed(2)}`,
            { valor_esperado: valorEsperado, valor_contado: valorContado, diferenca });

        res.json({
            sucesso: true,
            mensagem: "Caixa fechado com sucesso",
            valor_esperado: valorEsperado,
            valor_contado: valorContado,
            diferenca,
            caixa_id: caixa.id,
            aberto_por: caixa.usuario_abertura_nome || null,
            fechado_por: usuario.nome
        });

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao fechar caixa"
        });
    }
});


// ==========================================
// HISTÓRICO DE CAIXAS
// ==========================================
router.get("/historico", (req, res) => {
    try {
        const caixas = db.prepare(`
            SELECT *
            FROM caixas
            ORDER BY id DESC
        `).all();

        res.json(caixas);

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao carregar histórico"
        });
    }
});


// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function obterCaixaAberto() {
    return db.prepare(`
        SELECT *
        FROM caixas
        WHERE status = 'aberto'
        ORDER BY id DESC
        LIMIT 1
    `).get();
}


function calcularResumoCaixa(caixaId) {

    const caixa = db.prepare(`
        SELECT *
        FROM caixas
        WHERE id = ?
    `).get(caixaId);


    const movimentos = db.prepare(`
        SELECT
            COALESCE(
                SUM(
                    CASE
                        WHEN tipo = 'suprimento'
                        THEN valor
                        ELSE 0
                    END
                ),
                0
            ) AS suprimentos,

            COALESCE(
                SUM(
                    CASE
                        WHEN tipo = 'sangria'
                        THEN valor
                        ELSE 0
                    END
                ),
                0
            ) AS sangrias

        FROM movimentacoes_caixa
        WHERE caixa_id = ?
    `).get(caixaId);


    const vendas = db.prepare(`
        SELECT
            COALESCE(
                SUM(
                    CASE
                        WHEN pv.forma_pagamento = 'dinheiro'
                        THEN pv.valor
                        ELSE 0
                    END
                ),
                0
            ) AS dinheiro,

            COALESCE(
                SUM(
                    CASE
                        WHEN pv.forma_pagamento = 'pix'
                        THEN pv.valor
                        ELSE 0
                    END
                ),
                0
            ) AS pix,

            COALESCE(
                SUM(
                    CASE
                        WHEN pv.forma_pagamento = 'debito'
                        THEN pv.valor
                        ELSE 0
                    END
                ),
                0
            ) AS debito,

            COALESCE(
                SUM(
                    CASE
                        WHEN pv.forma_pagamento = 'credito'
                        THEN pv.valor
                        ELSE 0
                    END
                ),
                0
            ) AS credito

        FROM pagamentos_venda pv

        INNER JOIN vendas v
            ON v.id = pv.venda_id

        WHERE
            v.caixa_id = ?
            AND v.status = 'finalizada'
    `).get(caixaId);


    const totalVendas =
        Number(vendas.dinheiro) +
        Number(vendas.pix) +
        Number(vendas.debito) +
        Number(vendas.credito);


    const dinheiroEsperado =
        Number(caixa.valor_inicial) +
        Number(vendas.dinheiro) +
        Number(movimentos.suprimentos) -
        Number(movimentos.sangrias);


    return {
        valor_inicial:
            Number(caixa.valor_inicial),

        vendas_dinheiro:
            Number(vendas.dinheiro),

        vendas_pix:
            Number(vendas.pix),

        vendas_debito:
            Number(vendas.debito),

        vendas_credito:
            Number(vendas.credito),

        total_vendas:
            totalVendas,

        suprimentos:
            Number(movimentos.suprimentos),

        sangrias:
            Number(movimentos.sangrias),

        dinheiro_esperado:
            dinheiroEsperado
    };
}

// =====================================================
// RESUMO COMPLETO PARA FECHAMENTO DO CAIXA
// =====================================================

router.get("/resumo-fechamento", (req, res) => {
    try {

        // ==========================================
        // CAIXA ABERTO
        // ==========================================

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
                mensagem: "Nenhum caixa aberto."
            });
        }


        // ==========================================
        // VENDAS DO CAIXA
        // ==========================================

        const vendas = db.prepare(`
            SELECT
                COUNT(*) AS quantidade_vendas,
                COALESCE(SUM(total), 0) AS faturamento,
                COALESCE(SUM(desconto), 0) AS descontos
            FROM vendas
            WHERE
                caixa_id = ?
                AND status = 'finalizada'
        `).get(caixa.id);


        // ==========================================
        // CUSTO DOS PRODUTOS VENDIDOS
        // ==========================================

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
                v.caixa_id = ?
                AND v.status = 'finalizada'
        `).get(caixa.id);


        // ==========================================
        // PAGAMENTOS
        // ==========================================

        const pagamentos = db.prepare(`
            SELECT
                pv.forma_pagamento,
                COALESCE(SUM(pv.valor), 0) AS total,
                COALESCE(SUM(pv.troco), 0) AS troco
            FROM pagamentos_venda pv

            INNER JOIN vendas v
                ON v.id = pv.venda_id

            WHERE
                v.caixa_id = ?
                AND v.status = 'finalizada'

            GROUP BY pv.forma_pagamento
        `).all(caixa.id);


        const pagamentosFormatados = {
            dinheiro: 0,
            pix: 0,
            debito: 0,
            credito: 0
        };

        let trocoEntregue = 0;


        for (const pagamento of pagamentos) {

            if (
                Object.prototype.hasOwnProperty.call(
                    pagamentosFormatados,
                    pagamento.forma_pagamento
                )
            ) {
                pagamentosFormatados[
                    pagamento.forma_pagamento
                ] = Number(
                    pagamento.total || 0
                );

                trocoEntregue += Number(
                    pagamento.troco || 0
                );
            }

        }

        trocoEntregue =
            Number(trocoEntregue.toFixed(2));


        // ==========================================
        // MOVIMENTAÇÕES MANUAIS DO CAIXA
        // ==========================================

        const movimentacoes = db.prepare(`
            SELECT
                tipo,
                COALESCE(SUM(valor), 0) AS total
            FROM movimentacoes_caixa

            WHERE caixa_id = ?

            GROUP BY tipo
        `).all(caixa.id);


        let suprimentos = 0;
        let sangrias = 0;


        for (const movimento of movimentacoes) {

            if (movimento.tipo === "suprimento") {
                suprimentos =
                    Number(
                        movimento.total || 0
                    );
            }


            if (movimento.tipo === "sangria") {
                sangrias =
                    Number(
                        movimento.total || 0
                    );
            }

        }


        // ==========================================
        // CÁLCULOS
        // ==========================================

        const faturamento =
            Number(
                vendas.faturamento || 0
            );

        const custo =
            Number(
                custos.custo_total || 0
            );

        const lucro =
            Number(
                (
                    faturamento -
                    custo
                ).toFixed(2)
            );


        const margem =
            faturamento > 0
                ? Number(
                    (
                        lucro /
                        faturamento *
                        100
                    ).toFixed(2)
                )
                : 0;


        const valorInicial =
            Number(
                caixa.valor_inicial || 0
            );


        const dinheiroVendas =
            Number(
                pagamentosFormatados.dinheiro || 0
            );


        const dinheiroEsperado =
            Number(
                (
                    valorInicial +
                    dinheiroVendas +
                    suprimentos -
                    sangrias
                ).toFixed(2)
            );


        // ==========================================
        // RESPOSTA
        // ==========================================

        const vendasResposta = {
            quantidade: Number(vendas.quantidade_vendas || 0),
            faturamento: Number(faturamento.toFixed(2)),
            descontos: Number(Number(vendas.descontos || 0).toFixed(2))
        };

        if (req.session?.usuario?.perfil === "administrador") {
            vendasResposta.custo = Number(custo.toFixed(2));
            vendasResposta.lucro = lucro;
            vendasResposta.margem = margem;
        }

        res.json({
            sucesso: true,

            caixa: {
                id: caixa.id,
                data_abertura:
                    caixa.data_abertura,
                valor_inicial:
                    Number(
                        valorInicial.toFixed(2)
                    ),
                usuario_abertura_nome:
                    caixa.usuario_abertura_nome || null,
                pode_fechar:
                    podeFecharCaixa(req, caixa)
            },

            vendas: vendasResposta,

            pagamentos: {
                dinheiro:
                    Number(
                        pagamentosFormatados
                            .dinheiro
                            .toFixed(2)
                    ),

                pix:
                    Number(
                        pagamentosFormatados
                            .pix
                            .toFixed(2)
                    ),

                debito:
                    Number(
                        pagamentosFormatados
                            .debito
                            .toFixed(2)
                    ),

                credito:
                    Number(
                        pagamentosFormatados
                            .credito
                            .toFixed(2)
                    ),

                troco_entregue:
                    trocoEntregue
            },

            movimentacoes: {
                suprimentos:
                    Number(
                        suprimentos.toFixed(2)
                    ),

                sangrias:
                    Number(
                        sangrias.toFixed(2)
                    )
            },

            dinheiro_esperado:
                dinheiroEsperado
        });


    } catch (erro) {

        console.error(
            "Erro resumo fechamento:",
            erro
        );


        res.status(500).json({
            sucesso: false,
            mensagem:
                "Erro ao carregar resumo do fechamento."
        });

    }
});


// =====================================================
// PDF DO FECHAMENTO DO CAIXA
// =====================================================

router.get("/:id/pdf", (req, res) => {
    try {

        const caixaId = Number(req.params.id);

        if (!caixaId) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Caixa inválido."
            });
        }


        // ==========================================
        // CAIXA
        // ==========================================

        const caixa = db.prepare(`
            SELECT *
            FROM caixas
            WHERE id = ?
        `).get(caixaId);


        if (!caixa) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Caixa não encontrado."
            });
        }


        // ==========================================
        // VENDAS
        // ==========================================

        const vendas = db.prepare(`
            SELECT
                COUNT(*) AS quantidade,
                COALESCE(SUM(total), 0) AS faturamento,
                COALESCE(SUM(desconto), 0) AS descontos
            FROM vendas
            WHERE
                caixa_id = ?
                AND status = 'finalizada'
        `).get(caixaId);


        // ==========================================
        // CUSTO
        // ==========================================

        const custos = db.prepare(`
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
                ON v.id = iv.venda_id

            WHERE
                v.caixa_id = ?
                AND v.status = 'finalizada'
        `).get(caixaId);


        // ==========================================
        // PAGAMENTOS
        // ==========================================

        const pagamentos = db.prepare(`
            SELECT
                pv.forma_pagamento,
                COALESCE(SUM(pv.valor), 0) AS total
            FROM pagamentos_venda pv

            INNER JOIN vendas v
                ON v.id = pv.venda_id

            WHERE
                v.caixa_id = ?
                AND v.status = 'finalizada'

            GROUP BY pv.forma_pagamento
        `).all(caixaId);


        const formas = {
            dinheiro: 0,
            pix: 0,
            debito: 0,
            credito: 0
        };


        for (const pagamento of pagamentos) {

            if (
                Object.prototype.hasOwnProperty.call(
                    formas,
                    pagamento.forma_pagamento
                )
            ) {
                formas[pagamento.forma_pagamento] =
                    Number(pagamento.total || 0);
            }

        }


        // ==========================================
        // MOVIMENTAÇÕES
        // ==========================================

        const movimentos = db.prepare(`
            SELECT
                tipo,
                COALESCE(SUM(valor), 0) AS total
            FROM movimentacoes_caixa
            WHERE caixa_id = ?
            GROUP BY tipo
        `).all(caixaId);


        let suprimentos = 0;
        let sangrias = 0;


        for (const movimento of movimentos) {

            if (movimento.tipo === "suprimento") {
                suprimentos =
                    Number(movimento.total || 0);
            }

            if (movimento.tipo === "sangria") {
                sangrias =
                    Number(movimento.total || 0);
            }

        }


        // ==========================================
        // CÁLCULOS
        // ==========================================

        const faturamento =
            Number(vendas.faturamento || 0);

        const custo =
            Number(custos.custo || 0);

        const lucro =
            Number(
                (
                    faturamento - custo
                ).toFixed(2)
            );

        const margem =
            faturamento > 0
                ? Number(
                    (
                        lucro /
                        faturamento *
                        100
                    ).toFixed(2)
                )
                : 0;


        // ==========================================
        // FORMATADORES
        // ==========================================

        const dinheiro = valor =>
            Number(valor || 0)
                .toLocaleString(
                    "pt-BR",
                    {
                        style: "currency",
                        currency: "BRL"
                    }
                );


        const data = valor => {

            if (!valor) {
                return "-";
            }

            return new Date(
                valor.replace(" ", "T") + "Z"
            ).toLocaleString("pt-BR");

        };


        // ==========================================
        // PDF
        // ==========================================

        const doc = new PDFDocument({
            size: "A4",
            margin: 50
        });


        const nomeArquivo =
            `fechamento-caixa-${caixa.id}.pdf`;


        res.setHeader(
            "Content-Type",
            "application/pdf"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${nomeArquivo}"`
        );


        doc.pipe(res);


        // ==========================================
        // TÍTULO
        // ==========================================

        doc
            .fontSize(22)
            .text(
                "Fechamento de Caixa",
                {
                    align: "center"
                }
            );


        doc.moveDown(0.5);


        doc
            .fontSize(11)
            .text(
                `Caixa #${caixa.id}`,
                {
                    align: "center"
                }
            );


        doc.moveDown(2);


        // ==========================================
        // DATAS
        // ==========================================

        doc
            .fontSize(13)
            .text("Informações do Caixa");


        doc.moveDown(0.5);


        doc
            .fontSize(10)
            .text(
                `Abertura: ${data(caixa.data_abertura)}`
            );

        doc.text(
            `Fechamento: ${data(caixa.data_fechamento)}`
        );

        doc.text(
            `Aberto por: ${caixa.usuario_abertura_nome || "Não registrado"}`
        );

        doc.text(
            `Fechado por: ${caixa.usuario_fechamento_nome || "Não registrado"}`
        );


        doc.moveDown(1.5);


        // ==========================================
        // VENDAS
        // ==========================================

        doc
            .fontSize(13)
            .text("Resumo de Vendas");


        doc.moveDown(0.5);


        doc
            .fontSize(10)
            .text(
                `Quantidade de vendas: ${vendas.quantidade}`
            );

        doc.text(
            `Faturamento: ${dinheiro(faturamento)}`
        );

        doc.text(
            `Descontos: ${dinheiro(vendas.descontos)}`
        );

        doc.text(
            `Custo dos produtos: ${dinheiro(custo)}`
        );

        doc.text(
            `Lucro bruto: ${dinheiro(lucro)}`
        );

        doc.text(
            `Margem: ${margem.toFixed(2).replace(".", ",")}%`
        );


        doc.moveDown(1.5);


        // ==========================================
        // PAGAMENTOS
        // ==========================================

        doc
            .fontSize(13)
            .text("Formas de Pagamento");


        doc.moveDown(0.5);


        doc
            .fontSize(10)
            .text(
                `Dinheiro: ${dinheiro(formas.dinheiro)}`
            );

        doc.text(
            `PIX: ${dinheiro(formas.pix)}`
        );

        doc.text(
            `Débito: ${dinheiro(formas.debito)}`
        );

        doc.text(
            `Crédito: ${dinheiro(formas.credito)}`
        );


        doc.moveDown(1.5);


        // ==========================================
        // FECHAMENTO
        // ==========================================

        doc
            .fontSize(13)
            .text("Conferência do Caixa");


        doc.moveDown(0.5);


        doc
            .fontSize(10)
            .text(
                `Valor inicial: ${dinheiro(caixa.valor_inicial)}`
            );

        doc.text(
            `Suprimentos: ${dinheiro(suprimentos)}`
        );

        doc.text(
            `Sangrias: ${dinheiro(sangrias)}`
        );

        doc.text(
            `Dinheiro esperado: ${dinheiro(caixa.valor_esperado)}`
        );

        doc.text(
            `Dinheiro contado: ${dinheiro(caixa.valor_final_informado)}`
        );


        doc.moveDown(0.5);


        doc
            .fontSize(12)
            .text(
                `Diferença: ${dinheiro(caixa.diferenca)}`
            );


        doc.moveDown(3);


        doc
            .fontSize(9)
            .text(
                "Documento gerado automaticamente pelo Sistema da Adega.",
                {
                    align: "center"
                }
            );


        doc.end();


    } catch (erro) {

        console.error(
            "Erro ao gerar PDF:",
            erro
        );

        if (!res.headersSent) {

            res.status(500).json({
                sucesso: false,
                mensagem:
                    "Erro ao gerar PDF do fechamento."
            });

        }

    }
});


module.exports = router;