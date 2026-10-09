const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const session = require("express-session");

const db = require("./database");
const {
    iniciarBackupAutomatico
} = require("./utils/backupAutomatico");

const {
    obterStatusLicenca,
    statusPublico
} = require("./utils/licenca");

const app = express();

// =====================================================
// CONFIGURAÇÕES BÁSICAS
// =====================================================

app.disable("x-powered-by");

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(
    express.urlencoded({
        extended: false,
        limit: "2mb"
    })
);

function obterSegredoSessao() {
    if (process.env.SESSION_SECRET) {
        return process.env.SESSION_SECRET;
    }

    const pastaData =
        path.join(
            __dirname,
            "..",
            "data"
        );

    const arquivo =
        path.join(
            pastaData,
            "session-secret.txt"
        );

    try {
        fs.mkdirSync(
            pastaData,
            {
                recursive: true
            }
        );

        if (fs.existsSync(arquivo)) {
            const existente =
                fs
                    .readFileSync(
                        arquivo,
                        "utf8"
                    )
                    .trim();

            if (existente.length >= 32) {
                return existente;
            }
        }

        const segredo =
            crypto
                .randomBytes(48)
                .toString("base64url");

        fs.writeFileSync(
            arquivo,
            segredo,
            {
                encoding: "utf8",
                mode: 0o600
            }
        );

        return segredo;
    } catch (erro) {
        console.error(
            "Não foi possível persistir o segredo de sessão:",
            erro
        );

        return crypto
            .randomBytes(48)
            .toString("base64url");
    }
}

// =====================================================
// SESSÃO
// =====================================================

app.use(
    session({
        name: "adegapdv.sid",
        secret: obterSegredoSessao(),
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            maxAge:
                1000 *
                60 *
                60 *
                8
        }
    })
);

// =====================================================
// ROTAS
// =====================================================

const produtosRoutes =
    require("./routes/produtos");

const categoriasRoutes =
    require("./routes/categorias");

const estoqueRoutes =
    require("./routes/estoque");

const caixaRoutes =
    require("./routes/caixa");

const vendasRoutes =
    require("./routes/vendas");

const comandasRoutes =
    require("./routes/comandas");

const relatoriosRoutes =
    require("./routes/relatorios");

const backupRoutes =
    require("./routes/backup");

const authRoutes =
    require("./routes/auth");

const usuariosRoutes =
    require("./routes/usuarios");

const auditoriaRoutes =
    require("./routes/auditoria");

const configuracoesRoutes =
    require("./routes/configuracoes");

const inventarioRoutes =
    require("./routes/inventario");

const sistemaRoutes =
    require("./routes/sistema");

const planilhaRoutes =
    require("./routes/planilha");

const atualizacaoRoutes =
    require("./routes/atualizacao");

const licencaRoutes =
    require("./routes/licenca");

const dashboardRoutes =
    require("./routes/dashboard");

// =====================================================
// LICENCIAMENTO
// As rotas de ativação precisam continuar acessíveis mesmo
// quando ainda não existe uma licença válida.
// =====================================================

app.use(
    "/api/licenca",
    licencaRoutes
);

function exigirLicenca(
    req,
    res,
    next
) {
    const status =
        obterStatusLicenca();

    if (status.valida) {
        return next();
    }

    return res.status(402).json({
        sucesso: false,
        codigo: "LICENCA_NECESSARIA",
        mensagem: status.mensagem,
        licenca: statusPublico(status)
    });
}

// Toda API operacional, inclusive login, exige uma licença válida.
// /api/status e /api/licenca/* ficam liberados para o launcher/ativação.
app.use(
    "/api",
    (req, res, next) => {
        if (
            req.path === "/status" ||
            req.path.startsWith("/licenca")
        ) {
            return next();
        }

        return exigirLicenca(
            req,
            res,
            next
        );
    }
);

// =====================================================
// AUTENTICAÇÃO
// =====================================================

app.use(
    "/api/auth",
    authRoutes
);

function exigirLogin(
    req,
    res,
    next
) {
    if (
        req.session &&
        req.session.usuario
    ) {
        return next();
    }

    return res.status(401).json({
        sucesso: false,
        mensagem:
            "Você precisa estar logado."
    });
}

function exigirAdministrador(
    req,
    res,
    next
) {
    if (
        !req.session ||
        !req.session.usuario
    ) {
        return res.status(401).json({
            sucesso: false,
            mensagem:
                "Você precisa estar logado."
        });
    }

    if (
        req.session.usuario.perfil !==
        "administrador"
    ) {
        return res.status(403).json({
            sucesso: false,
            mensagem:
                "Acesso permitido apenas para administradores."
        });
    }

    return next();
}

// =====================================================
// APIs PROTEGIDAS
// =====================================================

app.use(
    "/api/produtos",
    exigirLogin,
    produtosRoutes
);

app.use(
    "/api/categorias",
    exigirLogin,
    categoriasRoutes
);

app.use(
    "/api/estoque",
    exigirLogin,
    estoqueRoutes
);

app.use(
    "/api/caixa",
    exigirLogin,
    caixaRoutes
);

app.use(
    "/api/vendas",
    exigirLogin,
    vendasRoutes
);

app.use(
    "/api/dashboard",
    exigirLogin,
    dashboardRoutes
);

app.use(
    "/api/comandas",
    exigirLogin,
    comandasRoutes
);

app.use(
    "/api/relatorios",
    exigirLogin,
    exigirAdministrador,
    relatoriosRoutes
);

app.use(
    "/api/backup",
    exigirLogin,
    exigirAdministrador,
    backupRoutes
);

app.use(
    "/api/usuarios",
    exigirLogin,
    exigirAdministrador,
    usuariosRoutes
);

app.use(
    "/api/auditoria",
    exigirLogin,
    exigirAdministrador,
    auditoriaRoutes
);

app.use(
    "/api/configuracoes",
    exigirLogin,
    configuracoesRoutes
);

app.use(
    "/api/inventario",
    exigirLogin,
    inventarioRoutes
);

app.use(
    "/api/sistema",
    exigirLogin,
    exigirAdministrador,
    sistemaRoutes
);

app.use(
    "/api/planilha",
    exigirLogin,
    exigirAdministrador,
    planilhaRoutes
);

app.use(
    "/api/atualizacao",
    exigirLogin,
    exigirAdministrador,
    atualizacaoRoutes
);

// =====================================================
// STATUS DO SERVIDOR
// =====================================================

app.get(
    "/api/status",
    (_req, res) => {
        const licenca =
            statusPublico(
                obterStatusLicenca()
            );

        res.json({
            sucesso: true,
            mensagem:
                "PDV da Adega funcionando",
            licenca
        });
    }
);

// APIs inexistentes também retornam JSON. Isso evita o front-end
// receber uma página HTML e falhar com JSON.parse inesperado.
app.use(
    "/api",
    (_req, res) => {
        return res.status(404).json({
            sucesso: false,
            mensagem:
                "Recurso da API não encontrado."
        });
    }
);

// =====================================================
// PÁGINAS DE ATIVAÇÃO / LOGIN / PRINCIPAL
// =====================================================

app.get(
    "/ativacao.html",
    (_req, res) => {
        return res.sendFile(
            path.join(
                __dirname,
                "public",
                "ativacao.html"
            ),
            {
                headers: {
                    "Cache-Control":
                        "no-store, max-age=0"
                }
            }
        );
    }
);

app.get(
    "/login.html",
    (_req, res) => {
        const licenca =
            obterStatusLicenca();

        if (!licenca.valida) {
            return res.redirect(
                "/ativacao.html"
            );
        }

        return res.sendFile(
            path.join(
                __dirname,
                "public",
                "login.html"
            ),
            {
                headers: {
                    "Cache-Control":
                        "no-store, max-age=0"
                }
            }
        );
    }
);

app.get(
    ["/", "/index.html"],
    (req, res) => {
        const licenca =
            obterStatusLicenca();

        if (!licenca.valida) {
            return res.redirect(
                "/ativacao.html"
            );
        }

        if (
            !req.session ||
            !req.session.usuario
        ) {
            return res.redirect(
                "/login.html"
            );
        }

        return res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            ),
            {
                headers: {
                    "Cache-Control":
                        "no-store, max-age=0"
                }
            }
        );
    }
);

// =====================================================
// ARQUIVOS PÚBLICOS
// =====================================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        ),
        {
            index: false,
            dotfiles: "ignore",
            setHeaders: (
                res,
                arquivo
            ) => {
                if (
                    /\.(?:html|js|css)$/i.test(
                        arquivo
                    )
                ) {
                    res.setHeader(
                        "Cache-Control",
                        "no-store, max-age=0"
                    );
                }
            }
        }
    )
);

// =====================================================
// TRATAMENTO GLOBAL DE ERROS
// =====================================================

app.use(
    (erro, req, res, _next) => {
        console.error(
            "Erro não tratado na requisição:",
            erro
        );

        if (
            erro instanceof SyntaxError &&
            erro.status === 400 &&
            "body" in erro
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    "Os dados enviados estão em formato JSON inválido."
            });
        }

        if (erro?.type === "entity.too.large") {
            return res.status(413).json({
                sucesso: false,
                mensagem:
                    "A requisição é maior que o limite permitido."
            });
        }

        return res.status(500).json({
            sucesso: false,
            mensagem:
                "Erro interno do servidor."
        });
    }
);

// =====================================================
// SERVIDOR
// =====================================================

const PORT =
    Number(
        process.env.PDV_PORT ||
        3000
    );

const HOST =
    process.env.PDV_HOST ||
    "127.0.0.1";

const server = app.listen(
    PORT,
    HOST,
    () => {
        console.log(
            `Servidor rodando em http://${HOST}:${PORT}`
        );

        iniciarBackupAutomatico(db);
    }
);

function encerrarServidor(sinal) {
    console.log(
        `Encerrando servidor (${sinal})...`
    );

    server.close(() => {
        try {
            if (db.open) {
                db.close();
            }
        } catch (erro) {
            console.error(
                "Erro ao fechar SQLite:",
                erro
            );
        }

        process.exit(0);
    });

    const forcar = setTimeout(() => {
        process.exit(1);
    }, 5000);

    if (
        typeof forcar.unref ===
        "function"
    ) {
        forcar.unref();
    }
}

process.once(
    "SIGTERM",
    () => encerrarServidor("SIGTERM")
);

process.once(
    "SIGINT",
    () => encerrarServidor("SIGINT")
);
