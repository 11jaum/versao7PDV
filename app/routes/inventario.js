const express = require("express");
const router = express.Router();
const db = require("../database");
const registrarAuditoria = require("../utils/auditoria");

router.get("/aberto", (req, res) => {
    try {
        const inventario = db.prepare(`
            SELECT * FROM inventarios
            WHERE status = 'aberto'
            ORDER BY id DESC LIMIT 1
        `).get();

        if (!inventario) return res.json({ sucesso: true, inventario: null, itens: [] });

        const itens = db.prepare(`
            SELECT * FROM itens_inventario
            WHERE inventario_id = ?
            ORDER BY produto_nome
        `).all(inventario.id);

        res.json({ sucesso: true, inventario, itens });
    } catch (erro) {
        console.error("Erro ao carregar inventário:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao carregar inventário." });
    }
});

router.post("/iniciar", (req, res) => {
    try {
        const aberto = db.prepare(`SELECT id FROM inventarios WHERE status = 'aberto' LIMIT 1`).get();
        if (aberto) {
            return res.status(409).json({
                sucesso: false,
                mensagem: "Já existe um inventário em andamento. Finalize ou cancele antes de iniciar outro."
            });
        }

        const produtos = db.prepare(`
            SELECT id, nome, unidade, quantidade
            FROM produtos
            WHERE ativo = 1
              AND COALESCE(tipo_estoque, 'normal') = 'normal'
            ORDER BY nome COLLATE NOCASE
        `).all();

        if (!produtos.length) {
            return res.status(400).json({ sucesso: false, mensagem: "Não há produtos cadastrados." });
        }

        const usuario = req.session.usuario;
        const criar = db.transaction(() => {
            const info = db.prepare(`
                INSERT INTO inventarios (usuario_id, usuario_nome, total_produtos)
                VALUES (?, ?, ?)
            `).run(usuario.id, usuario.nome, produtos.length);

            const inventarioId = Number(info.lastInsertRowid);
            const inserir = db.prepare(`
                INSERT INTO itens_inventario
                (inventario_id, produto_id, produto_nome, unidade, estoque_sistema)
                VALUES (?, ?, ?, ?, ?)
            `);

            for (const p of produtos) {
                inserir.run(inventarioId, p.id, p.nome, p.unidade, Number(p.quantidade || 0));
            }
            return inventarioId;
        });

        const id = criar();
        registrarAuditoria(req, "INVENTARIO_INICIADO", "inventario", id,
            `Inventário #${id} iniciado com ${produtos.length} produto(s).`);

        res.json({ sucesso: true, inventario_id: id });
    } catch (erro) {
        console.error("Erro ao iniciar inventário:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao iniciar inventário." });
    }
});

router.patch("/:id/item/:itemId", (req, res) => {
    try {
        const inventarioId = Number(req.params.id);
        const itemId = Number(req.params.itemId);
        const valor = req.body.quantidade_contada;

        if (!Number.isInteger(Number(valor)) || Number(valor) < 0) {
            return res.status(400).json({ sucesso: false, mensagem: "Informe uma quantidade válida." });
        }

        const inventario = db.prepare(`
            SELECT id FROM inventarios WHERE id = ? AND status = 'aberto'
        `).get(inventarioId);
        if (!inventario) return res.status(404).json({ sucesso: false, mensagem: "Inventário não encontrado ou já finalizado." });

        const item = db.prepare(`
            SELECT * FROM itens_inventario WHERE id = ? AND inventario_id = ?
        `).get(itemId, inventarioId);
        if (!item) return res.status(404).json({ sucesso: false, mensagem: "Item não encontrado." });

        const contado = Number(valor);
        const diferenca = contado - Number(item.estoque_sistema || 0);

        db.prepare(`
            UPDATE itens_inventario
            SET quantidade_contada = ?, diferenca = ?
            WHERE id = ?
        `).run(contado, diferenca, itemId);

        res.json({ sucesso: true, diferenca });
    } catch (erro) {
        console.error("Erro ao salvar contagem:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao salvar contagem." });
    }
});

router.post("/:id/finalizar", (req, res) => {
    try {
        const id = Number(req.params.id);
        const inventario = db.prepare(`
            SELECT * FROM inventarios WHERE id = ? AND status = 'aberto'
        `).get(id);
        if (!inventario) return res.status(404).json({ sucesso: false, mensagem: "Inventário não encontrado ou já finalizado." });

        const pendentes = db.prepare(`
            SELECT COUNT(*) AS total FROM itens_inventario
            WHERE inventario_id = ? AND quantidade_contada IS NULL
        `).get(id).total;

        if (pendentes > 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: `Ainda existem ${pendentes} produto(s) sem contagem.`
            });
        }

        const itens = db.prepare(`
            SELECT *
            FROM itens_inventario
            WHERE inventario_id = ?
        `).all(id);

        const divergencias = itens.filter(
            item => Number(item.diferenca || 0) !== 0
        );

        const finalizar = db.transaction(() => {
            const atualizarProduto = db.prepare(`
                UPDATE produtos
                SET quantidade = ?
                WHERE id = ?
                  AND ativo = 1
                  AND COALESCE(tipo_estoque, 'normal') = 'normal'
            `);

            const movimentar = db.prepare(`
                INSERT INTO movimentacoes_estoque (
                    produto_id,
                    tipo,
                    quantidade,
                    motivo
                )
                VALUES (?, ?, ?, ?)
            `);

            let aplicadas = 0;
            let ignoradas = 0;
            let ajusteTotal = 0;

            for (const item of divergencias) {
                const diferenca = Number(item.diferenca || 0);
                const quantidadeContada = Number(item.quantidade_contada);

                const info = atualizarProduto.run(
                    quantidadeContada,
                    item.produto_id
                );

                if (!info.changes) {
                    ignoradas++;
                    continue;
                }

                if (quantidadeContada === 0) {
                    db.prepare(`
                        UPDATE produto_fracionado_componentes
                        SET fracao_atual = 0
                        WHERE produto_estoque_id = ?
                    `).run(item.produto_id);
                }

                const tipo =
                    diferenca > 0
                        ? "ajuste_entrada"
                        : "ajuste_saida";

                movimentar.run(
                    item.produto_id,
                    tipo,
                    Math.abs(diferenca),
                    `Inventário #${id}: ${item.estoque_sistema} → ${item.quantidade_contada} (${diferenca > 0 ? "+" : ""}${diferenca})`
                );

                aplicadas++;
                ajusteTotal += diferenca;
            }

            db.prepare(`
                UPDATE inventarios
                SET status = 'finalizado',
                    total_divergencias = ?,
                    ajuste_total = ?,
                    finalizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                aplicadas,
                ajusteTotal,
                id
            );

            return {
                aplicadas,
                ignoradas,
                ajusteTotal
            };
        });

        const resultado = finalizar();

        registrarAuditoria(
            req,
            "INVENTARIO_FINALIZADO",
            "inventario",
            id,
            `Inventário #${id} finalizado com ${resultado.aplicadas} ajuste(s).`,
            {
                divergencias_identificadas: divergencias.length,
                divergencias_aplicadas: resultado.aplicadas,
                itens_ignorados: resultado.ignoradas,
                ajuste_total: resultado.ajusteTotal
            }
        );

        res.json({
            sucesso: true,
            mensagem:
                resultado.ignoradas > 0
                    ? "Inventário finalizado. Alguns itens foram ignorados porque foram desativados ou transformados em produtos de estoque automático durante a conferência."
                    : "Inventário finalizado e estoque ajustado com sucesso.",
            divergencias: resultado.aplicadas,
            ignorados: resultado.ignoradas,
            ajuste_total: resultado.ajusteTotal
        });
    } catch (erro) {
        console.error("Erro ao finalizar inventário:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao finalizar inventário." });
    }
});

router.post("/:id/cancelar", (req, res) => {
    try {
        const id = Number(req.params.id);
        const info = db.prepare(`
            UPDATE inventarios SET status = 'cancelado', finalizado_em = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'aberto'
        `).run(id);

        if (!info.changes) return res.status(404).json({ sucesso: false, mensagem: "Inventário não encontrado ou já encerrado." });

        registrarAuditoria(req, "INVENTARIO_CANCELADO", "inventario", id,
            `Inventário #${id} cancelado.`);
        res.json({ sucesso: true, mensagem: "Inventário cancelado." });
    } catch (erro) {
        console.error("Erro ao cancelar inventário:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao cancelar inventário." });
    }
});

router.get("/historico", (req, res) => {
    try {
        const itens = db.prepare(`
            SELECT * FROM inventarios
            WHERE status <> 'aberto'
            ORDER BY id DESC LIMIT 30
        `).all();
        res.json({ sucesso: true, inventarios: itens });
    } catch (erro) {
        res.status(500).json({ sucesso: false, mensagem: "Erro ao carregar histórico." });
    }
});

router.get("/:id", (req, res) => {
    try {
        const inventario = db.prepare(`SELECT * FROM inventarios WHERE id = ?`).get(Number(req.params.id));
        if (!inventario) return res.status(404).json({ sucesso: false, mensagem: "Inventário não encontrado." });
        const itens = db.prepare(`
            SELECT * FROM itens_inventario WHERE inventario_id = ?
            ORDER BY diferenca = 0, ABS(COALESCE(diferenca, 0)) DESC, produto_nome
        `).all(inventario.id);
        res.json({ sucesso: true, inventario, itens });
    } catch (erro) {
        res.status(500).json({ sucesso: false, mensagem: "Erro ao carregar inventário." });
    }
});

module.exports = router;
