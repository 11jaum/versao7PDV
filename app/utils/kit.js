const db = require("../database");
const {
    calcularUnidadesFisicasInteirasDisponiveis
} = require("./fracionado");

/*
Produto Kit / Combo:
- O produto vendido não possui estoque físico próprio.
- Cada venda consome uma quantidade EXATA de até 3 produtos físicos.

Exemplo:
Balde Heineken 10 unidades
- Produto físico: Heineken 269ml
- Quantidade por venda: 10

Se existem 47 cervejas inteiras disponíveis:
=> floor(47 / 10) = 4 baldes disponíveis.

Ao vender 1 balde:
=> baixa 10 cervejas do estoque físico.
*/

function listarComponentesKit(produtoId) {
    return db.prepare(`
        SELECT
            pkc.id,
            pkc.produto_id,
            pkc.produto_estoque_id,
            pkc.quantidade_por_venda,
            pkc.ordem,
            pe.nome AS produto_estoque_nome,
            pe.quantidade AS produto_estoque_quantidade,
            pe.unidade AS produto_estoque_unidade,
            pe.ativo AS produto_estoque_ativo,
            pe.tipo_estoque AS produto_estoque_tipo
        FROM produto_kit_componentes pkc
        INNER JOIN produtos pe
            ON pe.id = pkc.produto_estoque_id
        WHERE pkc.produto_id = ?
        ORDER BY pkc.ordem, pkc.id
    `).all(produtoId);
}

function disponibilidadeComponenteKit(componente) {
    const porVenda = Math.max(
        1,
        Number(componente.quantidade_por_venda || 1)
    );

    const unidadesInteiras =
        calcularUnidadesFisicasInteirasDisponiveis(
            componente.produto_estoque_id
        );

    return Math.max(
        0,
        Math.floor(
            unidadesInteiras / porVenda
        )
    );
}

function calcularDisponibilidadeKit(produtoId) {
    const componentes = listarComponentesKit(produtoId);

    if (!componentes.length) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(
            ...componentes.map(
                disponibilidadeComponenteKit
            )
        )
    );
}

function enriquecerProdutoKit(produto) {
    if (!produto) return produto;

    if (
        (produto.tipo_estoque || "normal") !==
        "kit"
    ) {
        return {
            ...produto,
            componentes_kit:
                produto.componentes_kit || []
        };
    }

    const componentes =
        listarComponentesKit(produto.id)
            .map(
                componente => ({
                    ...componente,
                    kits_disponiveis:
                        disponibilidadeComponenteKit(
                            componente
                        )
                })
            );

    const quantidadeVirtual =
        componentes.length
            ? Math.min(
                ...componentes.map(
                    componente =>
                        componente.kits_disponiveis
                )
            )
            : 0;

    const limitantes =
        componentes.filter(
            componente =>
                Number(
                    componente.kits_disponiveis
                ) ===
                Number(quantidadeVirtual)
        );

    return {
        ...produto,
        tipo_estoque: "kit",
        quantidade_fisica:
            Number(produto.quantidade || 0),
        quantidade:
            Math.max(0, quantidadeVirtual),
        quantidade_venda:
            Math.max(0, quantidadeVirtual),
        componentes_kit: componentes,
        componentes_limitantes:
            limitantes.map(
                componente => ({
                    produto_estoque_id:
                        componente.produto_estoque_id,
                    nome:
                        componente.produto_estoque_nome,
                    kits_disponiveis:
                        componente.kits_disponiveis
                })
            ),
        componente_limitante:
            limitantes.length
                ? limitantes
                    .map(
                        componente =>
                            componente.produto_estoque_nome
                    )
                    .join(", ")
                : null
    };
}

function enriquecerProdutosKit(produtos) {
    return produtos.map(enriquecerProdutoKit);
}

function validarComponentesKit(produtoId, componentes) {
    if (!Array.isArray(componentes)) {
        throw new Error(
            "COMPONENTES_KIT_INVALIDOS"
        );
    }

    const limpos =
        componentes
            .filter(
                componente =>
                    componente &&
                    componente.produto_estoque_id
            )
            .map(
                (componente, indice) => ({
                    produto_estoque_id:
                        Number(
                            componente
                                .produto_estoque_id
                        ),
                    quantidade_por_venda:
                        Number(
                            componente
                                .quantidade_por_venda
                        ),
                    ordem:
                        indice + 1
                })
            );

    if (
        limpos.length < 1 ||
        limpos.length > 3
    ) {
        throw new Error(
            "COMPONENTES_KIT_INVALIDOS"
        );
    }

    const ids = new Set();

    for (const componente of limpos) {
        if (
            !Number.isInteger(
                componente.produto_estoque_id
            ) ||
            componente.produto_estoque_id <= 0 ||
            !Number.isInteger(
                componente.quantidade_por_venda
            ) ||
            componente.quantidade_por_venda < 1 ||
            componente.quantidade_por_venda > 10000
        ) {
            throw new Error(
                "COMPONENTES_KIT_INVALIDOS"
            );
        }

        if (
            Number(produtoId) ===
            componente.produto_estoque_id
        ) {
            throw new Error(
                "PRODUTO_KIT_AUTO_VINCULO"
            );
        }

        if (
            ids.has(
                componente.produto_estoque_id
            )
        ) {
            throw new Error(
                "PRODUTO_KIT_DUPLICADO"
            );
        }

        ids.add(
            componente.produto_estoque_id
        );

        const fisico = db.prepare(`
            SELECT
                id,
                nome,
                ativo,
                tipo_estoque
            FROM produtos
            WHERE id = ?
        `).get(
            componente.produto_estoque_id
        );

        if (
            !fisico ||
            Number(fisico.ativo) !== 1
        ) {
            throw new Error(
                "PRODUTO_KIT_VINCULADO_NAO_ENCONTRADO"
            );
        }

        if (
            (fisico.tipo_estoque || "normal") !==
            "normal"
        ) {
            throw new Error(
                "PRODUTO_KIT_VINCULADO_DEVE_SER_FISICO"
            );
        }
    }

    return limpos;
}

function salvarComponentesKit(produtoId, componentes) {
    const limpos =
        validarComponentesKit(
            produtoId,
            componentes
        );

    db.prepare(`
        DELETE FROM produto_kit_componentes
        WHERE produto_id = ?
    `).run(produtoId);

    const inserir = db.prepare(`
        INSERT INTO produto_kit_componentes (
            produto_id,
            produto_estoque_id,
            quantidade_por_venda,
            ordem
        )
        VALUES (?, ?, ?, ?)
    `);

    for (const componente of limpos) {
        inserir.run(
            produtoId,
            componente.produto_estoque_id,
            componente.quantidade_por_venda,
            componente.ordem
        );
    }
}

function removerComponentesKit(produtoId) {
    db.prepare(`
        DELETE FROM produto_kit_componentes
        WHERE produto_id = ?
    `).run(produtoId);
}

function consumirKit(
    produtoId,
    quantidadeVendida,
    vendaId,
    motivoPersonalizado = null
) {
    const quantidade =
        Number(quantidadeVendida);

    if (
        !Number.isInteger(quantidade) ||
        quantidade <= 0
    ) {
        throw new Error(
            "QUANTIDADE_KIT_INVALIDA"
        );
    }

    const componentes =
        listarComponentesKit(produtoId);

    if (!componentes.length) {
        throw new Error(
            "KIT_SEM_COMPONENTES"
        );
    }

    const disponibilidade =
        calcularDisponibilidadeKit(produtoId);

    if (disponibilidade < quantidade) {
        throw new Error(
            `ESTOQUE_KIT_INSUFICIENTE:${produtoId}:${disponibilidade}`
        );
    }

    const atualizarFisico =
        db.prepare(`
            UPDATE produtos
            SET quantidade = quantidade - ?
            WHERE id = ?
        `);

    const registrarMovimentacao =
        db.prepare(`
            INSERT INTO movimentacoes_estoque (
                produto_id,
                tipo,
                quantidade,
                motivo,
                venda_id
            )
            VALUES (?, 'saida', ?, ?, ?)
        `);

    for (const componente of componentes) {
        const consumo =
            Number(
                componente
                    .quantidade_por_venda
            ) *
            quantidade;

        const disponivelInteiro =
            calcularUnidadesFisicasInteirasDisponiveis(
                componente.produto_estoque_id
            );

        if (
            disponivelInteiro < consumo
        ) {
            throw new Error(
                `ESTOQUE_KIT_COMPONENTE_INSUFICIENTE:${componente.produto_estoque_nome || componente.produto_estoque_id}:${disponivelInteiro}:${consumo}`
            );
        }

        atualizarFisico.run(
            consumo,
            componente.produto_estoque_id
        );

        registrarMovimentacao.run(
            componente.produto_estoque_id,
            consumo,
            motivoPersonalizado ||
                `Consumo de ${quantidade} venda(s) do kit #${produtoId}`,
            vendaId
        );
    }
}

function devolverKit(
    produtoId,
    quantidadeVendida,
    vendaId,
    motivoPersonalizado = null
) {
    const quantidade =
        Number(quantidadeVendida);

    if (
        !Number.isInteger(quantidade) ||
        quantidade <= 0
    ) {
        return;
    }

    const componentes =
        listarComponentesKit(produtoId);

    if (!componentes.length) {
        return;
    }

    const atualizarFisico =
        db.prepare(`
            UPDATE produtos
            SET quantidade = quantidade + ?
            WHERE id = ?
        `);

    const registrarMovimentacao =
        db.prepare(`
            INSERT INTO movimentacoes_estoque (
                produto_id,
                tipo,
                quantidade,
                motivo,
                venda_id
            )
            VALUES (?, 'entrada', ?, ?, ?)
        `);

    for (const componente of componentes) {
        const devolucao =
            Number(
                componente
                    .quantidade_por_venda
            ) *
            quantidade;

        atualizarFisico.run(
            devolucao,
            componente.produto_estoque_id
        );

        registrarMovimentacao.run(
            componente.produto_estoque_id,
            devolucao,
            motivoPersonalizado ||
                `Cancelamento/devolução do kit #${produtoId}`,
            vendaId
        );
    }
}

module.exports = {
    listarComponentesKit,
    calcularDisponibilidadeKit,
    enriquecerProdutoKit,
    enriquecerProdutosKit,
    salvarComponentesKit,
    removerComponentesKit,
    consumirKit,
    devolverKit
};
