const express = require("express");
const fs = require("fs");
const path = require("path");

const db = require("../database");
const {
    listarBackupsAutomaticos
} = require("../utils/backupAutomatico");

const {
    obterStatusLicenca,
    statusPublico
} = require("../utils/licenca");

const router = express.Router();

const pastaApp = path.join(__dirname, "..");
const pastaDatabase = path.join(pastaApp, "database");
const bancoPrincipal = path.join(pastaDatabase, "adega.db");
const pastaBackups = path.join(pastaApp, "backups");

function formatarArquivo(arquivo) {
    if (!arquivo) return null;

    return {
        nome: arquivo.nome || path.basename(arquivo.caminho || ""),
        data: new Date(arquivo.mtimeMs).toISOString(),
        tamanho: fs.existsSync(arquivo.caminho)
            ? fs.statSync(arquivo.caminho).size
            : 0
    };
}

router.get("/diagnostico", (req, res) => {
    try {
        let banco = {
            existe: false,
            caminho: bancoPrincipal,
            tamanho: 0,
            sqlite: null
        };

        if (fs.existsSync(bancoPrincipal)) {
            const stat = fs.statSync(bancoPrincipal);

            let sqlite = null;

            try {
                sqlite = db
                    .prepare("SELECT sqlite_version() AS versao")
                    .get()?.versao || null;
            } catch {}

            banco = {
                existe: true,
                caminho: bancoPrincipal,
                tamanho: stat.size,
                modificado_em: stat.mtime.toISOString(),
                sqlite
            };
        }

        let automaticos = [];

        try {
            automaticos = listarBackupsAutomaticos();
        } catch {}

        let totalBackups = 0;
        let ultimoBackup = null;

        if (fs.existsSync(pastaBackups)) {
            const arquivos = fs.readdirSync(pastaBackups, {
                withFileTypes: true
            });

            const encontrados = [];

            for (const item of arquivos) {
                if (
                    item.isFile() &&
                    item.name.toLowerCase().endsWith(".db")
                ) {
                    const caminho = path.join(
                        pastaBackups,
                        item.name
                    );

                    const stat = fs.statSync(caminho);

                    encontrados.push({
                        nome: item.name,
                        caminho,
                        mtimeMs: stat.mtimeMs
                    });
                }
            }

            totalBackups = encontrados.length;

            ultimoBackup = encontrados
                .sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null;
        }

        const licenca =
            statusPublico(
                obterStatusLicenca()
            );

        res.json({
            sucesso: true,
            app: {
                nome: "Adega PDV",
                versao: "2.1.7",
                modo: process.env.PDV_DESKTOP === "1"
                    ? "desktop-webview2"
                    : "web-local"
            },
            licenca,
            servidor: {
                ativo: true,
                uptime_segundos: Math.floor(process.uptime()),
                node: process.version,
                plataforma: `${process.platform} ${process.arch}`,
                porta: Number(process.env.PDV_PORT || 3000),
                host: process.env.PDV_HOST || "127.0.0.1"
            },
            banco,
            backups: {
                pasta: pastaBackups,
                total: totalBackups,
                automaticos: automaticos.length,
                ultimo_automatico: formatarArquivo(
                    automaticos[0] || null
                ),
                ultimo: formatarArquivo(
                    ultimoBackup
                )
            }
        });

    } catch (erro) {
        console.error(
            "Erro diagnóstico sistema:",
            erro
        );

        res.status(500).json({
            sucesso: false,
            mensagem:
                "Não foi possível carregar o diagnóstico."
        });
    }
});

module.exports = router;
