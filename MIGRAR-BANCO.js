const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

async function main() {
    const origem = process.argv[2];
    const destino = process.argv[3];
    const appDirArg = process.argv[4];

    if (!origem || !destino || !appDirArg) {
        console.error(
            "Uso: node MIGRAR-BANCO.js <origem.db> <destino.db> <pasta-dist-app>"
        );
        process.exit(2);
    }

    const origemAbs = path.resolve(origem);
    const destinoAbs = path.resolve(destino);
    const appDir = path.resolve(appDirArg);

    if (!fs.existsSync(origemAbs)) {
        console.error(`Banco de origem não encontrado: ${origemAbs}`);
        process.exit(3);
    }

    const packageJson = path.join(appDir, "package.json");

    if (!fs.existsSync(packageJson)) {
        console.error(`Não encontrei package.json em: ${appDir}`);
        process.exit(5);
    }

    // Resolve as dependências COMO SE o script estivesse dentro de dist/app.
    const requireApp = createRequire(packageJson);

    let Database;

    try {
        Database = requireApp("better-sqlite3");
    } catch (erro) {
        console.error("Não foi possível carregar better-sqlite3 da pasta dist/app.");
        console.error(`App: ${appDir}`);
        console.error(erro.message);
        process.exit(6);
    }

    fs.mkdirSync(path.dirname(destinoAbs), { recursive: true });

    let db;

    try {
        db = new Database(origemAbs, {
            readonly: true,
            fileMustExist: true
        });

        db.prepare("PRAGMA schema_version").get();

        // Remove destino anterior somente depois de validar a origem.
        if (fs.existsSync(destinoAbs)) {
            fs.rmSync(destinoAbs, { force: true });
        }

        await db.backup(destinoAbs, {
            progress({ totalPages, remainingPages }) {
                const concluido = totalPages - remainingPages;
                const pct = totalPages
                    ? Math.floor((concluido / totalPages) * 100)
                    : 100;

                process.stdout.write(`\rMigrando banco... ${pct}%`);
                return 200;
            }
        });

        process.stdout.write("\n");
        console.log("Banco migrado com sucesso.");

        const teste = new Database(destinoAbs, {
            readonly: true,
            fileMustExist: true
        });

        const integrity = teste.prepare("PRAGMA integrity_check").get();
        const integrityValue = Object.values(integrity || {})[0];

        if (String(integrityValue).toLowerCase() !== "ok") {
            teste.close();
            throw new Error(
                `PRAGMA integrity_check retornou: ${integrityValue}`
            );
        }

        const tabelas = teste
            .prepare(`
                SELECT name
                FROM sqlite_master
                WHERE type = 'table'
                  AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `)
            .all();

        console.log("Integridade do banco: OK");
        console.log(`Tabelas encontradas no destino: ${tabelas.length}`);

        const principais = [
            "produtos",
            "vendas",
            "usuarios",
            "movimentacoes"
        ];

        for (const tabela of principais) {
            const existe = tabelas.some(t => t.name === tabela);

            if (!existe) continue;

            try {
                const linha = teste
                    .prepare(`SELECT COUNT(*) AS total FROM "${tabela}"`)
                    .get();

                console.log(`${tabela}: ${linha.total} registro(s)`);
            } catch {}
        }

        teste.close();
    } catch (erro) {
        console.error("\nFalha ao migrar o banco:");
        console.error(erro.message);
        process.exit(4);
    } finally {
        try {
            db?.close();
        } catch {}
    }
}

main();
