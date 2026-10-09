const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const db = require("../database");
const registrarAuditoria = require("../utils/auditoria");

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;
const MAX_USUARIO = 80;
const MAX_SENHA = 128;

function regenerarSessao(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate(erro => {
            if (erro) {
                reject(erro);
                return;
            }

            resolve();
        });
    });
}

function agoraMs() {
    return Date.now();
}

function dataBloqueioFutura() {
    return new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000).toISOString();
}

function minutosRestantes(data) {
    const ms = new Date(data).getTime() - agoraMs();
    return Math.max(1, Math.ceil(ms / 60000));
}

// LOGIN
router.post("/login", async (req, res) => {
    try {
        const usuarioInformado =
            String(req.body.usuario || "")
                .trim();

        const senha =
            String(req.body.senha || "");

        if (!usuarioInformado || !senha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Informe usuário e senha."
            });
        }

        if (
            usuarioInformado.length > MAX_USUARIO ||
            senha.length > MAX_SENHA
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Usuário ou senha em formato inválido."
            });
        }

        const usuarioBanco = db.prepare(`
            SELECT *
            FROM usuarios
            WHERE LOWER(usuario) = LOWER(?)
              AND ativo = 1
            LIMIT 1
        `).get(usuarioInformado);

        // Mensagem genérica para não revelar se o usuário existe.
        if (!usuarioBanco) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "Usuário ou senha inválidos."
            });
        }

        // Libera automaticamente se o prazo já passou.
        if (usuarioBanco.bloqueado_ate) {
            const bloqueadoAte = new Date(usuarioBanco.bloqueado_ate).getTime();

            if (Number.isFinite(bloqueadoAte) && bloqueadoAte > agoraMs()) {
                return res.status(423).json({
                    sucesso: false,
                    bloqueado: true,
                    mensagem: `Usuário temporariamente bloqueado. Tente novamente em aproximadamente ${minutosRestantes(usuarioBanco.bloqueado_ate)} minuto(s).`
                });
            }

            db.prepare(`
                UPDATE usuarios
                SET tentativas_login = 0,
                    bloqueado_ate = NULL
                WHERE id = ?
            `).run(usuarioBanco.id);
        }

        const senhaCorreta = await bcrypt.compare(senha, usuarioBanco.senha_hash);

        if (!senhaCorreta) {
            const tentativas = Number(usuarioBanco.tentativas_login || 0) + 1;

            if (tentativas >= MAX_TENTATIVAS) {
                const bloqueadoAte = dataBloqueioFutura();

                db.prepare(`
                    UPDATE usuarios
                    SET tentativas_login = ?,
                        bloqueado_ate = ?
                    WHERE id = ?
                `).run(tentativas, bloqueadoAte, usuarioBanco.id);

                return res.status(423).json({
                    sucesso: false,
                    bloqueado: true,
                    mensagem: `Muitas tentativas incorretas. Usuário bloqueado por ${BLOQUEIO_MINUTOS} minutos.`
                });
            }

            db.prepare(`
                UPDATE usuarios
                SET tentativas_login = ?
                WHERE id = ?
            `).run(tentativas, usuarioBanco.id);

            const restantes = MAX_TENTATIVAS - tentativas;
            return res.status(401).json({
                sucesso: false,
                mensagem: `Usuário ou senha inválidos. Restam ${restantes} tentativa(s) antes do bloqueio temporário.`
            });
        }

        db.prepare(`
            UPDATE usuarios
            SET tentativas_login = 0,
                bloqueado_ate = NULL
            WHERE id = ?
        `).run(usuarioBanco.id);

        // Gera um novo ID de sessão após autenticar para impedir
        // reaproveitamento de uma sessão anônima anterior.
        await regenerarSessao(req);

        req.session.usuario = {
            id: usuarioBanco.id,
            nome: usuarioBanco.nome,
            usuario: usuarioBanco.usuario,
            perfil: usuarioBanco.perfil
        };

        registrarAuditoria(
            req,
            "LOGIN",
            "usuario",
            usuarioBanco.id,
            `Login realizado por ${usuarioBanco.nome}.`
        );

        res.json({
            sucesso: true,
            mensagem: "Login realizado com sucesso.",
            usuario: req.session.usuario
        });

    } catch (erro) {
        console.error("Erro login:", erro);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao realizar login."
        });
    }
});

// TROCAR A PRÓPRIA SENHA
router.put("/minha-senha", async (req, res) => {
    try {
        if (!req.session?.usuario) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "Você precisa estar logado."
            });
        }

        const senhaAtual =
            String(req.body.senha_atual || "");

        const novaSenha =
            String(req.body.nova_senha || "");

        if (!senhaAtual || !novaSenha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Informe a senha atual e a nova senha."
            });
        }

        if (
            senhaAtual.length > MAX_SENHA ||
            novaSenha.length > MAX_SENHA
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: `A senha deve ter no máximo ${MAX_SENHA} caracteres.`
            });
        }

        if (novaSenha.length < 6) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "A nova senha deve ter pelo menos 6 caracteres."
            });
        }

        if (senhaAtual === novaSenha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "A nova senha deve ser diferente da senha atual."
            });
        }

        const usuario = db.prepare(`
            SELECT id, nome, usuario, senha_hash
            FROM usuarios
            WHERE id = ? AND ativo = 1
        `).get(req.session.usuario.id);

        if (!usuario) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Usuário não encontrado."
            });
        }

        const atualCorreta = await bcrypt.compare(senhaAtual, usuario.senha_hash);
        if (!atualCorreta) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "A senha atual está incorreta."
            });
        }

        const hash = await bcrypt.hash(novaSenha, 10);
        db.prepare(`
            UPDATE usuarios
            SET senha_hash = ?,
                tentativas_login = 0,
                bloqueado_ate = NULL
            WHERE id = ?
        `).run(hash, usuario.id);

        registrarAuditoria(
            req,
            "SENHA_PROPRIA_ALTERADA",
            "usuario",
            usuario.id,
            `${usuario.nome} alterou a própria senha.`
        );

        res.json({
            sucesso: true,
            mensagem: "Senha alterada com sucesso."
        });
    } catch (erro) {
        console.error("Erro ao alterar a própria senha:", erro);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao alterar a senha."
        });
    }
});

// LOGOUT
router.post("/logout", (req, res) => {
    if (!req.session?.usuario) {
        return res.json({ sucesso: true, mensagem: "Sessão encerrada." });
    }

    try {
        registrarAuditoria(
            req,
            "LOGOUT",
            "usuario",
            req.session.usuario.id,
            `Logout realizado por ${req.session.usuario.nome}.`
        );
    } catch (erro) {
        console.error("Erro ao registrar logout na auditoria:", erro);
    }

    req.session.destroy(erro => {
        if (erro) {
            console.error("Erro logout:", erro);
            return res.status(500).json({
                sucesso: false,
                mensagem: "Erro ao sair do sistema."
            });
        }

        res.clearCookie("adegapdv.sid");
        res.json({
            sucesso: true,
            mensagem: "Logout realizado com sucesso."
        });
    });
});

// SESSÃO
router.get("/sessao", (req, res) => {
    if (!req.session?.usuario) {
        return res.status(401).json({
            sucesso: false,
            logado: false
        });
    }

    // Confere se o usuário ainda existe e continua ativo.
    const usuarioBanco = db.prepare(`
        SELECT id, nome, usuario, perfil, ativo
        FROM usuarios
        WHERE id = ?
    `).get(req.session.usuario.id);

    if (!usuarioBanco || Number(usuarioBanco.ativo) !== 1) {
        return req.session.destroy(() => {
            res.status(401).json({ sucesso: false, logado: false });
        });
    }

    req.session.usuario = {
        id: usuarioBanco.id,
        nome: usuarioBanco.nome,
        usuario: usuarioBanco.usuario,
        perfil: usuarioBanco.perfil
    };

    res.json({
        sucesso: true,
        logado: true,
        usuario: req.session.usuario
    });
});

module.exports = router;
