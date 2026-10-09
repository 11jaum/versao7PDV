const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../database");
const registrarAuditoria = require("../utils/auditoria");

const router = express.Router();
const pastaUploads = path.join(__dirname, "..", "public", "uploads");
fs.mkdirSync(pastaUploads, { recursive: true });

const extensaoPorMime = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp"
};

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, pastaUploads),
    filename: (_req, file, cb) => {
        const ext = extensaoPorMime[file.mimetype] || ".img";
        const sufixo = Math.random().toString(36).slice(2, 10);
        cb(null, `logo-${Date.now()}-${sufixo}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const permitidos = ["image/png", "image/jpeg", "image/webp"];

        if (!permitidos.includes(file.mimetype)) {
            return cb(
                new Error(
                    "Use uma imagem PNG, JPG ou WEBP."
                )
            );
        }

        cb(null, true);
    }
});

function texto(valor, maximo = 255) {
    return String(valor || "")
        .trim()
        .slice(0, maximo);
}

function inteiro(valor, padrao, minimo, maximo) {
    const numero = Number.parseInt(valor, 10);

    if (!Number.isInteger(numero)) {
        return padrao;
    }

    return Math.min(
        maximo,
        Math.max(minimo, numero)
    );
}

function numero(valor, padrao, minimo, maximo) {
    const convertido = Number(valor);

    if (!Number.isFinite(convertido)) {
        return padrao;
    }

    return Math.min(
        maximo,
        Math.max(minimo, convertido)
    );
}

function booleano(valor, padrao = 0) {
    if (valor === undefined || valor === null) {
        return padrao;
    }

    return ["1", "true", "on", "sim"].includes(
        String(valor).toLowerCase()
    ) ? 1 : 0;
}

function removerLogoGerenciada(logo) {
    if (
        !logo ||
        !String(logo).startsWith("/uploads/logo-")
    ) {
        return;
    }

    const nome = path.basename(logo);
    const arquivo = path.join(pastaUploads, nome);

    if (fs.existsSync(arquivo)) {
        try {
            fs.unlinkSync(arquivo);
        } catch (erro) {
            console.error(
                "Não foi possível remover logo antiga:",
                erro
            );
        }
    }
}

router.get("/", (_req, res) => {
    try {
        const config = db
            .prepare(`
                SELECT *
                FROM configuracoes
                WHERE id = 1
            `)
            .get();

        res.json(config);
    } catch (erro) {
        console.error(
            "Erro ao carregar configurações:",
            erro
        );

        res.status(500).json({
            sucesso: false,
            mensagem:
                "Não foi possível carregar as configurações."
        });
    }
});

router.put(
    "/",
    upload.single("logo"),
    (req, res) => {
        let logoNovaTemporaria =
            req.file?.path || null;

        try {
            if (
                req.session?.usuario?.perfil !==
                "administrador"
            ) {
                if (
                    logoNovaTemporaria &&
                    fs.existsSync(logoNovaTemporaria)
                ) {
                    fs.unlinkSync(
                        logoNovaTemporaria
                    );
                }

                return res.status(403).json({
                    sucesso: false,
                    mensagem:
                        "Acesso permitido apenas para administradores."
                });
            }

            const atual = db
                .prepare(`
                    SELECT *
                    FROM configuracoes
                    WHERE id = 1
                `)
                .get();

            const nome =
                texto(req.body.nome_adega, 80);

            const subtitulo =
                texto(req.body.subtitulo, 100);

            if (!nome) {
                throw new Error(
                    "Informe o nome da adega."
                );
            }

            if (!subtitulo) {
                throw new Error(
                    "Informe o subtítulo."
                );
            }

            const razaoSocial =
                texto(req.body.razao_social, 120);

            const cnpj =
                texto(req.body.cnpj, 18);

            const telefone =
                texto(req.body.telefone, 25);

            const endereco =
                texto(req.body.endereco, 120);

            const numeroEndereco =
                texto(req.body.numero, 20);

            const complemento =
                texto(req.body.complemento, 60);

            const bairro =
                texto(req.body.bairro, 80);

            const cidade =
                texto(req.body.cidade, 80);

            const estado =
                texto(req.body.estado, 2)
                    .toUpperCase();

            const cep =
                texto(req.body.cep, 10);

            const minimo =
                inteiro(
                    req.body.estoque_minimo_padrao,
                    0,
                    0,
                    999999
                );

            const diasParado =
                inteiro(
                    req.body.dias_produto_parado,
                    30,
                    1,
                    3650
                );

            const tema =
                req.body.tema_padrao === "escuro"
                    ? "escuro"
                    : "claro";

            const exibirDestaques =
                booleano(
                    req.body.pdv_exibir_destaques,
                    1
                );

            const qtdDestaques =
                inteiro(
                    req.body.pdv_quantidade_destaques,
                    8,
                    1,
                    12
                );

            const focoBusca =
                booleano(
                    req.body.pdv_foco_busca,
                    1
                );

            const permitirDesconto =
                booleano(
                    req.body.pdv_permitir_desconto,
                    1
                );

            const descontoMaximo =
                numero(
                    req.body
                        .pdv_desconto_maximo_percentual,
                    100,
                    0,
                    100
                );

            let logo = atual.logo;

            if (
                req.body.remover_logo === "1"
            ) {
                logo = null;
            }

            if (req.file) {
                logo =
                    `/uploads/${req.file.filename}`;
            }

            db.prepare(`
                UPDATE configuracoes
                SET
                    nome_adega = ?,
                    subtitulo = ?,
                    logo = ?,
                    razao_social = ?,
                    cnpj = ?,
                    telefone = ?,
                    endereco = ?,
                    numero = ?,
                    complemento = ?,
                    bairro = ?,
                    cidade = ?,
                    estado = ?,
                    cep = ?,
                    estoque_minimo_padrao = ?,
                    dias_produto_parado = ?,
                    tema_padrao = ?,
                    pdv_exibir_destaques = ?,
                    pdv_quantidade_destaques = ?,
                    pdv_foco_busca = ?,
                    pdv_permitir_desconto = ?,
                    pdv_desconto_maximo_percentual = ?,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = 1
            `).run(
                nome,
                subtitulo,
                logo,
                razaoSocial,
                cnpj,
                telefone,
                endereco,
                numeroEndereco,
                complemento,
                bairro,
                cidade,
                estado,
                cep,
                minimo,
                diasParado,
                tema,
                exibirDestaques,
                qtdDestaques,
                focoBusca,
                permitirDesconto,
                descontoMaximo
            );

            if (
                atual.logo &&
                atual.logo !== logo
            ) {
                removerLogoGerenciada(
                    atual.logo
                );
            }

            logoNovaTemporaria = null;

            const config = db
                .prepare(`
                    SELECT *
                    FROM configuracoes
                    WHERE id = 1
                `)
                .get();

            registrarAuditoria(
                req,
                "CONFIGURACOES_ALTERADAS",
                "configuracoes",
                1,
                "Configurações da adega e do PDV foram atualizadas.",
                {
                    nome_adega: config.nome_adega,
                    cnpj: config.cnpj,
                    cidade: config.cidade,
                    estoque_minimo_padrao:
                        config.estoque_minimo_padrao,
                    dias_produto_parado:
                        config.dias_produto_parado,
                    pdv_exibir_destaques:
                        config.pdv_exibir_destaques,
                    pdv_quantidade_destaques:
                        config.pdv_quantidade_destaques,
                    pdv_foco_busca:
                        config.pdv_foco_busca,
                    pdv_permitir_desconto:
                        config.pdv_permitir_desconto,
                    pdv_desconto_maximo_percentual:
                        config
                            .pdv_desconto_maximo_percentual
                }
            );

            res.json({
                sucesso: true,
                mensagem:
                    "Configurações salvas com sucesso.",
                configuracoes: config
            });

        } catch (erro) {
            if (
                logoNovaTemporaria &&
                fs.existsSync(logoNovaTemporaria)
            ) {
                try {
                    fs.unlinkSync(
                        logoNovaTemporaria
                    );
                } catch {}
            }

            console.error(
                "Erro ao salvar configurações:",
                erro
            );

            const mensagem =
                erro.message &&
                (
                    erro.message.startsWith("Informe ")
                )
                    ? erro.message
                    : "Não foi possível salvar as configurações.";

            res.status(
                mensagem.startsWith("Informe ")
                    ? 400
                    : 500
            ).json({
                sucesso: false,
                mensagem
            });
        }
    }
);

router.use(
    (erro, req, res, _next) => {
        if (
            req.file?.path &&
            fs.existsSync(req.file.path)
        ) {
            try {
                fs.unlinkSync(req.file.path);
            } catch {}
        }

        res.status(400).json({
            sucesso: false,
            mensagem:
                erro.message ||
                "Arquivo inválido."
        });
    }
);

module.exports = router;
