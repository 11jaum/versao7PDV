const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const db = require("../database");
const registrarAuditoria = require("../utils/auditoria");

const MAX_NOME = 120;
const MAX_USUARIO = 80;
const MAX_SENHA = 128;

function idValido(valor) {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0
        ? id
        : null;
}

function exigirAdministrador(req, res, next) {
    if (!req.session?.usuario) {
        return res.status(401).json({ sucesso: false, mensagem: "Você precisa estar logado." });
    }
    if (req.session.usuario.perfil !== "administrador") {
        return res.status(403).json({ sucesso: false, mensagem: "Acesso permitido apenas para administradores." });
    }
    next();
}

router.use(exigirAdministrador);

function contarAdminsAtivos() {
    return Number(db.prepare(`
        SELECT COUNT(*) AS total
        FROM usuarios
        WHERE perfil = 'administrador' AND ativo = 1
    `).get().total || 0);
}

function obterUsuario(id) {
    const valido =
        idValido(id);

    if (!valido) {
        return null;
    }

    return db
        .prepare(
            `SELECT * FROM usuarios WHERE id = ?`
        )
        .get(valido);
}

router.get("/", (req, res) => {
    try {
        const usuarios = db.prepare(`
            SELECT id, nome, usuario, perfil, ativo, criado_em, tentativas_login, bloqueado_ate
            FROM usuarios
            ORDER BY ativo DESC, nome COLLATE NOCASE ASC
        `).all();
        res.json({ sucesso: true, dados: usuarios });
    } catch (erro) {
        console.error("Erro ao listar usuários:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao carregar usuários." });
    }
});

router.post("/", async (req, res) => {
    try {
        const nome = String(req.body.nome || "").trim();
        const usuario = String(req.body.usuario || "").trim();
        const senha = String(req.body.senha || "");
        const perfil = req.body.perfil === "administrador" ? "administrador" : "operador";

        if (!nome || !usuario || !senha) {
            return res.status(400).json({ sucesso: false, mensagem: "Preencha nome, usuário e senha." });
        }
        if (
            nome.length > MAX_NOME ||
            usuario.length > MAX_USUARIO
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: `Nome deve ter até ${MAX_NOME} caracteres e usuário até ${MAX_USUARIO}.`
            });
        }
        if (senha.length > MAX_SENHA) {
            return res.status(400).json({
                sucesso: false,
                mensagem: `A senha deve ter no máximo ${MAX_SENHA} caracteres.`
            });
        }
        if (senha.length < 6) {
            return res.status(400).json({ sucesso: false, mensagem: "A senha deve ter pelo menos 6 caracteres." });
        }

        const existe = db.prepare(`SELECT id FROM usuarios WHERE LOWER(usuario) = LOWER(?)`).get(usuario);
        if (existe) {
            return res.status(409).json({ sucesso: false, mensagem: "Este nome de usuário já está em uso." });
        }

        const hash = await bcrypt.hash(senha, 10);
        const info = db.prepare(`
            INSERT INTO usuarios (nome, usuario, senha_hash, perfil, ativo)
            VALUES (?, ?, ?, ?, 1)
        `).run(nome, usuario, hash, perfil);

        registrarAuditoria(req, "USUARIO_CRIADO", "usuario", Number(info.lastInsertRowid),
            `Usuário ${nome} criado com perfil ${perfil}.`);

        res.json({ sucesso: true, mensagem: "Usuário criado com sucesso." });
    } catch (erro) {
        console.error("Erro ao criar usuário:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao criar usuário." });
    }
});

router.put("/:id", (req, res) => {
    try {
        const id = idValido(req.params.id);
        if (!id) {
            return res.status(400).json({ sucesso: false, mensagem: "ID de usuário inválido." });
        }

        const atual = obterUsuario(id);
        if (!atual) return res.status(404).json({ sucesso: false, mensagem: "Usuário não encontrado." });

        const nome = String(req.body.nome || "").trim();
        const usuario = String(req.body.usuario || "").trim();
        const perfil = req.body.perfil === "administrador" ? "administrador" : "operador";

        if (!nome || !usuario) {
            return res.status(400).json({ sucesso: false, mensagem: "Informe nome e usuário." });
        }

        if (
            nome.length > MAX_NOME ||
            usuario.length > MAX_USUARIO
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: `Nome deve ter até ${MAX_NOME} caracteres e usuário até ${MAX_USUARIO}.`
            });
        }

        const duplicado = db.prepare(`
            SELECT id FROM usuarios
            WHERE LOWER(usuario) = LOWER(?) AND id <> ?
        `).get(usuario, id);
        if (duplicado) {
            return res.status(409).json({ sucesso: false, mensagem: "Este nome de usuário já está em uso." });
        }

        // Nunca permite retirar o perfil do último administrador ativo.
        if (
            atual.perfil === "administrador" &&
            Number(atual.ativo) === 1 &&
            perfil !== "administrador" &&
            contarAdminsAtivos() <= 1
        ) {
            return res.status(409).json({
                sucesso: false,
                mensagem: "Não é possível rebaixar o último administrador ativo. Crie ou ative outro administrador primeiro."
            });
        }

        db.prepare(`
            UPDATE usuarios
            SET nome = ?, usuario = ?, perfil = ?
            WHERE id = ?
        `).run(nome, usuario, perfil, id);

        // Se o administrador editou a si mesmo, atualiza a sessão imediatamente.
        if (Number(req.session.usuario.id) === id) {
            req.session.usuario.nome = nome;
            req.session.usuario.usuario = usuario;
            req.session.usuario.perfil = perfil;
        }

        registrarAuditoria(req, "USUARIO_EDITADO", "usuario", id,
            `Usuário ${nome} editado.`,
            { perfil_anterior: atual.perfil, perfil_novo: perfil });

        res.json({ sucesso: true, mensagem: "Usuário atualizado com sucesso." });
    } catch (erro) {
        console.error("Erro ao editar usuário:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao editar usuário." });
    }
});

router.put("/:id/senha", async (req, res) => {
    try {
        const id = idValido(req.params.id);
        if (!id) {
            return res.status(400).json({ sucesso: false, mensagem: "ID de usuário inválido." });
        }

        const senha = String(req.body.senha || "");
        const usuario = obterUsuario(id);
        if (!usuario) return res.status(404).json({ sucesso: false, mensagem: "Usuário não encontrado." });
        if (senha.length > MAX_SENHA) return res.status(400).json({ sucesso: false, mensagem: `A senha deve ter no máximo ${MAX_SENHA} caracteres.` });
        if (senha.length < 6) return res.status(400).json({ sucesso: false, mensagem: "A senha deve ter pelo menos 6 caracteres." });

        const hash = await bcrypt.hash(senha, 10);
        db.prepare(`
            UPDATE usuarios
            SET senha_hash = ?, tentativas_login = 0, bloqueado_ate = NULL
            WHERE id = ?
        `).run(hash, id);

        registrarAuditoria(req, "SENHA_USUARIO_ALTERADA", "usuario", id,
            `Senha de ${usuario.nome} alterada por administrador.`);

        res.json({ sucesso: true, mensagem: "Senha alterada com sucesso." });
    } catch (erro) {
        console.error("Erro ao alterar senha:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao alterar senha." });
    }
});

router.patch("/:id/status", (req, res) => {
    try {
        const id = idValido(req.params.id);
        if (!id) {
            return res.status(400).json({ sucesso: false, mensagem: "ID de usuário inválido." });
        }

        const usuario = obterUsuario(id);
        if (!usuario) return res.status(404).json({ sucesso: false, mensagem: "Usuário não encontrado." });

        const atualmenteAtivo = Number(usuario.ativo) === 1;
        const novoAtivo = atualmenteAtivo ? 0 : 1;

        if (atualmenteAtivo && Number(req.session.usuario.id) === id) {
            return res.status(409).json({ sucesso: false, mensagem: "Você não pode desativar o próprio usuário enquanto está logado." });
        }

        if (
            atualmenteAtivo &&
            usuario.perfil === "administrador" &&
            contarAdminsAtivos() <= 1
        ) {
            return res.status(409).json({
                sucesso: false,
                mensagem: "Não é possível desativar o último administrador ativo. Crie ou ative outro administrador primeiro."
            });
        }

        db.prepare(`
            UPDATE usuarios
            SET ativo = ?, tentativas_login = 0, bloqueado_ate = NULL
            WHERE id = ?
        `).run(novoAtivo, id);

        registrarAuditoria(req, novoAtivo ? "USUARIO_ATIVADO" : "USUARIO_DESATIVADO", "usuario", id,
            `${usuario.nome} foi ${novoAtivo ? "ativado" : "desativado"}.`);

        res.json({
            sucesso: true,
            mensagem: novoAtivo ? "Usuário ativado com sucesso." : "Usuário desativado com sucesso."
        });
    } catch (erro) {
        console.error("Erro ao alterar status do usuário:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao alterar o status do usuário." });
    }
});

module.exports = router;
