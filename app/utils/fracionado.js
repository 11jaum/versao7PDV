const db = require("../database");

/*
Produto fracionado:
- O produto vendido (ex.: Dose de Gin) não possui estoque físico próprio.
- Ele pode consumir até 3 produtos físicos.
- Cada componente informa quantas vendas do produto fracionado
  correspondem a 1 unidade física.

Exemplo:
10 garrafas de Gin, fator 5, progresso 0
=> 10 * 5 - 0 = 50 doses disponíveis.

Se houver dois componentes, a disponibilidade da dose é limitada
pelo componente que acabar primeiro.
*/

function listarComponentes(produtoId) {
    return db.prepare(`
        SELECT
            pfc.id,
            pfc.produto_id,
            pfc.produto_estoque_id,
            pfc.fator_conversao,
            pfc.fracao_atual,
            pe.nome AS produto_estoque_nome,
            pe.quantidade AS produto_estoque_quantidade,
            pe.unidade AS produto_estoque_unidade,
            pe.ativo AS produto_estoque_ativo
        FROM produto_fracionado_componentes pfc
        INNER JOIN produtos pe
            ON pe.id = pfc.produto_estoque_id
        WHERE pfc.produto_id = ?
        ORDER BY pfc.ordem, pfc.id
    `).all(produtoId);
}


function disponibilidadeComponente(componente) {
    const quantidadeFisica =
        Number(componente.produto_estoque_quantidade || 0);

    const fator =
        Math.max(1, Number(componente.fator_conversao || 1));

    const progresso =
        Math.max(0, Number(componente.fracao_atual || 0));

    return Math.max(
        0,
        Math.floor(
            quantidadeFisica * fator - progresso
        )
    );
}


function calcularDisponibilidade(produtoId) {
    const componentes = listarComponentes(produtoId);

    if (!componentes.length) {
        return 0;
    }

    const disponibilidades =
        componentes.map(disponibilidadeComponente);

    return Math.max(
        0,
        Math.min(...disponibilidades)
    );
}

function calcularUnidadesFisicasInteirasDisponiveis(produtoEstoqueId) {
    const produto = db.prepare(`
        SELECT quantidade
        FROM produtos
        WHERE id = ?
    `).get(produtoEstoqueId);

    if (!produto) {
        return 0;
    }

    const quantidade = Math.max(
        0,
        Number(produto.quantidade || 0)
    );

    // Se existe consumo parcial de um produto fracionado, uma unidade física
    // está aberta/em uso e não pode ser vendida como unidade inteira.
    const parcial = db.prepare(`
        SELECT 1
        FROM produto_fracionado_componentes pfc
        INNER JOIN produtos pf
            ON pf.id = pfc.produto_id
        WHERE pfc.produto_estoque_id = ?
          AND pf.ativo = 1
          AND pfc.fracao_atual > 0
        LIMIT 1
    `).get(produtoEstoqueId);

    return Math.max(
        0,
        quantidade - (parcial ? 1 : 0)
    );
}


function enriquecerProduto(produto) {
    if (!produto) return produto;

    const tipo =
        produto.tipo_estoque || "normal";

    if (tipo !== "fracionado") {
        // Mantém outros tipos de estoque (ex.: kit).
        // Apenas produtos físicos normais recebem quantidade_venda baseada
        // em unidades inteiras disponíveis.
        if (tipo !== "normal") {
            return {
                ...produto,
                tipo_estoque: tipo,
                componentes_fracionados: []
            };
        }

        const quantidadeFisica =
            Math.max(
                0,
                Number(produto.quantidade || 0)
            );

        const quantidadeVenda =
            calcularUnidadesFisicasInteirasDisponiveis(
                produto.id
            );

        return {
            ...produto,
            tipo_estoque: "normal",
            componentes_fracionados: [],
            quantidade_venda:
                quantidadeVenda,
            possui_unidade_parcial:
                quantidadeVenda <
                quantidadeFisica
        };
    }

    const componentes =
        listarComponentes(produto.id).map(
            componente => ({
                ...componente,
                disponivel_vendas:
                    disponibilidadeComponente(componente)
            })
        );

    const quantidadeVirtual =
        componentes.length
            ? Math.min(
                ...componentes.map(
                    componente =>
                        componente.disponivel_vendas
                )
            )
            : 0;

    const limitantes =
        componentes.filter(
            componente =>
                Number(componente.disponivel_vendas) ===
                Number(quantidadeVirtual)
        );

    const nomesLimitantes =
        limitantes.map(
            componente =>
                componente.produto_estoque_nome
        );

    return {
        ...produto,
        tipo_estoque: "fracionado",
        quantidade_fisica: Number(produto.quantidade || 0),
        quantidade: Math.max(0, quantidadeVirtual),
        componentes_fracionados: componentes,

        ingredientes_limitantes:
            limitantes.map(
                componente => ({
                    produto_estoque_id:
                        componente.produto_estoque_id,
                    nome:
                        componente.produto_estoque_nome,
                    disponivel_vendas:
                        componente.disponivel_vendas
                })
            ),

        ingrediente_limitante:
            nomesLimitantes.length
                ? nomesLimitantes.join(", ")
                : null
    };
}


function enriquecerProdutos(produtos) {
    return produtos.map(enriquecerProduto);
}


function validarComponentes(produtoId, componentes) {
    if (!Array.isArray(componentes)) {
        throw new Error("COMPONENTES_FRACIONADOS_INVALIDOS");
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
                        Number(componente.produto_estoque_id),

                    fator_conversao:
                        Number(componente.fator_conversao),

                    ordem:
                        indice + 1
                })
            );

    if (limpos.length < 1 || limpos.length > 3) {
        throw new Error("COMPONENTES_FRACIONADOS_INVALIDOS");
    }

    const ids = new Set();

    for (const componente of limpos) {
        if (
            !Number.isInteger(componente.produto_estoque_id) ||
            componente.produto_estoque_id <= 0 ||
            !Number.isInteger(componente.fator_conversao) ||
            componente.fator_conversao < 1
        ) {
            throw new Error("COMPONENTES_FRACIONADOS_INVALIDOS");
        }

        if (Number(produtoId) === componente.produto_estoque_id) {
            throw new Error("PRODUTO_FRACIONADO_AUTO_VINCULO");
        }

        if (ids.has(componente.produto_estoque_id)) {
            throw new Error("PRODUTO_FRACIONADO_DUPLICADO");
        }

        ids.add(componente.produto_estoque_id);

        const fisico = db.prepare(`
            SELECT
                id,
                nome,
                ativo,
                tipo_estoque
            FROM produtos
            WHERE id = ?
        `).get(componente.produto_estoque_id);

        if (!fisico || Number(fisico.ativo) !== 1) {
            throw new Error("PRODUTO_VINCULADO_NAO_ENCONTRADO");
        }

        if ((fisico.tipo_estoque || "normal") !== "normal") {
            throw new Error("PRODUTO_VINCULADO_DEVE_SER_FISICO");
        }

        const outroVinculo = db.prepare(`
            SELECT
                pf.id,
                pf.nome
            FROM produto_fracionado_componentes pfc
            INNER JOIN produtos pf
                ON pf.id = pfc.produto_id
            WHERE pfc.produto_estoque_id = ?
              AND pfc.produto_id <> ?
              AND pf.ativo = 1
            LIMIT 1
        `).get(
            componente.produto_estoque_id,
            Number(produtoId) || 0
        );

        if (outroVinculo) {
            const erro = new Error(
                "PRODUTO_VINCULADO_OUTRO_FRACIONADO"
            );
            erro.produtoFracionado =
                outroVinculo.nome;
            throw erro;
        }
    }

    return limpos;
}


function salvarComponentes(produtoId, componentes) {
    const limpos =
        validarComponentes(produtoId, componentes);

    const existentes =
        db.prepare(`
            SELECT
                produto_estoque_id,
                fracao_atual
            FROM produto_fracionado_componentes
            WHERE produto_id = ?
        `).all(produtoId);

    const progressoAnterior =
        new Map(
            existentes.map(
                item => [
                    Number(item.produto_estoque_id),
                    Number(item.fracao_atual || 0)
                ]
            )
        );

    db.prepare(`
        DELETE FROM produto_fracionado_componentes
        WHERE produto_id = ?
    `).run(produtoId);

    const inserir = db.prepare(`
        INSERT INTO produto_fracionado_componentes (
            produto_id,
            produto_estoque_id,
            fator_conversao,
            fracao_atual,
            ordem
        )
        VALUES (?, ?, ?, ?, ?)
    `);

    for (const componente of limpos) {
        let fracaoAtual =
            progressoAnterior.get(
                componente.produto_estoque_id
            ) || 0;

        // Se o fator mudou, mantém o progresso dentro do novo fator.
        fracaoAtual =
            fracaoAtual %
            componente.fator_conversao;

        inserir.run(
            produtoId,
            componente.produto_estoque_id,
            componente.fator_conversao,
            fracaoAtual,
            componente.ordem
        );
    }
}


function removerComponentes(produtoId) {
    db.prepare(`
        DELETE FROM produto_fracionado_componentes
        WHERE produto_id = ?
    `).run(produtoId);
}


/*
Consome N vendas de um produto fracionado.

A unidade física só é baixada quando o progresso completa o fator.
Ex.: fator 5
- venda 1: progresso 1/5
- venda 5: baixa 1 garrafa e volta para 0/5
*/
function consumirFracionado(produtoId, quantidadeVendida, vendaId) {
    const quantidade =
        Number(quantidadeVendida);

    const componentes =
        listarComponentes(produtoId);

    if (!componentes.length) {
        throw new Error("FRACIONADO_SEM_COMPONENTES");
    }

    const disponibilidade =
        calcularDisponibilidade(produtoId);

    if (disponibilidade < quantidade) {
        throw new Error(
            `ESTOQUE_FRACIONADO_INSUFICIENTE:${produtoId}:${disponibilidade}`
        );
    }

    const atualizarFisico =
        db.prepare(`
            UPDATE produtos
            SET quantidade = quantidade - ?
            WHERE id = ?
        `);

    const atualizarProgresso =
        db.prepare(`
            UPDATE produto_fracionado_componentes
            SET fracao_atual = ?
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
        const fator =
            Number(componente.fator_conversao);

        const totalProgresso =
            Number(componente.fracao_atual || 0) +
            quantidade;

        const unidadesFisicasConsumidas =
            Math.floor(totalProgresso / fator);

        const novoProgresso =
            totalProgresso % fator;

        if (unidadesFisicasConsumidas > 0) {
            const fisico =
                db.prepare(`
                    SELECT quantidade, nome
                    FROM produtos
                    WHERE id = ?
                `).get(componente.produto_estoque_id);

            if (
                !fisico ||
                Number(fisico.quantidade) <
                unidadesFisicasConsumidas
            ) {
                throw new Error(
                    `ESTOQUE_VINCULADO_INSUFICIENTE:${componente.produto_estoque_nome || componente.produto_estoque_id}`
                );
            }

            atualizarFisico.run(
                unidadesFisicasConsumidas,
                componente.produto_estoque_id
            );

            registrarMovimentacao.run(
                componente.produto_estoque_id,
                unidadesFisicasConsumidas,
                `Consumo fracionado de ${quantidade} venda(s) do produto #${produtoId}`,
                vendaId
            );
        }

        atualizarProgresso.run(
            novoProgresso,
            componente.id
        );
    }
}


/*
Desfaz o consumo de N vendas fracionadas.
Converte a disponibilidade total novamente em:
quantidade física + progresso.
*/
function devolverFracionado(produtoId, quantidadeVendida, vendaId) {
    const quantidade =
        Number(quantidadeVendida);

    const componentes =
        listarComponentes(produtoId);

    if (!componentes.length) {
        return;
    }

    const atualizarFisico =
        db.prepare(`
            UPDATE produtos
            SET quantidade = ?
            WHERE id = ?
        `);

    const atualizarProgresso =
        db.prepare(`
            UPDATE produto_fracionado_componentes
            SET fracao_atual = ?
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
        const fator =
            Number(componente.fator_conversao);

        const estoqueFisicoAtual =
            Number(componente.produto_estoque_quantidade || 0);

        const progressoAtual =
            Number(componente.fracao_atual || 0);

        const porcoesDisponiveisAtuais =
            estoqueFisicoAtual * fator -
            progressoAtual;

        const porcoesAposDevolucao =
            porcoesDisponiveisAtuais +
            quantidade;

        const novoEstoqueFisico =
            Math.ceil(
                porcoesAposDevolucao / fator
            );

        const novoProgresso =
            novoEstoqueFisico * fator -
            porcoesAposDevolucao;

        const unidadesFisicasRestauradas =
            Math.max(
                0,
                novoEstoqueFisico -
                estoqueFisicoAtual
            );

        atualizarFisico.run(
            novoEstoqueFisico,
            componente.produto_estoque_id
        );

        atualizarProgresso.run(
            novoProgresso,
            componente.id
        );

        if (unidadesFisicasRestauradas > 0) {
            registrarMovimentacao.run(
                componente.produto_estoque_id,
                unidadesFisicasRestauradas,
                `Cancelamento de consumo fracionado do produto #${produtoId}`,
                vendaId
            );
        }
    }
}


module.exports = {
    listarComponentes,
    calcularDisponibilidade,
    calcularUnidadesFisicasInteirasDisponiveis,
    enriquecerProduto,
    enriquecerProdutos,
    salvarComponentes,
    removerComponentes,
    consumirFracionado,
    devolverFracionado
};
