const express = require("express");
const router = express.Router();
const db = require("../database");
const registrarAuditoria = require("../utils/auditoria");

router.get("/", (_req, res) => {
    try {
        const categorias = db.prepare(`
            SELECT *
            FROM categorias
            ORDER BY nome COLLATE NOCASE
        `).all();

        return res.json(categorias);
    } catch (erro) {
        console.error("Erro ao listar categorias:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao carregar categorias."
        });
    }
});

router.post("/", (req, res) => {
    try {
        const nome = String(req.body?.nome || "")
            .trim()
            .slice(0, 80);

        if (!nome) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Nome da categoria é obrigatório."
            });
        }

        const resultado = db.prepare(`
            INSERT INTO categorias (nome)
            VALUES (?)
        `).run(nome);

        const id = Number(resultado.lastInsertRowid);

        registrarAuditoria(
            req,
            "CATEGORIA_CRIADA",
            "categoria",
            id,
            `Categoria ${nome} cadastrada.`
        );

        return res.status(201).json({
            sucesso: true,
            mensagem: "Categoria cadastrada.",
            id
        });
    } catch (erro) {
        if (
            erro.code === "SQLITE_CONSTRAINT_UNIQUE" ||
            String(erro.message || "").includes("UNIQUE constraint failed: categorias.nome")
        ) {
            return res.status(409).json({
                sucesso: false,
                mensagem: "Essa categoria já existe."
            });
        }

        console.error("Erro ao cadastrar categoria:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao cadastrar categoria."
        });
    }
});

module.exports = router;
