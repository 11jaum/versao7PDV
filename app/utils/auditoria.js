const db = require("../database");

function registrarAuditoria(
    req,
    acao,
    entidade,
    entidadeId,
    descricao,
    detalhes = null
) {
    try {
        const usuario =
            req?.session?.usuario ||
            {};

        db.prepare(`
            INSERT INTO auditoria (
                usuario_id,
                usuario_nome,
                usuario_login,
                perfil,
                acao,
                entidade,
                entidade_id,
                descricao,
                detalhes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            usuario.id || null,
            usuario.nome || "Sistema",
            usuario.usuario || "sistema",
            usuario.perfil || "sistema",
            String(acao || "ACAO"),
            entidade || null,
            entidadeId || null,
            String(descricao || "Ação registrada."),
            detalhes
                ? JSON.stringify(detalhes)
                : null
        );

        return true;
    } catch (erro) {
        // Auditoria é importante, mas uma falha no log não pode transformar
        // uma venda/entrada/fechamento já concluído em erro para o usuário.
        console.error(
            "Falha ao registrar auditoria:",
            erro
        );

        return false;
    }
}

module.exports = registrarAuditoria;
