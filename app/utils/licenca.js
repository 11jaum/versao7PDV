const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PRODUTO = "Adega PDV";
const FORMATO = "ADG1";
const TOLERANCIA_RELOGIO_MS = 5 * 60 * 1000;
const INTERVALO_PERSISTENCIA_MS = 5 * 60 * 1000;

// A chave pública pode ser distribuída com o aplicativo.
// A chave privada correspondente fica SOMENTE no gerador de licenças do proprietário.
const CHAVE_PUBLICA = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAkTpnoNVQ97Owhf+KSjPpakpMe1+kQ7Y42+KWAFNRnSk=
-----END PUBLIC KEY-----`;

const pastaData = path.join(__dirname, "..", "..", "data");
const arquivoInstalacao = path.join(pastaData, "instalacao.id");
const arquivoLicenca = path.join(pastaData, "licenca.json");
const arquivoEstado = path.join(pastaData, "licenca-state.json");

let ultimoEstadoPersistido = 0;

function garantirPastaData() {
    fs.mkdirSync(pastaData, { recursive: true });
}

function salvarJsonAtomico(arquivo, dados) {
    garantirPastaData();

    const temporario = `${arquivo}.${process.pid}.tmp`;

    fs.writeFileSync(
        temporario,
        JSON.stringify(dados, null, 2),
        {
            encoding: "utf8",
            mode: 0o600
        }
    );

    fs.renameSync(temporario, arquivo);
}

function lerJson(arquivo, fallback = null) {
    try {
        return JSON.parse(
            fs.readFileSync(arquivo, "utf8")
        );
    } catch {
        return fallback;
    }
}

function obterInstalacaoId() {
    garantirPastaData();

    try {
        if (fs.existsSync(arquivoInstalacao)) {
            const existente = fs
                .readFileSync(arquivoInstalacao, "utf8")
                .trim()
                .toUpperCase();

            if (/^ADG-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){4}$/.test(existente)) {
                return existente;
            }
        }
    } catch {}

    const bruto = crypto
        .randomBytes(10)
        .toString("hex")
        .toUpperCase();

    const grupos = bruto.match(/.{1,4}/g) || [];
    const id = `ADG-${grupos.join("-")}`;

    fs.writeFileSync(
        arquivoInstalacao,
        id,
        {
            encoding: "utf8",
            mode: 0o600
        }
    );

    return id;
}

function base64UrlParaBuffer(valor) {
    return Buffer.from(String(valor || ""), "base64url");
}

function base64UrlCanonico(valor) {
    const texto = String(valor || "");

    if (!/^[A-Za-z0-9_-]+$/.test(texto)) {
        return false;
    }

    try {
        return base64UrlParaBuffer(texto)
            .toString("base64url") === texto;
    } catch {
        return false;
    }
}

function normalizarChave(chave) {
    return String(chave || "")
        .replace(/\s+/g, "")
        .trim();
}

function parseDataIso(valor) {
    if (!valor) return null;

    const ms = Date.parse(String(valor));

    return Number.isFinite(ms)
        ? ms
        : null;
}

function motivoPublico(codigo) {
    const mensagens = {
        NAO_ATIVADA:
            "Este Adega PDV ainda não foi ativado.",
        CHAVE_VAZIA:
            "Informe uma chave de licença.",
        CHAVE_FORMATO_INVALIDO:
            "A chave informada não está em um formato válido.",
        CHAVE_ASSINATURA_INVALIDA:
            "A assinatura da chave é inválida.",
        CHAVE_DADOS_INVALIDOS:
            "Os dados internos da chave são inválidos.",
        PRODUTO_INVALIDO:
            "Esta chave não pertence ao Adega PDV.",
        LICENCA_EXPIRADA:
            "Esta licença temporária expirou.",
        LICENCA_OUTRA_INSTALACAO:
            "Esta chave foi emitida para outra instalação do Adega PDV.",
        RELOGIO_RECUADO:
            "A data/hora do computador parece ter sido atrasada. Corrija o relógio do Windows e tente novamente.",
        ARQUIVO_LICENCA_INVALIDO:
            "O arquivo local da licença está inválido. Ative novamente com uma chave válida."
    };

    return mensagens[codigo] || "A licença não pôde ser validada.";
}

function validarEstruturaPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return "CHAVE_DADOS_INVALIDOS";
    }

    if (payload.v !== 1 || payload.produto !== PRODUTO) {
        return payload.produto !== PRODUTO
            ? "PRODUTO_INVALIDO"
            : "CHAVE_DADOS_INVALIDOS";
    }

    if (!/^[A-Z0-9-]{6,80}$/i.test(String(payload.licenca_id || ""))) {
        return "CHAVE_DADOS_INVALIDOS";
    }

    if (!["temporaria", "permanente"].includes(payload.tipo)) {
        return "CHAVE_DADOS_INVALIDOS";
    }

    const emitidaMs = parseDataIso(payload.emitida_em);

    if (!emitidaMs) {
        return "CHAVE_DADOS_INVALIDOS";
    }

    if (payload.tipo === "temporaria") {
        const expiraMs = parseDataIso(payload.expira_em);

        if (!expiraMs || expiraMs <= emitidaMs) {
            return "CHAVE_DADOS_INVALIDOS";
        }
    }

    if (
        payload.tipo === "permanente" &&
        payload.expira_em !== null &&
        payload.expira_em !== undefined &&
        payload.expira_em !== ""
    ) {
        return "CHAVE_DADOS_INVALIDOS";
    }

    if (
        payload.instalacao_id &&
        !/^ADG-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){4}$/.test(
            String(payload.instalacao_id).toUpperCase()
        )
    ) {
        return "CHAVE_DADOS_INVALIDOS";
    }

    return null;
}

function lerEstadoRelogio() {
    const estado = lerJson(arquivoEstado, {});
    const valor = Number(estado?.ultimo_validado_ms || 0);

    return Number.isFinite(valor) && valor > 0
        ? valor
        : 0;
}

function persistirEstadoRelogio(agoraMs) {
    if (
        agoraMs <= ultimoEstadoPersistido ||
        agoraMs - ultimoEstadoPersistido < INTERVALO_PERSISTENCIA_MS
    ) {
        return;
    }

    try {
        salvarJsonAtomico(
            arquivoEstado,
            {
                ultimo_validado_ms: agoraMs,
                ultimo_validado_em:
                    new Date(agoraMs).toISOString()
            }
        );

        ultimoEstadoPersistido = agoraMs;
    } catch (erro) {
        console.error(
            "Não foi possível atualizar o estado local da licença:",
            erro
        );
    }
}

function validarChave(
    chave,
    {
        verificarRelogio = true,
        persistirRelogio = false
    } = {}
) {
    const normalizada = normalizarChave(chave);
    const instalacaoId = obterInstalacaoId();
    const agoraMs = Date.now();

    if (!normalizada) {
        return {
            valida: false,
            codigo: "CHAVE_VAZIA",
            mensagem: motivoPublico("CHAVE_VAZIA"),
            instalacao_id: instalacaoId
        };
    }

    if (normalizada.length > 4096) {
        return {
            valida: false,
            codigo: "CHAVE_FORMATO_INVALIDO",
            mensagem: motivoPublico("CHAVE_FORMATO_INVALIDO"),
            instalacao_id: instalacaoId
        };
    }

    const partes = normalizada.split(".");

    if (
        partes.length !== 3 ||
        partes[0] !== FORMATO ||
        !base64UrlCanonico(partes[1]) ||
        !base64UrlCanonico(partes[2])
    ) {
        return {
            valida: false,
            codigo: "CHAVE_FORMATO_INVALIDO",
            mensagem: motivoPublico("CHAVE_FORMATO_INVALIDO"),
            instalacao_id: instalacaoId
        };
    }

    const entradaAssinada = `${FORMATO}.${partes[1]}`;

    let assinaturaValida = false;

    try {
        assinaturaValida = crypto.verify(
            null,
            Buffer.from(entradaAssinada, "utf8"),
            CHAVE_PUBLICA,
            base64UrlParaBuffer(partes[2])
        );
    } catch {
        assinaturaValida = false;
    }

    if (!assinaturaValida) {
        return {
            valida: false,
            codigo: "CHAVE_ASSINATURA_INVALIDA",
            mensagem: motivoPublico("CHAVE_ASSINATURA_INVALIDA"),
            instalacao_id: instalacaoId
        };
    }

    let payload;

    try {
        payload = JSON.parse(
            base64UrlParaBuffer(partes[1]).toString("utf8")
        );
    } catch {
        return {
            valida: false,
            codigo: "CHAVE_DADOS_INVALIDOS",
            mensagem: motivoPublico("CHAVE_DADOS_INVALIDOS"),
            instalacao_id: instalacaoId
        };
    }

    const erroEstrutura = validarEstruturaPayload(payload);

    if (erroEstrutura) {
        return {
            valida: false,
            codigo: erroEstrutura,
            mensagem: motivoPublico(erroEstrutura),
            instalacao_id: instalacaoId
        };
    }

    if (
        payload.instalacao_id &&
        String(payload.instalacao_id).toUpperCase() !== instalacaoId
    ) {
        return {
            valida: false,
            codigo: "LICENCA_OUTRA_INSTALACAO",
            mensagem: motivoPublico("LICENCA_OUTRA_INSTALACAO"),
            instalacao_id: instalacaoId
        };
    }

    const emitidaMs = parseDataIso(payload.emitida_em);

    // Para licença temporária, evita chaves emitidas muito no futuro.
    // Licenças permanentes não dependem do relógio do computador.
    if (
        payload.tipo === "temporaria" &&
        emitidaMs > agoraMs + 24 * 60 * 60 * 1000
    ) {
        return {
            valida: false,
            codigo: "CHAVE_DADOS_INVALIDOS",
            mensagem: motivoPublico("CHAVE_DADOS_INVALIDOS"),
            instalacao_id: instalacaoId
        };
    }

    if (
        verificarRelogio &&
        payload.tipo === "temporaria"
    ) {
        const ultimoValidado = lerEstadoRelogio();

        if (
            ultimoValidado > 0 &&
            agoraMs + TOLERANCIA_RELOGIO_MS < ultimoValidado
        ) {
            return {
                valida: false,
                codigo: "RELOGIO_RECUADO",
                mensagem: motivoPublico("RELOGIO_RECUADO"),
                instalacao_id: instalacaoId
            };
        }
    }

    let expiraMs = null;

    if (payload.tipo === "temporaria") {
        expiraMs = parseDataIso(payload.expira_em);

        if (agoraMs >= expiraMs) {
            return {
                valida: false,
                codigo: "LICENCA_EXPIRADA",
                mensagem: motivoPublico("LICENCA_EXPIRADA"),
                instalacao_id: instalacaoId,
                tipo: payload.tipo,
                expira_em: payload.expira_em,
                cliente: payload.cliente || null,
                licenca_id: payload.licenca_id
            };
        }
    }

    if (
        persistirRelogio &&
        payload.tipo === "temporaria"
    ) {
        persistirEstadoRelogio(agoraMs);
    }

    const diasRestantes = expiraMs
        ? Math.max(
            0,
            Math.ceil(
                (expiraMs - agoraMs) /
                (24 * 60 * 60 * 1000)
            )
        )
        : null;

    return {
        valida: true,
        ativa: true,
        codigo: "OK",
        mensagem: "Licença válida.",
        instalacao_id: instalacaoId,
        licenca_id: payload.licenca_id,
        tipo: payload.tipo,
        emitida_em: payload.emitida_em,
        expira_em:
            payload.tipo === "temporaria"
                ? payload.expira_em
                : null,
        dias_restantes: diasRestantes,
        cliente:
            String(payload.cliente || "").slice(0, 160) || null,
        vinculada_instalacao:
            Boolean(payload.instalacao_id),
        payload
    };
}

function obterStatusLicenca() {
    const instalacaoId = obterInstalacaoId();

    if (!fs.existsSync(arquivoLicenca)) {
        return {
            valida: false,
            ativa: false,
            codigo: "NAO_ATIVADA",
            mensagem: motivoPublico("NAO_ATIVADA"),
            instalacao_id: instalacaoId
        };
    }

    const arquivo = lerJson(arquivoLicenca, null);

    if (!arquivo || typeof arquivo.chave !== "string") {
        return {
            valida: false,
            ativa: false,
            codigo: "ARQUIVO_LICENCA_INVALIDO",
            mensagem: motivoPublico("ARQUIVO_LICENCA_INVALIDO"),
            instalacao_id: instalacaoId
        };
    }

    return validarChave(
        arquivo.chave,
        {
            verificarRelogio: true,
            persistirRelogio: true
        }
    );
}

function ativarLicenca(chave) {
    const resultado = validarChave(
        chave,
        {
            verificarRelogio: true,
            persistirRelogio: false
        }
    );

    if (!resultado.valida) {
        return resultado;
    }

    salvarJsonAtomico(
        arquivoLicenca,
        {
            formato: 1,
            chave: normalizarChave(chave),
            ativada_em: new Date().toISOString(),
            licenca_id: resultado.licenca_id,
            tipo: resultado.tipo,
            expira_em: resultado.expira_em,
            cliente: resultado.cliente,
            instalacao_id: resultado.instalacao_id
        }
    );

    persistirEstadoRelogio(Date.now());

    return {
        ...resultado,
        mensagem:
            resultado.tipo === "permanente"
                ? "Licença permanente ativada com sucesso."
                : "Licença temporária ativada com sucesso."
    };
}

function removerLicenca() {
    try {
        if (fs.existsSync(arquivoLicenca)) {
            fs.unlinkSync(arquivoLicenca);
        }

        return true;
    } catch {
        return false;
    }
}

function statusPublico(status = obterStatusLicenca()) {
    return {
        valida: Boolean(status.valida),
        ativa: Boolean(status.ativa),
        codigo: status.codigo,
        mensagem: status.mensagem,
        instalacao_id: status.instalacao_id || obterInstalacaoId(),
        licenca_id: status.licenca_id || null,
        tipo: status.tipo || null,
        emitida_em: status.emitida_em || null,
        expira_em: status.expira_em || null,
        dias_restantes:
            Number.isFinite(status.dias_restantes)
                ? status.dias_restantes
                : null,
        cliente: status.cliente || null,
        vinculada_instalacao:
            Boolean(status.vinculada_instalacao)
    };
}

module.exports = {
    obterInstalacaoId,
    obterStatusLicenca,
    ativarLicenca,
    removerLicenca,
    statusPublico,
    validarChave
};
