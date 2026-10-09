const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const PASTA_BACKUPS = path.join(__dirname, "..", "backups");
const PREFIXO = "AdegaPDV-auto-";
const LIMITE_BACKUPS = 30;
const INTERVALO_VERIFICACAO = 60 * 60 * 1000; // 1 hora

let backupEmAndamento = false;

function garantirPasta() {
    if (!fs.existsSync(PASTA_BACKUPS)) {
        fs.mkdirSync(PASTA_BACKUPS, { recursive: true });
    }
}

function doisDigitos(valor) {
    return String(valor).padStart(2, "0");
}

function dataLocal(agora = new Date()) {
    return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
}

function horaLocal(agora = new Date()) {
    return `${doisDigitos(agora.getHours())}-${doisDigitos(agora.getMinutes())}-${doisDigitos(agora.getSeconds())}`;
}

function listarBackupsAutomaticos() {
    garantirPasta();

    return fs.readdirSync(PASTA_BACKUPS)
        .filter(nome => nome.startsWith(PREFIXO) && nome.endsWith(".db"))
        .map(nome => {
            const caminho = path.join(PASTA_BACKUPS, nome);
            const stat = fs.statSync(caminho);
            return {
                nome,
                caminho,
                mtimeMs: stat.mtimeMs,
                tamanho: stat.size
            };
        })
        .filter(arquivo => arquivo.tamanho > 0)
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function existeBackupHoje() {
    const prefixoHoje = `${PREFIXO}${dataLocal()}_`;
    return listarBackupsAutomaticos().some(arquivo =>
        arquivo.nome.startsWith(prefixoHoje)
    );
}

function limparBackupsAntigos() {
    const backups = listarBackupsAutomaticos();
    const excedentes = backups.slice(LIMITE_BACKUPS);

    for (const arquivo of excedentes) {
        try {
            fs.unlinkSync(arquivo.caminho);
            console.log(`Backup automático antigo removido: ${arquivo.nome}`);
        } catch (erro) {
            console.error(`Erro ao remover backup antigo ${arquivo.nome}:`, erro);
        }
    }
}

function validarBackupCriado(caminho) {
    let teste = null;

    try {
        if (
            !fs.existsSync(caminho) ||
            fs.statSync(caminho).size <= 0
        ) {
            return false;
        }

        teste = new Database(
            caminho,
            {
                readonly: true,
                fileMustExist: true
            }
        );

        const integridade = teste.pragma(
            "quick_check",
            {
                simple: true
            }
        );

        return integridade === "ok";
    } catch {
        return false;
    } finally {
        try {
            teste?.close();
        } catch {}
    }
}

async function criarBackupAutomatico(db) {
    if (backupEmAndamento || existeBackupHoje()) {
        return false;
    }

    backupEmAndamento = true;
    garantirPasta();

    const agora = new Date();
    const nome = `${PREFIXO}${dataLocal(agora)}_${horaLocal(agora)}.db`;
    const destino = path.join(PASTA_BACKUPS, nome);

    try {
        // better-sqlite3 usa a API de backup do SQLite, gerando uma cópia
        // consistente mesmo quando o banco principal está em modo WAL.
        await db.backup(destino);

        if (!validarBackupCriado(destino)) {
            throw new Error(
                "Backup automático criado, mas falhou na validação de integridade."
            );
        }

        limparBackupsAntigos();
        console.log(`Backup automático criado: backups/${nome}`);
        return true;
    } catch (erro) {
        console.error("Erro ao criar backup automático:", erro);

        if (fs.existsSync(destino)) {
            try { fs.unlinkSync(destino); } catch {}
        }

        return false;
    } finally {
        backupEmAndamento = false;
    }
}

function iniciarBackupAutomatico(db) {
    garantirPasta();

    // Ao iniciar o PDV, cria o backup do dia se ele ainda não existir.
    setTimeout(() => {
        criarBackupAutomatico(db);
    }, 3000);

    // Se o servidor ficar aberto por vários dias, verifica uma vez por hora.
    const timer = setInterval(() => {
        criarBackupAutomatico(db);
    }, INTERVALO_VERIFICACAO);

    // Não mantém o processo vivo apenas por causa deste temporizador.
    if (typeof timer.unref === "function") {
        timer.unref();
    }
}

module.exports = {
    iniciarBackupAutomatico,
    criarBackupAutomatico,
    listarBackupsAutomaticos
};
