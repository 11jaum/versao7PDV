const express = require("express");
const router = express.Router();
const db = require("../database");

router.get("/", (req, res) => {
    try {
        const pagina = Math.max(1, Number(req.query.pagina) || 1);
        const limite = Math.min(100, Math.max(10, Number(req.query.limite) || 30));
        const offset = (pagina - 1) * limite;
        const usuarioId = Number(req.query.usuario_id) || null;
        const acao = String(req.query.acao || "").trim();
        const inicio = String(req.query.inicio || "").trim();
        const fim = String(req.query.fim || "").trim();
        const busca = String(req.query.busca || "").trim();

        const filtros = [];
        const params = [];
        if (usuarioId) { filtros.push("a.usuario_id = ?"); params.push(usuarioId); }
        if (acao) { filtros.push("a.acao = ?"); params.push(acao); }
        if (inicio) { filtros.push("date(a.criado_em, 'localtime') >= date(?)"); params.push(inicio); }
        if (fim) { filtros.push("date(a.criado_em, 'localtime') <= date(?)"); params.push(fim); }
        if (busca) {
            filtros.push("(a.descricao LIKE ? OR a.usuario_nome LIKE ? OR a.usuario_login LIKE ? OR a.entidade LIKE ?)");
            const termo = `%${busca}%`; params.push(termo, termo, termo, termo);
        }
        const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
        const total = db.prepare(`SELECT COUNT(*) AS total FROM auditoria a ${where}`).get(...params).total;
        const registros = db.prepare(`
            SELECT a.id, a.usuario_id, a.usuario_nome, a.usuario_login, a.perfil,
                   a.acao, a.entidade, a.entidade_id, a.descricao, a.detalhes, a.criado_em
            FROM auditoria a ${where}
            ORDER BY a.id DESC LIMIT ? OFFSET ?
        `).all(...params, limite, offset);
        const usuarios = db.prepare(`SELECT id, nome, usuario FROM usuarios ORDER BY nome`).all();
        const acoes = db.prepare(`SELECT DISTINCT acao FROM auditoria ORDER BY acao`).all().map(x => x.acao);
        res.json({ sucesso: true, registros, usuarios, acoes, paginacao: { pagina, limite, total, total_paginas: Math.max(1, Math.ceil(total / limite)) } });
    } catch (erro) {
        console.error("Erro auditoria:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao carregar auditoria." });
    }
});

module.exports = router;
