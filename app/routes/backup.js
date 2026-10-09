const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Database = require("better-sqlite3");

const router = express.Router();

const db = require("../database");

const pastaDatabase = path.join(__dirname, "..", "database");
const bancoPrincipal = path.join(pastaDatabase, "adega.db");

const pastaTemp = path.join(__dirname, "..", "temp");

if (!fs.existsSync(pastaTemp)) {
    fs.mkdirSync(pastaTemp, {
        recursive: true
    });
}


const upload = multer({
    dest: pastaTemp,
    limits: {
        fileSize: 100 * 1024 * 1024
    }
});


// ========================================
// CRIAR BACKUP
// ========================================

router.get("/download", async (req, res) => {

    let arquivoBackup = null;

    try {

        const agora = new Date();

        const data =
            agora
                .toISOString()
                .replace(/:/g, "-")
                .replace(/\..+/, "");

        const nome =
            `AdegaPDV-backup-${data}.db`;

        arquivoBackup =
            path.join(
                pastaTemp,
                nome
            );


        // Backup consistente mesmo com SQLite em WAL
        await db.backup(arquivoBackup);


        res.download(
            arquivoBackup,
            nome,
            erro => {

                if (
                    arquivoBackup &&
                    fs.existsSync(arquivoBackup)
                ) {

                    try {
                        fs.unlinkSync(
                            arquivoBackup
                        );
                    } catch (e) {
                        console.error(
                            "Erro ao excluir backup temporário:",
                            e
                        );
                    }
                }


                if (erro) {

                    console.error(
                        "Erro download backup:",
                        erro
                    );

                }

            }
        );


    } catch (erro) {

        console.error(
            "Erro ao gerar backup:",
            erro
        );


        if (
            arquivoBackup &&
            fs.existsSync(arquivoBackup)
        ) {

            fs.unlinkSync(
                arquivoBackup
            );
        }


        res.status(500).json({
            sucesso: false,
            mensagem:
                "Não foi possível gerar o backup."
        });

    }

});


// ========================================
// RESTAURAR BACKUP
// ========================================

function validarBancoAdega(caminho) {
    let teste = null;

    try {
        teste =
            new Database(
                caminho,
                {
                    readonly: true,
                    fileMustExist: true
                }
            );

        const integridade =
            teste
                .prepare(
                    "PRAGMA integrity_check"
                )
                .get();

        if (
            !integridade ||
            integridade.integrity_check !==
                "ok"
        ) {
            throw new Error(
                "BACKUP_INVALIDO"
            );
        }

        const tabelasObrigatorias =
            [
                "produtos",
                "vendas"
            ];

        for (
            const nomeTabela of
            tabelasObrigatorias
        ) {
            const tabela =
                teste.prepare(`
                    SELECT name
                    FROM sqlite_master
                    WHERE type = 'table'
                    AND name = ?
                `).get(
                    nomeTabela
                );

            if (!tabela) {
                throw new Error(
                    "BACKUP_INCOMPATIVEL"
                );
            }
        }

        return true;
    } finally {
        if (teste) {
            try {
                teste.close();
            } catch {}
        }
    }
}

router.post(
    "/restaurar",
    upload.single("backup"),
    async (req, res) => {
        const arquivo =
            req.file?.path;

        if (!arquivo) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    "Selecione um arquivo de backup."
            });
        }

        const pastaSeguranca =
            path.join(
                __dirname,
                "..",
                "backups",
                "antes-restauracao"
            );

        fs.mkdirSync(
            pastaSeguranca,
            {
                recursive: true
            }
        );

        const stamp =
            new Date()
                .toISOString()
                .replace(/:/g, "-")
                .replace(/\..+/, "");

        const seguranca =
            path.join(
                pastaSeguranca,
                `AdegaPDV-antes-restauracao-${stamp}.db`
            );

        const staging =
            path.join(
                pastaDatabase,
                `.adega-restauracao-${process.pid}-${Date.now()}.db`
            );

        const antigo =
            path.join(
                pastaDatabase,
                `.adega-anterior-${process.pid}-${Date.now()}.db`
            );

        let bancoFechado = false;
        let principalMovido = false;

        try {
            // 1) Valida o arquivo recebido antes de tocar no banco atual.
            validarBancoAdega(
                arquivo
            );

            // 2) Copia para o mesmo volume do banco principal e valida de novo.
            // Isso permite troca por rename sem risco de cópia parcial.
            fs.copyFileSync(
                arquivo,
                staging
            );

            validarBancoAdega(
                staging
            );

            // 3) Cria snapshot consistente do banco atual em pasta de backups.
            await db.backup(
                seguranca
            );

            validarBancoAdega(
                seguranca
            );

            // 4) Fecha o SQLite e remove WAL/SHM antigos antes da troca.
            db.close();
            bancoFechado = true;

            const wal =
                `${bancoPrincipal}-wal`;

            const shm =
                `${bancoPrincipal}-shm`;

            for (
                const auxiliar of
                [wal, shm]
            ) {
                if (
                    fs.existsSync(
                        auxiliar
                    )
                ) {
                    fs.unlinkSync(
                        auxiliar
                    );
                }
            }

            // 5) Troca em duas renomeações no mesmo volume.
            // Se a segunda falhar, o banco anterior volta imediatamente.
            if (
                fs.existsSync(
                    bancoPrincipal
                )
            ) {
                fs.renameSync(
                    bancoPrincipal,
                    antigo
                );

                principalMovido = true;
            }

            try {
                fs.renameSync(
                    staging,
                    bancoPrincipal
                );
            } catch (erroTroca) {
                if (
                    principalMovido &&
                    fs.existsSync(
                        antigo
                    ) &&
                    !fs.existsSync(
                        bancoPrincipal
                    )
                ) {
                    fs.renameSync(
                        antigo,
                        bancoPrincipal
                    );

                    principalMovido = false;
                }

                throw erroTroca;
            }

            // 6) Remove o banco antigo somente depois da troca concluída.
            if (
                principalMovido &&
                fs.existsSync(
                    antigo
                )
            ) {
                fs.unlinkSync(
                    antigo
                );
            }

            principalMovido = false;

            if (
                fs.existsSync(
                    arquivo
                )
            ) {
                fs.unlinkSync(
                    arquivo
                );
            }

            res.json({
                sucesso: true,
                mensagem:
                    "Backup restaurado com segurança. O servidor será reiniciado para concluir a restauração."
            });

            setTimeout(() => {
                process.exit(0);
            }, 1200);

        } catch (erro) {
            console.error(
                "Erro restauração:",
                erro
            );

            // Rollback defensivo se a troca foi interrompida.
            try {
                if (
                    principalMovido &&
                    fs.existsSync(
                        antigo
                    ) &&
                    !fs.existsSync(
                        bancoPrincipal
                    )
                ) {
                    fs.renameSync(
                        antigo,
                        bancoPrincipal
                    );

                    principalMovido = false;
                }
            } catch (erroRollback) {
                console.error(
                    "Erro ao reverter restauração:",
                    erroRollback
                );
            }

            for (
                const temporario of
                [staging, antigo, arquivo]
            ) {
                try {
                    if (
                        temporario &&
                        fs.existsSync(
                            temporario
                        )
                    ) {
                        fs.unlinkSync(
                            temporario
                        );
                    }
                } catch {}
            }

            if (
                erro.message ===
                "BACKUP_INVALIDO"
            ) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem:
                        "O arquivo selecionado não é um banco SQLite válido."
                });
            }

            if (
                erro.message ===
                "BACKUP_INCOMPATIVEL"
            ) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem:
                        "Este arquivo não parece ser um backup do AdegaPDV."
                });
            }

            // Se o banco já foi fechado, o processo não pode continuar
            // atendendo requisições com uma conexão encerrada.
            if (bancoFechado) {
                res.status(500).json({
                    sucesso: false,
                    mensagem:
                        "A restauração não pôde ser concluída. O banco anterior foi preservado e o servidor será reiniciado."
                });

                setTimeout(() => {
                    process.exit(1);
                }, 1200);

                return;
            }

            return res.status(500).json({
                sucesso: false,
                mensagem:
                    "Não foi possível restaurar o backup."
            });
        }
    }
);


module.exports = router;