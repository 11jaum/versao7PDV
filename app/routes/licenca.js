const express = require("express");

const {
    obterStatusLicenca,
    ativarLicenca,
    removerLicenca,
    statusPublico
} = require("../utils/licenca");

const router = express.Router();

const tentativas = [];
const JANELA_MS = 5 * 60 * 1000;
const MAX_TENTATIVAS = 20;

function permitirTentativa() {
    const agora = Date.now();

    while (
        tentativas.length &&
        tentativas[0] < agora - JANELA_MS
    ) {
        tentativas.shift();
    }

    if (tentativas.length >= MAX_TENTATIVAS) {
        return false;
    }

    tentativas.push(agora);
    return true;
}

router.get(
    "/status",
    (_req, res) => {
        return res.json({
            sucesso: true,
            ...statusPublico(
                obterStatusLicenca()
            )
        });
    }
);

router.post(
    "/ativar",
    (req, res) => {
        if (!permitirTentativa()) {
            return res.status(429).json({
                sucesso: false,
                mensagem:
                    "Muitas tentativas de ativação. Aguarde alguns minutos e tente novamente."
            });
        }

        try {
            const resultado = ativarLicenca(
                req.body?.chave
            );

            if (!resultado.valida) {
                return res.status(400).json({
                    sucesso: false,
                    ...statusPublico(resultado)
                });
            }

            return res.json({
                sucesso: true,
                ...statusPublico(resultado)
            });
        } catch (erro) {
            console.error(
                "Erro ao ativar licença:",
                erro
            );

            return res.status(500).json({
                sucesso: false,
                mensagem:
                    "Não foi possível salvar a ativação neste computador."
            });
        }
    }
);

// Esta rota é usada pela área administrativa para trocar a licença.
// A autorização de administrador é aplicada no server.js.
router.delete(
    "/remover",
    (req, res) => {
        if (
            !req.session?.usuario ||
            req.session.usuario.perfil !== "administrador"
        ) {
            return res.status(403).json({
                sucesso: false,
                mensagem:
                    "Somente um administrador pode remover a licença."
            });
        }

        if (!removerLicenca()) {
            return res.status(500).json({
                sucesso: false,
                mensagem:
                    "Não foi possível remover a licença local."
            });
        }

        return res.json({
            sucesso: true,
            mensagem:
                "Licença removida. Uma nova chave será necessária para continuar."
        });
    }
);

module.exports = router;
