const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const registrarAuditoria =
    require("../utils/auditoria");

const {
    validarPacoteAtualizacao
} = require(
    "../utils/validarPacoteAtualizacao"
);

const router = express.Router();

const pastaTemp =
    path.join(
        __dirname,
        "..",
        "temp"
    );

fs.mkdirSync(
    pastaTemp,
    {
        recursive: true
    }
);

const arquivoPendente =
    path.join(
        pastaTemp,
        "atualizacao-pendente.zip"
    );

const metadataPendente =
    path.join(
        pastaTemp,
        "atualizacao-pendente.json"
    );

const upload = multer({
    dest: pastaTemp,
    limits: {
        fileSize:
            500 * 1024 * 1024
    }
});

function zipValido(caminho) {
    try {
        const fd =
            fs.openSync(
                caminho,
                "r"
            );

        const buffer =
            Buffer.alloc(4);

        fs.readSync(
            fd,
            buffer,
            0,
            4,
            0
        );

        fs.closeSync(fd);

        return (
            buffer[0] === 0x50 &&
            buffer[1] === 0x4b &&
            (
                (
                    buffer[2] === 0x03 &&
                    buffer[3] === 0x04
                ) ||
                (
                    buffer[2] === 0x05 &&
                    buffer[3] === 0x06
                )
            )
        );
    } catch {
        return false;
    }
}

function removerSeExiste(
    caminho
) {
    try {
        if (
            fs.existsSync(
                caminho
            )
        ) {
            fs.unlinkSync(
                caminho
            );
        }
    } catch {}
}

function lerMetadata() {
    try {
        if (
            !fs.existsSync(
                metadataPendente
            )
        ) {
            return null;
        }

        return JSON.parse(
            fs.readFileSync(
                metadataPendente,
                "utf8"
            )
        );
    } catch {
        return null;
    }
}

function mensagemValidacao(
    codigo
) {
    const mensagens = {
        MANIFESTO_AUSENTE:
            "Esse ZIP não possui update-manifest.json. Gere a atualização por CRIAR-PACOTE-ATUALIZACAO.bat ou CRIAR-ATUALIZACAO-WEBAPP.bat.",
        MANIFESTO_INVALIDO:
            "O manifesto da atualização está inválido ou corrompido.",
        PRODUTO_INVALIDO:
            "O pacote não pertence ao Adega PDV.",
        TIPO_INVALIDO:
            "O tipo do pacote deve ser full ou webapp.",
        APP_INCOMPLETO:
            "Pacote incompleto: app/server.js não foi encontrado.",
        FULL_SEM_EXE:
            "Pacote completo inválido: AdegaPDV.exe não foi encontrado.",
        PACOTE_CONTEM_BANCO:
            "Pacote rejeitado por segurança: ele contém adega.db ou arquivos WAL/SHM. O banco nunca deve viajar dentro de uma atualização.",
        ZIP_EOCD_NAO_ENCONTRADO:
            "O arquivo ZIP está corrompido ou incompleto.",
        ZIP_DIRETORIO_INVALIDO:
            "O diretório interno do ZIP está inválido.",
        ZIP_ENTRADA_INVALIDA:
            "Uma entrada do ZIP está inválida.",
        ZIP_COMPRESSAO_NAO_SUPORTADA:
            "O ZIP usa um método de compressão não suportado.",
        CAMINHO_INSEGURO:
            "Pacote rejeitado por segurança: há um caminho interno inválido ou tentativa de sair da pasta de atualização.",
        ARQUIVO_DUPLICADO:
            "Pacote rejeitado por segurança: há arquivos duplicados com o mesmo caminho interno.",
        PACOTE_GRANDE:
            "Pacote rejeitado por segurança: quantidade ou tamanho descompactado acima do limite permitido."
    };

    return (
        mensagens[codigo] ||
        "A estrutura do pacote de atualização não é válida."
    );
}

router.get(
    "/status",
    (req, res) => {
        const existe =
            fs.existsSync(
                arquivoPendente
            );

        const stat =
            existe
                ? fs.statSync(
                    arquivoPendente
                )
                : null;

        const metadata =
            existe
                ? lerMetadata()
                : null;

        res.json({
            sucesso: true,
            pendente: existe,
            tamanho:
                stat?.size || 0,
            modificado_em:
                stat?.mtime?.toISOString() ||
                null,
            pacote:
                metadata
        });
    }
);

router.post(
    "/enviar",
    upload.single("pacote"),
    (req, res) => {
        const temporario =
            req.file?.path;

        if (!temporario) {
            return res
                .status(400)
                .json({
                    sucesso: false,
                    mensagem:
                        "Selecione o pacote ZIP da atualização."
                });
        }

        try {
            const nome =
                String(
                    req.file.originalname ||
                    ""
                );

            if (
                !nome
                    .toLowerCase()
                    .endsWith(".zip")
            ) {
                throw new Error(
                    "FORMATO_INVALIDO"
                );
            }

            if (
                !zipValido(
                    temporario
                )
            ) {
                throw new Error(
                    "ZIP_INVALIDO"
                );
            }

            const pacote =
                validarPacoteAtualizacao(
                    temporario
                );

            removerSeExiste(
                arquivoPendente
            );

            removerSeExiste(
                metadataPendente
            );

            fs.renameSync(
                temporario,
                arquivoPendente
            );

            const metadata = {
                nome,
                tipo:
                    pacote.tipo,
                versao:
                    pacote.versao,
                criado_em:
                    pacote.criado_em,
                prefixo:
                    pacote.prefixo,
                arquivos:
                    pacote.arquivos,
                tamanho:
                    fs.statSync(
                        arquivoPendente
                    ).size,
                validado_em:
                    new Date()
                        .toISOString()
            };

            fs.writeFileSync(
                metadataPendente,
                JSON.stringify(
                    metadata,
                    null,
                    2
                ),
                "utf8"
            );

            registrarAuditoria(
                req,
                "ATUALIZACAO_PREPARADA",
                "sistema",
                null,
                `Atualização ${pacote.tipo} ${pacote.versao || "sem versão"} validada: ${nome}`,
                metadata
            );

            res.json({
                sucesso: true,
                mensagem:
                    "Pacote validado e preparado.",
                arquivo:
                    nome,
                tamanho:
                    metadata.tamanho,
                pacote:
                    metadata
            });

        } catch (erro) {
            removerSeExiste(
                temporario
            );

            const mensagens = {
                FORMATO_INVALIDO:
                    "Selecione um arquivo .zip.",
                ZIP_INVALIDO:
                    "O arquivo selecionado não é um ZIP válido."
            };

            return res
                .status(400)
                .json({
                    sucesso: false,
                    mensagem:
                        mensagens[
                            erro.message
                        ] ||
                        mensagemValidacao(
                            erro.message
                        )
                });
        }
    }
);

router.delete(
    "/pendente",
    (req, res) => {
        try {
            removerSeExiste(
                arquivoPendente
            );

            removerSeExiste(
                metadataPendente
            );

            res.json({
                sucesso: true
            });
        } catch {
            res.status(500).json({
                sucesso: false,
                mensagem:
                    "Não foi possível remover o pacote pendente."
            });
        }
    }
);

module.exports = router;
