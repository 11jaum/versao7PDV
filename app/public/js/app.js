// =====================================================
// LICENCIAMENTO - REDIRECIONAMENTO GLOBAL
// =====================================================

const fetchAdegaOriginal =
    window.fetch.bind(window);

window.fetch = async (...args) => {
    const resposta =
        await fetchAdegaOriginal(...args);

    if (resposta.status === 402) {
        const url =
            typeof args[0] === "string"
                ? args[0]
                : args[0]?.url || "";

        if (!String(url).includes("/api/licenca/")) {
            setTimeout(() => {
                window.location.href =
                    "/ativacao.html";
            }, 0);
        }
    }

    return resposta;
};

async function verificarLicencaEmUso() {
    try {
        const resposta =
            await fetchAdegaOriginal(
                "/api/licenca/status",
                { cache: "no-store" }
            );

        const dados =
            await resposta.json();

        if (!dados.valida) {
            window.location.href =
                "/ativacao.html";
        }
    } catch {
        // Falha momentânea local não encerra a tela;
        // as APIs operacionais continuam protegidas pelo servidor.
    }
}

setInterval(
    verificarLicencaEmUso,
    60 * 1000
);

// ==========================================
// MODAL PADRÃO DO SISTEMA
// ==========================================
function mostrarModalSistema({ tipo = "aviso", titulo = "Atenção", mensagem = "", detalhes = "", confirmarTexto = "OK", cancelarTexto = "Cancelar", confirmacao = false } = {}) {
    return new Promise(resolve => {
        const overlay = document.getElementById("modalSistema");

        if (!overlay) {
            console.error("Modal padrão do sistema não encontrado:", {
                tipo,
                titulo,
                mensagem
            });
            resolve(false);
            return;
        }

        const modal = overlay.querySelector(".modal-sistema");
        const icone = document.getElementById("modalSistemaIcone");
        const tituloEl = document.getElementById("modalSistemaTitulo");
        const mensagemEl = document.getElementById("modalSistemaMensagem");
        const detalhesEl = document.getElementById("modalSistemaDetalhes");
        const btnConfirmar = document.getElementById("modalSistemaConfirmar");
        const btnCancelar = document.getElementById("modalSistemaCancelar");
        const btnFechar = document.getElementById("modalSistemaFechar");

        if (
            !modal ||
            !icone ||
            !tituloEl ||
            !mensagemEl ||
            !detalhesEl ||
            !btnConfirmar ||
            !btnCancelar ||
            !btnFechar
        ) {
            console.error("Estrutura do modal padrão está incompleta.");
            resolve(false);
            return;
        }

        const icones = {
            sucesso: "✓",
            erro: "×",
            aviso: "!",
            confirmacao: "?"
        };

        const focoAnterior =
            document.activeElement;

        modal.className =
            `modal-sistema tipo-${tipo}${confirmacao ? " confirmacao" : ""}`;

        icone.textContent =
            icones[tipo] || "!";

        tituloEl.textContent =
            String(titulo || "Atenção");

        mensagemEl.textContent =
            String(
                mensagem ||
                "Não foi possível concluir a operação."
            );

        detalhesEl.textContent =
            String(detalhes || "");

        detalhesEl.classList.toggle(
            "ativo",
            Boolean(detalhes)
        );

        btnConfirmar.textContent =
            confirmarTexto;

        btnCancelar.textContent =
            cancelarTexto;

        btnCancelar.style.display =
            confirmacao
                ? ""
                : "none";

        overlay.classList.add("ativo");
        document.body.classList.add("modal-aberto");

        requestAnimationFrame(() => {
            (
                confirmacao
                    ? btnCancelar
                    : btnConfirmar
            ).focus();
        });

        let finalizado = false;

        const finalizar = valor => {
            if (finalizado) return;
            finalizado = true;

            overlay.classList.remove("ativo");

            if (
                !document.querySelector(
                    ".modal-overlay.ativo"
                )
            ) {
                document.body.classList.remove(
                    "modal-aberto"
                );
            }

            btnConfirmar.onclick =
                btnCancelar.onclick =
                btnFechar.onclick =
                null;

            overlay.onclick = null;

            document.removeEventListener(
                "keydown",
                aoTeclarModalSistema,
                true
            );

            if (
                focoAnterior &&
                typeof focoAnterior.focus ===
                    "function"
            ) {
                requestAnimationFrame(
                    () =>
                        focoAnterior.focus()
                );
            }

            resolve(valor);
        };

        const aoTeclarModalSistema = evento => {
            if (
                evento.key === "Escape"
            ) {
                evento.preventDefault();
                evento.stopPropagation();
                finalizar(false);
                return;
            }

            if (
                evento.key === "Enter" &&
                !evento.shiftKey &&
                !evento.ctrlKey &&
                !evento.altKey &&
                !evento.metaKey &&
                evento.target?.tagName !==
                    "TEXTAREA"
            ) {
                evento.preventDefault();
                evento.stopPropagation();
                finalizar(
                    confirmacao
                        ? true
                        : true
                );
            }
        };

        btnConfirmar.onclick =
            () => finalizar(true);

        btnCancelar.onclick =
            () => finalizar(false);

        btnFechar.onclick =
            () => finalizar(false);

        overlay.onclick = evento => {
            if (
                evento.target === overlay &&
                !confirmacao
            ) {
                finalizar(false);
            }
        };

        document.addEventListener(
            "keydown",
            aoTeclarModalSistema,
            true
        );
    });
}
const modalErro = (mensagem, titulo = "Não foi possível concluir") =>
    mostrarModalSistema({ tipo: "erro", titulo, mensagem, confirmarTexto: "Entendi" });
const modalAviso = (mensagem, titulo = "Atenção") =>
    mostrarModalSistema({ tipo: "aviso", titulo, mensagem, confirmarTexto: "Entendi" });
const modalSucesso = (mensagem, titulo = "Tudo certo!") =>
    mostrarModalSistema({ tipo: "sucesso", titulo, mensagem });
const modalConfirmar = (mensagem, titulo = "Confirmar ação", confirmarTexto = "Confirmar") =>
    mostrarModalSistema({ tipo: "confirmacao", titulo, mensagem, confirmarTexto, cancelarTexto: "Cancelar", confirmacao: true });


// ========================================
// SKELETON / CARREGAMENTO DE CONTEÚDO
// ========================================

function htmlSkeletonCards(
    quantidade = 4
) {
    return `
        <div class="skeleton-cards">
            ${Array.from(
                {
                    length:
                        Math.max(
                            1,
                            quantidade
                        )
                },
                () => `
                    <div class="skeleton-card">
                        <i class="skeleton skeleton-quadrado"></i>
                        <div>
                            <i class="skeleton skeleton-linha grande"></i>
                            <i class="skeleton skeleton-linha media"></i>
                            <i class="skeleton skeleton-linha pequena"></i>
                        </div>
                    </div>
                `
            ).join("")}
        </div>
    `;
}


function htmlSkeletonTabela(
    linhas = 5,
    colunas = 5
) {
    return `
        <div class="skeleton-tabela">
            ${Array.from(
                {
                    length:
                        Math.max(
                            1,
                            linhas
                        )
                },
                () => `
                    <div class="skeleton-tabela-linha">
                        ${Array.from(
                            {
                                length:
                                    Math.max(
                                        1,
                                        colunas
                                    )
                            },
                            () =>
                                '<i class="skeleton skeleton-linha"></i>'
                        ).join("")}
                    </div>
                `
            ).join("")}
        </div>
    `;
}


const timersSkeleton =
    new WeakMap();


function iniciarSkeleton(
    elemento,
    tipo = "cards",
    quantidade = 4
) {
    if (!elemento) return;

    if (
        elemento.dataset
            .skeletonAtivo ===
        "1"
    ) {
        return;
    }

    elemento.dataset
        .skeletonAnterior =
        elemento.innerHTML;

    elemento.dataset
        .skeletonAtivo =
        "1";

    elemento.innerHTML =
        tipo === "tabela"
            ? htmlSkeletonTabela(
                quantidade,
                5
            )
            : htmlSkeletonCards(
                quantidade
            );

    const timerAnterior =
        timersSkeleton.get(
            elemento
        );

    if (timerAnterior) {
        clearTimeout(
            timerAnterior
        );
    }

    const timer =
        setTimeout(
            () => {
                if (
                    elemento.dataset
                        .skeletonAtivo !==
                    "1"
                ) {
                    return;
                }

                elemento.innerHTML = `
                    <div class="estado-conteudo estado-carregamento-expirado">
                        <span class="estado-conteudo-icone" aria-hidden="true">!</span>
                        <strong>Demorou mais que o esperado</strong>
                        <small>Atualize a tela ou tente novamente.</small>
                    </div>
                `;

                finalizarSkeleton(
                    elemento
                );
            },
            15000
        );

    timersSkeleton.set(
        elemento,
        timer
    );
}


function finalizarSkeleton(
    elemento
) {
    if (!elemento) return;

    const timer =
        timersSkeleton.get(
            elemento
        );

    if (timer) {
        clearTimeout(
            timer
        );

        timersSkeleton.delete(
            elemento
        );
    }

    delete elemento.dataset
        .skeletonAtivo;

    delete elemento.dataset
        .skeletonAnterior;
}


function skeletonTemporarioTela(
    nomeTela
) {
    const mapa = {
        dashboard:
            usuarioAtual?.perfil === "administrador"
                ? [
                    [
                        "rankingProdutosDashboard",
                        "cards",
                        5
                    ],
                    [
                        "dashboardCategoriasLegenda",
                        "cards",
                        4
                    ]
                ]
                : [
                    [
                        "dashboardCategoriasLegenda",
                        "cards",
                        4
                    ]
                ],
        pdv: [
            [
                "listaProdutosPDV",
                "cards",
                6
            ]
        ],
        usuarios: [
            [
                "tabelaUsuarios",
                "tabela",
                5
            ]
        ],
        auditoria: [
            [
                "tabelaAuditoria",
                "tabela",
                6
            ]
        ]
    };

    const itens =
        mapa[nomeTela] || [];

    itens.forEach(
        ([id, tipo, qtd]) => {
            const elemento =
                document.getElementById(
                    id
                );

            if (
                elemento &&
                (
                    !elemento.children.length ||
                    elemento.textContent
                        .trim()
                        .toLowerCase()
                        .includes(
                            "carregando"
                        )
                )
            ) {
                iniciarSkeleton(
                    elemento,
                    tipo,
                    qtd
                );
            }
        }
    );
}



// Usuário autenticado atualmente
let usuarioAtual = null;
let configuracoesSistema = null;

const botoesMenu =
    document.querySelectorAll(".menu-item");

const telas =
    document.querySelectorAll(".tela");

const tituloPagina =
    document.getElementById("tituloPagina");

const subtituloPagina =
    document.getElementById("subtituloPagina");


const dadosPaginas = {

    dashboard: {
        titulo: "Dashboard",
        subtitulo: "Visão geral da sua adega"
    },

    pdv: {
        titulo: "PDV",
        subtitulo: "Realize vendas de forma rápida"
    },

    comandas: {
        titulo: "Comandas",
        subtitulo: "Consumo em aberto para pagar no final"
    },

    estoque: {
        titulo: "Estoque",
        subtitulo: "Gerencie produtos e movimentações"
    },

    inventario: {
        titulo: "Inventário",
        subtitulo: "Conferência física do estoque"
    },

    caixa: {
        titulo: "Caixa",
        subtitulo: "Controle financeiro do caixa"
    },

    relatorios: {
        titulo: "Relatórios",
        subtitulo: "Acompanhe o desempenho da adega"
    },

    fechamentoMensal: {
        titulo: "Fechamento Mensal",
        subtitulo: "Consolidação financeira do mês"
    },

    usuarios: {
        titulo: "Usuários",
        subtitulo: "Gerencie os acessos ao sistema"
    },

    auditoria: {
        titulo: "Auditoria",
        subtitulo: "Acompanhe as ações realizadas no sistema"
    },

    configuracoes: {
        titulo: "Configurações",
        subtitulo: "Personalize sua adega e os padrões do sistema"
    },

    sistema: {
        titulo: "Sistema",
        subtitulo: "Backup, restauração e diagnóstico do Adega PDV"
    }

};


function abrirTela(nomeTela) {

    skeletonTemporarioTela(
        nomeTela
    );

    const telasSomenteAdministrador = [
        "relatorios",
        "fechamentoMensal",
        "usuarios",
        "auditoria",
        "configuracoes",
        "sistema"
    ];

    if (
        telasSomenteAdministrador.includes(nomeTela) &&
        usuarioAtual?.perfil !== "administrador"
    ) {
        return;
    }

    telas.forEach(tela => {
        tela.classList.remove("ativa");
    });

    botoesMenu.forEach(botao => {
        botao.classList.remove("ativo");
    });


    const tela =
        document.getElementById(nomeTela);

    if (tela) {
        tela.classList.add("ativa");
    }

    if (nomeTela === "sistema") {
        carregarStatusSistema();
        carregarStatusAtualizacao?.();
    }

    if (nomeTela === "pdv") {
        // Sempre consulta o estoque atual ao entrar no PDV.
        // Isso evita manter em memória quantidades antigas após inventário,
        // ajustes de estoque, importação ou outras operações.
        carregarProdutosPDV?.();
        carregarDestaquesPDV?.();
    }

    if (nomeTela === "dashboard") {
        configurarDashboardPorPerfil?.();
        atualizarIdentidadeDashboardModerno?.();
        atualizarRelogioDashboardModerno?.();

        // Ao voltar para o Dashboard, consulta novamente todos os dados.
        // Antes, apenas algumas partes eram atualizadas e os cards podiam
        // continuar mostrando valores antigos até reiniciar o aplicativo.
        atualizarDashboardAutomaticamente?.(
            {
                forcar: true
            }
        );
    }


    const botao =
        document.querySelector(
            `.menu-item[data-tela="${nomeTela}"]`
        );

    if (botao) {
        botao.classList.add("ativo");
    }


    const dados =
        dadosPaginas[nomeTela];

    if (dados) {
        if (tituloPagina) {
            tituloPagina.textContent =
                dados.titulo;
        }

        if (subtituloPagina) {
            subtituloPagina.textContent =
                dados.subtitulo;
        }
    }
    if (nomeTela === "comandas") {
        carregarComandas();
    }

    if (nomeTela === "inventario") {
        carregarInventarioAberto();
        carregarHistoricoInventario();
    }

    if (nomeTela === "fechamentoMensal") {
        carregarFechamentoMensal();
    }
}


botoesMenu.forEach(botao => {

    botao.addEventListener(
        "click",
        () => {

            const tela =
                botao.dataset.tela;

            abrirTela(tela);
        }
    );

});


document
    .querySelectorAll("[data-ir]")
    .forEach(botao => {

        botao.addEventListener(
            "click",
            () => {

                abrirTela(
                    botao.dataset.ir
                );

            }
        );

    });


function atualizarData() {

    const agora =
        new Date();

    document.getElementById(
        "dataAtual"
    ).textContent =
        agora.toLocaleDateString(
            "pt-BR",
            {
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        );

}


async function carregarResumoEstoque() {

    try {

        const resposta =
            await fetch(
                "/api/estoque/resumo"
            );

        const dados =
            await resposta.json();


        document.getElementById(
            "dashboardProdutos"
        ).textContent =
            dados.total_produtos || 0;


        document.getElementById(
            "dashboardEstoqueBaixo"
        ).textContent =
            dados.estoque_baixo || 0;


        document.getElementById(
            "totalItensEstoque"
        ).textContent =
            dados.total_itens || 0;


        document.getElementById(
            "produtosSemEstoque"
        ).textContent =
            dados.sem_estoque || 0;


        const valorCustoEstoque =
            document.getElementById(
                "valorCustoEstoque"
            );

        if (
            valorCustoEstoque &&
            usuarioAtual?.perfil === "administrador"
        ) {
            valorCustoEstoque.textContent =
                formatarDinheiro(
                    dados.valor_custo_estoque
                );
        }


        document.getElementById(
            "valorVendaEstoque"
        ).textContent =
            formatarDinheiro(
                dados.valor_venda_estoque
            );

    } catch (erro) {

        console.error(
            "Erro ao carregar estoque:",
            erro
        );

    }
}


function formatarDinheiro(valor) {

    return Number(valor || 0)
        .toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );

}


atualizarData();
carregarResumoEstoque();

let produtosCache = [];


async function carregarProdutos() {

    try {

        const resposta =
            await fetch("/api/produtos");

        produtosCache =
            await resposta.json();

        renderizarProdutos();

    } catch (erro) {

        console.error(
            "Erro ao carregar produtos:",
            erro
        );

    }
}


async function carregarCategorias() {

    try {

        const resposta =
            await fetch("/api/categorias");

        const categorias =
            await resposta.json();

        const select =
            document.getElementById(
                "produtoCategoria"
            );

        select.innerHTML = `
            <option value="">
                Sem categoria
            </option>
        `;

        categorias.forEach(categoria => {

            select.innerHTML += `
                <option value="${categoria.id}">
                    ${categoria.nome}
                </option>
            `;

        });

    } catch (erro) {

        console.error(erro);

    }
}



function formatarValidadeProduto(data) {
    if (!data) {
        return '<span class="validade-sem-data">—</span>';
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const validade = new Date(`${data}T00:00:00`);

    const dias = Math.round(
        (validade - hoje) /
        (1000 * 60 * 60 * 24)
    );

    const dataFormatada =
        validade.toLocaleDateString("pt-BR");

    if (dias < 0) {
        return `
            <span class="badge-validade vencido">
                Vencido • ${dataFormatada}
            </span>
        `;
    }

    if (dias === 0) {
        return `
            <span class="badge-validade hoje">
                Vence hoje
            </span>
        `;
    }

    if (dias <= 7) {
        return `
            <span class="badge-validade breve">
                ${dias} dia(s) • ${dataFormatada}
            </span>
        `;
    }

    return `
        <span class="badge-validade normal">
            ${dataFormatada}
        </span>
    `;
}


function renderizarProdutos() {

    const pesquisa =
        document
            .getElementById("pesquisaProduto")
            .value
            .toLowerCase();

    const filtro =
        document
            .getElementById("filtroEstoque")
            .value;


    const produtosFiltrados =
        produtosCache.filter(produto => {

            const correspondePesquisa =
                produto.nome
                    .toLowerCase()
                    .includes(pesquisa) ||

                String(
                    produto.codigo_barras || ""
                ).includes(pesquisa);


            let correspondeFiltro = true;

            if (filtro === "normal") {

                correspondeFiltro =
                    produto.quantidade >
                    produto.estoque_minimo;

            }

            if (filtro === "baixo") {

                correspondeFiltro =
                    produto.quantidade > 0 &&
                    produto.quantidade <=
                    produto.estoque_minimo;

            }

            if (filtro === "zerado") {

                correspondeFiltro =
                    produto.quantidade === 0;

            }

            return (
                correspondePesquisa &&
                correspondeFiltro
            );

        });


    const tbody =
        document.getElementById(
            "tabelaProdutos"
        );


    if (produtosFiltrados.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    Nenhum produto encontrado.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        produtosFiltrados.map(produto => {

            let status = "Normal";
            let classe = "status-normal";

            if (produto.quantidade === 0) {
                status = "Sem estoque";
                classe = "status-zerado";
            }
            else if (
                produto.quantidade <=
                produto.estoque_minimo
            ) {
                status = "Estoque baixo";
                classe = "status-baixo";
            }


            return `
                <tr>

                    <td>
                        <strong>
                            ${produto.nome}
                        </strong>

                        <br>

                        <small>
                            ${produto.codigo_barras || ""}
                        </small>
                    </td>

                    <td>
                        ${produto.categoria || "-"}
                    </td>

                    <td>
                        ${formatarDinheiro(
                            produto.preco_venda
                        )}
                    </td>

                    <td>
                        ${produto.quantidade}
                        ${produto.unidade}
                    </td>

                    <td>
                        ${produto.estoque_minimo}
                    </td>

                    <td>
                        ${formatarValidadeProduto(
                            produto.data_validade
                        )}
                    </td>

                    <td>
                        <span
                            class="
                                status-estoque
                                ${classe}
                            "
                        >
                            ${status}
                        </span>
                    </td>

                    <td>

                        <div class="acoes-tabela">

                            <button
                                class="btn-acao"
                                onclick="
                                    editarProduto(
                                        ${produto.id}
                                    )
                                "
                            >
                                Editar
                            </button>

                            ${
                                ["fracionado", "kit"].includes(
                                    produto.tipo_estoque || "normal"
                                )
                                    ? `
                                        <span class="badge-estoque-virtual">
                                            Estoque automático
                                        </span>
                                    `
                                    : `
                                        <button
                                            class="btn-acao"
                                            onclick="abrirMovimentacao(${produto.id}, 'entrada')"
                                        >
                                            + Entrada
                                        </button>

                                        <button
                                            class="btn-acao"
                                            onclick="abrirMovimentacao(${produto.id}, 'saida')"
                                        >
                                            - Saída
                                        </button>

                                        <button
                                            class="btn-acao"
                                            onclick="abrirMovimentacao(${produto.id}, 'perda')"
                                        >
                                            Perda
                                        </button>

                                        <button
                                            class="btn-acao"
                                            onclick="abrirMovimentacao(${produto.id}, 'ajuste')"
                                        >
                                            Ajustar
                                        </button>
                                    `
                            }

                        </div>

                    </td>

                </tr>
            `;

        }).join("");
}


function produtosFisicosDisponiveis(produtoEditandoId = null) {
    return produtosCache.filter(
        produto =>
            Number(produto.ativo ?? 1) === 1 &&
            (produto.tipo_estoque || "normal") === "normal" &&
            Number(produto.id) !== Number(produtoEditandoId)
    );
}


function preencherSelectsProdutosFracionados(produtoEditandoId = null) {
    const selects = [
        {
            elemento: document.getElementById("produtoEstoqueVinculado"),
            placeholder: "Selecione o produto físico"
        },
        {
            elemento: document.getElementById("produtoEstoqueVinculado2"),
            placeholder: "Nenhum segundo produto"
        },
        {
            elemento: document.getElementById("produtoEstoqueVinculado3"),
            placeholder: "Nenhum terceiro produto"
        }
    ];

    const fisicos =
        produtosFisicosDisponiveis(produtoEditandoId);

    for (const item of selects) {
        if (!item.elemento) continue;

        const valorAnterior = item.elemento.value;

        item.elemento.innerHTML = `
            <option value="">
                ${item.placeholder}
            </option>
        ` + fisicos.map(
            produto => `
                <option value="${produto.id}">
                    ${produto.nome} — estoque: ${produto.quantidade} ${produto.unidade || "un"}
                </option>
            `
        ).join("");

        if (
            valorAnterior &&
            [...item.elemento.options].some(
                opcao => opcao.value === valorAnterior
            )
        ) {
            item.elemento.value = valorAnterior;
        }
    }
}


function preencherSelectsProdutosKit(produtoEditandoId = null) {
    const selects = [
        {
            elemento: document.getElementById("produtoKitEstoqueVinculado"),
            placeholder: "Selecione o produto físico"
        },
        {
            elemento: document.getElementById("produtoKitEstoqueVinculado2"),
            placeholder: "Nenhum segundo produto"
        },
        {
            elemento: document.getElementById("produtoKitEstoqueVinculado3"),
            placeholder: "Nenhum terceiro produto"
        }
    ];

    const fisicos =
        produtosFisicosDisponiveis(produtoEditandoId);

    for (const item of selects) {
        if (!item.elemento) continue;

        const valorAnterior = item.elemento.value;

        item.elemento.innerHTML = `
            <option value="">
                ${item.placeholder}
            </option>
        ` + fisicos.map(
            produto => `
                <option value="${produto.id}">
                    ${produto.nome} — estoque: ${produto.quantidade} ${produto.unidade || "un"}
                </option>
            `
        ).join("");

        if (
            valorAnterior &&
            [...item.elemento.options].some(
                opcao => opcao.value === valorAnterior
            )
        ) {
            item.elemento.value = valorAnterior;
        }
    }
}


function atualizarPreviaKit() {
    const componentes = [
        {
            select: document.getElementById("produtoKitEstoqueVinculado"),
            quantidade: document.getElementById("produtoKitQuantidade")
        },
        {
            select: document.getElementById("produtoKitEstoqueVinculado2"),
            quantidade: document.getElementById("produtoKitQuantidade2")
        },
        {
            select: document.getElementById("produtoKitEstoqueVinculado3"),
            quantidade: document.getElementById("produtoKitQuantidade3")
        }
    ];

    const selecionados =
        componentes
            .map(componente => {
                const produtoId =
                    Number(componente.select?.value || 0);

                if (!produtoId) return null;

                const porVenda =
                    Math.max(
                        1,
                        Number(componente.quantidade?.value || 1)
                    );

                const produtoFisico =
                    produtosCache.find(
                        produto =>
                            Number(produto.id) === produtoId
                    );

                const estoqueInteiro =
                    Math.max(
                        0,
                        Number(
                            produtoFisico?.quantidade_venda ??
                            produtoFisico?.quantidade ??
                            0
                        )
                    );

                return {
                    nome: produtoFisico?.nome || "Produto",
                    porVenda,
                    disponivel: Math.floor(
                        estoqueInteiro / porVenda
                    )
                };
            })
            .filter(Boolean);

    const disponivel =
        selecionados.length
            ? Math.min(
                ...selecionados.map(
                    item => item.disponivel
                )
            )
            : 0;

    const saida =
        document.getElementById("produtoKitDisponivel");

    if (saida) {
        saida.textContent = String(disponivel);
    }

    const limitante =
        document.getElementById("produtoKitLimitante");

    if (!limitante) return;

    if (!selecionados.length) {
        limitante.textContent =
            "Selecione os produtos físicos para calcular quantos Kits/Combos podem ser vendidos.";
        return;
    }

    const nomes =
        selecionados
            .filter(
                item =>
                    item.disponivel === disponivel
            )
            .map(item => item.nome);

    limitante.textContent =
        `${disponivel} Kit(s)/Combo(s) disponíveis — limitado por ${nomes.join(", ")}`;
}


function atualizarPreviaFracionado() {
    const tipo =
        document.getElementById("produtoTipoEstoque")?.value;

    const config =
        document.getElementById("configProdutoFracionado");

    const configKit =
        document.getElementById("configProdutoKit");

    const campoQuantidade =
        document.getElementById("produtoQuantidade");

    if (!config || !campoQuantidade) return;

    const fracionado =
        tipo === "fracionado";

    const kit =
        tipo === "kit";

    config.style.display =
        fracionado ? "block" : "none";

    if (configKit) {
        configKit.style.display =
            kit ? "block" : "none";
    }

    if (!document.getElementById("produtoId").value) {
        campoQuantidade.disabled =
            fracionado || kit;

        if (fracionado || kit) {
            campoQuantidade.value = 0;
        }
    }

    if (kit) {
        atualizarPreviaKit();
    }

    if (!fracionado) return;

    const componentes = [
        {
            select:
                document.getElementById("produtoEstoqueVinculado"),
            fator:
                document.getElementById("produtoFatorConversao"),
            progresso:
                document.getElementById("produtoFracaoAtual")
        },
        {
            select:
                document.getElementById("produtoEstoqueVinculado2"),
            fator:
                document.getElementById("produtoFatorConversao2"),
            progresso:
                document.getElementById("produtoFracaoAtual2")
        },
        {
            select:
                document.getElementById("produtoEstoqueVinculado3"),
            fator:
                document.getElementById("produtoFatorConversao3"),
            progresso:
                document.getElementById("produtoFracaoAtual3")
        }
    ];

    const disponibilidades = [];

    componentes.forEach((componente, indice) => {
        const produtoId =
            Number(componente.select?.value || 0);

        const fator =
            Math.max(
                1,
                Number(componente.fator?.value || 1)
            );

        const produtoFisico =
            produtosCache.find(
                produto =>
                    Number(produto.id) === produtoId
            );

        const produtoEditando =
            produtosCache.find(
                produto =>
                    Number(produto.id) ===
                    Number(
                        document.getElementById("produtoId").value || 0
                    )
            );

        const configuracaoAtual =
            produtoEditando?.componentes_fracionados?.find(
                item =>
                    Number(item.produto_estoque_id) ===
                    produtoId
            );

        const progressoAtual =
            configuracaoAtual
                ? Number(configuracaoAtual.fracao_atual || 0)
                : 0;

        if (componente.progresso) {
            componente.progresso.textContent =
                produtoId
                    ? `${progressoAtual} / ${fator} doses`
                    : (indice === 0 ? `0 / ${fator} doses` : "—");
        }

        if (produtoFisico && produtoId) {
            disponibilidades.push(
                Math.max(
                    0,
                    Math.floor(
                        Number(produtoFisico.quantidade || 0) *
                        fator -
                        progressoAtual
                    )
                )
            );
        }
    });

    const disponivel =
        disponibilidades.length
            ? Math.min(...disponibilidades)
            : 0;

    const saida =
        document.getElementById("produtoFracionadoDisponivel");

    if (saida) {
        saida.textContent = String(disponivel);
    }

    const limitante =
        document.getElementById("produtoFracionadoLimitante");

    if (limitante) {
        const componentesSelecionados =
            componentes
                .map(componente => {
                    const produtoId =
                        Number(componente.select?.value || 0);

                    if (!produtoId) return null;

                    const produtoFisico =
                        produtosCache.find(
                            produto =>
                                Number(produto.id) === produtoId
                        );

                    const fator =
                        Math.max(
                            1,
                            Number(componente.fator?.value || 1)
                        );

                    const produtoEditando =
                        produtosCache.find(
                            produto =>
                                Number(produto.id) ===
                                Number(
                                    document.getElementById("produtoId").value || 0
                                )
                        );

                    const configuracaoAtual =
                        produtoEditando?.componentes_fracionados?.find(
                            item =>
                                Number(item.produto_estoque_id) === produtoId
                        );

                    const progressoAtual =
                        configuracaoAtual
                            ? Number(configuracaoAtual.fracao_atual || 0)
                            : 0;

                    const disponivelComponente =
                        Math.max(
                            0,
                            Math.floor(
                                Number(produtoFisico?.quantidade || 0) *
                                fator -
                                progressoAtual
                            )
                        );

                    return {
                        nome:
                            produtoFisico?.nome ||
                            "Produto",
                        disponivel:
                            disponivelComponente
                    };
                })
                .filter(Boolean);

        if (!componentesSelecionados.length) {
            limitante.textContent =
                "Selecione os produtos físicos para calcular o ingrediente limitante.";
        } else {
            const menor =
                Math.min(
                    ...componentesSelecionados.map(
                        item => item.disponivel
                    )
                );

            const nomes =
                componentesSelecionados
                    .filter(
                        item =>
                            item.disponivel === menor
                    )
                    .map(
                        item => item.nome
                    );

            limitante.textContent =
                `${menor} doses disponíveis — limitado por ${nomes.join(", ")}`;
        }
    }
}


function obterComponentesFracionadosFormulario() {
    const componentes = [];

    const primeiroId =
        Number(
            document.getElementById("produtoEstoqueVinculado").value || 0
        );

    const primeiroFator =
        Number(
            document.getElementById("produtoFatorConversao").value || 0
        );

    if (primeiroId) {
        componentes.push({
            produto_estoque_id: primeiroId,
            fator_conversao: primeiroFator
        });
    }

    const segundoId =
        Number(
            document.getElementById("produtoEstoqueVinculado2").value || 0
        );

    const segundoFator =
        Number(
            document.getElementById("produtoFatorConversao2").value || 0
        );

    if (segundoId) {
        componentes.push({
            produto_estoque_id: segundoId,
            fator_conversao: segundoFator
        });
    }

    const terceiroId =
        Number(
            document.getElementById("produtoEstoqueVinculado3").value || 0
        );

    const terceiroFator =
        Number(
            document.getElementById("produtoFatorConversao3").value || 0
        );

    if (terceiroId) {
        componentes.push({
            produto_estoque_id: terceiroId,
            fator_conversao: terceiroFator
        });
    }

    return componentes;
}


function obterComponentesKitFormulario() {
    const componentes = [];

    const configuracoes = [
        ["produtoKitEstoqueVinculado", "produtoKitQuantidade"],
        ["produtoKitEstoqueVinculado2", "produtoKitQuantidade2"],
        ["produtoKitEstoqueVinculado3", "produtoKitQuantidade3"]
    ];

    for (const [idProduto, idQuantidade] of configuracoes) {
        const produtoId =
            Number(
                document.getElementById(idProduto)?.value || 0
            );

        if (!produtoId) continue;

        componentes.push({
            produto_estoque_id: produtoId,
            quantidade_por_venda:
                Number(
                    document.getElementById(idQuantidade)?.value || 0
                )
        });
    }

    return componentes;
}


function abrirModalProduto() {

    document
        .getElementById("formProduto")
        .reset();

    document
        .getElementById("produtoId")
        .value = "";

    const minimoPadrao = document.getElementById("produtoMinimo");
    if (minimoPadrao && configuracoesSistema) {
        minimoPadrao.value = configuracoesSistema.estoque_minimo_padrao ?? 0;
    }

    document
        .getElementById(
            "tituloModalProduto"
        )
        .textContent = "Novo Produto";

    document
        .getElementById(
            "produtoQuantidade"
        )
        .disabled = false;

    document.getElementById("produtoTipoEstoque").value = "normal";
    document.getElementById("produtoFatorConversao").value = 5;
    document.getElementById("produtoFatorConversao2").value = 1;
    document.getElementById("produtoFatorConversao3").value = 1;
    document.getElementById("produtoEstoqueVinculado").value = "";
    document.getElementById("produtoEstoqueVinculado2").value = "";
    document.getElementById("produtoEstoqueVinculado3").value = "";

    document.getElementById("produtoKitQuantidade").value = 10;
    document.getElementById("produtoKitQuantidade2").value = 1;
    document.getElementById("produtoKitQuantidade3").value = 1;
    document.getElementById("produtoKitEstoqueVinculado").value = "";
    document.getElementById("produtoKitEstoqueVinculado2").value = "";
    document.getElementById("produtoKitEstoqueVinculado3").value = "";

    preencherSelectsProdutosFracionados();
    preencherSelectsProdutosKit();
    atualizarPreviaFracionado();

    document
        .getElementById("modalProduto")
        .classList.add("ativo");
}


function fecharModalProduto() {

    document
        .getElementById("modalProduto")
        .classList.remove("ativo");
}


async function editarProduto(id) {

    const produto =
        produtosCache.find(
            p => p.id === id
        );

    if (!produto) return;


    document.getElementById(
        "produtoId"
    ).value = produto.id;

    document.getElementById(
        "produtoNome"
    ).value = produto.nome;

    document.getElementById(
        "produtoCodigo"
    ).value =
        produto.codigo_barras || "";

    const campoCustoProduto =
        document.getElementById(
            "produtoCusto"
        );

    if (campoCustoProduto) {
        campoCustoProduto.value =
            usuarioAtual?.perfil === "administrador"
                ? (produto.preco_custo ?? 0)
                : "";
    }

    document.getElementById(
        "produtoVenda"
    ).value =
        produto.preco_venda;

    document.getElementById(
        "produtoQuantidade"
    ).value =
        produto.quantidade;

    document.getElementById(
        "produtoQuantidade"
    ).disabled = true;

    document.getElementById(
        "produtoMinimo"
    ).value =
        produto.estoque_minimo;

    document.getElementById(
        "produtoUnidade"
    ).value =
        produto.unidade;

    document.getElementById(
        "produtoValidade"
    ).value =
        produto.data_validade || "";

    document.getElementById(
        "tituloModalProduto"
    ).textContent =
        "Editar Produto";


    await carregarCategorias();


    if (produto.categoria) {

        const select =
            document.getElementById(
                "produtoCategoria"
            );

        const opcao =
            [...select.options].find(
                o =>
                    o.textContent.trim() ===
                    produto.categoria
            );

        if (opcao) {
            select.value = opcao.value;
        }

    }


    preencherSelectsProdutosFracionados(produto.id);
    preencherSelectsProdutosKit(produto.id);

    document.getElementById("produtoTipoEstoque").value =
        produto.tipo_estoque || "normal";

    const componentes =
        Array.isArray(produto.componentes_fracionados)
            ? produto.componentes_fracionados
            : [];

    const componente1 = componentes[0];
    const componente2 = componentes[1];
    const componente3 = componentes[2];

    document.getElementById("produtoEstoqueVinculado").value =
        componente1
            ? String(componente1.produto_estoque_id)
            : "";

    document.getElementById("produtoFatorConversao").value =
        componente1
            ? componente1.fator_conversao
            : 5;

    document.getElementById("produtoEstoqueVinculado2").value =
        componente2
            ? String(componente2.produto_estoque_id)
            : "";

    document.getElementById("produtoFatorConversao2").value =
        componente2
            ? componente2.fator_conversao
            : 1;

    document.getElementById("produtoEstoqueVinculado3").value =
        componente3
            ? String(componente3.produto_estoque_id)
            : "";

    document.getElementById("produtoFatorConversao3").value =
        componente3
            ? componente3.fator_conversao
            : 1;

    const componentesKit =
        Array.isArray(produto.componentes_kit)
            ? produto.componentes_kit
            : [];

    const kit1 = componentesKit[0];
    const kit2 = componentesKit[1];
    const kit3 = componentesKit[2];

    document.getElementById("produtoKitEstoqueVinculado").value =
        kit1 ? String(kit1.produto_estoque_id) : "";
    document.getElementById("produtoKitQuantidade").value =
        kit1 ? kit1.quantidade_por_venda : 10;

    document.getElementById("produtoKitEstoqueVinculado2").value =
        kit2 ? String(kit2.produto_estoque_id) : "";
    document.getElementById("produtoKitQuantidade2").value =
        kit2 ? kit2.quantidade_por_venda : 1;

    document.getElementById("produtoKitEstoqueVinculado3").value =
        kit3 ? String(kit3.produto_estoque_id) : "";
    document.getElementById("produtoKitQuantidade3").value =
        kit3 ? kit3.quantidade_por_venda : 1;

    atualizarPreviaFracionado();

    document
        .getElementById("modalProduto")
        .classList.add("ativo");
}


document
    .getElementById("formProduto")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const id =
                document.getElementById(
                    "produtoId"
                ).value;


            const dados = {

                codigo_barras:
                    document.getElementById(
                        "produtoCodigo"
                    ).value,

                nome:
                    document.getElementById(
                        "produtoNome"
                    ).value,

                categoria_id:
                    document.getElementById(
                        "produtoCategoria"
                    ).value || null,

                ...(usuarioAtual?.perfil === "administrador"
                    ? {
                        preco_custo:
                            document.getElementById(
                                "produtoCusto"
                            ).value
                    }
                    : {}),

                preco_venda:
                    document.getElementById(
                        "produtoVenda"
                    ).value,

                estoque_minimo:
                    document.getElementById(
                        "produtoMinimo"
                    ).value,

                unidade:
                    document.getElementById(
                        "produtoUnidade"
                    ).value,

                data_validade:
                    document.getElementById(
                        "produtoValidade"
                    ).value || null,

                tipo_estoque:
                    document.getElementById(
                        "produtoTipoEstoque"
                    ).value,

                componentes_fracionados:
                    obterComponentesFracionadosFormulario(),

                componentes_kit:
                    obterComponentesKitFormulario()
            };


            if (!id) {

                dados.quantidade =
                    document.getElementById(
                        "produtoQuantidade"
                    ).value;

            }


            if (dados.tipo_estoque === "fracionado") {
                if (dados.componentes_fracionados.length < 1) {
                    await modalAviso(
                        "Selecione pelo menos um produto físico que será consumido.",
                        "Produto fracionado"
                    );
                    return;
                }

                if (
                    dados.componentes_fracionados.some(
                        componente =>
                            !Number.isInteger(componente.fator_conversao) ||
                            componente.fator_conversao < 1
                    )
                ) {
                    await modalAviso(
                        "Informe quantas doses cada unidade física rende.",
                        "Fator inválido"
                    );
                    return;
                }

                const idsComponentes =
                    dados.componentes_fracionados.map(
                        componente => componente.produto_estoque_id
                    );

                if (
                    new Set(idsComponentes).size !==
                    idsComponentes.length
                ) {
                    await modalAviso(
                        "Os produtos físicos vinculados precisam ser diferentes.",
                        "Produto duplicado"
                    );
                    return;
                }
            }


            if (dados.tipo_estoque === "kit") {
                if (dados.componentes_kit.length < 1) {
                    await modalAviso(
                        "Selecione pelo menos um produto físico que será retirado do estoque.",
                        "Kit / Combo"
                    );
                    return;
                }

                if (
                    dados.componentes_kit.some(
                        componente =>
                            !Number.isInteger(
                                componente.quantidade_por_venda
                            ) ||
                            componente.quantidade_por_venda < 1
                    )
                ) {
                    await modalAviso(
                        "Informe uma quantidade válida que será retirada do estoque em cada venda do Kit/Combo.",
                        "Quantidade inválida"
                    );
                    return;
                }

                const idsKit =
                    dados.componentes_kit.map(
                        componente =>
                            componente.produto_estoque_id
                    );

                if (
                    new Set(idsKit).size !==
                    idsKit.length
                ) {
                    await modalAviso(
                        "Os produtos físicos do Kit/Combo precisam ser diferentes.",
                        "Produto duplicado"
                    );
                    return;
                }
            }


            const url =
                id
                    ? `/api/produtos/${id}`
                    : "/api/produtos";

            const metodo =
                id
                    ? "PUT"
                    : "POST";


            const resposta =
                await fetch(
                    url,
                    {
                        method: metodo,

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(dados)
                    }
                );


            const resultado =
                await resposta.json();


            if (!resposta.ok) {

                await modalErro(resultado.mensagem || "Erro ao salvar produto");

                return;
            }


            fecharModalProduto();

            await carregarProdutos();

            if (typeof carregarProdutosPDV === "function") {
                await carregarProdutosPDV();
            }

            await carregarResumoEstoque();

        }
    );


function abrirMovimentacao(
    produtoId,
    tipo
) {

    const produto =
        produtosCache.find(
            p => p.id === produtoId
        );

    if (!produto) return;


    document.getElementById(
        "movimentacaoProdutoId"
    ).value = produtoId;

    document.getElementById(
        "movimentacaoTipo"
    ).value = tipo;

    document.getElementById(
        "nomeProdutoMovimentacao"
    ).textContent =
        produto.nome;


    const titulo =
        document.getElementById(
            "tituloMovimentacao"
        );

    const label =
        document.getElementById(
            "labelQuantidadeMovimentacao"
        );


    if (tipo === "entrada") {
        titulo.textContent =
            "Entrada de Estoque";

        label.textContent =
            "Quantidade de entrada";
    }

    if (tipo === "saida") {
        titulo.textContent =
            "Saída Manual";

        label.textContent =
            "Quantidade de saída";
    }

    if (tipo === "perda") {
        titulo.textContent =
            "Registrar Perda";

        label.textContent =
            "Quantidade perdida";
    }

    if (tipo === "ajuste") {
        titulo.textContent =
            "Ajuste de Inventário";

        label.textContent =
            "Quantidade real contada";
    }


    document
        .getElementById(
            "movimentacaoQuantidade"
        )
        .value = "";

    document
        .getElementById(
            "movimentacaoMotivo"
        )
        .value = "";


    document
        .getElementById(
            "modalMovimentacao"
        )
        .classList.add("ativo");
}


function fecharMovimentacao() {

    document
        .getElementById(
            "modalMovimentacao"
        )
        .classList.remove("ativo");
}


document
    .getElementById(
        "formMovimentacao"
    )
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const produtoId =
                document.getElementById(
                    "movimentacaoProdutoId"
                ).value;

            const tipo =
                document.getElementById(
                    "movimentacaoTipo"
                ).value;

            const quantidade =
                document.getElementById(
                    "movimentacaoQuantidade"
                ).value;

            const motivo =
                document.getElementById(
                    "movimentacaoMotivo"
                ).value;


            let dados;


            if (tipo === "ajuste") {

                dados = {
                    produto_id:
                        Number(produtoId),

                    quantidade_real:
                        Number(quantidade),

                    motivo
                };

            } else {

                dados = {
                    produto_id:
                        Number(produtoId),

                    quantidade:
                        Number(quantidade),

                    motivo
                };

            }


            const resposta =
                await fetch(
                    `/api/estoque/${tipo}`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(dados)
                    }
                );


            const resultado =
                await resposta.json();


            if (!resposta.ok) {

                await modalErro(resultado.mensagem || "Erro na movimentação");

                return;
            }


            fecharMovimentacao();

            await carregarProdutos();

            if (
                typeof carregarProdutosPDV ===
                "function"
            ) {
                await carregarProdutosPDV();
            }

            await carregarResumoEstoque();

        }
    );


document
    .getElementById("produtoTipoEstoque")
    .addEventListener(
        "change",
        atualizarPreviaFracionado
    );

[
    "produtoEstoqueVinculado",
    "produtoEstoqueVinculado2",
    "produtoEstoqueVinculado3",
    "produtoFatorConversao",
    "produtoFatorConversao2",
    "produtoFatorConversao3",
    "produtoKitEstoqueVinculado",
    "produtoKitEstoqueVinculado2",
    "produtoKitEstoqueVinculado3",
    "produtoKitQuantidade",
    "produtoKitQuantidade2",
    "produtoKitQuantidade3"
].forEach(id => {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.addEventListener(
            (id.includes("Fator") || id.includes("Quantidade"))
                ? "input"
                : "change",
            atualizarPreviaFracionado
        );
    }
});


document
    .getElementById("btnNovoProduto")
    .addEventListener(
        "click",
        async () => {

            await carregarCategorias();

            abrirModalProduto();

        }
    );


document
    .getElementById(
        "fecharModalProduto"
    )
    .addEventListener(
        "click",
        fecharModalProduto
    );


document
    .getElementById(
        "cancelarProduto"
    )
    .addEventListener(
        "click",
        fecharModalProduto
    );


document
    .getElementById(
        "fecharModalMovimentacao"
    )
    .addEventListener(
        "click",
        fecharMovimentacao
    );


document
    .getElementById(
        "cancelarMovimentacao"
    )
    .addEventListener(
        "click",
        fecharMovimentacao
    );


document
    .getElementById(
        "pesquisaProduto"
    )
    .addEventListener(
        "input",
        renderizarProdutos
    );


document
    .getElementById(
        "filtroEstoque"
    )
    .addEventListener(
        "change",
        renderizarProdutos
    );


carregarProdutos();
carregarCategorias();

let caixaAtual = null;


// ===============================
// CARREGAR CAIXA
// ===============================

async function carregarCaixa() {

    try {

        const resposta =
            await fetch("/api/caixa/aberto");

        const dados =
            await resposta.json();


        caixaAtual = dados;


        if (!dados.aberto) {

            atualizarCaixaFechado();

            return;
        }


        const resumo =
            dados.resumo;


        document.getElementById(
            "caixaValorInicial"
        ).textContent =
            formatarDinheiro(
                resumo.valor_inicial
            );


        document.getElementById(
            "caixaTotalVendas"
        ).textContent =
            formatarDinheiro(
                resumo.total_vendas
            );


        document.getElementById(
            "caixaDinheiroEsperado"
        ).textContent =
            formatarDinheiro(
                resumo.dinheiro_esperado
            );


        document.getElementById(
            "caixaDinheiro"
        ).textContent =
            formatarDinheiro(
                resumo.vendas_dinheiro
            );


        document.getElementById(
            "caixaPix"
        ).textContent =
            formatarDinheiro(
                resumo.vendas_pix
            );


        document.getElementById(
            "caixaDebito"
        ).textContent =
            formatarDinheiro(
                resumo.vendas_debito
            );


        document.getElementById(
            "caixaCredito"
        ).textContent =
            formatarDinheiro(
                resumo.vendas_credito
            );


        document.getElementById(
            "caixaStatusCard"
        ).textContent =
            "Aberto";


        document.getElementById(
            "statusCaixa"
        ).textContent =
            "Aberto";


        document.querySelector(
            ".bolinha-caixa"
        ).style.background =
            "var(--verde)";


        const data =
            new Date(
                dados.caixa.data_abertura
                    .replace(" ", "T") + "Z"
            );


        document.getElementById(
            "caixaDataAbertura"
        ).textContent =
            `Aberto por ${dados.caixa.usuario_abertura_nome || "usuário não registrado"} • ` +
            data.toLocaleString("pt-BR");


        document.getElementById(
            "btnAbrirCaixa"
        ).disabled = true;


        document.getElementById(
            "btnSuprimento"
        ).disabled = false;


        document.getElementById(
            "btnSangria"
        ).disabled = false;


        const btnFecharCaixa =
            document.getElementById(
                "btnFecharCaixa"
            );

        btnFecharCaixa.disabled =
            dados.pode_fechar === false;

        btnFecharCaixa.title =
            dados.pode_fechar === false
                ? `Caixa aberto por ${dados.caixa.usuario_abertura_nome || "outro usuário"}. Somente ele ou um administrador pode fechar.`
                : "Fechar caixa";


        await carregarMovimentacoesCaixa();

    } catch (erro) {

        console.error(
            "Erro ao carregar caixa:",
            erro
        );

    }
}


// ===============================
// CAIXA FECHADO
// ===============================

function atualizarCaixaFechado() {

    document.getElementById(
        "caixaValorInicial"
    ).textContent =
        formatarDinheiro(0);


    document.getElementById(
        "caixaTotalVendas"
    ).textContent =
        formatarDinheiro(0);


    document.getElementById(
        "caixaDinheiroEsperado"
    ).textContent =
        formatarDinheiro(0);


    document.getElementById(
        "caixaDinheiro"
    ).textContent =
        formatarDinheiro(0);


    document.getElementById(
        "caixaPix"
    ).textContent =
        formatarDinheiro(0);


    document.getElementById(
        "caixaDebito"
    ).textContent =
        formatarDinheiro(0);


    document.getElementById(
        "caixaCredito"
    ).textContent =
        formatarDinheiro(0);


    document.getElementById(
        "caixaStatusCard"
    ).textContent =
        "Fechado";


    document.getElementById(
        "caixaDataAbertura"
    ).textContent =
        "Nenhum caixa aberto";


    document.getElementById(
        "statusCaixa"
    ).textContent =
        "Fechado";


    document.querySelector(
        ".bolinha-caixa"
    ).style.background =
        "var(--vermelho)";


    document.getElementById(
        "btnAbrirCaixa"
    ).disabled = false;


    document.getElementById(
        "btnSuprimento"
    ).disabled = true;


    document.getElementById(
        "btnSangria"
    ).disabled = true;


    document.getElementById(
        "btnFecharCaixa"
    ).disabled = true;


    document.getElementById(
        "tabelaMovimentacoesCaixa"
    ).innerHTML = `
        <tr>
            <td colspan="4">
                Nenhum caixa aberto.
            </td>
        </tr>
    `;
}


// ===============================
// ABRIR CAIXA
// ===============================

document.getElementById(
    "btnAbrirCaixa"
).addEventListener(
    "click",
    () => {

        document.getElementById(
            "modalAbrirCaixa"
        ).classList.add("ativo");

    }
);


document.getElementById(
    "formAbrirCaixa"
).addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const valor =
            Number(
                document.getElementById(
                    "valorInicialCaixa"
                ).value
            );


        const resposta =
            await fetch(
                "/api/caixa/abrir",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            valor_inicial: valor
                        })
                }
            );


        const resultado =
            await resposta.json();


        if (!resposta.ok) {

            await modalErro(resultado.mensagem || "Erro ao abrir caixa");

            return;
        }


        document.getElementById(
            "modalAbrirCaixa"
        ).classList.remove("ativo");


        await carregarCaixa();

    }
);


// ===============================
// SUPRIMENTO / SANGRIA
// ===============================

function abrirMovimentoCaixa(tipo) {

    const titulo =
        document.getElementById(
            "tituloMovimentoCaixa"
        );


    if (tipo === "suprimento") {

        titulo.textContent =
            "Suprimento";

        document.getElementById(
            "descricaoMovimentoCaixa"
        ).textContent =
            "Adicionar dinheiro ao caixa";

    }


    if (tipo === "sangria") {

        titulo.textContent =
            "Sangria";

        document.getElementById(
            "descricaoMovimentoCaixa"
        ).textContent =
            "Retirar dinheiro do caixa";

    }


    document.getElementById(
        "tipoMovimentoCaixa"
    ).value = tipo;


    document.getElementById(
        "valorMovimentoCaixa"
    ).value = "";


    document.getElementById(
        "motivoMovimentoCaixa"
    ).value = "";


    document.getElementById(
        "modalMovimentoCaixa"
    ).classList.add("ativo");
}


document.getElementById(
    "btnSuprimento"
).addEventListener(
    "click",
    () => abrirMovimentoCaixa(
        "suprimento"
    )
);


document.getElementById(
    "btnSangria"
).addEventListener(
    "click",
    () => abrirMovimentoCaixa(
        "sangria"
    )
);


document.getElementById(
    "formMovimentoCaixa"
).addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const tipo =
            document.getElementById(
                "tipoMovimentoCaixa"
            ).value;


        const valor =
            Number(
                document.getElementById(
                    "valorMovimentoCaixa"
                ).value
            );


        const descricao =
            document.getElementById(
                "motivoMovimentoCaixa"
            ).value;


        const resposta =
            await fetch(
                `/api/caixa/${tipo}`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            valor,
                            descricao
                        })
                }
            );


        const resultado =
            await resposta.json();


        if (!resposta.ok) {

            await modalErro(resultado.mensagem || "Erro na movimentação");

            return;
        }


        document.getElementById(
            "modalMovimentoCaixa"
        ).classList.remove("ativo");


        await carregarCaixa();

    }
);


// ===============================
// MOVIMENTAÇÕES
// ===============================

async function carregarMovimentacoesCaixa() {

    const resposta =
        await fetch(
            "/api/caixa/movimentacoes"
        );


    const movimentacoes =
        await resposta.json();


    const tbody =
        document.getElementById(
            "tabelaMovimentacoesCaixa"
        );


    if (movimentacoes.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="4">
                    Nenhuma movimentação.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        movimentacoes.map(mov => {

            let nomeTipo =
                mov.tipo;

            if (mov.tipo === "abertura") {
                nomeTipo = "Abertura";
            }

            if (mov.tipo === "suprimento") {
                nomeTipo = "Suprimento";
            }

            if (mov.tipo === "sangria") {
                nomeTipo = "Sangria";
            }


            return `
                <tr>

                    <td>
                        ${nomeTipo}
                    </td>

                    <td>
                        ${mov.descricao || "-"}
                    </td>

                    <td>
                        ${formatarDinheiro(
                            mov.valor
                        )}
                    </td>

                    <td>
                        ${formatarDataBanco(
                            mov.criado_em
                        )}
                    </td>

                </tr>
            `;

        }).join("");
}


// ===============================
// FECHAR CAIXA
// ===============================

document.getElementById(
    "btnFecharCaixa"
).addEventListener(
    "click",
    () => {

        if (
            !caixaAtual ||
            !caixaAtual.aberto
        ) {
            return;
        }

        if (caixaAtual.pode_fechar === false) {
            modalAviso(
                `Este caixa foi aberto por ${caixaAtual.caixa?.usuario_abertura_nome || "outro usuário"}. Somente esse usuário ou um administrador pode fechá-lo.`
            );
            return;
        }


        const esperado =
            caixaAtual.resumo
                .dinheiro_esperado;


        document.getElementById(
            "fechamentoEsperado"
        ).textContent =
            formatarDinheiro(
                esperado
            );


        document.getElementById(
            "valorContadoCaixa"
        ).value = "";


        atualizarPreviewDiferenca();


        document.getElementById(
            "modalFecharCaixa"
        ).classList.add("ativo");

        carregarResumoFechamento();

    }
);


document.getElementById(
    "valorContadoCaixa"
).addEventListener(
    "input",
    atualizarPreviewDiferenca
);


function atualizarPreviewDiferenca() {

    const elemento =
        document.getElementById(
            "previewDiferencaCaixa"
        );


    if (
        !caixaAtual ||
        !caixaAtual.aberto
    ) {

        elemento.textContent =
            formatarDinheiro(0);

        return;
    }


    const esperado =
        Number(
            caixaAtual.resumo
                .dinheiro_esperado
        );


    const contado =
        Number(
            document.getElementById(
                "valorContadoCaixa"
            ).value || 0
        );


    const diferenca =
        contado - esperado;


    elemento.textContent =
        formatarDinheiro(
            diferenca
        );


    elemento.classList.remove(
        "diferenca-positiva",
        "diferenca-negativa"
    );


    if (diferenca > 0) {

        elemento.classList.add(
            "diferenca-positiva"
        );

    }


    if (diferenca < 0) {

        elemento.classList.add(
            "diferenca-negativa"
        );

    }
}


document.getElementById(
    "formFecharCaixa"
).addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const valorContado =
            Number(
                document.getElementById(
                    "valorContadoCaixa"
                ).value
            );


        const resposta =
            await fetch(
                "/api/caixa/fechar",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            valor_contado:
                                valorContado
                        })
                }
            );


        const resultado =
            await resposta.json();


        if (!resposta.ok) {

            await modalErro(resultado.mensagem || "Erro ao fechar caixa");

            return;
        }


        document.getElementById(
            "modalFecharCaixa"
        ).classList.remove("ativo");


        await mostrarModalSistema({
            tipo: "sucesso",
            titulo: "Caixa fechado com sucesso!",
            mensagem: "A conferência do caixa foi concluída.",
            detalhes: `Aberto por: ${resultado.aberto_por || "Não registrado"}\nFechado por: ${resultado.fechado_por || "-"}\nEsperado: ${formatarDinheiro(resultado.valor_esperado)}\nContado: ${formatarDinheiro(resultado.valor_contado)}\nDiferença: ${formatarDinheiro(resultado.diferenca)}`,
            confirmarTexto: "OK"
        });

        if (resultado.caixa_id) {

            const link =
                document.createElement("a");

            link.href =
                `/api/caixa/${resultado.caixa_id}/pdf`;

            link.download =
                `fechamento-caixa-${resultado.caixa_id}.pdf`;

            document.body.appendChild(link);

            link.click();

            link.remove();
        }

        caixaAtual = null;

        await carregarCaixa();

    }
);


// ===============================
// DATAS
// ===============================

function formatarDataBanco(data) {

    if (!data) {
        return "-";
    }

    const convertido =
        new Date(
            data.replace(" ", "T") + "Z"
        );

    return convertido.toLocaleString(
        "pt-BR"
    );
}


// ===============================
// FECHAR MODAIS
// ===============================

function fecharModal(id) {

    document.getElementById(id)
        .classList.remove("ativo");
}


document.getElementById(
    "fecharModalAbrirCaixa"
).addEventListener(
    "click",
    () =>
        fecharModal(
            "modalAbrirCaixa"
        )
);


document.getElementById(
    "cancelarAbrirCaixa"
).addEventListener(
    "click",
    () =>
        fecharModal(
            "modalAbrirCaixa"
        )
);


document.getElementById(
    "fecharModalMovimentoCaixa"
).addEventListener(
    "click",
    () =>
        fecharModal(
            "modalMovimentoCaixa"
        )
);


document.getElementById(
    "cancelarMovimentoCaixa"
).addEventListener(
    "click",
    () =>
        fecharModal(
            "modalMovimentoCaixa"
        )
);


document.getElementById(
    "fecharModalFecharCaixa"
).addEventListener(
    "click",
    () =>
        fecharModal(
            "modalFecharCaixa"
        )
);


document.getElementById(
    "cancelarFecharCaixa"
).addEventListener(
    "click",
    () =>
        fecharModal(
            "modalFecharCaixa"
        )
);


carregarCaixa();

let produtosPDV = [];
let carrinhoPDV = [];
let comandaAtivaPDV = null;
let detalhesComandaAbertaId = null;
let produtosMaisVendidosPDV = [];
let favoritosPDV = new Set(
    JSON.parse(localStorage.getItem("adega-pdv-favoritos") || "[]").map(Number)
);

function normalizarBuscaPDV(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function salvarFavoritosPDV() {
    localStorage.setItem(
        "adega-pdv-favoritos",
        JSON.stringify([...favoritosPDV])
    );
}

function alternarFavoritoPDV(produtoId, evento) {
    if (evento) {
        evento.preventDefault();
        evento.stopPropagation();
    }

    produtoId = Number(produtoId);

    if (favoritosPDV.has(produtoId)) {
        favoritosPDV.delete(produtoId);
    } else {
        favoritosPDV.add(produtoId);
    }

    salvarFavoritosPDV();
    renderizarDestaquesPDV();
    renderizarProdutosPDV();
}

window.alternarFavoritoPDV = alternarFavoritoPDV;


// ==========================================
// INICIAR PDV
// ==========================================

async function carregarPDV() {
    await Promise.all([
        carregarProdutosPDV(),
        carregarTiposVendaPDV(),
        carregarDestaquesPDV()
    ]);

    atualizarCarrinhoPDV();

    if (
        configBool(
            configuracoesSistema?.pdv_foco_busca,
            true
        )
    ) {
        setTimeout(() => {
            document
                .getElementById("pesquisaPDV")
                ?.focus();
        }, 80);
    }
}


// ==========================================
// PRODUTOS
// ==========================================

async function carregarProdutosPDV() {

    iniciarSkeleton(
        document.getElementById(
            "listaProdutosPDV"
        ),
        "cards",
        6
    );

    try {
        const resposta =
            await fetch("/api/produtos");

        produtosPDV =
            await resposta.json();

        // Se o estoque mudou enquanto havia itens no carrinho,
        // atualiza os limites locais para não trabalhar com quantidade antiga.
        if (Array.isArray(carrinhoPDV) && carrinhoPDV.length) {
            const ajustado = [];

            for (const item of carrinhoPDV) {
                const produtoAtual =
                    produtosPDV.find(
                        produto =>
                            Number(produto.id) ===
                            Number(item.produto_id)
                    );

                if (!produtoAtual) {
                    continue;
                }

                const estoqueAtual =
                    estoqueDisponivelPDV(
                        produtoAtual
                    );

                if (estoqueAtual <= 0) {
                    continue;
                }

                item.estoque =
                    estoqueAtual;

                if (
                    Number(item.quantidade) >
                    estoqueAtual
                ) {
                    item.quantidade =
                        estoqueAtual;
                }

                ajustado.push(item);
            }

            carrinhoPDV =
                ajustado;

            atualizarCarrinhoPDV();
        }

        renderizarProdutosPDV();

    } catch (erro) {
        console.error(
            "Erro ao carregar produtos do PDV:",
            erro
        );
    }
}


function estoqueDisponivelPDV(produto) {
    if (!produto) {
        return 0;
    }

    if (
        ["fracionado", "kit"].includes(
            produto.tipo_estoque || "normal"
        )
    ) {
        return Math.max(
            0,
            Number(produto.quantidade || 0)
        );
    }

    return Math.max(
        0,
        Number(
            produto.quantidade_venda ??
            produto.quantidade ??
            0
        )
    );
}


function obterTextoEstoquePDV(produto) {
    const quantidade =
        estoqueDisponivelPDV(
            produto
        );

    if (
        (produto.tipo_estoque || "normal") ===
        "fracionado"
    ) {
        const limitante =
            produto.ingrediente_limitante;

        return limitante
            ? `${quantidade} doses — limitado por ${limitante}`
            : `${quantidade} doses disponíveis`;
    }

    if (
        (produto.tipo_estoque || "normal") ===
        "kit"
    ) {
        const limitante =
            produto.componente_limitante;

        return limitante
            ? `${quantidade} Kit(s)/Combo(s) — limitado por ${limitante}`
            : `${quantidade} Kit(s)/Combo(s) disponíveis`;
    }

    const quantidadeFisica =
        Math.max(
            0,
            Number(produto.quantidade || 0)
        );

    if (
        produto.possui_unidade_parcial &&
        quantidadeFisica >
        quantidade
    ) {
        return `Disponível: ${quantidade} • físico: ${quantidadeFisica}`;
    }

    return `Estoque: ${quantidade}`;
}


function renderizarProdutosPDV() {
    finalizarSkeleton(
        document.getElementById(
            "listaProdutosPDV"
        )
    );

    const campoPesquisa = document.getElementById("pesquisaPDV");
    const pesquisa = normalizarBuscaPDV(campoPesquisa?.value);

    const idsMaisVendidos = new Map(
        produtosMaisVendidosPDV.map((produto, indice) => [
            Number(produto.id),
            indice
        ])
    );

    const produtosFiltrados = produtosPDV
        .filter(produto => {
            if (!pesquisa) return true;

            const texto = normalizarBuscaPDV([
                produto.nome,
                produto.codigo_barras,
                produto.categoria_nome,
                produto.categoria
            ].filter(Boolean).join(" "));

            return texto.includes(pesquisa);
        })
        .sort((a, b) => {
            const favA = favoritosPDV.has(Number(a.id)) ? 1 : 0;
            const favB = favoritosPDV.has(Number(b.id)) ? 1 : 0;
            if (favA !== favB) return favB - favA;

            const rankA = idsMaisVendidos.has(Number(a.id))
                ? idsMaisVendidos.get(Number(a.id))
                : 9999;
            const rankB = idsMaisVendidos.has(Number(b.id))
                ? idsMaisVendidos.get(Number(b.id))
                : 9999;

            if (rankA !== rankB) return rankA - rankB;

            return String(a.nome).localeCompare(String(b.nome), "pt-BR");
        });

    const contador = document.getElementById("contadorResultadosPDV");
    if (contador) {
        contador.textContent =
            `${produtosFiltrados.length} produto${produtosFiltrados.length === 1 ? "" : "s"}`;
    }

    const lista = document.getElementById("listaProdutosPDV");

    if (produtosFiltrados.length === 0) {
        lista.innerHTML = `
            <div class="pagina-vazia">
                Nenhum produto encontrado.
            </div>
        `;
        return;
    }

    lista.innerHTML = produtosFiltrados.map(produto => {
        const quantidade = estoqueDisponivelPDV(produto);
        const minimo = Number(produto.estoque_minimo || 0);
        const semEstoque = quantidade <= 0;
        const estoqueBaixo = !semEstoque && quantidade <= minimo;
        const favorito = favoritosPDV.has(Number(produto.id));

        return `
            <div
                class="produto-pdv ${semEstoque ? "sem-estoque" : ""} ${estoqueBaixo ? "estoque-baixo" : ""}"
                ${semEstoque ? "" : `onclick="adicionarAoCarrinho(${produto.id})"`}
            >
                <button
                    type="button"
                    class="pdv-favorito-btn"
                    title="${favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}"
                    onclick="alternarFavoritoPDV(${produto.id}, event)"
                >${favorito ? "♥" : "♡"}</button>

                <h3>${produto.nome}</h3>

                <span class="codigo">
                    ${produto.codigo_barras || ""}
                </span>

                <div class="produto-pdv-rodape">
                    <span class="preco">
                        ${formatarDinheiro(produto.preco_venda)}
                    </span>

                    <span class="estoque ${estoqueBaixo ? "estoque-alerta" : ""}">
                        ${obterTextoEstoquePDV(produto)}
                    </span>
                </div>
            </div>
        `;
    }).join("");
}


async function carregarDestaquesPDV() {
    try {
        const resposta = await fetch("/api/vendas/pdv/destaques");
        const dados = await resposta.json();

        produtosMaisVendidosPDV =
            resposta.ok && dados.sucesso
                ? (dados.produtos || [])
                : [];

        renderizarDestaquesPDV();
        renderizarProdutosPDV();
    } catch (erro) {
        console.error("Erro ao carregar destaques do PDV:", erro);
        produtosMaisVendidosPDV = [];
        renderizarDestaquesPDV();
    }
}


function renderizarDestaquesPDV() {
    const area = document.getElementById("listaDestaquesPDV");
    const painel = document.getElementById("pdvDestaques");

    if (!area || !painel) return;

    const favoritos = produtosPDV
        .filter(produto => favoritosPDV.has(Number(produto.id)));

    const mapa = new Map();

    favoritos.forEach(produto => {
        mapa.set(Number(produto.id), produto);
    });

    produtosMaisVendidosPDV.forEach(destaque => {
        if (mapa.has(Number(destaque.id))) return;

        const produtoCompleto = produtosPDV.find(
            produto => Number(produto.id) === Number(destaque.id)
        );

        if (produtoCompleto) {
            mapa.set(Number(produtoCompleto.id), produtoCompleto);
        }
    });

    const destaques = [...mapa.values()];

    const habilitado =
        configuracoesSistema
            ? configBool(
                configuracoesSistema.pdv_exibir_destaques,
                true
            )
            : true;

    const limite = Math.max(
        1,
        Math.min(
            12,
            Number(
                configuracoesSistema
                    ?.pdv_quantidade_destaques ??
                8
            )
        )
    );

    const destaquesVisiveis =
        destaques.slice(0, limite);

    painel.style.display =
        habilitado &&
        destaquesVisiveis.length
            ? ""
            : "none";

    if (
        !habilitado ||
        !destaquesVisiveis.length
    ) {
        area.innerHTML = "";
        return;
    }

    area.innerHTML = destaquesVisiveis.map(produto => {
        const semEstoque = estoqueDisponivelPDV(produto) <= 0;
        const favorito = favoritosPDV.has(Number(produto.id));

        return `
            <div
                class="pdv-destaque-produto ${semEstoque ? "sem-estoque" : ""}"
                ${semEstoque ? "" : `onclick="adicionarAoCarrinho(${produto.id})"`}
            >
                <button
                    type="button"
                    class="pdv-favorito-btn"
                    title="${favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}"
                    onclick="alternarFavoritoPDV(${produto.id}, event)"
                >${favorito ? "♥" : "♡"}</button>

                <strong>${produto.nome}</strong>
                <span class="preco">${formatarDinheiro(produto.preco_venda)}</span>

                ${
                    (produto.tipo_estoque || "normal") === "fracionado" &&
                    produto.ingrediente_limitante
                        ? `
                            <small class="pdv-limitante">
                                ${Number(produto.quantidade || 0)} doses — limitado por ${produto.ingrediente_limitante}
                            </small>
                        `
                        : (produto.tipo_estoque || "normal") === "kit" &&
                          produto.componente_limitante
                            ? `
                                <small class="pdv-limitante">
                                    ${Number(produto.quantidade || 0)} Kit(s)/Combo(s) — limitado por ${produto.componente_limitante}
                                </small>
                            `
                            : ""
                }
            </div>
        `;
    }).join("");
}


async function repetirUltimaVendaPDV() {
    if (comandaAtivaPDV) {
        await modalAviso(
            "Saia da comanda atual antes de repetir uma venda anterior.",
            "Comanda ativa"
        );
        return;
    }

    try {
        const resposta = await fetch("/api/vendas/ultima/repetir");
        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
            throw new Error(
                dados.mensagem || "Não foi possível carregar a última venda."
            );
        }

        const itensDisponiveis = [];
        const problemas = [];

        for (const itemVenda of dados.itens || []) {
            const produto = produtosPDV.find(
                produto => Number(produto.id) === Number(itemVenda.produto_id)
            );

            if (!produto) {
                problemas.push(`${itemVenda.nome}: produto não encontrado`);
                continue;
            }

            const desejado = Number(itemVenda.quantidade || 0);
            const estoque = estoqueDisponivelPDV(produto);

            if (estoque <= 0) {
                problemas.push(`${produto.nome}: sem estoque`);
                continue;
            }

            const quantidade = Math.min(desejado, estoque);

            itensDisponiveis.push({
                produto_id: Number(produto.id),
                nome: produto.nome,
                preco: Number(produto.preco_venda),
                quantidade,
                estoque
            });

            if (quantidade < desejado) {
                problemas.push(
                    `${produto.nome}: solicitado ${desejado}, disponível ${estoque}`
                );
            }
        }

        if (!itensDisponiveis.length) {
            await modalAviso(
                "Nenhum item da última venda está disponível em estoque.",
                "Não foi possível repetir"
            );
            return;
        }

        const confirmar = await modalConfirmar(
            `A venda #${dados.venda.id} será carregada no carrinho com os preços atuais.${problemas.length ? `\n\nAtenção:\n${problemas.join("\n")}` : ""}`,
            "Repetir última venda",
            "Carregar no carrinho"
        );

        if (!confirmar) return;

        carrinhoPDV = itensDisponiveis;

        const tipoVenda = document.getElementById("tipoVendaPDV");
        if (
            tipoVenda &&
            [...tipoVenda.options].some(
                opcao => Number(opcao.value) === Number(dados.venda.tipo_venda_id)
            )
        ) {
            tipoVenda.value = String(dados.venda.tipo_venda_id);
        }

        document.getElementById("descontoPDV").value = 0;
        document.getElementById("valorRecebidoPDV").value = "";

        // Ao repetir uma venda, os itens são reaproveitados,
        // mas a forma de pagamento NÃO é repetida.
        document.getElementById("usarPagamentoDivididoPDV").checked = false;
        document.getElementById("formaPagamentoPDV").value = "dinheiro";
        document.getElementById("valorPrimeiroPagamentoPDV").value = "";
        document.getElementById("segundaFormaPagamentoPDV").value = "pix";
        document.getElementById("pagamentoDivididoBoxPDV").style.display = "none";

        atualizarCarrinhoPDV();

        if (problemas.length) {
            await modalAviso(
                `A venda foi carregada com ajustes de estoque:\n\n${problemas.join("\n")}`,
                "Venda carregada com atenção"
            );
        }

    } catch (erro) {
        await modalErro(erro.message, "Não foi possível repetir");
    }
}


// ==========================================
// ADICIONAR CARRINHO
// ==========================================

function adicionarAoCarrinho(produtoId) {
    const produto =
        produtosPDV.find(
            item =>
                item.id === produtoId
        );


    if (!produto) {
        return;
    }


    const estoqueDisponivel =
        estoqueDisponivelPDV(
            produto
        );

    if (estoqueDisponivel <= 0) {
        modalAviso("Este produto está sem estoque disponível para venda.", "Produto indisponível");
        return;
    }


    const itemExistente =
        carrinhoPDV.find(
            item =>
                item.produto_id === produtoId
        );


    if (itemExistente) {

        if (
            itemExistente.quantidade >=
            estoqueDisponivel
        ) {
            modalAviso("Quantidade máxima disponível em estoque atingida.", "Limite de estoque");

            return;
        }


        itemExistente.quantidade++;

    } else {

        carrinhoPDV.push({
            produto_id: produto.id,
            nome: produto.nome,
            preco: Number(
                produto.preco_venda
            ),
            quantidade: 1,
            estoque:
                estoqueDisponivel
        });
    }


    produtoCarrinhoSelecionadoPDV =
        Number(produtoId);

    atualizarCarrinhoPDV();
}


// ==========================================
// ALTERAR QUANTIDADE
// ==========================================

function alterarQuantidadeCarrinho(
    produtoId,
    diferenca
) {

    const item =
        carrinhoPDV.find(
            produto =>
                produto.produto_id ===
                produtoId
        );


    if (!item) {
        return;
    }


    const novaQuantidade =
        item.quantidade +
        diferenca;


    if (novaQuantidade <= 0) {

        removerDoCarrinho(
            produtoId
        );

        return;
    }


    if (
        novaQuantidade >
        item.estoque
    ) {
        modalAviso("A quantidade solicitada é maior que o estoque disponível.", "Estoque insuficiente");

        return;
    }


    item.quantidade =
        novaQuantidade;


    atualizarCarrinhoPDV();
}


// ==========================================
// REMOVER ITEM
// ==========================================

function removerDoCarrinho(produtoId) {

    carrinhoPDV =
        carrinhoPDV.filter(
            item =>
                item.produto_id !==
                produtoId
        );


    atualizarCarrinhoPDV();
}


// ==========================================
// LIMPAR CARRINHO
// ==========================================

document.getElementById(
    "btnLimparCarrinho"
).addEventListener(
    "click",
    async () => {

        if (
            carrinhoPDV.length === 0
        ) {
            return;
        }


        const confirmar = await modalConfirmar(
            `Os ${carrinhoPDV.reduce((total, item) => total + item.quantidade, 0)} itens adicionados serão removidos da venda atual.`,
            "Limpar carrinho?",
            "Limpar"
        );


        if (!confirmar) {
            return;
        }


        carrinhoPDV = [];

        atualizarCarrinhoPDV();
    }
);


// ==========================================
// RENDERIZAR CARRINHO
// ==========================================

let produtoCarrinhoSelecionadoPDV = null;


function selecionarItemCarrinhoPDV(
    indiceOuProdutoId,
    porProdutoId = false
) {
    if (!carrinhoPDV.length) {
        produtoCarrinhoSelecionadoPDV =
            null;
        return;
    }

    let indice;

    if (porProdutoId) {
        indice =
            carrinhoPDV.findIndex(
                item =>
                    Number(
                        item.produto_id
                    ) ===
                    Number(
                        indiceOuProdutoId
                    )
            );
    } else {
        indice =
            Number(
                indiceOuProdutoId
            );
    }

    if (
        !Number.isFinite(indice) ||
        indice < 0
    ) {
        indice = 0;
    }

    if (
        indice >=
        carrinhoPDV.length
    ) {
        indice =
            carrinhoPDV.length - 1;
    }

    produtoCarrinhoSelecionadoPDV =
        carrinhoPDV[indice]
            .produto_id;

    document
        .querySelectorAll(
            ".item-carrinho"
        )
        .forEach(
            elemento => {
                const selecionado =
                    Number(
                        elemento.dataset
                            .produtoId
                    ) ===
                    Number(
                        produtoCarrinhoSelecionadoPDV
                    );

                elemento.classList.toggle(
                    "selecionado-teclado",
                    selecionado
                );

                if (selecionado) {
                    elemento.scrollIntoView({
                        block: "nearest",
                        behavior: "smooth"
                    });
                }
            }
        );
}


function obterIndiceCarrinhoSelecionadoPDV() {
    if (!carrinhoPDV.length) {
        return -1;
    }

    let indice =
        carrinhoPDV.findIndex(
            item =>
                Number(
                    item.produto_id
                ) ===
                Number(
                    produtoCarrinhoSelecionadoPDV
                )
        );

    if (indice < 0) {
        indice = 0;

        produtoCarrinhoSelecionadoPDV =
            carrinhoPDV[0]
                .produto_id;
    }

    return indice;
}


function atualizarCarrinhoPDV() {
    const container =
        document.getElementById(
            "carrinhoItens"
        );

    const contadorItens =
        document.getElementById(
            "quantidadeItensCarrinho"
        );

    const quantidadeTotal =
        carrinhoPDV.reduce(
            (total, item) =>
                total +
                item.quantidade,
            0
        ) +
        Number(
            comandaAtivaPDV?.quantidade_itens ||
            0
        );

    if (contadorItens) {
        contadorItens.textContent =
            quantidadeTotal === 1
                ? "1 item"
                : `${quantidadeTotal} itens`;
    }

    // O carrinho visual pode ainda não estar montado em uma troca de tela.
    // Nesse caso os dados continuam válidos e os totais são atualizados
    // sem interromper a abertura da comanda.
    if (container) {
        if (carrinhoPDV.length === 0) {
            container.innerHTML = `
                <div class="carrinho-vazio">
                    Nenhum produto adicionado.
                </div>
            `;
        } else {
            container.innerHTML =
                carrinhoPDV
                    .map(item => {
                        const subtotal =
                            item.preco *
                            item.quantidade;

                        return `
                            <div
                                class="item-carrinho${item.produto_id === produtoCarrinhoSelecionadoPDV ? " selecionado-teclado" : ""}"
                                data-produto-id="${item.produto_id}"
                                tabindex="-1"
                            >
                                <div class="item-carrinho-topo">
                                    <strong>${item.nome}</strong>
                                    <button
                                        onclick="removerDoCarrinho(${item.produto_id})"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div class="item-carrinho-info">
                                    <div class="controle-quantidade">
                                        <button
                                            onclick="alterarQuantidadeCarrinho(${item.produto_id}, -1)"
                                        >
                                            −
                                        </button>

                                        <span>${item.quantidade}</span>

                                        <button
                                            onclick="alterarQuantidadeCarrinho(${item.produto_id}, 1)"
                                        >
                                            +
                                        </button>
                                    </div>

                                    <span class="item-subtotal">
                                        ${formatarDinheiro(subtotal)}
                                    </span>
                                </div>
                            </div>
                        `;
                    })
                    .join("");
        }

        if (
            carrinhoPDV.length &&
            produtoCarrinhoSelecionadoPDV !== null
        ) {
            selecionarItemCarrinhoPDV(
                produtoCarrinhoSelecionadoPDV,
                true
            );
        }
    }

    atualizarTotaisPDV();
}


// ==========================================
// TOTAIS
// ==========================================

function calcularSubtotalPDV() {

    const subtotalCarrinho =
        carrinhoPDV.reduce(
            (total, item) =>
                total +
                (
                    item.preco *
                    item.quantidade
                ),
            0
        );

    return Number(
        (
            subtotalCarrinho +
            Number(
                comandaAtivaPDV?.subtotal ||
                0
            )
        ).toFixed(2)
    );
}


function atualizarTotaisPDV() {
    const subtotal =
        calcularSubtotalPDV();

    const descontoInput =
        document.getElementById(
            "descontoPDV"
        );

    let desconto =
        Number(
            descontoInput?.value ||
            0
        );

    if (desconto < 0) {
        desconto = 0;
    }

    const permitirDesconto =
        configBool(
            configuracoesSistema
                ?.pdv_permitir_desconto,
            true
        );

    if (!permitirDesconto) {
        desconto = 0;
    }

    const limitePercentual =
        Number(
            configuracoesSistema
                ?.pdv_desconto_maximo_percentual ??
            100
        );

    const limiteValor =
        subtotal *
        (limitePercentual / 100);

    if (desconto > limiteValor) {
        desconto = limiteValor;
    }

    if (desconto > subtotal) {
        desconto = subtotal;
    }

    const total =
        subtotal - desconto;

    const subtotalEl =
        document.getElementById(
            "subtotalPDV"
        );

    const descontoResumoEl =
        document.getElementById(
            "descontoResumoPDV"
        );

    const totalEl =
        document.getElementById(
            "totalPDV"
        );

    const finalizarEl =
        document.getElementById(
            "btnFinalizarVenda"
        );

    if (subtotalEl) {
        subtotalEl.textContent =
            formatarDinheiro(
                subtotal
            );
    }

    if (descontoResumoEl) {
        descontoResumoEl.textContent =
            formatarDinheiro(
                desconto
            );
    }

    if (totalEl) {
        totalEl.textContent =
            formatarDinheiro(
                total
            );
    }

    // Só chama o módulo de pagamento dividido quando a interface
    // correspondente está presente.
    if (
        document.getElementById(
            "pagamentoDivididoContainer"
        ) ||
        document.getElementById(
            "formaPagamentoPDV"
        )
    ) {
        atualizarPagamentoDivididoPDV();
    }

    if (finalizarEl) {
        finalizarEl.disabled =
            carrinhoPDV.length === 0 &&
            !comandaAtivaPDV?.quantidade_itens;
    }

    atualizarBannerComandaPDV();
}


// ==========================================
// PAGAMENTO / TROCO
// ==========================================

function calcularTotalPDV() {
    const subtotal = calcularSubtotalPDV();
    const desconto = Number(
        document.getElementById("descontoPDV").value || 0
    );

    return Number(
        Math.max(0, subtotal - desconto).toFixed(2)
    );
}


function pagamentoDivididoAtivoPDV() {
    return Boolean(
        document.getElementById("usarPagamentoDivididoPDV")?.checked
    );
}


function obterPagamentosPDV() {
    const total = calcularTotalPDV();
    const primeiraForma =
        document.getElementById("formaPagamentoPDV").value;

    if (!pagamentoDivididoAtivoPDV()) {
        return [{
            forma_pagamento: primeiraForma,
            valor: total
        }];
    }

    const valorPrimeiro = Number(
        document.getElementById("valorPrimeiroPagamentoPDV").value || 0
    );

    const segundaForma =
        document.getElementById("segundaFormaPagamentoPDV").value;

    const valorSegundo = Number(
        Math.max(0, total - valorPrimeiro).toFixed(2)
    );

    return [
        {
            forma_pagamento: primeiraForma,
            valor: Number(valorPrimeiro.toFixed(2))
        },
        {
            forma_pagamento: segundaForma,
            valor: valorSegundo
        }
    ];
}


function escolherSegundaFormaDiferentePDV() {
    const primeira =
        document.getElementById("formaPagamentoPDV").value;

    const segunda =
        document.getElementById("segundaFormaPagamentoPDV");

    if (!segunda || segunda.value !== primeira) return;

    const alternativa = [
        "dinheiro",
        "pix",
        "debito",
        "credito"
    ].find(forma => forma !== primeira);

    if (alternativa) {
        segunda.value = alternativa;
    }
}


function atualizarPagamentoDivididoPDV() {
    const dividido = pagamentoDivididoAtivoPDV();
    const box = document.getElementById("pagamentoDivididoBoxPDV");

    if (box) {
        box.style.display = dividido ? "block" : "none";
    }

    escolherSegundaFormaDiferentePDV();

    const total = calcularTotalPDV();
    const campoPrimeiro =
        document.getElementById("valorPrimeiroPagamentoPDV");

    if (
        dividido &&
        campoPrimeiro &&
        (
            campoPrimeiro.value === "" ||
            Number(campoPrimeiro.value) <= 0 ||
            Number(campoPrimeiro.value) >= total
        )
    ) {
        campoPrimeiro.value =
            total > 0 ? (total / 2).toFixed(2) : "0.00";
    }

    const valorPrimeiro =
        Number(campoPrimeiro?.value || 0);

    const valorSegundo =
        Number(Math.max(0, total - valorPrimeiro).toFixed(2));

    const campoSegundo =
        document.getElementById("valorSegundoPagamentoPDV");

    if (campoSegundo) {
        campoSegundo.value = formatarDinheiro(valorSegundo);
    }

    atualizarTrocoPDV();
}


function atualizarTrocoPDV() {
    escolherSegundaFormaDiferentePDV();

    const pagamentos = obterPagamentosPDV();
    const dividido = pagamentoDivididoAtivoPDV();

    const pagamentoDinheiro =
        pagamentos.find(
            pagamento => pagamento.forma_pagamento === "dinheiro"
        );

    const campo =
        document.getElementById("campoValorRecebido");

    const linha =
        document.getElementById("linhaTrocoPDV");

    if (!pagamentoDinheiro) {
        if (campo) campo.style.display = "none";
        if (linha) linha.style.display = "none";

        const recebido = document.getElementById("valorRecebidoPDV");
        if (recebido) recebido.value = "";

        return;
    }

    if (campo) campo.style.display = "";
    if (linha) linha.style.display = "flex";

    const valorDinheiro = Number(pagamentoDinheiro.valor || 0);

    const label =
        document.getElementById("labelValorRecebidoPDV");

    if (label) {
        label.textContent =
            dividido
                ? `Valor entregue em dinheiro (parte: ${formatarDinheiro(valorDinheiro)})`
                : "Valor recebido em dinheiro";
    }

    const recebido =
        Number(
            document.getElementById("valorRecebidoPDV")?.value || 0
        );

    const troco =
        Math.max(0, recebido - valorDinheiro);

    document.getElementById("trocoPDV").textContent =
        formatarDinheiro(troco);
}


// ==========================================
// TIPOS DE VENDA
// ==========================================

async function carregarTiposVendaPDV() {

    try {

        const resposta =
            await fetch(
                "/api/vendas/tipos"
            );


        const tipos =
            await resposta.json();


        const select =
            document.getElementById(
                "tipoVendaPDV"
            );


        select.innerHTML = "";


        tipos.forEach(tipo => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                tipo.id;


            option.textContent =
                tipo.nome;


            select.appendChild(
                option
            );

        });

    } catch (erro) {

        console.error(
            "Erro ao carregar tipos:",
            erro
        );
    }
}


// ==========================================
// FINALIZAR VENDA
// ==========================================

document.getElementById(
    "btnFinalizarVenda"
).addEventListener(
    "click",
    finalizarVendaPDV
);


async function finalizarVendaPDV() {

    if (
        carrinhoPDV.length === 0 &&
        !comandaAtivaPDV?.quantidade_itens
    ) {
        return;
    }

    const tipoVendaId =
        Number(document.getElementById("tipoVendaPDV").value);

    const formaPagamento =
        document.getElementById("formaPagamentoPDV").value;

    const desconto =
        Number(document.getElementById("descontoPDV").value || 0);

    const subtotal = calcularSubtotalPDV();

    const total = Number(
        Math.max(0, subtotal - desconto).toFixed(2)
    );

    const dividido =
        total > 0 &&
        pagamentoDivididoAtivoPDV();

    let pagamentos =
        total === 0
            ? []
            : obterPagamentosPDV();

    if (dividido) {
        const valorPrimeiro = pagamentos[0].valor;

        if (
            !Number.isFinite(valorPrimeiro) ||
            valorPrimeiro <= 0 ||
            valorPrimeiro >= total
        ) {
            await modalAviso(
                "No pagamento dividido, o valor da primeira forma precisa ser maior que zero e menor que o total da venda.",
                "Valor do pagamento"
            );
            return;
        }

        if (
            pagamentos[0].forma_pagamento ===
            pagamentos[1].forma_pagamento
        ) {
            await modalAviso(
                "Escolha duas formas de pagamento diferentes.",
                "Pagamento dividido"
            );
            return;
        }
    }

    let valorRecebido = 0;

    const pagamentoDinheiro =
        pagamentos.find(
            pagamento => pagamento.forma_pagamento === "dinheiro"
        );

    if (pagamentoDinheiro) {
        valorRecebido =
            Number(document.getElementById("valorRecebidoPDV").value);

        if (
            !Number.isFinite(valorRecebido) ||
            valorRecebido < pagamentoDinheiro.valor
        ) {
            await modalAviso(
                `O valor entregue em dinheiro deve ser de pelo menos ${formatarDinheiro(pagamentoDinheiro.valor)}.`,
                "Valor insuficiente"
            );
            return;
        }

        pagamentos = pagamentos.map(
            pagamento => ({
                ...pagamento,
                valor_recebido:
                    pagamento.forma_pagamento === "dinheiro"
                        ? valorRecebido
                        : 0
            })
        );
    }

    const dados = {
        tipo_venda_id: tipoVendaId,
        desconto,
        forma_pagamento: formaPagamento,
        valor_recebido: valorRecebido,
        pagamentos,
        itens: carrinhoPDV.map(
            item => ({
                produto_id: item.produto_id,
                quantidade: item.quantidade
            })
        )
    };

    const botao =
        document.getElementById("btnFinalizarVenda");

    if (!botao) {
        await modalErro(
            "A interface do PDV não terminou de carregar. Feche e abra o Adega PDV novamente.",
            "PDV indisponível"
        );
        return;
    }

    botao.disabled = true;
    botao.textContent =
        comandaAtivaPDV
            ? "Recebendo comanda..."
            : "Finalizando...";

    try {
        let resposta;
        let resultado;

        if (comandaAtivaPDV) {
            // Qualquer consumo novo que ainda esteja no carrinho é
            // salvo primeiro. Assim, se o recebimento falhar, o estoque
            // continua reservado na comanda sem duplicar itens na tentativa seguinte.
            if (carrinhoPDV.length) {
                const respostaItens = await fetch(
                    `/api/comandas/${comandaAtivaPDV.id}/itens`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            itens: carrinhoPDV.map(item => ({
                                produto_id: item.produto_id,
                                quantidade: item.quantidade
                            }))
                        })
                    }
                );

                const dadosItens = await respostaItens.json();

                if (!respostaItens.ok) {
                    await modalErro(
                        dadosItens.mensagem ||
                        "Não foi possível adicionar os novos itens à comanda."
                    );
                    return;
                }

                comandaAtivaPDV = dadosItens.comanda;
                carrinhoPDV = [];
                atualizarCarrinhoPDV();
            }

            resposta = await fetch(
                `/api/comandas/${comandaAtivaPDV.id}/finalizar`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                }
            );

            resultado = await resposta.json();

            if (!resposta.ok) {
                // Recarrega o valor real da comanda. Isso também evita
                // reenviar os itens que acabaram de ser reservados.
                try {
                    const atual = await fetch(
                        `/api/comandas/${comandaAtivaPDV.id}`
                    );
                    if (atual.ok) {
                        comandaAtivaPDV = await atual.json();
                        atualizarCarrinhoPDV();
                    }
                } catch (_) {}

                await modalErro(
                    resultado.mensagem ||
                    "Erro ao receber a comanda"
                );
                return;
            }
        } else {
            resposta = await fetch(
                "/api/vendas",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                }
            );

            resultado = await resposta.json();

            if (!resposta.ok) {
                await modalErro(
                    resultado.mensagem ||
                    "Erro ao finalizar venda"
                );
                return;
            }
        }

        abrirModalVendaFinalizada(resultado);

        carrinhoPDV = [];
        comandaAtivaPDV = null;

        document.getElementById("descontoPDV").value = 0;
        document.getElementById("valorRecebidoPDV").value = "";
        document.getElementById("usarPagamentoDivididoPDV").checked = false;
        document.getElementById("valorPrimeiroPagamentoPDV").value = "";
        document.getElementById("segundaFormaPagamentoPDV").value = "pix";
        document.getElementById("pagamentoDivididoBoxPDV").style.display = "none";

        await carregarProdutosPDV();
        await carregarDestaquesPDV();

        atualizarCarrinhoPDV();

        await carregarResumoEstoque();
        await carregarProdutos();
        await carregarCaixa();
        await carregarResumoVendasDashboard();
        await carregarComandas();

    } catch (erro) {
        console.error(erro);

        await modalErro(
            "Erro de comunicação com o servidor.",
            "Falha de conexão"
        );

    } finally {
        botao.textContent =
            comandaAtivaPDV
                ? "Receber Comanda"
                : "Finalizar Venda";

        botao.disabled =
            carrinhoPDV.length === 0 &&
            !comandaAtivaPDV?.quantidade_itens;
    }
}


// ==========================================
// CARDS PRINCIPAIS DO DASHBOARD
// ==========================================

async function carregarCardsPrincipaisDashboard() {
    try {
        const resposta =
            await fetch(
                `/api/dashboard/resumo?_=${Date.now()}`,
                {
                    cache:
                        "no-store",
                    headers: {
                        "Cache-Control":
                            "no-cache"
                    }
                }
            );

        const dados =
            await resposta.json();

        if (
            !resposta.ok ||
            !dados.sucesso
        ) {
            throw new Error(
                dados.mensagem ||
                "Falha ao atualizar os cards."
            );
        }

        const hoje =
            dados.hoje ||
            {};

        const ontem =
            dados.ontem ||
            {};

        const estoque =
            dados.estoque ||
            {};

        const faturamento =
            document.getElementById(
                "dashboardFaturamento"
            );

        const vendas =
            document.getElementById(
                "dashboardVendas"
            );

        const produtos =
            document.getElementById(
                "dashboardProdutos"
            );

        const estoqueBaixo =
            document.getElementById(
                "dashboardEstoqueBaixo"
            );

        const totalItens =
            document.getElementById(
                "totalItensEstoque"
            );

        const semEstoque =
            document.getElementById(
                "produtosSemEstoque"
            );

        if (faturamento) {
            faturamento.textContent =
                formatarDinheiro(
                    hoje.faturamento
                );
        }

        if (vendas) {
            vendas.textContent =
                Number(
                    hoje.quantidade_vendas ||
                    0
                );
        }

        if (produtos) {
            produtos.textContent =
                Number(
                    estoque.total_produtos ||
                    0
                );
        }

        if (estoqueBaixo) {
            estoqueBaixo.textContent =
                Number(
                    estoque.estoque_baixo ||
                    0
                );
        }

        if (totalItens) {
            totalItens.textContent =
                Number(
                    estoque.total_itens ||
                    0
                );
        }

        if (semEstoque) {
            semEstoque.textContent =
                Number(
                    estoque.sem_estoque ||
                    0
                );
        }

        // Atualiza os comparativos dos mesmos cards usando a mesma
        // fotografia dos dados, evitando valores de momentos diferentes.
        aplicarComparativoDashboard?.(
            "dashComparativoVendas",
            hoje.quantidade_vendas,
            ontem.quantidade_vendas
        );

        aplicarComparativoDashboard?.(
            "dashComparativoFaturamento",
            hoje.faturamento,
            ontem.faturamento
        );

        return dados;
    } catch (erro) {
        console.error(
            "Erro nos cards principais do Dashboard:",
            erro
        );

        return null;
    }
}


// ==========================================
// DASHBOARD DE VENDAS
// ==========================================

async function carregarResumoVendasDashboard() {
    await carregarCardsPrincipaisDashboard();
}


// ==========================================
// EVENTOS DO PDV
// ==========================================

document.getElementById("pesquisaPDV").addEventListener(
    "input",
    renderizarProdutosPDV
);

document.getElementById("pesquisaPDV").addEventListener(
    "keydown",
    evento => {
        if (evento.key !== "Enter") return;

        const valor = normalizarBuscaPDV(evento.currentTarget.value);
        if (!valor) return;

        const produtoExato = produtosPDV.find(
            produto =>
                normalizarBuscaPDV(produto.codigo_barras) === valor
        );

        if (!produtoExato) return;

        evento.preventDefault();

        if (Number(produtoExato.quantidade || 0) <= 0) {
            modalAviso(
                "Este produto está sem estoque.",
                "Produto indisponível"
            );
            return;
        }

        adicionarAoCarrinho(Number(produtoExato.id));
        evento.currentTarget.value = "";
        renderizarProdutosPDV();
    }
);

document.getElementById("btnLimparPesquisaPDV")?.addEventListener(
    "click",
    () => {
        const campo = document.getElementById("pesquisaPDV");
        campo.value = "";
        campo.focus();
        renderizarProdutosPDV();
    }
);

document.getElementById("btnRepetirUltimaVenda")?.addEventListener(
    "click",
    repetirUltimaVendaPDV
);


document.getElementById(
    "descontoPDV"
).addEventListener(
    "input",
    atualizarTotaisPDV
);


document.getElementById(
    "formaPagamentoPDV"
).addEventListener(
    "change",
    atualizarPagamentoDivididoPDV
);


document.getElementById(
    "usarPagamentoDivididoPDV"
).addEventListener(
    "change",
    atualizarPagamentoDivididoPDV
);


document.getElementById(
    "valorPrimeiroPagamentoPDV"
).addEventListener(
    "input",
    atualizarPagamentoDivididoPDV
);


document.getElementById(
    "segundaFormaPagamentoPDV"
).addEventListener(
    "change",
    atualizarTrocoPDV
);


document.getElementById(
    "valorRecebidoPDV"
).addEventListener(
    "input",
    atualizarTrocoPDV
);


carregarPDV();
carregarResumoVendasDashboard();

function abrirModalVendaFinalizada(venda) {

    document.getElementById("sucessoVendaId").textContent =
        `Venda #${venda.venda_id}`;

    document.getElementById("sucessoVendaTotal").textContent =
        formatarDinheiro(venda.total);

    document.getElementById("sucessoVendaData").textContent =
        new Date().toLocaleString("pt-BR");

    const pagamentos =
        Array.isArray(venda.pagamentos)
            ? venda.pagamentos
            : [];

    const lista =
        document.getElementById("sucessoVendaPagamentos");

    if (lista) {
        lista.innerHTML =
            pagamentos.length
                ? pagamentos.map(
                    pagamento => `
                        <div class="pagamento-venda-linha">
                            <span>${formatarFormaPagamento(pagamento.forma_pagamento)}</span>
                            <strong>${formatarDinheiro(pagamento.valor)}</strong>
                        </div>
                    `
                ).join("")
                : `<span>-</span>`;
    }

    const dinheiro =
        pagamentos.find(
            pagamento => pagamento.forma_pagamento === "dinheiro"
        );

    const linhaRecebido =
        document.getElementById("linhaSucessoRecebido");

    const linhaTroco =
        document.getElementById("linhaSucessoTroco");

    if (dinheiro) {
        linhaRecebido.style.display = "flex";
        linhaTroco.style.display = "flex";

        document.getElementById("sucessoVendaRecebido").textContent =
            formatarDinheiro(dinheiro.valor_recebido || 0);

        document.getElementById("sucessoVendaTroco").textContent =
            formatarDinheiro(dinheiro.troco || 0);

    } else {
        linhaRecebido.style.display = "none";
        linhaTroco.style.display = "none";
    }

    document.getElementById("modalVendaFinalizada")
        .classList.add("ativo");
}

function fecharModalVendaFinalizada() {

    document.getElementById(
        "modalVendaFinalizada"
    ).classList.remove(
        "ativo"
    );
}


document.getElementById(
    "fecharVendaFinalizada"
).addEventListener(
    "click",
    fecharModalVendaFinalizada
);


document.getElementById(
    "btnNovaVenda"
).addEventListener(
    "click",
    () => {

        fecharModalVendaFinalizada();

        document.getElementById(
            "pesquisaPDV"
        ).focus();

    }
);



const campoCodigoPDV = document.getElementById("pesquisaPDV");

campoCodigoPDV.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;

    event.preventDefault();

    const codigo = campoCodigoPDV.value.trim();

    if (!codigo) return;

    const produto = produtosPDV.find(
        p => String(p.codigo_barras || "").trim() === codigo
    );

    if (!produto) {
        modalErro(
            `Nenhum produto possui o código de barras ${codigo}.`,
            "Produto não encontrado"
        );

        campoCodigoPDV.select();
        return;
    }

    if (estoqueDisponivelPDV(produto) <= 0) {
        modalErro(
            `${produto.nome} está sem estoque disponível para venda.`,
            "Produto sem estoque"
        );

        campoCodigoPDV.value = "";
        return;
    }

    adicionarAoCarrinho(produto.id);

    campoCodigoPDV.value = "";
    renderizarProdutosPDV();

    campoCodigoPDV.focus();
});

let vendaSelecionadaId = null;


// ===============================
// HISTÓRICO
// ===============================

// =====================================================
// PAGINAÇÃO DO HISTÓRICO
// =====================================================

let paginaVendasAtual = 1;
const vendasPorPagina = 20;


async function carregarHistoricoVendas(
    pagina = paginaVendasAtual
) {

    try {

        const resposta =
            await fetch(
                `/api/vendas?pagina=${pagina}&limite=${vendasPorPagina}`
            );

        const resultado =
            await resposta.json();


        if (!resposta.ok) {

            await modalErro(
                resultado.mensagem ||
                "Erro ao carregar histórico de vendas."
            );

            return;
        }


        paginaVendasAtual =
            resultado.pagina;


        const vendas =
            resultado.dados || [];


        const tabela =
            document.getElementById(
                "tabelaVendas"
            );


        if (!tabela) {
            return;
        }


        tabela.innerHTML = "";


        if (vendas.length === 0) {

            tabela.innerHTML = `
                <tr>
                    <td
                        colspan="6"
                        style="text-align:center;"
                    >
                        Nenhuma venda encontrada.
                    </td>
                </tr>
            `;

        } else {

            for (const venda of vendas) {

                const tr =
                    document.createElement("tr");


                const statusClasse =
                    venda.status === "cancelada"
                        ? "status-cancelada"
                        : "status-finalizada";


                tr.innerHTML = `
                    <td>
                        #${venda.id}
                    </td>

                    <td>
                        ${formatarDataVenda(
                            venda.criado_em
                        )}
                    </td>

                    <td>
                        ${venda.tipo_venda || "-"}
                    </td>

                    <td>
                        ${formatarDinheiro(
                            venda.total
                        )}
                    </td>

                    <td>
                        <span
                            class="${statusClasse}"
                        >
                            ${
                                venda.status === "cancelada"
                                    ? "Cancelada"
                                    : "Finalizada"
                            }
                        </span>
                    </td>

                    <td>
                        <button
                            type="button"
                            onclick="abrirDetalhesVenda(${venda.id})"
                        >
                            Visualizar
                        </button>
                    </td>
                `;


                tabela.appendChild(tr);

            }

        }


        const infoPagina =
            document.getElementById(
                "infoPaginaVendas"
            );


        if (infoPagina) {

            infoPagina.textContent =
                `Página ${resultado.pagina} de ${resultado.total_paginas} • ${resultado.total} vendas`;

        }


        const btnAnterior =
            document.getElementById(
                "btnPaginaAnterior"
            );


        const btnProxima =
            document.getElementById(
                "btnProximaPagina"
            );


        if (btnAnterior) {

            btnAnterior.disabled =
                resultado.pagina <= 1;

        }


        if (btnProxima) {

            btnProxima.disabled =
                resultado.pagina >=
                resultado.total_paginas;

        }


    } catch (erro) {

        console.error(
            "Erro histórico:",
            erro
        );

    }

}


// ===============================
// DETALHES
// ===============================

async function abrirDetalhesVenda(id) {

    try {

        const resposta =
            await fetch(
                `/api/vendas/${id}`
            );

        const dados =
            await resposta.json();


        if (!resposta.ok) {

            await modalErro(
                dados.mensagem ||
                "Não foi possível carregar a venda.",
                "Erro ao carregar venda"
            );

            return;
        }


        vendaSelecionadaId = id;

        const venda =
            dados.venda;

        const pagamentos =
            Array.isArray(dados.pagamentos)
                ? dados.pagamentos
                : [];

        const pagamentoDinheiro =
            pagamentos.find(
                pagamento => pagamento.forma_pagamento === "dinheiro"
            );


        document.getElementById(
            "detalheVendaTitulo"
        ).textContent =
            `Venda #${venda.id}`;


        document.getElementById(
            "detalheVendaData"
        ).textContent =
            formatarDataVenda(
                venda.criado_em
            );


        document.getElementById(
            "detalheVendaTipo"
        ).textContent =
            venda.tipo_venda;


        document.getElementById(
            "detalheVendaStatus"
        ).textContent =
            venda.status === "cancelada"
                ? "Cancelada"
                : "Finalizada";


        document.getElementById(
            "detalheVendaPagamento"
        ).textContent =
            pagamentos.length > 1
                ? "Pagamento dividido"
                : pagamentos.length === 1
                    ? formatarFormaPagamento(
                        pagamentos[0].forma_pagamento
                    )
                    : "-";


        const listaPagamentos =
            document.getElementById(
                "detalheVendaPagamentos"
            );

        if (listaPagamentos) {
            listaPagamentos.innerHTML =
                pagamentos.length
                    ? pagamentos.map(
                        pagamento => `
                            <div class="pagamento-venda-linha">
                                <span>${formatarFormaPagamento(pagamento.forma_pagamento)}</span>
                                <strong>${formatarDinheiro(pagamento.valor)}</strong>
                            </div>
                        `
                    ).join("")
                    : `<span>-</span>`;
        }


        // PRODUTOS

        document.getElementById(
            "detalheVendaItens"
        ).innerHTML =

            dados.itens.map(item => `

                <div class="detalhe-item-venda">

                    <div>

                        <strong>
                            ${item.nome}
                        </strong>

                        <small>
                            ${item.quantidade}
                            ×
                            ${formatarDinheiro(
                                item.preco_unitario
                            )}
                        </small>

                    </div>

                    <span class="detalhe-item-subtotal">

                        ${formatarDinheiro(
                            item.subtotal
                        )}

                    </span>

                </div>

            `).join("");


        document.getElementById(
            "detalheVendaSubtotal"
        ).textContent =
            formatarDinheiro(
                venda.subtotal
            );


        document.getElementById(
            "detalheVendaDesconto"
        ).textContent =
            formatarDinheiro(
                venda.desconto
            );


        document.getElementById(
            "detalheVendaTotal"
        ).textContent =
            formatarDinheiro(
                venda.total
            );


        const linhaRecebido =
            document.getElementById(
                "detalheLinhaRecebido"
            );


        const linhaTroco =
            document.getElementById(
                "detalheLinhaTroco"
            );


        if (pagamentoDinheiro) {

            linhaRecebido.style.display =
                "flex";

            linhaTroco.style.display =
                "flex";


            document.getElementById(
                "detalheVendaRecebido"
            ).textContent =
                formatarDinheiro(
                    pagamentoDinheiro.valor_recebido
                );


            document.getElementById(
                "detalheVendaTroco"
            ).textContent =
                formatarDinheiro(
                    pagamentoDinheiro.troco
                );

        } else {

            linhaRecebido.style.display =
                "none";

            linhaTroco.style.display =
                "none";

        }


        const botaoCancelar =
            document.getElementById(
                "btnCancelarVenda"
            );

        // Guarda no próprio botão o ID real da venda carregada.
        botaoCancelar.dataset.vendaId = String(venda.id);

        botaoCancelar.disabled =
            venda.status === "cancelada";


        botaoCancelar.textContent =
            venda.status === "cancelada"
                ? "Venda Cancelada"
                : "Cancelar Venda";


        document.getElementById(
            "modalDetalhesVenda"
        ).classList.add("ativo");


    } catch (erro) {

        console.error(erro);

        await modalErro(
            "Não foi possível carregar os detalhes da venda.",
            "Erro ao carregar venda"
        );

    }

}


// ===============================
// FORMATADORES
// ===============================

function formatarFormaPagamento(forma) {

    const nomes = {
        dinheiro: "Dinheiro",
        pix: "Pix",
        debito: "Cartão de Débito",
        credito: "Cartão de Crédito"
    };

    return nomes[forma] || forma;
}


function formatarDataVenda(data) {

    if (!data) return "-";

    const dataJS =
        new Date(
            data.replace(" ", "T") + "Z"
        );

    return dataJS.toLocaleString(
        "pt-BR"
    );
}


// ===============================
// FECHAR
// ===============================

function fecharDetalhesVenda() {

    document.getElementById(
        "modalDetalhesVenda"
    ).classList.remove("ativo");

    vendaSelecionadaId = null;
}


document.getElementById(
    "fecharDetalhesVenda"
).addEventListener(
    "click",
    fecharDetalhesVenda
);


document.getElementById(
    "btnFecharDetalhesVenda"
).addEventListener(
    "click",
    fecharDetalhesVenda
);


// ===============================
// ATUALIZAR
// ===============================

document.getElementById(
    "btnAtualizarVendas"
).addEventListener(
    "click",
    () => carregarHistoricoVendas(1)
);


carregarHistoricoVendas();

// ========================================
// CANCELAR VENDA
// ========================================

document
    .getElementById("btnCancelarVenda")
    .addEventListener("click", solicitarCancelamentoVenda);


async function solicitarCancelamentoVenda() {

    const botao =
        document.getElementById(
            "btnCancelarVenda"
        );

    // Usa o ID da venda que foi realmente carregada no modal.
    const vendaId = Number(
        botao.dataset.vendaId || vendaSelecionadaId
    );

    if (!vendaId) {
        await modalErro(
            "Nenhuma venda válida foi selecionada.",
            "Erro"
        );
        return;
    }

    const confirmado = await modalConfirmar(
        `Os produtos da venda #${vendaId} serão devolvidos ao estoque e ela deixará de contar no caixa.`,
        "Cancelar venda?",
        "Cancelar venda"
    );

    if (!confirmado) {
        return;
    }

    botao.disabled = true;
    botao.textContent = "Cancelando...";

    try {

        const resposta = await fetch(
            `/api/vendas/${vendaId}/cancelar`,
            {
                method: "POST"
            }
        );

        let resultado = {};

        try {
            resultado = await resposta.json();
        } catch {
            resultado = {};
        }

        if (!resposta.ok) {
            await modalErro(
                resultado.mensagem ||
                "Ocorreu um erro ao cancelar a venda.",
                "Não foi possível cancelar"
            );

            botao.disabled = false;
            botao.textContent = "Cancelar Venda";
            return;
        }

        fecharDetalhesVenda();

        await modalSucesso(
            "A venda foi cancelada e os produtos foram devolvidos ao estoque.",
            "Venda cancelada"
        );

        // Atualiza as áreas principais do sistema.
        if (typeof carregarHistoricoVendas === "function") {
            await carregarHistoricoVendas();
        }

        if (typeof carregarProdutosPDV === "function") {
            await carregarProdutosPDV();
        }

        if (typeof carregarProdutos === "function") {
            await carregarProdutos();
        }

        if (typeof carregarResumoEstoque === "function") {
            await carregarResumoEstoque();
        }

        if (typeof carregarCaixa === "function") {
            await carregarCaixa();
        }

        if (typeof carregarResumoVendasDashboard === "function") {
            await carregarResumoVendasDashboard();
        }

    } catch (erro) {

        console.error(
            "Erro ao cancelar venda:",
            erro
        );

        await modalErro(
            "Não foi possível cancelar a venda. Verifique se o servidor está funcionando.",
            "Erro de comunicação"
        );

        botao.disabled = false;
        botao.textContent = "Cancelar Venda";
    }
}

// ========================================
// RELATÓRIOS
// ========================================

async function carregarRelatorios() {

    if (usuarioAtual?.perfil !== "administrador") {
        return;
    }

    await Promise.all([
        carregarResumoRelatorios(),
        carregarPagamentosRelatorios(),
        carregarTiposVendaRelatorios(),
        carregarProdutosRelatorios(),
        carregarEstoqueBaixoRelatorios(),
        carregarListaComprasRelatorios()
    ]);
}


// ========================================
// RESUMO
// ========================================

async function carregarResumoRelatorios() {

    try {

        const resposta =
            await fetch(
                "/api/relatorios/resumo"
            );

        const dados =
            await resposta.json();


        if (!resposta.ok) {
            throw new Error(
                dados.mensagem
            );
        }


        document.getElementById(
            "relatorioFaturamento"
        ).textContent =
            formatarDinheiro(
                dados.faturamento
            );


        document.getElementById(
            "relatorioQuantidadeVendas"
        ).textContent =
            dados.quantidade_vendas;


        document.getElementById(
            "relatorioTicketMedio"
        ).textContent =
            formatarDinheiro(
                dados.ticket_medio
            );


        document.getElementById(
            "relatorioCanceladas"
        ).textContent =
            dados.vendas_canceladas;


    } catch (erro) {

        console.error(
            "Erro resumo relatório:",
            erro
        );

    }
}


// ========================================
// FORMAS DE PAGAMENTO
// ========================================

async function carregarPagamentosRelatorios() {

    try {

        const resposta =
            await fetch(
                "/api/relatorios/pagamentos"
            );

        const resultado =
            await resposta.json();


        const container =
            document.getElementById(
                "relatorioPagamentos"
            );


        if (
            !resultado.dados ||
            resultado.dados.length === 0
        ) {

            container.innerHTML = `
                <div class="relatorio-vazio">
                    Nenhum pagamento registrado hoje.
                </div>
            `;

            return;
        }


        container.innerHTML =
            resultado.dados
                .map(item => `

                    <div class="relatorio-linha">

                        <div class="relatorio-linha-info">

                            <strong>
                                ${nomeFormaPagamentoRelatorio(
                                    item.forma_pagamento
                                )}
                            </strong>

                            <small>
                                ${item.quantidade_vendas}
                                venda(s)
                            </small>

                        </div>


                        <div class="relatorio-linha-valor">

                            <strong>
                                ${formatarDinheiro(
                                    item.total
                                )}
                            </strong>

                        </div>

                    </div>

                `).join("");


    } catch (erro) {

        console.error(
            "Erro relatório pagamentos:",
            erro
        );

    }
}


// ========================================
// TIPOS DE VENDA
// ========================================

async function carregarTiposVendaRelatorios() {

    try {

        const resposta =
            await fetch(
                "/api/relatorios/tipos-venda"
            );

        const resultado =
            await resposta.json();


        const container =
            document.getElementById(
                "relatorioTiposVenda"
            );


        if (
            !resultado.dados ||
            resultado.dados.length === 0
        ) {

            container.innerHTML = `
                <div class="relatorio-vazio">
                    Nenhuma venda realizada hoje.
                </div>
            `;

            return;
        }


        container.innerHTML =
            resultado.dados
                .map(item => `

                    <div class="relatorio-linha">

                        <div class="relatorio-linha-info">

                            <strong>
                                ${item.nome}
                            </strong>

                            <small>
                                ${item.quantidade_vendas}
                                venda(s)
                            </small>

                        </div>


                        <div class="relatorio-linha-valor">

                            <strong>
                                ${formatarDinheiro(
                                    item.faturamento
                                )}
                            </strong>

                        </div>

                    </div>

                `).join("");


    } catch (erro) {

        console.error(
            "Erro tipos venda:",
            erro
        );

    }
}


// ========================================
// PRODUTOS MAIS VENDIDOS
// ========================================

async function carregarProdutosRelatorios() {

    try {

        const resposta =
            await fetch(
                "/api/relatorios/produtos"
            );

        const resultado =
            await resposta.json();


        const container =
            document.getElementById(
                "relatorioProdutos"
            );


        if (
            !resultado.dados ||
            resultado.dados.length === 0
        ) {

            container.innerHTML = `
                <div class="relatorio-vazio">
                    Nenhum produto vendido hoje.
                </div>
            `;

            return;
        }


        container.innerHTML =
            resultado.dados
                .map((produto, index) => `

                    <div class="relatorio-linha">

                        <div class="relatorio-ranking">

                            <span class="relatorio-posicao">
                                ${index + 1}
                            </span>


                            <div class="relatorio-linha-info">

                                <strong>
                                    ${produto.nome}
                                </strong>

                                <small>
                                    ${produto.quantidade}
                                    unidade(s)
                                </small>

                            </div>

                        </div>


                        <div class="relatorio-linha-valor">

                            <strong>
                                ${formatarDinheiro(
                                    produto.faturamento
                                )}
                            </strong>

                        </div>

                    </div>

                `).join("");


    } catch (erro) {

        console.error(
            "Erro ranking produtos:",
            erro
        );

    }
}


// ========================================
// ESTOQUE BAIXO
// ========================================

async function carregarEstoqueBaixoRelatorios() {

    try {

        const resposta =
            await fetch(
                "/api/relatorios/estoque-baixo"
            );

        const resultado =
            await resposta.json();


        const produtos =
            resultado.produtos || [];


        document.getElementById(
            "quantidadeEstoqueBaixo"
        ).textContent =
            produtos.length;


        const container =
            document.getElementById(
                "relatorioEstoqueBaixo"
            );


        if (produtos.length === 0) {

            container.innerHTML = `
                <div class="relatorio-vazio">
                    ✓ Nenhum produto com estoque baixo.
                </div>
            `;

            return;
        }


        container.innerHTML =
            produtos.map(produto => {

                const classe =
                    produto.quantidade <= 0
                        ? "relatorio-estoque-zero"
                        : "relatorio-estoque-baixo";


                return `

                    <div class="relatorio-linha">

                        <div class="relatorio-linha-info">

                            <strong>
                                ${produto.nome}
                            </strong>

                            <small>
                                Mínimo:
                                ${produto.estoque_minimo}
                                ${produto.unidade}
                            </small>

                        </div>


                        <div
                            class="
                                relatorio-linha-valor
                                ${classe}
                            "
                        >

                            <strong>
                                ${produto.quantidade}
                                ${produto.unidade}
                            </strong>

                        </div>

                    </div>

                `;

            }).join("");


    } catch (erro) {

        console.error(
            "Erro estoque baixo:",
            erro
        );

    }
}


// ========================================
// LISTA DE COMPRAS
// ========================================

let textoListaComprasAtual = "";


async function carregarListaComprasRelatorios() {

    try {

        const resposta =
            await fetch("/api/produtos");

        const produtos =
            await resposta.json();

        if (!resposta.ok || !Array.isArray(produtos)) {
            throw new Error(
                "Não foi possível carregar os produtos."
            );
        }


        const produtosFisicos =
            produtos.filter(
                produto =>
                    Number(produto.ativo ?? 1) === 1 &&
                    (produto.tipo_estoque || "normal") === "normal"
            );


        const produtosFracionados =
            produtos.filter(
                produto =>
                    Number(produto.ativo ?? 1) === 1 &&
                    (produto.tipo_estoque || "normal") === "fracionado"
            );

        const produtosKit =
            produtos.filter(
                produto =>
                    Number(produto.ativo ?? 1) === 1 &&
                    (produto.tipo_estoque || "normal") === "kit"
            );


        const lista =
            produtosFisicos
                .filter(produto => {
                    const atual =
                        Number(produto.quantidade || 0);

                    const minimo =
                        Number(produto.estoque_minimo || 0);

                    return (
                        minimo > 0 &&
                        atual <= minimo
                    );
                })
                .map(produto => {

                    const limitaFracionados =
                        produtosFracionados
                            .filter(fracionado =>
                                Array.isArray(
                                    fracionado.ingredientes_limitantes
                                ) &&
                                fracionado.ingredientes_limitantes.some(
                                    item =>
                                        Number(item.produto_estoque_id) ===
                                        Number(produto.id)
                                )
                            )
                            .map(
                                fracionado =>
                                    fracionado.nome
                            );

                    const limitaKits =
                        produtosKit
                            .filter(kit =>
                                Array.isArray(
                                    kit.componentes_limitantes
                                ) &&
                                kit.componentes_limitantes.some(
                                    item =>
                                        Number(item.produto_estoque_id) ===
                                        Number(produto.id)
                                )
                            )
                            .map(kit => kit.nome);

                    const limita = [
                        ...limitaFracionados,
                        ...limitaKits
                    ];

                    return {
                        ...produto,
                        limita
                    };
                })
                .sort((a, b) => {
                    const qtdA =
                        Number(a.quantidade || 0);

                    const qtdB =
                        Number(b.quantidade || 0);

                    if (
                        (qtdA <= 0) !==
                        (qtdB <= 0)
                    ) {
                        return qtdA <= 0 ? -1 : 1;
                    }

                    const proporcaoA =
                        qtdA /
                        Math.max(
                            1,
                            Number(a.estoque_minimo || 1)
                        );

                    const proporcaoB =
                        qtdB /
                        Math.max(
                            1,
                            Number(b.estoque_minimo || 1)
                        );

                    if (proporcaoA !== proporcaoB) {
                        return proporcaoA - proporcaoB;
                    }

                    return String(a.nome)
                        .localeCompare(
                            String(b.nome),
                            "pt-BR"
                        );
                });


        document.getElementById(
            "quantidadeListaCompras"
        ).textContent =
            lista.length;


        const container =
            document.getElementById(
                "relatorioListaCompras"
            );


        if (!lista.length) {

            textoListaComprasAtual =
                "Lista de compras\n\nNenhum produto precisa de reposição no momento.";

            container.innerHTML = `
                <div class="relatorio-vazio">
                    ✓ Nenhum produto precisa ser comprado agora.
                </div>
            `;

            return;
        }


        textoListaComprasAtual =
            [
                "LISTA DE COMPRAS - ADEGA",
                "",
                ...lista.map(
                    produto => {
                        const unidade =
                            produto.unidade || "un";

                        const motivos = [
                            `atual: ${produto.quantidade} ${unidade}`,
                            `mínimo: ${produto.estoque_minimo} ${unidade}`
                        ];

                        if (produto.limita.length) {
                            motivos.push(
                                `limita: ${produto.limita.join(", ")}`
                            );
                        }

                        return `☐ ${produto.nome} — ${motivos.join(" | ")}`;
                    }
                )
            ].join("\n");


        container.innerHTML =
            lista.map(produto => {

                const semEstoque =
                    Number(produto.quantidade || 0) <= 0;

                const limite =
                    produto.limita.length
                        ? `
                            <small class="lista-compras-limitante">
                                ⚠ Limita: ${produto.limita.join(", ")}
                            </small>
                        `
                        : "";

                return `
                    <div class="relatorio-linha lista-compras-linha">

                        <div class="lista-compras-check">
                            ☐
                        </div>

                        <div class="relatorio-linha-info">
                            <strong>
                                ${produto.nome}
                            </strong>

                            <small>
                                Estoque atual:
                                ${produto.quantidade}
                                ${produto.unidade || "un"}
                                · Mínimo:
                                ${produto.estoque_minimo}
                                ${produto.unidade || "un"}
                            </small>

                            ${limite}
                        </div>

                        <div
                            class="
                                relatorio-linha-valor
                                ${
                                    semEstoque
                                        ? "relatorio-estoque-zero"
                                        : "relatorio-estoque-baixo"
                                }
                            "
                        >
                            <strong>
                                ${semEstoque ? "COMPRAR" : "REPOR"}
                            </strong>
                        </div>

                    </div>
                `;

            }).join("");


    } catch (erro) {

        console.error(
            "Erro lista de compras:",
            erro
        );

        const container =
            document.getElementById(
                "relatorioListaCompras"
            );

        if (container) {
            container.innerHTML = `
                <div class="relatorio-vazio">
                    Não foi possível gerar a lista de compras.
                </div>
            `;
        }

    }
}


async function copiarListaCompras() {

    if (!textoListaComprasAtual) {
        await carregarListaComprasRelatorios();
    }

    try {
        await navigator.clipboard.writeText(
            textoListaComprasAtual
        );

        await modalAviso(
            "Lista de compras copiada.",
            "Lista de compras"
        );

    } catch (erro) {

        const area =
            document.createElement("textarea");

        area.value =
            textoListaComprasAtual;

        document.body.appendChild(area);

        area.select();

        document.execCommand("copy");

        area.remove();

        await modalAviso(
            "Lista de compras copiada.",
            "Lista de compras"
        );
    }
}


document
    .getElementById("btnCopiarListaCompras")
    ?.addEventListener(
        "click",
        copiarListaCompras
    );


// ========================================
// PAGAMENTO
// ========================================

function nomeFormaPagamentoRelatorio(forma) {

    const nomes = {
        dinheiro: "💵 Dinheiro",
        pix: "◆ Pix",
        debito: "💳 Débito",
        credito: "💳 Crédito"
    };

    return nomes[forma] || forma;
}


// ========================================
// ATUALIZAR
// ========================================

document
    .getElementById(
        "btnAtualizarRelatorios"
    )
    .addEventListener(
        "click",
        async () => {

            const botao =
                document.getElementById(
                    "btnAtualizarRelatorios"
                );

            botao.disabled = true;
            botao.textContent =
                "↻ Atualizando...";


            await carregarRelatorios();
            await carregarHistoricoVendas();


            botao.disabled = false;
            botao.textContent =
                "↻ Atualizar dados";
        }
    );


// Relatórios são carregados após validar a sessão do administrador.

// ========================================
// BACKUP
// ========================================

const btnCriarBackup =
    document.getElementById(
        "btnCriarBackup"
    );

const btnSelecionarBackup =
    document.getElementById(
        "btnSelecionarBackup"
    );

const arquivoBackup =
    document.getElementById(
        "arquivoBackup"
    );


// DOWNLOAD
btnCriarBackup?.addEventListener(
    "click",
    () => {

        window.location.href =
            "/api/backup/download";

    }
);


// SELECIONAR ARQUIVO
btnSelecionarBackup?.addEventListener(
    "click",
    () => {

        arquivoBackup.click();

    }
);


// RESTAURAR
arquivoBackup?.addEventListener(
    "change",
    async () => {

        const arquivo =
            arquivoBackup.files[0];

        if (!arquivo) return;


        const confirmado =
            await modalConfirmar(
                "Os dados atuais serão substituídos pelos dados deste backup. Um backup de segurança será criado automaticamente antes da restauração.",
                "Restaurar backup?",
                "Restaurar"
            );


        if (!confirmado) {

            arquivoBackup.value = "";

            return;
        }


        const dados =
            new FormData();

        dados.append(
            "backup",
            arquivo
        );


        btnSelecionarBackup.disabled =
            true;

        btnSelecionarBackup.textContent =
            "Restaurando...";


        try {

            const resposta =
                await fetch(
                    "/api/backup/restaurar",
                    {
                        method: "POST",
                        body: dados
                    }
                );


            const resultado =
                await resposta.json();


            if (!resposta.ok) {

                modalErro(
                    resultado.mensagem ||
                    "Não foi possível restaurar o backup.",
                    "Erro na restauração"
                );

                return;
            }


            modalSucesso(
                window.chrome?.webview
                    ? "Backup restaurado. O Adega PDV será reiniciado automaticamente."
                    : "Backup restaurado. Reinicie o servidor para continuar.",
                "Backup restaurado"
            );

            if (window.chrome?.webview) {
                window.chrome.webview.postMessage({
                    acao: "reiniciar-servidor"
                });
            }


        } catch (erro) {

            console.error(
                "Erro restauração:",
                erro
            );


            modalErro(
                "Não foi possível comunicar com o servidor.",
                "Erro"
            );

        } finally {

            btnSelecionarBackup.disabled =
                false;

            btnSelecionarBackup.textContent =
                "Restaurar backup";

            arquivoBackup.value = "";

        }

    }
);



// ========================================
// V3.3 - DASHBOARD MODERNO
// ========================================

function atualizarIdentidadeDashboardModerno() {
    const nome =
        String(
            usuarioAtual?.nome ||
            document.getElementById("nomeUsuario")?.textContent ||
            "Usuário"
        ).trim();

    const primeiroNome =
        nome.split(/\s+/)[0] || "Usuário";

    const nomeDashboard =
        document.getElementById(
            "dashboardNomeUsuario"
        );

    if (nomeDashboard) {
        nomeDashboard.textContent =
            primeiroNome;
    }

    const avatar =
        document.getElementById(
            "avatarUsuario"
        );

    if (avatar) {
        const partes =
            nome.split(/\s+/)
                .filter(Boolean);

        const iniciais =
            partes.length > 1
                ? `${partes[0][0]}${partes[partes.length - 1][0]}`
                : primeiroNome.slice(0, 2);

        avatar.textContent =
            iniciais.toUpperCase();
    }
}


function atualizarRelogioDashboardModerno() {

    const agora =
        new Date();

    const hora =
        document.getElementById(
            "dashboardHoraAtual"
        );

    const diaSemana =
        document.getElementById(
            "dashboardDiaSemana"
        );

    const dataCompleta =
        document.getElementById(
            "dashboardDataCompleta"
        );

    if (hora) {
        hora.textContent =
            agora.toLocaleTimeString(
                "pt-BR",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );
    }

    if (diaSemana) {
        let texto =
            agora.toLocaleDateString(
                "pt-BR",
                {
                    weekday: "long"
                }
            );

        diaSemana.textContent =
            texto.charAt(0).toUpperCase() +
            texto.slice(1);
    }

    if (dataCompleta) {
        dataCompleta.textContent =
            agora.toLocaleDateString(
                "pt-BR",
                {
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                }
            );
    }
}


function corCategoriaDashboard(indice) {
    const cores = [
        "#2f9df4",
        "#34d399",
        "#f6c84c",
        "#fb5b78",
        "#8b79f7",
        "#22d3ee"
    ];

    return cores[
        indice % cores.length
    ];
}


async function carregarCategoriasDashboardModerno() {

    const donut =
        document.getElementById(
            "dashboardDonutCategorias"
        );

    const legenda =
        document.getElementById(
            "dashboardCategoriasLegenda"
        );

    const totalEl =
        document.getElementById(
            "dashboardDonutTotal"
        );

    finalizarSkeleton(
        legenda
    );

    if (
        !donut ||
        !legenda
    ) {
        return;
    }

    try {

        const resposta =
            await fetch(
                "/api/produtos"
            );

        const dados =
            await resposta.json();

        const produtos =
            Array.isArray(dados)
                ? dados
                : (
                    Array.isArray(dados.produtos)
                        ? dados.produtos
                        : []
                );

        const categorias = new Map();

        produtos.forEach(produto => {

            const nome =
                String(
                    produto.categoria ||
                    "Sem categoria"
                ).trim() ||
                "Sem categoria";

            categorias.set(
                nome,
                (
                    categorias.get(nome) ||
                    0
                ) + 1
            );

        });


        const lista =
            [...categorias.entries()]
                .sort(
                    (a, b) =>
                        b[1] - a[1]
                );

        const total =
            lista.reduce(
                (soma, item) =>
                    soma + item[1],
                0
            );


        if (totalEl) {
            totalEl.textContent =
                total;
        }


        if (!total) {

            donut.style.background =
                "conic-gradient(#334155 0 100%)";

            legenda.innerHTML =
                '<div class="dashboard-vazio">Nenhuma categoria cadastrada.</div>';

            return;
        }


        let acumulado = 0;

        const partesGradiente =
            lista.slice(0, 6)
                .map(
                    (item, indice) => {

                        const percentual =
                            (
                                item[1] /
                                total
                            ) * 100;

                        const inicio =
                            acumulado;

                        acumulado +=
                            percentual;

                        const cor =
                            corCategoriaDashboard(
                                indice
                            );

                        return `${cor} ${inicio.toFixed(2)}% ${acumulado.toFixed(2)}%`;

                    }
                );


        if (
            acumulado < 100
        ) {
            partesGradiente.push(
                `#475569 ${acumulado.toFixed(2)}% 100%`
            );
        }


        donut.style.background =
            `conic-gradient(${partesGradiente.join(",")})`;


        legenda.innerHTML =
            lista.slice(0, 5)
                .map(
                    (item, indice) => {

                        const percentual =
                            (
                                (
                                    item[1] /
                                    total
                                ) * 100
                            ).toFixed(0);

                        return `
                            <div class="dash-categoria-linha">
                                <span class="dash-categoria-cor" style="background:${corCategoriaDashboard(indice)}"></span>
                                <span title="${escaparHtmlUsuario(item[0])}">${escaparHtmlUsuario(item[0])}</span>
                                <strong>${percentual}%</strong>
                            </div>
                        `;

                    }
                )
                .join("");

    } catch (erro) {

        console.error(
            "Erro categorias dashboard:",
            erro
        );

        legenda.innerHTML =
            '<div class="dashboard-vazio">Não foi possível carregar as categorias.</div>';

    }

}


function configurarBuscaGlobalModerna() {

    const busca =
        document.getElementById(
            "buscaGlobal"
        );

    if (!busca) return;


    busca.addEventListener(
        "keydown",
        evento => {

            if (
                evento.key !== "Enter"
            ) {
                return;
            }


            const termo =
                busca.value.trim();

            abrirTela(
                "pdv"
            );


            requestAnimationFrame(
                () => {

                    const pesquisaPDV =
                        document.getElementById(
                            "pesquisaPDV"
                        );

                    if (!pesquisaPDV) {
                        return;
                    }

                    pesquisaPDV.value =
                        termo;

                    pesquisaPDV.dispatchEvent(
                        new Event(
                            "input",
                            {
                                bubbles: true
                            }
                        )
                    );

                    pesquisaPDV.focus();

                }
            );

        }
    );

}


const atualizarDashboardCompletoOriginal =
    typeof atualizarDashboardCompleto === "function"
        ? atualizarDashboardCompleto
        : null;


async function atualizarDashboardModernoCompleto() {

    atualizarIdentidadeDashboardModerno();
    atualizarRelogioDashboardModerno();

    if (
        atualizarDashboardCompletoOriginal
    ) {
        await atualizarDashboardCompletoOriginal();
    }

    await carregarCategoriasDashboardModerno();

}


document.addEventListener(
    "DOMContentLoaded",
    () => {

        atualizarRelogioDashboardModerno();
        configurarBuscaGlobalModerna();

        setInterval(
            atualizarRelogioDashboardModerno,
            30000
        );

        setTimeout(
            atualizarIdentidadeDashboardModerno,
            500
        );

        setTimeout(
            carregarCategoriasDashboardModerno,
            700
        );

    }
);


// ========================================
// ATALHOS DE TECLADO DO PDV
// ========================================

function elementoAceitaDigitacao(elemento) {
    if (!elemento) return false;

    const tag =
        String(
            elemento.tagName || ""
        ).toLowerCase();

    return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        elemento.isContentEditable
    );
}


function telaAtivaEhPDV() {
    return Boolean(
        document.querySelector(
            "#pdv.tela.ativa"
        )
    );
}


function fecharModalAtivo() {
    const modal =
        Array.from(
            document.querySelectorAll(
                ".modal-overlay.ativo"
            )
        )
        .pop();

    if (!modal) return false;

    const botao =
        modal.querySelector(
            ".modal-fechar, .modal-sistema-fechar, [data-fechar-modal]"
        );

    if (botao) {
        botao.click();
        return true;
    }

    return false;
}


function focarCampoPDV(id) {
    const elemento =
        document.getElementById(id);

    if (!elemento) {
        return false;
    }

    elemento.focus();
    elemento.select?.();

    return true;
}


function navegarCarrinhoPDV(direcao) {
    if (!carrinhoPDV.length) {
        return;
    }

    let indice =
        obterIndiceCarrinhoSelecionadoPDV();

    indice += direcao;

    if (indice < 0) {
        indice =
            carrinhoPDV.length - 1;
    }

    if (
        indice >=
        carrinhoPDV.length
    ) {
        indice = 0;
    }

    selecionarItemCarrinhoPDV(
        indice
    );
}


function alterarQuantidadeSelecionadaPDV(delta) {
    const indice =
        obterIndiceCarrinhoSelecionadoPDV();

    if (indice < 0) return;

    const item =
        carrinhoPDV[indice];

    alterarQuantidadeCarrinho(
        item.produto_id,
        delta
    );

    produtoCarrinhoSelecionadoPDV =
        item.produto_id;
}


async function removerSelecionadoPDV() {
    const indice =
        obterIndiceCarrinhoSelecionadoPDV();

    if (indice < 0) return;

    const item =
        carrinhoPDV[indice];

    const indiceNovo =
        Math.max(
            0,
            Math.min(
                indice,
                carrinhoPDV.length - 2
            )
        );

    removerDoCarrinho(
        item.produto_id
    );

    if (carrinhoPDV.length) {
        selecionarItemCarrinhoPDV(
            indiceNovo
        );
    }
}


document
    .getElementById(
        "btnMostrarAtalhosPDV"
    )
    ?.addEventListener(
        "click",
        () => {
            document
                .getElementById(
                    "pdvAtalhosFaixa"
                )
                ?.classList.toggle(
                    "aberta"
                );
        }
    );


document.addEventListener(
    "click",
    evento => {
        const item =
            evento.target.closest(
                ".item-carrinho"
            );

        if (!item) return;

        produtoCarrinhoSelecionadoPDV =
            Number(
                item.dataset
                    .produtoId
            );

        selecionarItemCarrinhoPDV(
            produtoCarrinhoSelecionadoPDV,
            true
        );
    }
);


document.addEventListener(
    "keydown",
    evento => {

        if (evento.repeat) {
            return;
        }


        if (
            evento.key === "Escape"
        ) {
            if (fecharModalAtivo()) {
                evento.preventDefault();
                return;
            }

            if (telaAtivaEhPDV()) {
                const busca =
                    document.getElementById(
                        "pesquisaPDV"
                    );

                if (
                    busca &&
                    busca.value
                ) {
                    busca.value = "";
                    busca.dispatchEvent(
                        new Event(
                            "input",
                            {
                                bubbles: true
                            }
                        )
                    );

                    busca.focus();
                    evento.preventDefault();
                }
            }

            return;
        }


        if (
            evento.key === "F2" &&
            !telaAtivaEhPDV()
        ) {
            const buscaGlobal =
                document.getElementById(
                    "buscaGlobal"
                );

            if (buscaGlobal) {
                evento.preventDefault();
                buscaGlobal.focus();
                buscaGlobal.select?.();
            }

            return;
        }


        if (!telaAtivaEhPDV()) {
            return;
        }


        if (
            evento.key === "F2"
        ) {
            evento.preventDefault();
            focarCampoPDV(
                "pesquisaPDV"
            );
            return;
        }


        if (
            evento.key === "F3"
        ) {
            evento.preventDefault();

            if (carrinhoPDV.length) {
                selecionarItemCarrinhoPDV(
                    obterIndiceCarrinhoSelecionadoPDV()
                );
            }

            return;
        }


        if (
            evento.key === "F4"
        ) {
            evento.preventDefault();

            const botao =
                document.getElementById(
                    "btnFinalizarVenda"
                );

            if (
                botao &&
                !botao.disabled
            ) {
                botao.click();
            }

            return;
        }


        if (
            evento.key === "F5"
        ) {
            evento.preventDefault();
            focarCampoPDV(
                "descontoPDV"
            );
            return;
        }


        if (
            evento.key === "F6"
        ) {
            evento.preventDefault();
            focarCampoPDV(
                "formaPagamentoPDV"
            );
            return;
        }


        if (
            evento.key === "F7"
        ) {
            evento.preventDefault();

            const campo =
                document.getElementById(
                    "campoValorRecebido"
                );

            if (
                campo &&
                window.getComputedStyle(
                    campo
                ).display !== "none"
            ) {
                focarCampoPDV(
                    "valorRecebidoPDV"
                );
            } else {
                focarCampoPDV(
                    "formaPagamentoPDV"
                );
            }

            return;
        }


        if (
            evento.key === "F8"
        ) {
            evento.preventDefault();

            const repetir =
                document.getElementById(
                    "btnRepetirUltimaVenda"
                );

            if (
                repetir &&
                !repetir.disabled
            ) {
                repetir.click();
            }

            return;
        }


        const digitando =
            elementoAceitaDigitacao(
                document.activeElement
            );


        if (
            !digitando &&
            evento.key === "ArrowUp"
        ) {
            evento.preventDefault();
            navegarCarrinhoPDV(-1);
            return;
        }


        if (
            !digitando &&
            evento.key === "ArrowDown"
        ) {
            evento.preventDefault();
            navegarCarrinhoPDV(1);
            return;
        }


        if (
            !digitando &&
            (
                evento.key === "+" ||
                evento.key === "="
            )
        ) {
            evento.preventDefault();
            alterarQuantidadeSelecionadaPDV(
                1
            );
            return;
        }


        if (
            !digitando &&
            evento.key === "-"
        ) {
            evento.preventDefault();
            alterarQuantidadeSelecionadaPDV(
                -1
            );
            return;
        }


        if (
            !digitando &&
            (
                evento.key === "Delete" ||
                evento.key === "Backspace"
            )
        ) {
            evento.preventDefault();
            removerSelecionadoPDV();
            return;
        }

    }
);




// Remove estado de skeleton assim que uma rotina substitui o conteúdo.
const observerSkeleton =
    new MutationObserver(
        mutacoes => {
            mutacoes.forEach(
                mutacao => {
                    const alvo =
                        mutacao.target;

                    if (
                        alvo instanceof HTMLElement &&
                        alvo.dataset
                            .skeletonAtivo ===
                        "1" &&
                        !alvo.querySelector(
                            ".skeleton, .skeleton-card, .skeleton-tabela"
                        )
                    ) {
                        finalizarSkeleton(
                            alvo
                        );
                    }
                }
            );
        }
    );


document.addEventListener(
    "DOMContentLoaded",
    () => {
        document
            .querySelectorAll(
                "#listaProdutosPDV, #rankingProdutosDashboard, #dashboardCategoriasLegenda, #tabelaUsuarios, #tabelaAuditoria"
            )
            .forEach(
                elemento =>
                    observerSkeleton.observe(
                        elemento,
                        {
                            childList: true,
                            subtree: true
                        }
                    )
            );
    }
);




// =====================================================
// PLANILHAS DE PRODUTOS / ESTOQUE - V1.6.2
// =====================================================

function baixarArquivoPlanilha(
    blob,
    nomeArquivo
) {
    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;
    link.download =
        nomeArquivo ||
        "AdegaPDV-produtos.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(
        () =>
            URL.revokeObjectURL(url),
        1200
    );
}


function abrirModalPlanilhaEstoque() {
    const modal =
        document.getElementById(
            "modalPlanilhaEstoque"
        );

    if (!modal) {
        modalErro(
            "A janela de importação não foi encontrada."
        );
        return;
    }

    modal.classList.add(
        "ativo"
    );

    document.body.classList.add(
        "modal-aberto"
    );
}


function fecharModalPlanilhaEstoque() {
    const modal =
        document.getElementById(
            "modalPlanilhaEstoque"
        );

    modal?.classList.remove(
        "ativo"
    );

    if (
        typeof limparPreviewPlanilha ===
        "function"
    ) {
        limparPreviewPlanilha();
    }

    document.body.classList.remove(
        "modal-aberto"
    );
}


async function exportarPlanilhaProdutos(
    formato
) {
    try {
        const resposta =
            await fetch(
                `/api/planilha/exportar?formato=${encodeURIComponent(formato)}`
            );

        if (!resposta.ok) {
            const dados =
                await resposta.json()
                    .catch(
                        () => ({})
                    );

            throw new Error(
                dados.mensagem ||
                "Não foi possível exportar a planilha."
            );
        }

        const blob =
            await resposta.blob();

        const disposicao =
            resposta.headers.get(
                "content-disposition"
            ) || "";

        const nomeMatch =
            disposicao.match(
                /filename="?([^";]+)"?/i
            );

        const nomeArquivo =
            nomeMatch?.[1] ||
            (
                formato === "xls"
                    ? "AdegaPDV-produtos.xls"
                    : "AdegaPDV-produtos.csv"
            );

        baixarArquivoPlanilha(
            blob,
            nomeArquivo
        );

        modalSucesso(
            "A planilha com os produtos e o estoque atual foi gerada.",
            "Exportação concluída"
        );

    } catch (erro) {
        console.error(
            "Erro ao exportar planilha:",
            erro
        );

        modalErro(
            erro.message ||
            "Não foi possível exportar a planilha."
        );
    }
}


async function atualizarTelasAposImportacao() {
    const tarefas = [];

    if (
        typeof carregarProdutos ===
        "function"
    ) {
        tarefas.push(
            Promise.resolve(
                carregarProdutos()
            )
        );
    }

    if (
        typeof carregarResumoEstoque ===
        "function"
    ) {
        tarefas.push(
            Promise.resolve(
                carregarResumoEstoque()
            )
        );
    }

    if (
        typeof carregarCategorias ===
        "function"
    ) {
        tarefas.push(
            Promise.resolve(
                carregarCategorias()
            )
        );
    }

    if (
        typeof carregarProdutosPDV ===
        "function"
    ) {
        tarefas.push(
            Promise.resolve(
                carregarProdutosPDV()
            )
        );
    }

    if (
        typeof carregarDashboard ===
        "function"
    ) {
        tarefas.push(
            Promise.resolve(
                carregarDashboard()
            )
        );
    }

    await Promise.allSettled(
        tarefas
    );
}


let tokenPreviewPlanilha =
    null;


function escaparHtmlPlanilha(
    valor
) {
    return String(
        valor ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function rotuloAcaoPreviewPlanilha(
    acao
) {
    const mapa = {
        criar:
            "Criar",
        atualizar:
            "Atualizar",
        ignorar:
            "Ignorar",
        erro:
            "Erro"
    };

    return (
        mapa[acao] ||
        acao ||
        "—"
    );
}


function limparPreviewPlanilha() {
    tokenPreviewPlanilha =
        null;

    const area =
        document.getElementById(
            "planilhaPreview"
        );

    if (area) {
        area.hidden = true;
    }

    const tabela =
        document.getElementById(
            "tabelaPreviewPlanilha"
        );

    if (tabela) {
        tabela.innerHTML = `
            <tr>
                <td colspan="7" class="tabela-estado-vazio">
                    Selecione uma planilha para visualizar.
                </td>
            </tr>
        `;
    }

    const confirmar =
        document.getElementById(
            "btnConfirmarImportacaoPlanilha"
        );

    if (confirmar) {
        confirmar.disabled =
            true;
    }
}


function renderizarPreviewPlanilha(
    dados
) {
    tokenPreviewPlanilha =
        dados.token ||
        null;

    const area =
        document.getElementById(
            "planilhaPreview"
        );

    const arquivo =
        document.getElementById(
            "planilhaPreviewArquivo"
        );

    if (area) {
        area.hidden = false;
    }

    if (arquivo) {
        arquivo.textContent =
            dados.nome_arquivo ||
            "Planilha selecionada";
    }

    const resumo =
        dados.resumo || {};

    const campos = {
        previewQtdCriar:
            resumo.criar,
        previewQtdAtualizar:
            resumo.atualizar,
        previewQtdIgnorar:
            resumo.ignorar,
        previewQtdErro:
            resumo.erro
    };

    Object.entries(
        campos
    ).forEach(
        ([id, valor]) => {
            const elemento =
                document.getElementById(
                    id
                );

            if (elemento) {
                elemento.textContent =
                    Number(
                        valor || 0
                    );
            }
        }
    );

    const tabela =
        document.getElementById(
            "tabelaPreviewPlanilha"
        );

    const linhas =
        Array.isArray(
            dados.linhas
        )
            ? dados.linhas
            : [];

    if (tabela) {
        tabela.innerHTML =
            linhas.length
                ? linhas.map(
                    linha => `
                        <tr class="preview-linha preview-${escaparHtmlPlanilha(
                            linha.acao
                        )}">
                            <td>${Number(
                                linha.linha ||
                                0
                            )}</td>
                            <td>
                                <span class="preview-status ${escaparHtmlPlanilha(
                                    linha.acao
                                )}">
                                    ${escaparHtmlPlanilha(
                                        rotuloAcaoPreviewPlanilha(
                                            linha.acao
                                        )
                                    )}
                                </span>
                            </td>
                            <td title="${escaparHtmlPlanilha(
                                linha.nome
                            )}">
                                ${escaparHtmlPlanilha(
                                    linha.nome
                                )}
                            </td>
                            <td>${escaparHtmlPlanilha(
                                linha.codigo ||
                                "—"
                            )}</td>
                            <td>${escaparHtmlPlanilha(
                                linha.categoria ||
                                "—"
                            )}</td>
                            <td>${escaparHtmlPlanilha(
                                linha.quantidade
                            )}</td>
                            <td class="preview-motivo">
                                ${escaparHtmlPlanilha(
                                    linha.motivo ||
                                    "—"
                                )}
                            </td>
                        </tr>
                    `
                ).join("")
                : `
                    <tr>
                        <td colspan="7" class="tabela-estado-vazio">
                            Nenhuma linha encontrada.
                        </td>
                    </tr>
                `;
    }

    const aviso =
        document.getElementById(
            "planilhaPreviewAviso"
        );

    const erros =
        Number(
            resumo.erro || 0
        );

    if (aviso) {
        aviso.classList.toggle(
            "com-erros",
            erros > 0
        );

        aviso.textContent =
            erros > 0
                ? `${erros} linha(s) possuem erro. Corrija a planilha antes de confirmar a importação. Nenhuma alteração foi aplicada ao banco.`
                : "Nenhuma alteração foi aplicada ao banco. Revise os dados e confirme a importação.";
    }

    const confirmar =
        document.getElementById(
            "btnConfirmarImportacaoPlanilha"
        );

    if (confirmar) {
        confirmar.disabled =
            !tokenPreviewPlanilha ||
            erros > 0 ||
            (
                Number(
                    resumo.criar || 0
                ) +
                Number(
                    resumo.atualizar || 0
                )
            ) === 0;
    }

    requestAnimationFrame(
        () => {
            area?.scrollIntoView({
                behavior:
                    "smooth",
                block:
                    "nearest"
            });
        }
    );
}


async function importarPlanilhaEstoque(
    arquivo
) {
    if (!arquivo) {
        return;
    }

    const extensao =
        arquivo.name
            .toLowerCase()
            .split(".")
            .pop();

    if (
        ![
            "csv",
            "xls",
            "xml",
            "xlsx"
        ].includes(
            extensao
        )
    ) {
        modalAviso(
            "Use um arquivo CSV, XLS ou XLSX.",
            "Formato não suportado"
        );

        return;
    }

    const botao =
        document.getElementById(
            "btnImportarPlanilha"
        );

    const textoOriginal =
        botao?.textContent ||
        "Escolher arquivo";

    try {
        limparPreviewPlanilha();

        if (botao) {
            botao.disabled =
                true;

            botao.textContent =
                "Analisando...";
        }

        const formData =
            new FormData();

        formData.append(
            "arquivo",
            arquivo
        );

        const resposta =
            await fetch(
                "/api/planilha/preview",
                {
                    method:
                        "POST",
                    body:
                        formData
                }
            );

        const dados =
            await resposta
                .json()
                .catch(
                    () => ({})
                );

        if (!resposta.ok) {
            throw new Error(
                dados.mensagem ||
                "Não foi possível analisar a planilha."
            );
        }

        renderizarPreviewPlanilha(
            dados
        );

    } catch (erro) {
        console.error(
            "Erro ao gerar pré-visualização:",
            erro
        );

        limparPreviewPlanilha();

        modalErro(
            erro.message ||
            "Não foi possível analisar a planilha."
        );

    } finally {
        if (botao) {
            botao.disabled =
                false;

            botao.textContent =
                textoOriginal;
        }
    }
}


async function confirmarImportacaoPlanilha() {
    if (
        !tokenPreviewPlanilha
    ) {
        return;
    }

    const confirmar =
        await modalConfirmar(
            "Confirmar esta importação?\n\nSomente as linhas marcadas como Criar ou Atualizar serão aplicadas. Linhas ignoradas não alteram o banco.",
            "Confirmar importação",
            "Importar agora"
        );

    if (!confirmar) {
        return;
    }

    const botao =
        document.getElementById(
            "btnConfirmarImportacaoPlanilha"
        );

    const textoOriginal =
        botao?.textContent ||
        "Confirmar importação";

    try {
        if (botao) {
            botao.disabled =
                true;

            botao.textContent =
                "Importando...";
        }

        const resposta =
            await fetch(
                "/api/planilha/importar",
                {
                    method:
                        "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            token:
                                tokenPreviewPlanilha
                        })
                }
            );

        const dados =
            await resposta
                .json()
                .catch(
                    () => ({})
                );

        if (!resposta.ok) {
            if (
                Array.isArray(
                    dados.linhas
                )
            ) {
                renderizarPreviewPlanilha({
                    token:
                        tokenPreviewPlanilha,
                    nome_arquivo:
                        document
                            .getElementById(
                                "planilhaPreviewArquivo"
                            )
                            ?.textContent ||
                        "Planilha",
                    resumo:
                        dados.resumo ||
                        {},
                    linhas:
                        dados.linhas
                });
            }

            throw new Error(
                dados.mensagem ||
                "Não foi possível importar a planilha."
            );
        }

        const resumo =
            dados.resumo ||
            {};

        await atualizarTelasAposImportacao();

        limparPreviewPlanilha();
        fecharModalPlanilhaEstoque();

        modalSucesso(
            [
                `${Number(
                    resumo.criados ||
                    0
                )} criado(s)`,
                `${Number(
                    resumo.atualizados ||
                    0
                )} atualizado(s)`,
                `${Number(
                    resumo.estoque_ajustado ||
                    0
                )} ajuste(s) de estoque`,
                `${Number(
                    resumo.ignorados ||
                    0
                )} ignorado(s)`
            ].join(
                " • "
            ),
            "Importação concluída"
        );

    } catch (erro) {
        console.error(
            "Erro ao confirmar importação:",
            erro
        );

        modalErro(
            erro.message ||
            "Não foi possível importar a planilha."
        );

    } finally {
        if (botao) {
            botao.textContent =
                textoOriginal;

            botao.disabled =
                !tokenPreviewPlanilha;
        }
    }
}


function configurarPlanilhaEstoque() {
    const btnPlanilha =
        document.getElementById(
            "btnPlanilhaEstoque"
        );

    const btnFechar =
        document.getElementById(
            "fecharModalPlanilha"
        );

    const modal =
        document.getElementById(
            "modalPlanilhaEstoque"
        );

    const btnCsv =
        document.getElementById(
            "btnExportarCsv"
        );

    const btnExcel =
        document.getElementById(
            "btnExportarExcel"
        );

    const btnImportar =
        document.getElementById(
            "btnImportarPlanilha"
        );

    const arquivoInput =
        document.getElementById(
            "arquivoPlanilhaEstoque"
        );

    btnPlanilha?.addEventListener(
        "click",
        abrirModalPlanilhaEstoque
    );

    btnFechar?.addEventListener(
        "click",
        fecharModalPlanilhaEstoque
    );

    modal?.addEventListener(
        "click",
        evento => {
            if (
                evento.target ===
                modal
            ) {
                fecharModalPlanilhaEstoque();
            }
        }
    );

    btnCsv?.addEventListener(
        "click",
        () =>
            exportarPlanilhaProdutos(
                "csv"
            )
    );

    btnExcel?.addEventListener(
        "click",
        () =>
            exportarPlanilhaProdutos(
                "xls"
            )
    );

    btnImportar?.addEventListener(
        "click",
        () => {
            arquivoInput?.click();
        }
    );

    arquivoInput?.addEventListener(
        "change",
        async evento => {
            const arquivo =
                evento.target.files?.[0];

            try {
                await importarPlanilhaEstoque(
                    arquivo
                );
            } finally {
                evento.target.value = "";
            }
        }
    );
}




document
    .getElementById(
        "btnConfirmarImportacaoPlanilha"
    )
    ?.addEventListener(
        "click",
        confirmarImportacaoPlanilha
    );

document
    .getElementById(
        "btnCancelarPreviewPlanilha"
    )
    ?.addEventListener(
        "click",
        () => {
            limparPreviewPlanilha();

            document
                .getElementById(
                    "arquivoPlanilhaEstoque"
                )
                ?.click();
        }
    );

document
    .getElementById(
        "btnVoltarPreviewPlanilha"
    )
    ?.addEventListener(
        "click",
        limparPreviewPlanilha
    );


document.addEventListener(
    "DOMContentLoaded",
    configurarPlanilhaEstoque
);



// =====================================================
// ATUALIZAÇÃO DO ADEGA PDV - V1.6.1
// =====================================================

let pacoteAtualizacaoPreparado = false;


function formatarTamanhoAtualizacao(bytes) {
    const valor = Number(bytes || 0);

    if (valor < 1024) {
        return `${valor} B`;
    }

    if (valor < 1024 * 1024) {
        return `${(valor / 1024).toFixed(1)} KB`;
    }

    return `${(valor / 1024 / 1024).toFixed(1)} MB`;
}


function definirEstadoAtualizacao({
    preparado = false,
    nome = "Nenhum pacote selecionado",
    detalhe = "Gere o pacote pelo próprio Adega PDV."
} = {}) {

    pacoteAtualizacaoPreparado = preparado;

    const nomeEl =
        document.getElementById(
            "atualizacaoNomeArquivo"
        );

    const detalheEl =
        document.getElementById(
            "atualizacaoDetalheArquivo"
        );

    const aplicar =
        document.getElementById(
            "btnAplicarAtualizacao"
        );

    if (nomeEl) {
        nomeEl.textContent = nome;
    }

    if (detalheEl) {
        detalheEl.textContent = detalhe;
    }

    if (aplicar) {
        aplicar.disabled = !preparado;
    }
}


async function carregarStatusAtualizacao() {
    if (
        usuarioAtual?.perfil !==
        "administrador"
    ) {
        return;
    }

    try {
        const resposta =
            await fetch(
                "/api/atualizacao/status"
            );

        const dados =
            await resposta.json();

        if (
            resposta.ok &&
            dados.pendente
        ) {
            const tipoPacote =
                dados.pacote?.tipo === "webapp"
                    ? "WebApp"
                    : "Completo";

            const versaoPacote =
                dados.pacote?.versao
                    ? ` • versão ${dados.pacote.versao}`
                    : "";

            definirEstadoAtualizacao({
                preparado: true,
                nome:
                    dados.pacote?.nome ||
                    "Pacote já preparado",
                detalhe:
                    `${tipoPacote}${versaoPacote} • ${formatarTamanhoAtualizacao(dados.tamanho)} • pronto para instalar`
            });
        }
    } catch {}
}


document
    .getElementById(
        "btnSelecionarAtualizacao"
    )
    ?.addEventListener(
        "click",
        () =>
            document
                .getElementById(
                    "arquivoAtualizacao"
                )
                ?.click()
    );


document
    .getElementById(
        "arquivoAtualizacao"
    )
    ?.addEventListener(
        "change",
        async evento => {

            const arquivo =
                evento.target.files?.[0];

            if (!arquivo) return;

            const nome =
                arquivo.name.toLowerCase();

            if (
                !nome.endsWith(".zip")
            ) {
                modalAviso(
                    "Selecione um arquivo ZIP de atualização.",
                    "Pacote incorreto"
                );

                evento.target.value = "";
                return;
            }

            const botao =
                document.getElementById(
                    "btnSelecionarAtualizacao"
                );

            const textoOriginal =
                botao?.textContent;

            try {
                if (botao) {
                    botao.disabled = true;
                    botao.textContent =
                        "Validando...";
                }

                definirEstadoAtualizacao({
                    preparado: false,
                    nome: arquivo.name,
                    detalhe:
                        `Enviando ${formatarTamanhoAtualizacao(arquivo.size)}...`
                });

                const formData =
                    new FormData();

                formData.append(
                    "pacote",
                    arquivo
                );

                const resposta =
                    await fetch(
                        "/api/atualizacao/enviar",
                        {
                            method: "POST",
                            body: formData
                        }
                    );

                const dados =
                    await resposta.json();

                if (!resposta.ok) {
                    throw new Error(
                        dados.mensagem ||
                        "Pacote inválido."
                    );
                }

                const tipoPacote =
                    dados.pacote?.tipo === "webapp"
                        ? "WebApp"
                        : "Completo";

                const versaoPacote =
                    dados.pacote?.versao
                        ? ` • versão ${dados.pacote.versao}`
                        : "";

                definirEstadoAtualizacao({
                    preparado: true,
                    nome: arquivo.name,
                    detalhe:
                        `${tipoPacote}${versaoPacote} • ${formatarTamanhoAtualizacao(dados.tamanho)} • estrutura validada`
                });

                modalSucesso(
                    `Pacote ${tipoPacote} validado${versaoPacote}.\n\nO banco e os backups serão preservados. Clique em Aplicar e reiniciar.`,
                    "Atualização pronta"
                );

            } catch (erro) {
                definirEstadoAtualizacao();

                modalErro(
                    erro.message ||
                    "Não foi possível preparar a atualização."
                );
            } finally {
                if (botao) {
                    botao.disabled = false;
                    botao.textContent =
                        textoOriginal ||
                        "Selecionar pacote";
                }

                evento.target.value = "";
            }
        }
    );


document
    .getElementById(
        "btnAplicarAtualizacao"
    )
    ?.addEventListener(
        "click",
        async () => {

            if (!pacoteAtualizacaoPreparado) {
                return;
            }

            if (!window.chrome?.webview) {
                modalAviso(
                    "A instalação automática funciona pelo aplicativo WebView2.",
                    "Atualização"
                );
                return;
            }

            const confirmar =
                await modalConfirmar(
                    "Aplicar a atualização agora?\n\nO banco será protegido por backup e o Adega PDV reiniciará automaticamente.",
                    "Atualizar Adega PDV"
                );

            if (!confirmar) {
                return;
            }

            const botao =
                document.getElementById(
                    "btnAplicarAtualizacao"
                );

            if (botao) {
                botao.disabled = true;
                botao.textContent =
                    "Atualizando...";
            }

            window.chrome.webview.postMessage({
                acao:
                    "aplicar-atualizacao"
            });
        }
    );


// ========================================
// SISTEMA / DIAGNÓSTICO
// ========================================

function formatarBytesSistema(bytes) {
    const valor = Number(bytes || 0);

    if (valor < 1024) {
        return `${valor} B`;
    }

    if (valor < 1024 * 1024) {
        return `${(valor / 1024).toFixed(1)} KB`;
    }

    return `${(valor / 1024 / 1024).toFixed(2)} MB`;
}


function formatarDuracaoSistema(segundos) {
    let total = Math.max(
        0,
        Number(segundos || 0)
    );

    const dias = Math.floor(
        total / 86400
    );

    total %= 86400;

    const horas = Math.floor(
        total / 3600
    );

    total %= 3600;

    const minutos = Math.floor(
        total / 60
    );

    if (dias > 0) {
        return `${dias}d ${horas}h ${minutos}min`;
    }

    if (horas > 0) {
        return `${horas}h ${minutos}min`;
    }

    return `${minutos} min`;
}


function formatarDataSistema(data) {
    if (!data) return "Nenhum";

    const valor = new Date(data);

    if (Number.isNaN(valor.getTime())) {
        return "Nenhum";
    }

    return valor.toLocaleString(
        "pt-BR"
    );
}


let infoHostSistema = {
    webview2: null,
    versaoApp: null
};


async function carregarStatusSistema() {

    if (
        usuarioAtual?.perfil !==
        "administrador"
    ) {
        return;
    }

    const servidorStatus =
        document.getElementById(
            "sistemaServidorStatus"
        );

    const servidorDetalhe =
        document.getElementById(
            "sistemaServidorDetalhe"
        );

    try {

        const resposta =
            await fetch(
                "/api/sistema/diagnostico"
            );

        const dados =
            await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                dados.mensagem ||
                "Erro ao carregar diagnóstico."
            );
        }


        servidorStatus.textContent =
            "Funcionando";

        servidorDetalhe.textContent =
            `${dados.servidor.host}:${dados.servidor.porta}`;


        const bancoStatus =
            document.getElementById(
                "sistemaBancoStatus"
            );

        const bancoDetalhe =
            document.getElementById(
                "sistemaBancoDetalhe"
            );

        bancoStatus.textContent =
            dados.banco.existe
                ? "OK"
                : "Não encontrado";

        bancoDetalhe.textContent =
            dados.banco.existe
                ? formatarBytesSistema(
                    dados.banco.tamanho
                )
                : "Verifique a instalação";


        const backupStatus =
            document.getElementById(
                "sistemaBackupStatus"
            );

        const backupDetalhe =
            document.getElementById(
                "sistemaBackupDetalhe"
            );

        const ultimo =
            dados.backups.ultimo_automatico ||
            dados.backups.ultimo;

        backupStatus.textContent =
            ultimo
                ? formatarDataSistema(
                    ultimo.data
                )
                : "Nenhum backup";

        backupDetalhe.textContent =
            `${dados.backups.automaticos} automático(s) · ${dados.backups.total} total`;


        document.getElementById(
            "sistemaVersao"
        ).textContent =
            `Adega PDV ${dados.app.versao}`;

        document.getElementById(
            "sistemaModo"
        ).textContent =
            dados.app.modo ===
            "desktop-webview2"
                ? "Aplicativo local WebView2"
                : "Web app local";


        document.getElementById(
            "diagVersaoApp"
        ).textContent =
            dados.app.versao;

        const diagLicenca =
            document.getElementById(
                "diagLicenca"
            );

        const diagLicencaValidade =
            document.getElementById(
                "diagLicencaValidade"
            );

        const diagInstalacaoId =
            document.getElementById(
                "diagInstalacaoId"
            );

        if (diagLicenca) {
            diagLicenca.textContent =
                dados.licenca?.tipo === "permanente"
                    ? "Permanente"
                    : dados.licenca?.tipo === "temporaria"
                        ? "Temporária"
                        : "Não identificada";
        }

        if (diagLicencaValidade) {
            diagLicencaValidade.textContent =
                dados.licenca?.tipo === "permanente"
                    ? "Sem vencimento"
                    : dados.licenca?.expira_em
                        ? formatarDataSistema(
                            dados.licenca.expira_em
                        )
                        : "—";
        }

        if (diagInstalacaoId) {
            diagInstalacaoId.textContent =
                dados.licenca?.instalacao_id ||
                "—";
        }

        const sistemaLicencaStatus =
            document.getElementById(
                "sistemaLicencaStatus"
            );

        const sistemaLicencaDetalhe =
            document.getElementById(
                "sistemaLicencaDetalhe"
            );

        const sistemaInstalacaoId =
            document.getElementById(
                "sistemaInstalacaoId"
            );

        if (sistemaLicencaStatus) {
            sistemaLicencaStatus.textContent =
                dados.licenca?.tipo === "permanente"
                    ? "Licença permanente"
                    : "Licença temporária";
        }

        if (sistemaLicencaDetalhe) {
            sistemaLicencaDetalhe.textContent =
                dados.licenca?.tipo === "permanente"
                    ? (dados.licenca?.cliente || "Sem vencimento")
                    : `Válida até ${formatarDataSistema(dados.licenca?.expira_em)} · ${dados.licenca?.dias_restantes ?? 0} dia(s)`;
        }

        if (sistemaInstalacaoId) {
            sistemaInstalacaoId.textContent =
                dados.licenca?.instalacao_id ||
                "—";
        }

        document.getElementById(
            "diagNode"
        ).textContent =
            dados.servidor.node;

        document.getElementById(
            "diagSQLite"
        ).textContent =
            dados.banco.sqlite || "—";

        document.getElementById(
            "diagUptime"
        ).textContent =
            formatarDuracaoSistema(
                dados.servidor.uptime_segundos
            );

        document.getElementById(
            "diagBackups"
        ).textContent =
            `${dados.backups.total} (${dados.backups.automaticos} automáticos)`;

        document.getElementById(
            "diagEndereco"
        ).textContent =
            `${dados.servidor.host}:${dados.servidor.porta}`;


        if (
            infoHostSistema.versaoApp
        ) {
            document.getElementById(
                "diagVersaoApp"
            ).textContent =
                infoHostSistema.versaoApp;
        }

        if (
            infoHostSistema.webview2
        ) {
            document.getElementById(
                "diagWebView"
            ).textContent =
                infoHostSistema.webview2;
        } else if (
            !window.chrome?.webview
        ) {
            document.getElementById(
                "diagWebView"
            ).textContent =
                "Navegador externo";
        }


        if (window.chrome?.webview) {
            window.chrome.webview.postMessage({
                acao: "obter-info-host"
            });
        }


    } catch (erro) {

        console.error(
            "Erro status sistema:",
            erro
        );

        servidorStatus.textContent =
            "Erro";

        servidorDetalhe.textContent =
            "Não foi possível carregar o diagnóstico";

    }

}


document
    .getElementById(
        "btnAtualizarSistema"
    )
    ?.addEventListener(
        "click",
        carregarStatusSistema
    );


document
    .getElementById(
        "btnTrocarLicenca"
    )
    ?.addEventListener(
        "click",
        () => {
            window.location.href =
                "/ativacao.html?trocar=1";
        }
    );


document
    .getElementById(
        "btnCopiarInstalacaoSistema"
    )
    ?.addEventListener(
        "click",
        async () => {
            const valor =
                document.getElementById(
                    "sistemaInstalacaoId"
                )?.textContent?.trim();

            if (!valor || valor === "—") {
                return;
            }

            try {
                await navigator.clipboard.writeText(
                    valor
                );

                await modalSucesso(
                    "Código da instalação copiado.",
                    "Licenciamento"
                );
            } catch {
                await modalAviso(
                    valor,
                    "Código da instalação"
                );
            }
        }
    );


document
    .getElementById(
        "btnAbrirPastaBackups"
    )
    ?.addEventListener(
        "click",
        async () => {

            if (window.chrome?.webview) {

                window.chrome.webview.postMessage({
                    acao: "abrir-backups"
                });

                return;
            }


            await modalAviso(
                "Esta opção está disponível quando o Adega PDV é aberto pelo aplicativo WebView2.",
                "Pasta de backups"
            );

        }
    );


if (window.chrome?.webview) {

    window.chrome.webview.addEventListener(
        "message",
        evento => {

            const dados =
                evento.data;

            if (
                !dados ||
                dados.tipo !==
                "info-host"
            ) {
                return;
            }

            infoHostSistema = {
                webview2:
                    dados.webview2 || null,

                versaoApp:
                    dados.versaoApp || null
            };


            const webview =
                document.getElementById(
                    "diagWebView"
                );

            if (webview) {
                webview.textContent =
                    dados.webview2 ||
                    "Disponível";
            }


            const versao =
                document.getElementById(
                    "diagVersaoApp"
                );

            if (
                versao &&
                dados.versaoApp
            ) {
                versao.textContent =
                    dados.versaoApp;
            }

        }
    );

}


// ==========================================
// RELATÓRIO DE LUCRO
// ==========================================

async function carregarRelatorioLucro() {

    try {

        const resposta =
            await fetch(
                "/api/relatorios/lucro"
            );

        const dados =
            await resposta.json();


        if (!resposta.ok) {

            console.error(
                "Erro relatório lucro:",
                dados
            );

            return;
        }


        document.getElementById(
            "lucroFaturamento"
        ).textContent =
            formatarDinheiro(
                dados.faturamento || 0
            );


        document.getElementById(
            "lucroCusto"
        ).textContent =
            formatarDinheiro(
                dados.custo || 0
            );


        const campoLucro =
            document.getElementById(
                "lucroBruto"
            );

        campoLucro.textContent =
            formatarDinheiro(
                dados.lucro || 0
            );


        document.getElementById(
            "lucroMargem"
        ).textContent =
            `${Number(
                dados.margem || 0
            ).toLocaleString(
                "pt-BR",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            )}%`;


        // Lucro negativo
        if (Number(dados.lucro) < 0) {
            campoLucro.style.color =
                "#dc2626";
        } else {
            campoLucro.style.color =
                "";
        }


    } catch (erro) {

        console.error(
            "Erro ao carregar lucro:",
            erro
        );

    }

}


// ==========================================
// PRODUTOS MAIS LUCRATIVOS
// ==========================================

async function carregarProdutosLucrativos() {

    const container =
        document.getElementById(
            "listaProdutosLucrativos"
        );

    if (!container) return;


    try {

        const resposta =
            await fetch(
                "/api/relatorios/produtos-lucrativos"
            );

        const resultado =
            await resposta.json();


        if (!resposta.ok) {
            throw new Error(
                resultado.mensagem ||
                "Erro"
            );
        }


        const produtos =
            resultado.dados || [];


        if (produtos.length === 0) {

            container.innerHTML = `
                <div class="lucro-vazio">
                    Nenhuma venda encontrada hoje.
                </div>
            `;

            return;
        }


        container.innerHTML =
            produtos.map(
                (produto, indice) => {

                    return `
                        <div class="produto-lucrativo">

                            <div
                                class="produto-lucrativo-posicao"
                            >
                                ${indice + 1}º
                            </div>


                            <div
                                class="produto-lucrativo nome"
                            >
                                <strong>
                                    ${produto.nome}
                                </strong>

                                <span>
                                    ${produto.quantidade_vendida}
                                    unidade(s) vendida(s)
                                </span>
                            </div>


                            <div
                                class="produto-lucrativo-valor"
                            >
                                <span>
                                    Faturamento
                                </span>

                                <strong>
                                    ${formatarDinheiro(
                                        produto.faturamento
                                    )}
                                </strong>
                            </div>


                            <div
                                class="produto-lucrativo-valor"
                            >
                                <span>
                                    Custo
                                </span>

                                <strong>
                                    ${formatarDinheiro(
                                        produto.custo
                                    )}
                                </strong>
                            </div>


                            <div
                                class="produto-lucrativo-valor lucro"
                            >
                                <span>
                                    Lucro
                                </span>

                                <strong>
                                    ${formatarDinheiro(
                                        produto.lucro
                                    )}
                                </strong>
                            </div>


                            <div
                                class="produto-lucrativo-valor"
                            >
                                <span>
                                    Margem
                                </span>

                                <strong>
                                    ${Number(
                                        produto.margem || 0
                                    ).toLocaleString(
                                        "pt-BR",
                                        {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        }
                                    )}%
                                </strong>
                            </div>

                        </div>
                    `;

                }
            )
            .join("");


    } catch (erro) {

        console.error(
            "Erro ranking lucro:",
            erro
        );

        container.innerHTML = `
            <div class="lucro-vazio">
                Não foi possível carregar
                os produtos.
            </div>
        `;

    }

}


// ==========================================
// LUCRO POR PERÍODO
// ==========================================

async function consultarLucroPeriodo() {

    const inicio =
        document.getElementById(
            "lucroDataInicio"
        ).value;

    const fim =
        document.getElementById(
            "lucroDataFim"
        ).value;


    if (!inicio || !fim) {

        await modalAviso(
            "Selecione a data inicial e a data final.",
            "Período incompleto"
        );

        return;
    }


    if (inicio > fim) {

        await modalAviso(
            "A data inicial não pode ser maior que a data final.",
            "Período inválido"
        );

        return;
    }


    try {

        const resposta =
            await fetch(
                `/api/relatorios/lucro-periodo?inicio=${encodeURIComponent(
                    inicio
                )}&fim=${encodeURIComponent(
                    fim
                )}`
            );


        const dados =
            await resposta.json();


        if (!resposta.ok) {

            await modalErro(
                dados.mensagem ||
                "Não foi possível consultar o período.",
                "Erro no relatório"
            );

            return;
        }


        document.getElementById(
            "lucroPeriodoVendas"
        ).textContent =
            dados.total_vendas || 0;


        document.getElementById(
            "lucroPeriodoFaturamento"
        ).textContent =
            formatarDinheiro(
                dados.faturamento || 0
            );


        document.getElementById(
            "lucroPeriodoCusto"
        ).textContent =
            formatarDinheiro(
                dados.custo || 0
            );


        document.getElementById(
            "lucroPeriodoLucro"
        ).textContent =
            formatarDinheiro(
                dados.lucro || 0
            );


        document.getElementById(
            "lucroPeriodoMargem"
        ).textContent =
            `${Number(
                dados.margem || 0
            ).toLocaleString(
                "pt-BR",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            )}%`;


    } catch (erro) {

        console.error(
            "Erro lucro período:",
            erro
        );

        await modalErro(
            "Não foi possível comunicar com o servidor.",
            "Erro"
        );

    }

}


// ==========================================
// DATAS PADRÃO
// ==========================================

function configurarDatasLucro() {

    const inicio =
        document.getElementById(
            "lucroDataInicio"
        );

    const fim =
        document.getElementById(
            "lucroDataFim"
        );


    if (!inicio || !fim) {
        return;
    }


    const hoje =
        new Date();


    const primeiroDia =
        new Date(
            hoje.getFullYear(),
            hoje.getMonth(),
            1
        );


    function formatarDataInput(data) {

        const ano =
            data.getFullYear();

        const mes =
            String(
                data.getMonth() + 1
            ).padStart(
                2,
                "0"
            );

        const dia =
            String(
                data.getDate()
            ).padStart(
                2,
                "0"
            );


        return `${ano}-${mes}-${dia}`;
    }


    inicio.value =
        formatarDataInput(
            primeiroDia
        );

    fim.value =
        formatarDataInput(
            hoje
        );

}


// ==========================================
// ATUALIZAR TUDO
// ==========================================

async function atualizarRelatorioLucro() {

    if (usuarioAtual?.perfil !== "administrador") {
        return;
    }

    await Promise.all([
        carregarRelatorioLucro(),
        carregarProdutosLucrativos()
    ]);

}


// BOTÃO ATUALIZAR

document
    .getElementById(
        "btnAtualizarLucro"
    )
    ?.addEventListener(
        "click",
        atualizarRelatorioLucro
    );


// BOTÃO CONSULTAR

document
    .getElementById(
        "btnConsultarLucro"
    )
    ?.addEventListener(
        "click",
        consultarLucroPeriodo
    );


// INICIALIZAÇÃO

configurarDatasLucro();

// Lucro é carregado após validar a sessão do administrador.


// ==========================================
// DASHBOARD COMPLETO
// ==========================================

async function carregarFinanceiroDashboard() {

    if (usuarioAtual?.perfil !== "administrador") {
        return;
    }

    try {

        const resposta =
            await fetch(
                "/api/relatorios/lucro"
            );

        const dados =
            await resposta.json();


        if (!resposta.ok) {
            return;
        }


        const faturamento =
            Number(
                dados.faturamento || 0
            );

        const custo =
            Number(
                dados.custo || 0
            );

        const lucro =
            Number(
                dados.lucro || 0
            );

        const margem =
            Number(
                dados.margem || 0
            );


        // CARD LUCRO

        document.getElementById(
            "dashboardLucro"
        ).textContent =
            formatarDinheiro(lucro);


        // CARD MARGEM

        document.getElementById(
            "dashboardMargem"
        ).textContent =
            `${margem.toLocaleString(
                "pt-BR",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            )}%`;


        // RESUMO

        document.getElementById(
            "dashboardResumoFaturamento"
        ).textContent =
            formatarDinheiro(
                faturamento
            );


        document.getElementById(
            "dashboardResumoCusto"
        ).textContent =
            formatarDinheiro(
                custo
            );


        const campoLucro =
            document.getElementById(
                "dashboardResumoLucro"
            );


        campoLucro.textContent =
            formatarDinheiro(
                lucro
            );


        document.getElementById(
            "dashboardResumoMargem"
        ).textContent =
            `${margem.toLocaleString(
                "pt-BR",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            )}%`;


        if (lucro < 0) {

            campoLucro.style.color =
                "#dc2626";

            document.getElementById(
                "dashboardLucro"
            ).style.color =
                "#dc2626";

        } else {

            campoLucro.style.color = "";

            document.getElementById(
                "dashboardLucro"
            ).style.color = "";

        }


    } catch (erro) {

        console.error(
            "Erro financeiro dashboard:",
            erro
        );

    }

}

async function carregarCaixaDashboard() {

    const box =
        document.getElementById(
            "dashboardCaixaStatusBox"
        );

    if (!box) {
        return;
    }


    try {

        const respostaCaixa =
            await fetch(
                "/api/caixa/aberto"
            );

        const caixa =
            await respostaCaixa.json();


        /*
            Sua API pode retornar o caixa
            diretamente ou dentro de uma
            propriedade "caixa".
        */

        const caixaAberto =
            caixa.caixa || caixa;


        if (
            !respostaCaixa.ok ||
            !caixaAberto ||
            !caixaAberto.id
        ) {

            mostrarCaixaFechadoDashboard();

            return;
        }


        box.classList.remove(
            "fechado"
        );

        box.classList.add(
            "aberto"
        );


        document.getElementById(
            "dashboardCaixaSituacao"
        ).textContent =
            "Aberto";


        document.getElementById(
            "dashboardCaixaIcone"
        ).textContent =
            "🔓";


        document.getElementById(
            "dashboardCaixaInicial"
        ).textContent =
            formatarDinheiro(
                caixaAberto.valor_inicial ||
                0
            );


        // RESUMO DO CAIXA

        try {

            const respostaResumo =
                await fetch(
                    "/api/caixa/resumo"
                );

            const resumo =
                await respostaResumo.json();


            if (respostaResumo.ok) {

                document.getElementById(
                    "dashboardCaixaVendas"
                ).textContent =
                    formatarDinheiro(
                        resumo.total_vendas ||
                        resumo.vendas ||
                        0
                    );


                document.getElementById(
                    "dashboardCaixaEsperado"
                ).textContent =
                    formatarDinheiro(
                        resumo.dinheiro_esperado ||
                        resumo.valor_esperado ||
                        0
                    );

            }

        } catch (erro) {

            console.error(
                "Erro resumo caixa dashboard:",
                erro
            );

        }


    } catch (erro) {

        console.error(
            "Erro caixa dashboard:",
            erro
        );

        mostrarCaixaFechadoDashboard();

    }

}


function mostrarCaixaFechadoDashboard() {

    const box =
        document.getElementById(
            "dashboardCaixaStatusBox"
        );

    if (!box) return;


    box.classList.remove(
        "aberto"
    );

    box.classList.add(
        "fechado"
    );


    document.getElementById(
        "dashboardCaixaSituacao"
    ).textContent =
        "Fechado";


    document.getElementById(
        "dashboardCaixaIcone"
    ).textContent =
        "🔒";


    document.getElementById(
        "dashboardCaixaInicial"
    ).textContent =
        "R$ 0,00";


    document.getElementById(
        "dashboardCaixaVendas"
    ).textContent =
        "R$ 0,00";


    document.getElementById(
        "dashboardCaixaEsperado"
    ).textContent =
        "R$ 0,00";

}


function percentualComparativo(atual, anterior) {
    atual = Number(atual || 0);
    anterior = Number(anterior || 0);
    if (anterior === 0) {
        if (atual === 0) return { texto: "Hoje vs. ontem: 0,0%", classe: "" };
        return { texto: "Hoje vs. ontem: +100,0%", classe: "positivo" };
    }
    const percentual = ((atual - anterior) / Math.abs(anterior)) * 100;
    return {
        texto: `Hoje vs. ontem: ${percentual >= 0 ? "+" : ""}${percentual.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
        classe: percentual > 0 ? "positivo" : percentual < 0 ? "negativo" : ""
    };
}


// =====================================================
// ALERTAS DE ESTOQUE E VALIDADE NO DASHBOARD
// =====================================================
function renderizarListaValidadesDashboard(produtos) {
    const area =
        document.getElementById(
            "dashboardListaValidades"
        );

    if (!area) return;

    if (!produtos?.length) {
        area.innerHTML = `
            <div class="dashboard-vazio">
                Nenhum produto vencido ou próximo do vencimento. ✓
            </div>
        `;
        return;
    }

    area.innerHTML =
        produtos.map(produto => {
            const dias =
                Number(produto.dias_restantes);

            let classe = "normal";
            let texto = "";

            if (dias < 0) {
                classe = "vencido";
                texto =
                    `Vencido há ${Math.abs(dias)} dia(s)`;
            }
            else if (dias === 0) {
                classe = "hoje";
                texto = "Vence hoje";
            }
            else if (dias <= 7) {
                classe = "breve";
                texto =
                    `Vence em ${dias} dia(s)`;
            }
            else {
                texto =
                    `Vence em ${dias} dia(s)`;
            }

            const data =
                new Date(
                    `${produto.data_validade}T00:00:00`
                ).toLocaleDateString(
                    "pt-BR"
                );

            return `
                <div class="dashboard-validade-item ${classe}">
                    <div>
                        <strong>
                            ${escaparHtmlUsuario(
                                produto.nome || "Produto"
                            )}
                        </strong>

                        <small>
                            ${Number(
                                produto.quantidade || 0
                            )}
                            ${escaparHtmlUsuario(
                                produto.unidade || "un"
                            )}
                            em estoque
                        </small>
                    </div>

                    <div class="dashboard-validade-status">
                        <strong>${texto}</strong>
                        <small>${data}</small>
                    </div>
                </div>
            `;
        }).join("");
}


async function carregarAlertasDashboard() {
    try {
        const resposta =
            await fetch(
                "/api/estoque/alertas-dashboard"
            );

        const dados =
            await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
            return;
        }

        const semEstoque =
            document.getElementById(
                "dashboardSemEstoqueAlerta"
            );

        const vencem =
            document.getElementById(
                "dashboardVencemSemana"
            );

        const vencidosTexto =
            document.getElementById(
                "dashboardVencidosTexto"
            );

        if (semEstoque) {
            semEstoque.textContent =
                Number(dados.sem_estoque || 0);
        }

        if (vencem) {
            vencem.textContent =
                Number(dados.vencem_semana || 0);
        }

        if (vencidosTexto) {
            vencidosTexto.textContent =
                `${Number(
                    dados.vencidos || 0
                )} produto(s) já vencido(s)`;
        }

        if (
            usuarioAtual?.perfil ===
            "administrador"
        ) {
            const perdas =
                document.getElementById(
                    "dashboardPerdasMes"
                );

            const perdasQtd =
                document.getElementById(
                    "dashboardPerdasMesQtd"
                );

            if (perdas) {
                perdas.textContent =
                    formatarDinheiro(
                        dados.perdas_mes_custo || 0
                    );
            }

            if (perdasQtd) {
                perdasQtd.textContent =
                    `${Number(
                        dados
                            .perdas_mes_quantidade ||
                        0
                    )} unidade(s) perdida(s)`;
            }
        }

        renderizarListaValidadesDashboard(
            dados.produtos_validade || []
        );

    } catch (erro) {
        console.error(
            "Erro ao carregar alertas do dashboard:",
            erro
        );
    }
}


function aplicarComparativoDashboard(id, atual, anterior) {
    const el = document.getElementById(id);
    if (!el) return;
    const resultado = percentualComparativo(atual, anterior);
    el.textContent = resultado.texto;
    el.classList.remove("positivo", "negativo");
    if (resultado.classe) el.classList.add(resultado.classe);
}

function formatarDiaDashboard(data) {
    const partes = String(data || "").split("-");
    if (partes.length !== 3) return data || "";
    return `${partes[2]}/${partes[1]}`;
}

function renderizarGraficoDashboard(dados) {
    const area = document.getElementById("graficoDashboard7Dias");
    if (!area) return;

    const lista = Array.isArray(dados) ? dados : [];

    if (!lista.length) {
        area.innerHTML =
            '<div class="dashboard-vazio">Ainda não há dados suficientes para o gráfico.</div>';
        return;
    }

    const maior = Math.max(
        ...lista.map(
            item =>
                Number(
                    item.faturamento ||
                    0
                )
        ),
        1
    );

    area.innerHTML = `
        <div class="grafico-grade-linhas" aria-hidden="true">
            <i></i><i></i><i></i><i></i>
        </div>

        ${lista.map((item, indice) => {
            const valor =
                Number(
                    item.faturamento ||
                    0
                );

            const altura =
                valor > 0
                    ? Math.max(
                        (
                            valor /
                            maior
                        ) * 100,
                        4
                    )
                    : 2;

            return `
                <div
                    class="grafico-coluna grafico-coluna-moderno"
                    title="${formatarDinheiro(valor)} • ${Number(item.vendas || 0)} venda(s)"
                >
                    <span class="grafico-tooltip">
                        ${formatarDinheiro(valor)}
                    </span>

                    <div class="grafico-barra-area">
                        <div
                            class="grafico-barra"
                            style="height:${altura}%"
                        ></div>
                    </div>

                    <span class="grafico-dia">
                        ${formatarDiaDashboard(item.data)}
                    </span>
                </div>
            `;
        }).join("")}
    `;
}

function renderizarRankingDashboard(produtos) {
    finalizarSkeleton(
        document.getElementById(
            "rankingProdutosDashboard"
        )
    );

    const area = document.getElementById("rankingProdutosDashboard");
    if (!area) return;

    if (!produtos?.length) {
        area.innerHTML =
            '<div class="dashboard-vazio">Ainda não há vendas no período.</div>';
        return;
    }

    const maior =
        Math.max(
            ...produtos.map(
                produto =>
                    Number(
                        produto.quantidade ||
                        0
                    )
            ),
            1
        );

    area.innerHTML =
        produtos.slice(0, 5)
            .map(
                (produto, indice) => {

                    const quantidade =
                        Number(
                            produto.quantidade ||
                            0
                        );

                    const percentual =
                        Math.max(
                            (
                                quantidade /
                                maior
                            ) * 100,
                            4
                        );

                    return `
                        <div class="ranking-dashboard-item ranking-dashboard-item-moderno">

                            <span class="ranking-dashboard-posicao">
                                ${indice + 1}
                            </span>

                            <div class="ranking-dashboard-info">

                                <div class="ranking-dashboard-linha">
                                    <strong>
                                        ${escaparHtmlUsuario(produto.nome || "Produto")}
                                    </strong>

                                    <span>
                                        ${quantidade} un.
                                    </span>
                                </div>

                                <div class="ranking-dashboard-barra">
                                    <i style="width:${percentual}%"></i>
                                </div>

                                <small>
                                    ${formatarDinheiro(Number(produto.faturamento || 0))}
                                </small>

                            </div>

                        </div>
                    `;

                }
            )
            .join("");
}

function renderizarEstoqueBaixoDashboard(produtos) {
    const area = document.getElementById("listaEstoqueBaixoDashboard");
    if (!area) return;
    if (!produtos?.length) {
        area.innerHTML = '<div class="dashboard-vazio">Nenhum produto com estoque baixo. ✓</div>';
        return;
    }
    area.innerHTML = produtos.map(produto => `
        <div class="dashboard-atencao-item">
            <div>
                <strong>${escaparHtmlUsuario(produto.nome || "Produto")}</strong>
                <small>Mínimo: ${Number(produto.estoque_minimo || 0)}</small>
            </div>
            <div class="dashboard-atencao-valor">
                <strong>${Number(produto.quantidade || 0)} ${escaparHtmlUsuario(produto.unidade || "un.")}</strong>
                <small>${Number(produto.quantidade || 0) <= 0 ? "Sem estoque" : "Estoque baixo"}</small>
            </div>
        </div>
    `).join("");
}

function renderizarProdutosParadosDashboard(produtos) {
    const area = document.getElementById("listaProdutosParadosDashboard");
    if (!area) return;
    if (!produtos?.length) {
        area.innerHTML = `<div class="dashboard-vazio">Nenhum produto parado há mais de ${Number(configuracoesSistema?.dias_produto_parado ?? 30)} dias. ✓</div>`;
        return;
    }
    area.innerHTML = produtos.map(produto => `
        <div class="dashboard-atencao-item">
            <div>
                <strong>${escaparHtmlUsuario(produto.nome || "Produto")}</strong>
                <small>${produto.ultima_venda ? `Última venda: ${formatarDataUsuario(produto.ultima_venda)}` : "Nunca vendido"}</small>
            </div>
            <div class="dashboard-atencao-valor">
                <strong>${Number(produto.quantidade || 0)} ${escaparHtmlUsuario(produto.unidade || "un.")}</strong>
                <small>em estoque</small>
            </div>
        </div>
    `).join("");
}

async function carregarDashboardAvancado() {
    if (usuarioAtual?.perfil !== "administrador") return;
    try {
        const resposta = await fetch("/api/relatorios/dashboard-avancado");
        const dados = await resposta.json();
        if (!resposta.ok || !dados.sucesso) return;

        document.getElementById("dash7Vendas").textContent =
            Number(dados.resumo_7_dias?.vendas || 0);
        document.getElementById("dash7Faturamento").textContent =
            formatarDinheiro(Number(dados.resumo_7_dias?.faturamento || 0));
        document.getElementById("dash7Ticket").textContent =
            formatarDinheiro(Number(dados.resumo_7_dias?.ticket_medio || 0));
        document.getElementById("dashProdutosParados").textContent =
            Number(dados.total_produtos_parados || 0);

        aplicarComparativoDashboard(
            "dashComparativoVendas",
            dados.hoje?.vendas,
            dados.ontem?.vendas
        );
        aplicarComparativoDashboard(
            "dashComparativoFaturamento",
            dados.hoje?.faturamento,
            dados.ontem?.faturamento
        );

        renderizarGraficoDashboard(dados.serie_7_dias);
        renderizarRankingDashboard(dados.produtos_mais_vendidos);
        renderizarEstoqueBaixoDashboard(dados.estoque_baixo);
        renderizarProdutosParadosDashboard(dados.produtos_parados);
    } catch (erro) {
        console.error("Erro dashboard avançado:", erro);
    }
}

document.getElementById("btnAtualizarDashboardAvancado")
    ?.addEventListener("click", carregarDashboardAvancado);



// ========================================
// DASHBOARD DO OPERADOR
// ========================================

function configurarDashboardPorPerfil() {
    const administrador =
        usuarioAtual?.perfil ===
        "administrador";

    document
        .querySelectorAll(
            ".dashboard-admin-only"
        )
        .forEach(
            elemento => {
                elemento.style.display =
                    administrador
                        ? ""
                        : "none";
            }
        );

    const dashboard =
        document.getElementById(
            "dashboard"
        );

    dashboard?.classList.toggle(
        "dashboard-operador",
        !administrador
    );

    const chip =
        document.getElementById(
            "dashboardHeroChip"
        );

    const texto =
        document.getElementById(
            "dashboardHeroTexto"
        );

    if (chip) {
        chip.textContent =
            administrador
                ? "Visão geral"
                : "Visão operacional";
    }

    if (texto) {
        texto.textContent =
            administrador
                ? "Aqui está um resumo da sua adega hoje."
                : "Acompanhe vendas do dia, caixa, estoque e alertas.";
    }

    if (!administrador) {
        // O ranking depende de /api/relatorios/dashboard-avancado.
        // Como operador não possui essa permissão, removemos qualquer
        // skeleton que tenha ficado da montagem inicial da página.
        const ranking =
            document.getElementById(
                "rankingProdutosDashboard"
            );

        if (ranking) {
            finalizarSkeleton(
                ranking
            );
        }

        const grafico =
            document.getElementById(
                "graficoDashboard7Dias"
            );

        if (grafico) {
            finalizarSkeleton(
                grafico
            );
        }
    }
}


async function carregarDashboardOperador() {
    if (
        usuarioAtual?.perfil ===
        "administrador"
    ) {
        return;
    }

    try {
        const resposta =
            await fetch(
                "/api/produtos"
            );

        const dados =
            await resposta.json();

        if (!resposta.ok) {
            return;
        }

        const produtos =
            Array.isArray(dados)
                ? dados
                : (
                    Array.isArray(
                        dados.produtos
                    )
                        ? dados.produtos
                        : []
                );

        const estoqueBaixo =
            produtos
                .filter(
                    produto =>
                        Number(
                            produto.ativo ?? 1
                        ) === 1 &&
                        String(
                            produto.tipo_estoque ||
                            "normal"
                        ) === "normal" &&
                        Number(
                            produto.quantidade || 0
                        ) <=
                        Number(
                            produto.estoque_minimo || 0
                        )
                )
                .sort(
                    (a, b) =>
                        Number(
                            a.quantidade || 0
                        ) -
                        Number(
                            b.quantidade || 0
                        )
                )
                .slice(0, 8);

        renderizarEstoqueBaixoDashboard(
            estoqueBaixo
        );

    } catch (erro) {
        console.error(
            "Erro dashboard operador:",
            erro
        );

        const area =
            document.getElementById(
                "listaEstoqueBaixoDashboard"
            );

        if (area) {
            area.innerHTML =
                '<div class="dashboard-vazio">Não foi possível carregar o estoque baixo.</div>';
        }
    }
}


async function atualizarDashboardCompleto() {

    configurarDashboardPorPerfil();

    const tarefas = [
        carregarCardsPrincipaisDashboard(),
        carregarCaixaDashboard(),
        carregarAlertasDashboard()
    ];

    if (
        usuarioAtual?.perfil ===
        "administrador"
    ) {
        tarefas.push(
            carregarFinanceiroDashboard(),
            carregarDashboardAvancado()
        );
    } else {
        tarefas.push(
            carregarDashboardOperador()
        );
    }

    await Promise.allSettled(
        tarefas
    );

    if (
        typeof carregarResumoEstoque ===
        "function"
    ) {
        await carregarResumoEstoque();
    }

    // Mantém também as categorias/gráfico de categorias sincronizados.
    if (
        typeof carregarCategoriasDashboardModerno ===
            "function"
    ) {
        await carregarCategoriasDashboardModerno();
    }
}


// =====================================================
// V2.1.5 - DASHBOARD EM TEMPO REAL LOCAL
// =====================================================

let dashboardAtualizacaoEmAndamento =
    false;

let dashboardUltimaAtualizacao =
    0;

const DASHBOARD_INTERVALO_ATUALIZACAO =
    5000; // 5 segundos


function dashboardEstaVisivel() {
    const dashboard =
        document.getElementById(
            "dashboard"
        );

    return Boolean(
        dashboard?.classList.contains(
            "ativa"
        )
    );
}


async function atualizarDashboardAutomaticamente(
    {
        forcar = false
    } = {}
) {
    if (
        !forcar &&
        (
            !dashboardEstaVisivel() ||
            document.visibilityState ===
                "hidden"
        )
    ) {
        return;
    }

    if (
        dashboardAtualizacaoEmAndamento
    ) {
        return;
    }

    dashboardAtualizacaoEmAndamento =
        true;

    try {
        await atualizarDashboardCompleto();

        dashboardUltimaAtualizacao =
            Date.now();
    } catch (erro) {
        console.error(
            "Erro na atualização automática do dashboard:",
            erro
        );
    } finally {
        dashboardAtualizacaoEmAndamento =
            false;
    }
}


function iniciarAtualizacaoAutomaticaDashboard() {
    // Atualiza a cada 10 segundos somente enquanto o Dashboard está aberto.
    setInterval(
        () => {
            atualizarDashboardAutomaticamente();
        },
        DASHBOARD_INTERVALO_ATUALIZACAO
    );

    // Ao voltar para a janela depois de usar outro programa,
    // atualiza imediatamente em vez de esperar o próximo intervalo.
    document.addEventListener(
        "visibilitychange",
        () => {
            if (
                document.visibilityState ===
                    "visible" &&
                dashboardEstaVisivel()
            ) {
                atualizarDashboardAutomaticamente(
                    {
                        forcar: true
                    }
                );
            }
        }
    );

    window.addEventListener(
        "focus",
        () => {
            if (
                dashboardEstaVisivel()
            ) {
                atualizarDashboardAutomaticamente(
                    {
                        forcar: true
                    }
                );
            }
        }
    );
}


iniciarAtualizacaoAutomaticaDashboard();

document
    .getElementById(
        "btnAtualizarDashboard"
    )
    ?.addEventListener(
        "click",
        () =>
            atualizarDashboardAutomaticamente(
                {
                    forcar: true
                }
            )
    );

    atualizarDashboardAutomaticamente(
        {
            forcar: true
        }
    );

    async function carregarResumoFechamento() {

    try {

        const resposta =
            await fetch(
                "/api/caixa/resumo-fechamento"
            );

        const dados =
            await resposta.json();

        if (!resposta.ok) {
            return;
        }

        document.getElementById(
            "fechamentoAbertoPor"
        ).textContent =
            dados.caixa.usuario_abertura_nome ||
            "Não registrado";

        document.getElementById(
            "fechamentoFechadoPor"
        ).textContent =
            usuarioAtual?.nome ||
            "Usuário atual";

        document.getElementById(
            "fechamentoVendas"
        ).textContent =
            dados.vendas.quantidade;

        document.getElementById(
            "fechamentoFaturamento"
        ).textContent =
            formatarDinheiro(
                dados.vendas.faturamento
            );

        if (usuarioAtual?.perfil === "administrador") {
            document.getElementById(
                "fechamentoCusto"
            ).textContent =
                formatarDinheiro(
                    dados.vendas.custo
                );

            document.getElementById(
                "fechamentoLucro"
            ).textContent =
                formatarDinheiro(
                    dados.vendas.lucro
                );

            document.getElementById(
                "fechamentoMargem"
            ).textContent =
                `${Number(
                    dados.vendas.margem || 0
                ).toLocaleString(
                    "pt-BR",
                    {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }
                )}%`;
        }

        document.getElementById(
            "fechamentoDescontos"
        ).textContent =
            formatarDinheiro(
                dados.vendas.descontos
            );

        document.getElementById(
            "fechamentoDinheiro"
        ).textContent =
            formatarDinheiro(
                dados.pagamentos.dinheiro
            );

        document.getElementById(
            "fechamentoPix"
        ).textContent =
            formatarDinheiro(
                dados.pagamentos.pix
            );

        document.getElementById(
            "fechamentoDebito"
        ).textContent =
            formatarDinheiro(
                dados.pagamentos.debito
            );

        document.getElementById(
            "fechamentoCredito"
        ).textContent =
            formatarDinheiro(
                dados.pagamentos.credito
            );

        document.getElementById(
            "fechamentoTrocoEntregue"
        ).textContent =
            formatarDinheiro(
                dados.pagamentos.troco_entregue || 0
            );

        document.getElementById(
            "fechamentoValorInicial"
        ).textContent =
            formatarDinheiro(
                dados.caixa.valor_inicial
            );

        document.getElementById(
            "fechamentoSuprimentos"
        ).textContent =
            formatarDinheiro(
                dados.movimentacoes.suprimentos
            );

        document.getElementById(
            "fechamentoSangrias"
        ).textContent =
            formatarDinheiro(
                dados.movimentacoes.sangrias
            );

        document.getElementById(
            "fechamentoDinheiroEsperado"
        ).textContent =
            formatarDinheiro(
                dados.dinheiro_esperado
            );

    } catch (erro) {

        console.error(
            "Erro ao carregar resumo do fechamento:",
            erro
        );

    }

}

// =====================================================
// MODO ESCURO
// =====================================================

const btnTema =
    document.getElementById("btnTema");

const iconeTema =
    document.getElementById("iconeTema");

const textoTema =
    document.getElementById("textoTema");


function atualizarBotaoTema() {

    const escuro =
        document.body.classList.contains(
            "tema-escuro"
        );

    if (iconeTema) {
        iconeTema.textContent =
            escuro ? "☀️" : "🌙";
    }

    if (textoTema) {
        textoTema.textContent =
            escuro
                ? "Modo claro"
                : "Modo escuro";
    }
}


function aplicarTema(tema) {

    if (tema === "escuro") {

        document.body.classList.add(
            "tema-escuro"
        );

    } else {

        document.body.classList.remove(
            "tema-escuro"
        );

    }

    atualizarBotaoTema();
}


// Recuperar preferência salva

const temaSalvo =
    localStorage.getItem(
        "adega-tema"
    );

if (temaSalvo) {

    aplicarTema(temaSalvo);

} else {

    aplicarTema("claro");

}


// Alternar tema

btnTema?.addEventListener(
    "click",
    () => {

        const escuro =
            document.body.classList.contains(
                "tema-escuro"
            );

        const novoTema =
            escuro
                ? "claro"
                : "escuro";

        aplicarTema(novoTema);

        localStorage.setItem(
            "adega-tema",
            novoTema
        );

    }
);

document
    .getElementById(
        "btnPaginaAnterior"
    )
    ?.addEventListener(
        "click",
        () => {

            if (paginaVendasAtual > 1) {

                carregarHistoricoVendas(
                    paginaVendasAtual - 1
                );

            }

        }
    );


document
    .getElementById(
        "btnProximaPagina"
    )
    ?.addEventListener(
        "click",
        () => {

            carregarHistoricoVendas(
                paginaVendasAtual + 1
            );

        }
    );


    // =====================================================
// USUÁRIO LOGADO
// =====================================================

async function carregarUsuarioLogado() {

    try {

        const resposta =
            await fetch("/api/auth/sessao");

        if (!resposta.ok) {
            window.location.href =
                "/login.html";

            return;
        }

        const dados =
            await resposta.json();

        const usuario =
            dados.usuario;

        usuarioAtual = usuario;

        document.getElementById(
            "nomeUsuario"
        ).textContent =
            usuario.nome;

        document.getElementById(
            "perfilUsuario"
        ).textContent =
            usuario.perfil;


        aplicarPermissoesInterface(
            usuario
        );

        // Atualiza o dashboard já conhecendo o perfil.
        await atualizarDashboardCompleto();

        // Dados financeiros e relatórios somente para administrador.
        if (usuario.perfil === "administrador") {
            await Promise.all([
                carregarRelatorios(),
                atualizarRelatorioLucro()
            ]);
        }

    } catch (erro) {

        console.error(
            "Erro ao verificar usuário:",
            erro
        );

    }

}

function aplicarPermissoesInterface(
    usuario
) {

    const administrador =
        usuario.perfil ===
        "administrador";


    // Dashboard também muda conforme o perfil.
    configurarDashboardPorPerfil();


    // =========================
    // MENU RELATÓRIOS
    // =========================

    const menuRelatorios =
        document.querySelector(
            '[data-tela="relatorios"]'
        );

    if (menuRelatorios) {
        menuRelatorios.style.display =
            administrador
                ? ""
                : "none";
    }

    const menuFechamentoMensal =
        document.querySelector(
            '[data-tela="fechamentoMensal"]'
        );

    if (menuFechamentoMensal) {
        menuFechamentoMensal.style.display =
            administrador ? "" : "none";
    }


    // =========================
    // MENU USUÁRIOS
    // =========================

    const menuUsuarios =
        document.querySelector(
            '[data-tela="usuarios"]'
        );

    if (menuUsuarios) {
        menuUsuarios.style.display =
            administrador
                ? ""
                : "none";
    }

    const menuAuditoria = document.querySelector('[data-tela="auditoria"]');
    if (menuAuditoria) {
        menuAuditoria.style.display = administrador ? "" : "none";
    }

    const menuConfiguracoes = document.querySelector('[data-tela="configuracoes"]');
    if (menuConfiguracoes) {
        menuConfiguracoes.style.display = administrador ? "" : "none";
    }


    const menuSistema = document.querySelector('[data-tela="sistema"]');
    if (menuSistema) {
        menuSistema.style.display = administrador ? "" : "none";
    }

    document.querySelectorAll(".admin-financeiro").forEach(elemento => {
        elemento.style.display = administrador ? "" : "none";
    });


    document.querySelectorAll(".admin-planilha").forEach(elemento => {
        elemento.style.display = administrador ? "" : "none";
    });


    // =========================
    // ATALHO RELATÓRIOS
    // =========================

    const atalhoRelatorios =
        document.querySelector(
            '[data-ir="relatorios"]'
        );

    if (atalhoRelatorios) {
        atalhoRelatorios.style.display =
            administrador
                ? ""
                : "none";
    }


    // =========================
    // CARDS FINANCEIROS
    // =========================

    const lucroCard =
        document.querySelector(
            ".card-lucro-dashboard"
        );

    if (lucroCard) {
        lucroCard.style.display =
            administrador
                ? ""
                : "none";
    }


    // Card de margem
    const dashboardMargem =
        document.getElementById(
            "dashboardMargem"
        );

    if (
        dashboardMargem &&
        dashboardMargem.closest(".card")
    ) {
        dashboardMargem
            .closest(".card")
            .style.display =
                administrador
                    ? ""
                    : "none";
    }


    // =========================
    // RESUMO FINANCEIRO
    // =========================

    const resumoFinanceiro =
        document.querySelector(
            ".dashboard-financeiro"
        );

    if (resumoFinanceiro) {
        resumoFinanceiro.style.display =
            administrador
                ? ""
                : "none";
    }


    // =========================
    // PREÇO / VALOR DE CUSTO
    // =========================

    document
        .querySelectorAll(".admin-custo")
        .forEach(elemento => {
            elemento.style.display =
                administrador
                    ? ""
                    : "none";
        });

}


// =====================================================
// MINHA SENHA
// =====================================================
function abrirModalMinhaSenha() {
    const form = document.getElementById("formMinhaSenha");
    form?.reset();
    document.getElementById("modalMinhaSenha")?.classList.add("ativo");
    setTimeout(() => document.getElementById("minhaSenhaAtual")?.focus(), 50);
}

function fecharModalMinhaSenha() {
    document.getElementById("modalMinhaSenha")?.classList.remove("ativo");
}

async function salvarMinhaSenha(evento) {
    evento.preventDefault();

    const senhaAtual = document.getElementById("minhaSenhaAtual").value;
    const novaSenha = document.getElementById("minhaNovaSenha").value;
    const confirmar = document.getElementById("minhaNovaSenhaConfirmar").value;

    if (novaSenha.length < 6) {
        return modalAviso("A nova senha deve ter pelo menos 6 caracteres.");
    }

    if (novaSenha !== confirmar) {
        return modalAviso("A confirmação da nova senha não confere.");
    }

    if (senhaAtual === novaSenha) {
        return modalAviso("A nova senha deve ser diferente da senha atual.");
    }

    try {
        const resposta = await fetch("/api/auth/minha-senha", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                senha_atual: senhaAtual,
                nova_senha: novaSenha
            })
        });

        const dados = await resposta.json();
        if (!resposta.ok) {
            return modalErro(dados.mensagem || "Não foi possível alterar sua senha.");
        }

        fecharModalMinhaSenha();
        modalSucesso(dados.mensagem || "Senha alterada com sucesso.");
    } catch (erro) {
        console.error(erro);
        modalErro("Não foi possível alterar sua senha.");
    }
}

document.getElementById("btnMinhaSenha")?.addEventListener("click", abrirModalMinhaSenha);
document.getElementById("formMinhaSenha")?.addEventListener("submit", salvarMinhaSenha);
document.getElementById("fecharModalMinhaSenha")?.addEventListener("click", fecharModalMinhaSenha);
document.getElementById("cancelarModalMinhaSenha")?.addEventListener("click", fecharModalMinhaSenha);

// =====================================================
// LOGOUT
// =====================================================

document.getElementById(
    "btnLogout"
)?.addEventListener(
    "click",
    async () => {

        try {

            const resposta =
                await fetch(
                    "/api/auth/logout",
                    {
                        method: "POST"
                    }
                );

            if (!resposta.ok) {
                throw new Error(
                    "Erro ao sair"
                );
            }

            window.location.href =
                "/login.html";

        } catch (erro) {

            console.error(erro);

            modalErro(
                "Não foi possível sair do sistema."
            );

        }

    }
);




// =====================================================
// FECHAMENTO MENSAL
// =====================================================
function fmMesAtual() {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

function fmNomeMes(mes) {
    if (!mes) return "—";
    const [ano, numero] = mes.split("-").map(Number);
    const data = new Date(ano, numero - 1, 1);
    const nome = data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return nome.charAt(0).toUpperCase() + nome.slice(1);
}

function fmDinheiro(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = formatarDinheiro(Number(valor || 0));
}

function fmRenderizarDias(dias) {
    const area = document.getElementById("fmGrafico");
    if (!area) return;
    if (!dias?.length) {
        area.innerHTML = '<div class="dashboard-vazio">Nenhuma venda finalizada neste mês.</div>';
        return;
    }
    const maximo = Math.max(...dias.map(item => Number(item.faturamento || 0)), 1);
    area.innerHTML = dias.map(item => {
        const valor = Number(item.faturamento || 0);
        const largura = Math.max(4, (valor / maximo) * 100);
        const data = new Date(`${item.data}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        return `
            <div class="fm-dia">
                <span>${data}</span>
                <div class="fm-barra"><i style="width:${largura}%"></i></div>
                <div><strong>${formatarDinheiro(valor)}</strong><small>${Number(item.vendas || 0)} venda(s)</small></div>
            </div>`;
    }).join("");
}

async function carregarFechamentoMensal() {
    if (usuarioAtual?.perfil !== "administrador") return;
    const campo = document.getElementById("fechamentoMes");
    if (!campo) return;
    if (!campo.value) campo.value = fmMesAtual();
    try {
        const resposta = await fetch(`/api/relatorios/fechamento-mensal?mes=${encodeURIComponent(campo.value)}`);
        const dados = await resposta.json();
        if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || "Erro ao gerar fechamento mensal.");

        const r = dados.resumo || {};
        const p = dados.pagamentos || {};
        document.getElementById("fechamentoMensalTitulo").textContent = fmNomeMes(dados.mes);
        fmDinheiro("fmFaturamento", r.faturamento);
        fmDinheiro("fmLucro", r.lucro_bruto);
        fmDinheiro("fmCusto", r.custo_mercadoria);
        fmDinheiro("fmPerdas", r.perdas_custo);
        fmDinheiro("fmResultado", r.resultado_apos_perdas);
        fmDinheiro("fmTicket", r.ticket_medio);
        fmDinheiro("fmDinheiro", p.dinheiro);
        fmDinheiro("fmPix", p.pix);
        fmDinheiro("fmDebito", p.debito);
        fmDinheiro("fmCredito", p.credito);
        fmDinheiro("fmOutros", p.outros);
        fmDinheiro("fmResumoFat", r.faturamento);
        fmDinheiro("fmResumoDesc", r.descontos);
        fmDinheiro("fmResumoCusto", r.custo_mercadoria);
        fmDinheiro("fmResumoPerdas", r.perdas_custo);
        fmDinheiro("fmResumoResultado", r.resultado_apos_perdas);

        document.getElementById("fmVendas").textContent = `${Number(r.quantidade_vendas || 0)} venda(s)`;
        document.getElementById("fmResumoVendas").textContent = Number(r.quantidade_vendas || 0);
        document.getElementById("fmMargem").textContent = `Margem: ${Number(r.margem_bruta || 0).toLocaleString("pt-BR", {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`;
        document.getElementById("fmPerdasQtd").textContent = `${Number(r.perdas_quantidade || 0)} unidade(s) perdida(s)`;
        document.getElementById("fmDescontos").textContent = `${formatarDinheiro(r.descontos || 0)} em descontos`;
        fmRenderizarDias(dados.dias || []);
    } catch (erro) {
        console.error("Erro fechamento mensal:", erro);
        modalErro(erro.message || "Não foi possível gerar o fechamento mensal.");
    }
}

document.getElementById("btnGerarFechamentoMensal")?.addEventListener("click", carregarFechamentoMensal);
document.getElementById("fechamentoMes")?.addEventListener("change", carregarFechamentoMensal);

// =====================================================
// CONFIGURAÇÕES DA ADEGA
// =====================================================
let removerLogoConfiguracao = false;

function configBool(valor, padrao = true) {
    if (valor === undefined || valor === null) {
        return padrao;
    }

    return Number(valor) === 1 ||
        valor === true ||
        valor === "1";
}

function aplicarConfiguracoesPDV(config) {
    if (!config) return;

    const painelDestaques =
        document.getElementById("pdvDestaques");

    if (painelDestaques) {
        const exibir =
            configBool(
                config.pdv_exibir_destaques,
                true
            );

        painelDestaques.dataset.habilitado =
            exibir ? "1" : "0";

        if (!exibir) {
            painelDestaques.style.display =
                "none";
        }
    }

    const desconto =
        document.getElementById("descontoPDV");

    if (desconto) {
        const permitir =
            configBool(
                config.pdv_permitir_desconto,
                true
            );

        desconto.disabled = !permitir;

        if (!permitir) {
            desconto.value = 0;
        }

        desconto.title = permitir
            ? `Desconto máximo: ${Number(
                config
                    .pdv_desconto_maximo_percentual ??
                100
            )}% do subtotal`
            : "Descontos desativados nas configurações do PDV.";
    }
}

function aplicarIdentidadeSistema(config) {
    if (!config) return;

    configuracoesSistema = config;

    const nome =
        document.getElementById(
            "nomeAdegaSistema"
        );

    const subtitulo =
        document.getElementById(
            "subtituloAdegaSistema"
        );

    const logo =
        document.getElementById(
            "logoSistema"
        );

    if (nome) {
        nome.textContent =
            config.nome_adega ||
            "Adega do Chefe";
    }

    if (subtitulo) {
        subtitulo.textContent =
            config.subtitulo ||
            "Sistema de Gestão";
    }

    document.title =
        `${config.nome_adega || "Adega"} - PDV`;

    if (logo) {
        logo.innerHTML =
            config.logo
                ? `<img src="${config.logo}" alt="Logo">`
                : "🍷";
    }

    if (
        !localStorage.getItem(
            "adega-tema"
        )
    ) {
        aplicarTema(
            config.tema_padrao ||
            "claro"
        );
    }

    aplicarConfiguracoesPDV(config);

    const diasParado =
        Number(
            config.dias_produto_parado ??
            30
        );

    document
        .querySelectorAll(
            ".texto-produto-parado"
        )
        .forEach(elemento => {
            elemento.textContent =
                `Sem venda nos últimos ${diasParado} dias`;
        });
}

async function carregarConfiguracoesSistema() {
    try {
        const resposta =
            await fetch(
                "/api/configuracoes"
            );

        if (!resposta.ok) return;

        const config =
            await resposta.json();

        aplicarIdentidadeSistema(
            config
        );

        return config;

    } catch (erro) {
        console.error(
            "Erro ao carregar configurações:",
            erro
        );
    }
}

function preencherCampoConfig(id, valor = "") {
    const campo =
        document.getElementById(id);

    if (campo) {
        campo.value =
            valor ?? "";
    }
}

async function preencherTelaConfiguracoes() {
    if (
        usuarioAtual?.perfil !==
        "administrador"
    ) {
        return;
    }

    const config =
        await carregarConfiguracoesSistema();

    if (!config) return;

    preencherCampoConfig(
        "configNomeAdega",
        config.nome_adega
    );

    preencherCampoConfig(
        "configSubtitulo",
        config.subtitulo
    );

    preencherCampoConfig(
        "configRazaoSocial",
        config.razao_social
    );

    preencherCampoConfig(
        "configCnpj",
        config.cnpj
    );

    preencherCampoConfig(
        "configTelefone",
        config.telefone
    );

    preencherCampoConfig(
        "configEndereco",
        config.endereco
    );

    preencherCampoConfig(
        "configNumero",
        config.numero
    );

    preencherCampoConfig(
        "configComplemento",
        config.complemento
    );

    preencherCampoConfig(
        "configBairro",
        config.bairro
    );

    preencherCampoConfig(
        "configCidade",
        config.cidade
    );

    preencherCampoConfig(
        "configEstado",
        config.estado
    );

    preencherCampoConfig(
        "configCep",
        config.cep
    );

    preencherCampoConfig(
        "configEstoqueMinimo",
        config.estoque_minimo_padrao ?? 0
    );

    preencherCampoConfig(
        "configDiasProdutoParado",
        config.dias_produto_parado ?? 30
    );

    preencherCampoConfig(
        "configTema",
        config.tema_padrao || "claro"
    );

    preencherCampoConfig(
        "configPdvQuantidadeDestaques",
        config.pdv_quantidade_destaques ?? 8
    );

    preencherCampoConfig(
        "configPdvDescontoMaximo",
        config
            .pdv_desconto_maximo_percentual ??
        100
    );

    const destaques =
        document.getElementById(
            "configPdvDestaques"
        );

    const foco =
        document.getElementById(
            "configPdvFocoBusca"
        );

    const permitirDesconto =
        document.getElementById(
            "configPdvPermitirDesconto"
        );

    if (destaques) {
        destaques.checked =
            configBool(
                config.pdv_exibir_destaques,
                true
            );
    }

    if (foco) {
        foco.checked =
            configBool(
                config.pdv_foco_busca,
                true
            );
    }

    if (permitirDesconto) {
        permitirDesconto.checked =
            configBool(
                config.pdv_permitir_desconto,
                true
            );
    }

    atualizarDependenciasConfiguracoesPDV();

    const preview =
        document.getElementById(
            "configLogoPreview"
        );

    preview.innerHTML =
        config.logo
            ? `<img src="${config.logo}" alt="Logo atual">`
            : "🍷";

    removerLogoConfiguracao = false;
}

function atualizarDependenciasConfiguracoesPDV() {
    const destaques =
        document.getElementById(
            "configPdvDestaques"
        );

    const grupoDestaques =
        document.getElementById(
            "configGrupoQuantidadeDestaques"
        );

    const desconto =
        document.getElementById(
            "configPdvPermitirDesconto"
        );

    const grupoDesconto =
        document.getElementById(
            "configGrupoDescontoMaximo"
        );

    if (
        destaques &&
        grupoDestaques
    ) {
        grupoDestaques.classList.toggle(
            "config-desabilitado",
            !destaques.checked
        );
    }

    if (
        desconto &&
        grupoDesconto
    ) {
        grupoDesconto.classList.toggle(
            "config-desabilitado",
            !desconto.checked
        );
    }
}

document
    .querySelector(
        '.menu-item[data-tela="configuracoes"]'
    )
    ?.addEventListener(
        "click",
        preencherTelaConfiguracoes
    );

document
    .getElementById(
        "btnEscolherLogo"
    )
    ?.addEventListener(
        "click",
        () =>
            document
                .getElementById(
                    "configLogo"
                )
                ?.click()
    );

document
    .getElementById(
        "configLogo"
    )
    ?.addEventListener(
        "change",
        evento => {
            const arquivo =
                evento.target
                    .files?.[0];

            if (!arquivo) return;

            removerLogoConfiguracao =
                false;

            const preview =
                document.getElementById(
                    "configLogoPreview"
                );

            preview.innerHTML =
                `<img src="${URL.createObjectURL(
                    arquivo
                )}" alt="Nova logo">`;
        }
    );

document
    .getElementById(
        "btnRemoverLogo"
    )
    ?.addEventListener(
        "click",
        () => {
            removerLogoConfiguracao =
                true;

            const input =
                document.getElementById(
                    "configLogo"
                );

            if (input) {
                input.value = "";
            }

            document
                .getElementById(
                    "configLogoPreview"
                )
                .textContent = "🍷";
        }
    );

document
    .getElementById(
        "configPdvDestaques"
    )
    ?.addEventListener(
        "change",
        atualizarDependenciasConfiguracoesPDV
    );

document
    .getElementById(
        "configPdvPermitirDesconto"
    )
    ?.addEventListener(
        "change",
        atualizarDependenciasConfiguracoesPDV
    );

document
    .getElementById(
        "formConfiguracoes"
    )
    ?.addEventListener(
        "submit",
        async evento => {
            evento.preventDefault();

            const dados =
                new FormData();

            const adicionar =
                (nome, id) =>
                    dados.append(
                        nome,
                        document
                            .getElementById(id)
                            ?.value ?? ""
                    );

            adicionar(
                "nome_adega",
                "configNomeAdega"
            );

            adicionar(
                "subtitulo",
                "configSubtitulo"
            );

            adicionar(
                "razao_social",
                "configRazaoSocial"
            );

            adicionar(
                "cnpj",
                "configCnpj"
            );

            adicionar(
                "telefone",
                "configTelefone"
            );

            adicionar(
                "endereco",
                "configEndereco"
            );

            adicionar(
                "numero",
                "configNumero"
            );

            adicionar(
                "complemento",
                "configComplemento"
            );

            adicionar(
                "bairro",
                "configBairro"
            );

            adicionar(
                "cidade",
                "configCidade"
            );

            adicionar(
                "estado",
                "configEstado"
            );

            adicionar(
                "cep",
                "configCep"
            );

            adicionar(
                "estoque_minimo_padrao",
                "configEstoqueMinimo"
            );

            adicionar(
                "dias_produto_parado",
                "configDiasProdutoParado"
            );

            adicionar(
                "tema_padrao",
                "configTema"
            );

            adicionar(
                "pdv_quantidade_destaques",
                "configPdvQuantidadeDestaques"
            );

            adicionar(
                "pdv_desconto_maximo_percentual",
                "configPdvDescontoMaximo"
            );

            dados.append(
                "pdv_exibir_destaques",
                document.getElementById(
                    "configPdvDestaques"
                )?.checked
                    ? "1"
                    : "0"
            );

            dados.append(
                "pdv_foco_busca",
                document.getElementById(
                    "configPdvFocoBusca"
                )?.checked
                    ? "1"
                    : "0"
            );

            dados.append(
                "pdv_permitir_desconto",
                document.getElementById(
                    "configPdvPermitirDesconto"
                )?.checked
                    ? "1"
                    : "0"
            );

            dados.append(
                "remover_logo",
                removerLogoConfiguracao
                    ? "1"
                    : "0"
            );

            const logo =
                document.getElementById(
                    "configLogo"
                )?.files?.[0];

            if (logo) {
                dados.append(
                    "logo",
                    logo
                );
            }

            try {
                const resposta =
                    await fetch(
                        "/api/configuracoes",
                        {
                            method: "PUT",
                            body: dados
                        }
                    );

                const resultado =
                    await resposta.json();

                if (!resposta.ok) {
                    return modalErro(
                        resultado.mensagem ||
                        "Não foi possível salvar as configurações."
                    );
                }

                aplicarIdentidadeSistema(
                    resultado.configuracoes
                );

                await preencherTelaConfiguracoes();

                if (
                    typeof carregarDestaquesPDV ===
                    "function"
                ) {
                    await carregarDestaquesPDV();
                }

                modalSucesso(
                    "Configurações salvas com sucesso."
                );

            } catch (erro) {
                console.error(erro);

                modalErro(
                    "Não foi possível salvar as configurações."
                );
            }
        }
    );

// =====================================================
// INVENTÁRIO
// =====================================================
let inventarioAtual = null;
let itensInventarioAtual = [];

function atualizarResumoInventario() {
    const total = itensInventarioAtual.length;
    const conferidos = itensInventarioAtual.filter(i => i.quantidade_contada !== null).length;
    const divergencias = itensInventarioAtual.filter(i => i.quantidade_contada !== null && Number(i.diferenca) !== 0).length;
    document.getElementById("invTotal").textContent = total;
    document.getElementById("invConferidos").textContent = conferidos;
    document.getElementById("invDivergencias").textContent = divergencias;
    document.getElementById("invPendentes").textContent = total - conferidos;
}

function renderizarInventario() {
    const tbody = document.getElementById("tabelaInventario");
    if (!tbody) return;

    const termo = (document.getElementById("pesquisaInventario")?.value || "").toLowerCase().trim();
    const filtro = document.getElementById("filtroInventario")?.value || "todos";

    const filtrados = itensInventarioAtual.filter(item => {
        const contado = item.quantidade_contada !== null;
        const dif = Number(item.diferenca || 0);
        const busca = String(item.produto_nome || "").toLowerCase().includes(termo);
        if (!busca) return false;
        if (filtro === "pendentes") return !contado;
        if (filtro === "divergentes") return contado && dif !== 0;
        if (filtro === "corretos") return contado && dif === 0;
        return true;
    });

    tbody.innerHTML = filtrados.map(item => {
        const contado = item.quantidade_contada !== null;
        const dif = contado ? Number(item.diferenca || 0) : null;
        const classe = !contado ? "pendente" : dif === 0 ? "correto" : "divergente";
        const textoDif = dif === null ? "—" : `${dif > 0 ? "+" : ""}${dif}`;
        const status = !contado ? "Pendente" : dif === 0 ? "Correto" : dif < 0 ? "Falta" : "Sobra";
        return `
            <tr class="inventario-linha ${classe}">
                <td><strong>${escaparHtmlUsuario(item.produto_nome)}</strong><small>${escaparHtmlUsuario(item.unidade || "unidade")}</small></td>
                <td><strong>${Number(item.estoque_sistema || 0)}</strong></td>
                <td>
                    <input class="input-contagem-inventario" type="number" min="0" step="1"
                        data-item-id="${item.id}"
                        value="${contado ? Number(item.quantidade_contada) : ""}"
                        placeholder="Contar">
                </td>
                <td><strong class="inventario-diferenca ${dif !== null && dif < 0 ? "negativa" : dif > 0 ? "positiva" : ""}">${textoDif}</strong></td>
                <td><span class="badge-inventario ${classe}">${status}</span></td>
            </tr>
        `;
    }).join("") || '<tr><td colspan="5" class="dashboard-vazio">Nenhum produto encontrado.</td></tr>';

    tbody.querySelectorAll(".input-contagem-inventario").forEach(input => {
        input.addEventListener("change", salvarContagemInventario);
    });
    atualizarResumoInventario();
}

async function salvarContagemInventario(evento) {
    const input = evento.currentTarget;
    const itemId = Number(input.dataset.itemId);
    const valor = Number(input.value);
    if (!Number.isInteger(valor) || valor < 0 || !inventarioAtual) {
        modalAviso("Informe uma quantidade inteira maior ou igual a zero.", "Contagem inválida");
        return;
    }
    try {
        const resposta = await fetch(`/api/inventario/${inventarioAtual.id}/item/${itemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantidade_contada: valor })
        });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || "Erro ao salvar contagem.");
        const item = itensInventarioAtual.find(i => Number(i.id) === itemId);
        if (item) {
            item.quantidade_contada = valor;
            item.diferenca = Number(dados.diferenca || 0);
        }
        renderizarInventario();
    } catch (erro) {
        modalErro(erro.message);
    }
}

async function carregarInventarioAberto() {
    try {
        const resposta = await fetch("/api/inventario/aberto");
        const dados = await resposta.json();
        inventarioAtual = dados.inventario || null;
        itensInventarioAtual = dados.itens || [];

        const aberto = !!inventarioAtual;
        document.getElementById("inventarioAndamento").style.display = aberto ? "" : "none";
        document.getElementById("inventarioResumo").style.display = aberto ? "" : "none";
        document.getElementById("inventarioVazio").style.display = aberto ? "none" : "";
        document.getElementById("btnIniciarInventario").style.display = aberto ? "none" : "";

        if (aberto) {
            document.getElementById("inventarioTitulo").textContent =
                `Inventário #${inventarioAtual.id} • ${inventarioAtual.usuario_nome || "Usuário"}`;
            renderizarInventario();
        }
    } catch (erro) {
        console.error("Erro ao carregar inventário:", erro);
    }
}

async function iniciarInventario() {
    const confirmar = await modalConfirmar(
        "O sistema vai registrar uma fotografia do estoque atual para você fazer a contagem física.",
        "Iniciar novo inventário",
        "Iniciar"
    );
    if (!confirmar) return;
    try {
        const resposta = await fetch("/api/inventario/iniciar", { method: "POST" });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || "Erro ao iniciar inventário.");
        await carregarInventarioAberto();
        await carregarHistoricoInventario();
        modalSucesso("Inventário iniciado. Agora informe a quantidade física de cada produto.");
    } catch (erro) { modalErro(erro.message); }
}

async function finalizarInventario() {
    if (!inventarioAtual) return;
    const pendentes = itensInventarioAtual.filter(i => i.quantidade_contada === null).length;
    if (pendentes) {
        modalAviso(`Ainda existem ${pendentes} produto(s) sem contagem.`, "Inventário incompleto");
        return;
    }
    const divergencias = itensInventarioAtual.filter(i => Number(i.diferenca || 0) !== 0).length;
    const confirmar = await modalConfirmar(
        `Foram encontradas ${divergencias} divergência(s). Ao finalizar, o estoque do sistema será ajustado para as quantidades contadas.`,
        "Finalizar inventário",
        "Finalizar e ajustar"
    );
    if (!confirmar) return;

    try {
        const resposta = await fetch(`/api/inventario/${inventarioAtual.id}/finalizar`, { method: "POST" });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || "Erro ao finalizar inventário.");
        await carregarInventarioAberto();
        await carregarHistoricoInventario();
        await atualizarDashboardCompleto();

        if (
            typeof carregarProdutos ===
            "function"
        ) {
            await carregarProdutos();
        }

        if (
            typeof carregarProdutosPDV ===
            "function"
        ) {
            await carregarProdutosPDV();
        }

        await carregarResumoEstoque();
        await carregarCardsPrincipaisDashboard();

        modalSucesso(`${dados.mensagem} Divergências ajustadas: ${dados.divergencias}.`);
    } catch (erro) { modalErro(erro.message); }
}

async function cancelarInventario() {
    if (!inventarioAtual) return;
    const confirmar = await modalConfirmar(
        "As contagens já digitadas serão descartadas e nenhum estoque será alterado.",
        "Cancelar inventário",
        "Cancelar inventário"
    );
    if (!confirmar) return;
    try {
        const resposta = await fetch(`/api/inventario/${inventarioAtual.id}/cancelar`, { method: "POST" });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || "Erro ao cancelar inventário.");
        await carregarInventarioAberto();
        await carregarHistoricoInventario();
        modalSucesso("Inventário cancelado sem alterar o estoque.");
    } catch (erro) { modalErro(erro.message); }
}

async function carregarHistoricoInventario() {
    const tbody = document.getElementById("tabelaHistoricoInventario");
    if (!tbody) return;
    try {
        const resposta = await fetch("/api/inventario/historico");
        const dados = await resposta.json();
        const lista = dados.inventarios || [];
        tbody.innerHTML = lista.map(inv => `
            <tr>
                <td>#${inv.id}</td>
                <td>${escaparHtmlUsuario(inv.usuario_nome || "—")}</td>
                <td><span class="badge-inventario ${inv.status === "finalizado" ? "correto" : "pendente"}">${inv.status}</span></td>
                <td>${Number(inv.total_produtos || 0)}</td>
                <td>${Number(inv.total_divergencias || 0)}</td>
                <td>${Number(inv.ajuste_total || 0) > 0 ? "+" : ""}${Number(inv.ajuste_total || 0)}</td>
                <td>${formatarDataUsuario(inv.finalizado_em || inv.criado_em)}</td>
                <td><button class="btn-acao btn-ver-inventario" data-id="${inv.id}">Ver</button></td>
            </tr>
        `).join("") || '<tr><td colspan="8" class="dashboard-vazio">Nenhum inventário finalizado ainda.</td></tr>';

        tbody.querySelectorAll(".btn-ver-inventario").forEach(btn => {
            btn.addEventListener("click", () => verInventario(Number(btn.dataset.id)));
        });
    } catch (erro) {
        console.error("Erro histórico inventário:", erro);
    }
}

async function verInventario(id) {
    try {
        const resposta = await fetch(`/api/inventario/${id}`);
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || "Erro ao carregar inventário.");
        const divergentes = (dados.itens || []).filter(i => Number(i.diferenca || 0) !== 0);
        const linhas = divergentes.length
            ? divergentes.slice(0, 15).map(i =>
                `${i.produto_nome}: ${i.estoque_sistema} → ${i.quantidade_contada} (${Number(i.diferenca) > 0 ? "+" : ""}${i.diferenca})`
              ).join("\n")
            : "Nenhuma divergência encontrada.";
        modalAviso(
            `Responsável: ${dados.inventario.usuario_nome || "—"}\nProdutos: ${dados.inventario.total_produtos}\nDivergências: ${dados.inventario.total_divergencias}\n\n${linhas}`,
            `Inventário #${id}`
        );
    } catch (erro) { modalErro(erro.message); }
}

document.getElementById("btnIniciarInventario")?.addEventListener("click", iniciarInventario);
document.getElementById("btnFinalizarInventario")?.addEventListener("click", finalizarInventario);
document.getElementById("btnCancelarInventario")?.addEventListener("click", cancelarInventario);
document.getElementById("pesquisaInventario")?.addEventListener("input", renderizarInventario);
document.getElementById("filtroInventario")?.addEventListener("change", renderizarInventario);

carregarConfiguracoesSistema();

carregarUsuarioLogado();


// =====================================================
// LOG DE AUDITORIA - SOMENTE ADMINISTRADOR
// =====================================================
let paginaAuditoriaAtual = 1;
let totalPaginasAuditoria = 1;

function escaparHtmlAuditoria(valor) {
    return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formatarDataAuditoria(data) {
    if (!data) return "-";
    const normalizada = String(data).includes("T") ? data : String(data).replace(" ", "T") + "Z";
    const d = new Date(normalizada);
    return Number.isNaN(d.getTime()) ? data : d.toLocaleString("pt-BR");
}

async function carregarAuditoria(pagina = 1) {

    iniciarSkeleton(
        document.getElementById(
            "tabelaAuditoria"
        ),
        "tabela",
        6
    );

    if (usuarioAtual?.perfil !== "administrador") return;
    try {
        const params = new URLSearchParams({ pagina: String(pagina), limite: "30" });
        const usuario = document.getElementById("auditoriaUsuario")?.value;
        const acao = document.getElementById("auditoriaAcao")?.value;
        const inicio = document.getElementById("auditoriaInicio")?.value;
        const fim = document.getElementById("auditoriaFim")?.value;
        const busca = document.getElementById("auditoriaBusca")?.value.trim();
        if (usuario) params.set("usuario_id", usuario);
        if (acao) params.set("acao", acao);
        if (inicio) params.set("inicio", inicio);
        if (fim) params.set("fim", fim);
        if (busca) params.set("busca", busca);
        const resposta = await fetch(`/api/auditoria?${params}`);
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || "Erro ao carregar auditoria");
        paginaAuditoriaAtual = dados.paginacao.pagina;
        totalPaginasAuditoria = dados.paginacao.total_paginas;
        const tabela = document.getElementById("tabelaAuditoria");
        if (tabela) {
            tabela.innerHTML = dados.registros.length ? dados.registros.map(r => `
                <tr>
                    <td>${escaparHtmlAuditoria(formatarDataAuditoria(r.criado_em))}</td>
                    <td><strong>${escaparHtmlAuditoria(r.usuario_nome)}</strong><br><small>@${escaparHtmlAuditoria(r.usuario_login)}</small></td>
                    <td><span class="status-badge">${escaparHtmlAuditoria(r.acao.replaceAll("_", " "))}</span></td>
                    <td>${escaparHtmlAuditoria(r.descricao)}</td>
                    <td>${r.entidade ? `${escaparHtmlAuditoria(r.entidade)}${r.entidade_id ? ` #${r.entidade_id}` : ""}` : "-"}</td>
                </tr>`).join("") : '<tr><td colspan="5">Nenhum registro encontrado.</td></tr>';
        }
        const selUsuario = document.getElementById("auditoriaUsuario");
        if (selUsuario && selUsuario.options.length <= 1) {
            dados.usuarios.forEach(u => selUsuario.add(new Option(`${u.nome} (@${u.usuario})`, u.id)));
        }
        const selAcao = document.getElementById("auditoriaAcao");
        if (selAcao) {
            const atual = selAcao.value;
            selAcao.innerHTML = '<option value="">Todas</option>';
            dados.acoes.forEach(a => selAcao.add(new Option(a.replaceAll("_", " "), a)));
            selAcao.value = atual;
        }
        const info = document.getElementById("infoPaginaAuditoria");
        if (info) info.textContent = `Página ${paginaAuditoriaAtual} de ${totalPaginasAuditoria} • ${dados.paginacao.total} registros`;
        const ant = document.getElementById("btnAuditoriaAnterior");
        const prox = document.getElementById("btnAuditoriaProxima");
        if (ant) ant.disabled = paginaAuditoriaAtual <= 1;
        if (prox) prox.disabled = paginaAuditoriaAtual >= totalPaginasAuditoria;
    } catch (erro) {
        console.error(erro);
        modalErro(erro.message || "Não foi possível carregar a auditoria.");
    }
}

document.getElementById("btnAtualizarAuditoria")?.addEventListener("click", () => carregarAuditoria(paginaAuditoriaAtual));
document.getElementById("btnFiltrarAuditoria")?.addEventListener("click", () => carregarAuditoria(1));
document.getElementById("btnAuditoriaAnterior")?.addEventListener("click", () => carregarAuditoria(paginaAuditoriaAtual - 1));
document.getElementById("btnAuditoriaProxima")?.addEventListener("click", () => carregarAuditoria(paginaAuditoriaAtual + 1));
document.querySelector('.menu-item[data-tela="auditoria"]')?.addEventListener("click", () => carregarAuditoria(1));

// =====================================================
// GERENCIAMENTO DE USUÁRIOS
// =====================================================

let usuariosSistema = [];

function escaparHtmlUsuario(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatarDataUsuario(valor) {
    if (!valor) return "-";
    const data = new Date(String(valor).replace(" ", "T") + (String(valor).includes("Z") ? "" : "Z"));
    if (Number.isNaN(data.getTime())) return valor;
    return data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function carregarUsuarios() {

    iniciarSkeleton(
        document.getElementById(
            "tabelaUsuarios"
        ),
        "tabela",
        5
    );

    if (usuarioAtual?.perfil !== "administrador") {
        return;
    }
    const tabela = document.getElementById("tabelaUsuarios");
    if (!tabela) return;
    try {
        const resposta = await fetch("/api/usuarios");
        if (resposta.status === 403) {
            document.getElementById("menuUsuarios")?.style.setProperty("display", "none");
            if (document.getElementById("usuarios")?.classList.contains("ativa")) abrirTela("dashboard");
            return;
        }
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || "Erro ao carregar usuários.");
        usuariosSistema = dados.dados || [];
        renderizarUsuarios();
    } catch (erro) {
        console.error(erro);
        tabela.innerHTML = `<tr><td colspan="6" class="usuarios-vazio">Não foi possível carregar os usuários.</td></tr>`;
    }
}

function renderizarUsuarios() {
    const tabela = document.getElementById("tabelaUsuarios");
    if (!tabela) return;
    document.getElementById("usuariosTotal").textContent = usuariosSistema.length;
    document.getElementById("usuariosAtivos").textContent = usuariosSistema.filter(u => Number(u.ativo) === 1).length;
    document.getElementById("usuariosAdmins").textContent = usuariosSistema.filter(u => u.perfil === "administrador").length;
    document.getElementById("usuariosOperadores").textContent = usuariosSistema.filter(u => u.perfil === "operador").length;

    if (!usuariosSistema.length) {
        tabela.innerHTML = `<tr><td colspan="6" class="usuarios-vazio">Nenhum usuário cadastrado.</td></tr>`;
        return;
    }

    tabela.innerHTML = usuariosSistema.map(usuario => {
        const ativo = Number(usuario.ativo) === 1;
        const bloqueado = usuario.bloqueado_ate && new Date(usuario.bloqueado_ate).getTime() > Date.now();
        const perfil = usuario.perfil === "administrador" ? "Administrador" : "Operador";
        return `
            <tr>
                <td><div class="usuario-tabela-nome"><span class="usuario-mini-avatar">${escaparHtmlUsuario(usuario.nome).charAt(0).toUpperCase() || "U"}</span><strong>${escaparHtmlUsuario(usuario.nome)}</strong></div></td>
                <td>${escaparHtmlUsuario(usuario.usuario)}</td>
                <td><span class="badge-perfil ${usuario.perfil}">${perfil}</span></td>
                <td><span class="badge-usuario-status ${!ativo ? "inativo" : bloqueado ? "bloqueado" : "ativo"}">${!ativo ? "Inativo" : bloqueado ? "Bloqueado" : "Ativo"}</span></td>
                <td>${escaparHtmlUsuario(formatarDataUsuario(usuario.criado_em))}</td>
                <td><div class="acoes-tabela usuarios-acoes">
                    <button class="btn-acao" type="button" onclick="editarUsuario(${Number(usuario.id)})">Editar</button>
                    <button class="btn-acao" type="button" onclick="abrirAlterarSenhaUsuario(${Number(usuario.id)})">Senha</button>
                    <button class="btn-acao ${ativo ? "btn-desativar-usuario" : "btn-ativar-usuario"}" type="button" onclick="alternarStatusUsuario(${Number(usuario.id)})">${ativo ? "Desativar" : "Ativar"}</button>
                </div></td>
            </tr>`;
    }).join("");
}

function abrirModalUsuario(usuario = null) {
    document.getElementById("formUsuario").reset();
    document.getElementById("usuarioId").value = usuario?.id || "";
    document.getElementById("tituloModalUsuario").textContent = usuario ? "Editar usuário" : "Novo usuário";
    document.getElementById("usuarioNome").value = usuario?.nome || "";
    document.getElementById("usuarioLogin").value = usuario?.usuario || "";
    document.getElementById("usuarioPerfil").value = usuario?.perfil || "operador";
    const senha = document.getElementById("usuarioSenha");
    senha.value = "";
    senha.required = !usuario;
    document.getElementById("campoSenhaNovoUsuario").style.display = usuario ? "none" : "flex";
    document.getElementById("modalUsuario").classList.add("ativo");
    setTimeout(() => document.getElementById("usuarioNome")?.focus(), 50);
}

function fecharModalUsuario() { document.getElementById("modalUsuario")?.classList.remove("ativo"); }

function editarUsuario(id) {
    const usuario = usuariosSistema.find(u => Number(u.id) === Number(id));
    if (usuario) abrirModalUsuario(usuario);
}

async function salvarUsuario(evento) {
    evento.preventDefault();
    const id = document.getElementById("usuarioId").value;
    const corpo = {
        nome: document.getElementById("usuarioNome").value.trim(),
        usuario: document.getElementById("usuarioLogin").value.trim(),
        perfil: document.getElementById("usuarioPerfil").value
    };
    if (!id) corpo.senha = document.getElementById("usuarioSenha").value;
    try {
        const resposta = await fetch(id ? `/api/usuarios/${id}` : "/api/usuarios", {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo)
        });
        const dados = await resposta.json();
        if (!resposta.ok) return modalErro(dados.mensagem || "Não foi possível salvar o usuário.");
        fecharModalUsuario();
        await carregarUsuarios();
        modalSucesso(dados.mensagem || "Usuário salvo com sucesso.");
    } catch (erro) {
        console.error(erro);
        modalErro("Não foi possível salvar o usuário.");
    }
}

function abrirAlterarSenhaUsuario(id) {
    const usuario = usuariosSistema.find(u => Number(u.id) === Number(id));
    if (!usuario) return;
    document.getElementById("formSenhaUsuario").reset();
    document.getElementById("senhaUsuarioId").value = id;
    document.getElementById("senhaUsuarioDescricao").textContent = `Nova senha para ${usuario.nome}.`;
    document.getElementById("modalSenhaUsuario").classList.add("ativo");
    setTimeout(() => document.getElementById("novaSenhaUsuario")?.focus(), 50);
}

function fecharModalSenhaUsuario() { document.getElementById("modalSenhaUsuario")?.classList.remove("ativo"); }

async function salvarSenhaUsuario(evento) {
    evento.preventDefault();
    const id = document.getElementById("senhaUsuarioId").value;
    const senha = document.getElementById("novaSenhaUsuario").value;
    const confirmar = document.getElementById("confirmarSenhaUsuario").value;
    if (senha.length < 6) return modalAviso("A senha deve ter pelo menos 6 caracteres.");
    if (senha !== confirmar) return modalAviso("As senhas informadas não são iguais.");
    try {
        const resposta = await fetch(`/api/usuarios/${id}/senha`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ senha })
        });
        const dados = await resposta.json();
        if (!resposta.ok) return modalErro(dados.mensagem || "Não foi possível alterar a senha.");
        fecharModalSenhaUsuario();
        modalSucesso(dados.mensagem || "Senha alterada com sucesso.");
    } catch (erro) {
        console.error(erro);
        modalErro("Não foi possível alterar a senha.");
    }
}

async function alternarStatusUsuario(id) {
    const usuario = usuariosSistema.find(u => Number(u.id) === Number(id));
    if (!usuario) return;
    const ativo = Number(usuario.ativo) === 1;
    const confirmou = await modalConfirmar(
        ativo ? `Desativar o acesso de ${usuario.nome}?` : `Ativar novamente o acesso de ${usuario.nome}?`,
        ativo ? "Desativar usuário" : "Ativar usuário",
        ativo ? "Desativar" : "Ativar"
    );
    if (!confirmou) return;
    try {
        const resposta = await fetch(`/api/usuarios/${id}/status`, { method: "PATCH" });
        const dados = await resposta.json();
        if (!resposta.ok) return modalErro(dados.mensagem || "Não foi possível alterar o usuário.");
        await carregarUsuarios();
        modalSucesso(dados.mensagem || "Status atualizado.");
    } catch (erro) {
        console.error(erro);
        modalErro("Não foi possível alterar o usuário.");
    }
}

document.getElementById("btnNovoUsuario")?.addEventListener("click", () => abrirModalUsuario());
document.getElementById("formUsuario")?.addEventListener("submit", salvarUsuario);
document.getElementById("fecharModalUsuario")?.addEventListener("click", fecharModalUsuario);
document.getElementById("cancelarModalUsuario")?.addEventListener("click", fecharModalUsuario);
document.getElementById("formSenhaUsuario")?.addEventListener("submit", salvarSenhaUsuario);
document.getElementById("fecharModalSenhaUsuario")?.addEventListener("click", fecharModalSenhaUsuario);
document.getElementById("cancelarModalSenhaUsuario")?.addEventListener("click", fecharModalSenhaUsuario);
document.querySelector('.menu-item[data-tela="usuarios"]')?.addEventListener("click", carregarUsuarios);


// =====================================================
// MODO TELA CHEIA - V1.6.8
// =====================================================
function atualizarBotaoTelaCheia(ativo) {
    const botao = document.getElementById("btnTelaCheia");
    if (!botao) return;
    botao.classList.toggle("ativo", Boolean(ativo));
    botao.title = ativo ? "Sair da tela cheia" : "Tela cheia";
    botao.setAttribute(
        "aria-label",
        ativo ? "Sair da tela cheia" : "Ativar tela cheia"
    );
}

async function alternarTelaCheia() {
    if (window.chrome?.webview?.postMessage) {
        window.chrome.webview.postMessage({
            tipo: "alternar-tela-cheia"
        });
        return;
    }

    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
        atualizarBotaoTelaCheia(Boolean(document.fullscreenElement));
    } catch (erro) {
        console.error("Erro ao alternar tela cheia:", erro);
    }
}

document.getElementById("btnTelaCheia")
    ?.addEventListener("click", alternarTelaCheia);

document.addEventListener("fullscreenchange", () => {
    atualizarBotaoTelaCheia(Boolean(document.fullscreenElement));
});

if (window.chrome?.webview?.addEventListener) {
    window.chrome.webview.addEventListener("message", evento => {
        const dados = evento.data || {};
        if (dados.tipo === "estado-tela-cheia") {
            atualizarBotaoTelaCheia(Boolean(dados.ativo));
        }
    });
}


// =====================================================
// POLIMENTO FINAL DE INTERFACE - V1.7.1
// =====================================================

function atualizarEstadoRolagemTabela(
    container
) {
    if (!container) return;

    const possuiRolagem =
        container.scrollWidth >
        container.clientWidth + 2;

    const noInicio =
        container.scrollLeft <= 2;

    const noFim =
        container.scrollLeft +
        container.clientWidth >=
        container.scrollWidth - 2;

    container.classList.toggle(
        "tem-rolagem-horizontal",
        possuiRolagem
    );

    container.classList.toggle(
        "rolagem-no-inicio",
        noInicio
    );

    container.classList.toggle(
        "rolagem-no-fim",
        noFim
    );
}


function configurarTabelasResponsivas() {
    document
        .querySelectorAll(
            ".tabela-container"
        )
        .forEach(
            container => {
                if (
                    container.dataset
                        .responsivoConfigurado ===
                    "1"
                ) {
                    atualizarEstadoRolagemTabela(
                        container
                    );
                    return;
                }

                container.dataset
                    .responsivoConfigurado =
                    "1";

                container.setAttribute(
                    "tabindex",
                    "0"
                );

                container.setAttribute(
                    "role",
                    "region"
                );

                container.setAttribute(
                    "aria-label",
                    "Tabela com rolagem horizontal quando necessário"
                );

                const atualizar =
                    () =>
                        atualizarEstadoRolagemTabela(
                            container
                        );

                container.addEventListener(
                    "scroll",
                    atualizar,
                    {
                        passive: true
                    }
                );

                const observer =
                    new MutationObserver(
                        atualizar
                    );

                observer.observe(
                    container,
                    {
                        childList: true,
                        subtree: true,
                        characterData: true
                    }
                );

                atualizar();
            }
        );
}


function sincronizarModaisInterface() {
    const existeModal =
        Boolean(
            document.querySelector(
                ".modal-overlay.ativo"
            )
        );

    document.body.classList.toggle(
        "modal-aberto",
        existeModal
    );
}


function configurarModaisInterface() {
    document
        .querySelectorAll(
            ".modal-overlay"
        )
        .forEach(
            overlay => {
                if (
                    overlay.dataset
                        .polimentoConfigurado ===
                    "1"
                ) {
                    return;
                }

                overlay.dataset
                    .polimentoConfigurado =
                    "1";

                overlay.setAttribute(
                    "aria-hidden",
                    overlay.classList.contains(
                        "ativo"
                    )
                        ? "false"
                        : "true"
                );

                const observer =
                    new MutationObserver(
                        () => {
                            const ativo =
                                overlay.classList.contains(
                                    "ativo"
                                );

                            overlay.setAttribute(
                                "aria-hidden",
                                ativo
                                    ? "false"
                                    : "true"
                            );

                            sincronizarModaisInterface();

                            if (ativo) {
                                const modal =
                                    overlay.querySelector(
                                        ".modal, .modal-sistema"
                                    );

                                if (modal) {
                                    modal.scrollTop = 0;
                                }
                            }
                        }
                    );

                observer.observe(
                    overlay,
                    {
                        attributes: true,
                        attributeFilter: [
                            "class"
                        ]
                    }
                );
            }
        );
}


function normalizarEstadosVazios() {
    document
        .querySelectorAll(
            ".dashboard-vazio"
        )
        .forEach(
            elemento => {
                elemento.classList.add(
                    "estado-vazio-padronizado"
                );
            }
        );

    document
        .querySelectorAll(
            ".tabela tbody td[colspan]"
        )
        .forEach(
            celula => {
                const texto =
                    celula.textContent
                        .trim();

                if (
                    texto &&
                    celula.children
                        .length === 0
                ) {
                    celula.classList.add(
                        "tabela-estado-vazio"
                    );
                }
            }
        );
}


function configurarPolimentoFinalInterface() {
    configurarTabelasResponsivas();
    configurarModaisInterface();
    normalizarEstadosVazios();

    window.addEventListener(
        "resize",
        () => {
            document
                .querySelectorAll(
                    ".tabela-container"
                )
                .forEach(
                    atualizarEstadoRolagemTabela
                );
        },
        {
            passive: true
        }
    );

    const observer =
        new MutationObserver(
            () => {
                configurarTabelasResponsivas();
                normalizarEstadosVazios();
            }
        );

    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );
}


document.addEventListener(
    "DOMContentLoaded",
    configurarPolimentoFinalInterface
);


// =====================================================
// COMANDAS
// =====================================================

function escaparHtmlComanda(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatarDataHoraComanda(valor) {
    if (!valor) return "—";

    const data = new Date(
        String(valor).replace(" ", "T") +
        (String(valor).includes("Z") ? "" : "Z")
    );

    if (Number.isNaN(data.getTime())) {
        return String(valor);
    }

    return data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function abrirModalComanda(id) {
    document.getElementById(id)?.classList.add("ativo");
    document.body.classList.add("modal-aberto");
}

function fecharModalComanda(id) {
    document.getElementById(id)?.classList.remove("ativo");

    if (!document.querySelector(".modal-overlay.ativo")) {
        document.body.classList.remove("modal-aberto");
    }
}

async function carregarComandas() {
    const lista = document.getElementById("listaComandas");
    if (!lista) return;

    try {
        const resposta = await fetch("/api/comandas?status=aberta");
        const comandas = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                comandas.mensagem ||
                "Não foi possível carregar as comandas."
            );
        }

        const qtd = comandas.length;
        const valor = comandas.reduce(
            (soma, comanda) => soma + Number(comanda.subtotal || 0),
            0
        );
        const itens = comandas.reduce(
            (soma, comanda) => soma + Number(comanda.quantidade_itens || 0),
            0
        );

        const qtdEl = document.getElementById("comandasAbertasQtd");
        const valorEl = document.getElementById("comandasAbertasValor");
        const itensEl = document.getElementById("comandasAbertasItens");

        if (qtdEl) qtdEl.textContent = qtd;
        if (valorEl) valorEl.textContent = formatarDinheiro(valor);
        if (itensEl) itensEl.textContent = itens;

        if (!comandas.length) {
            lista.innerHTML = `
                <div class="comandas-vazio">
                    <div class="comandas-vazio-icone">⌁</div>
                    <strong>Nenhuma comanda aberta</strong>
                    <span>Abra uma comanda para começar a registrar o consumo.</span>
                </div>
            `;
            return;
        }

        lista.innerHTML = comandas.map(comanda => `
            <article class="comanda-card">
                <div class="comanda-card-topo">
                    <div class="comanda-card-identidade">
                        <span class="comanda-numero">#${Number(comanda.id)}</span>
                        <div>
                            <h3>${escaparHtmlComanda(comanda.nome)}</h3>
                            <small>Aberta ${formatarDataHoraComanda(comanda.criado_em)}</small>
                        </div>
                    </div>
                    <span class="comanda-status">EM ABERTO</span>
                </div>
                ${comanda.observacao ? `<p class="comanda-card-obs">${escaparHtmlComanda(comanda.observacao)}</p>` : ""}
                <div class="comanda-card-numeros">
                    <div><span>Itens</span><strong>${Number(comanda.quantidade_itens || 0)}</strong></div>
                    <div><span>Total atual</span><strong>${formatarDinheiro(comanda.subtotal)}</strong></div>
                </div>
                <div class="comanda-card-rodape">
                    <small>${escaparHtmlComanda(comanda.usuario_abertura_nome || "Usuário")}</small>
                    <div>
                        <button class="botao-secundario" type="button" onclick="verDetalhesComanda(${Number(comanda.id)})">Ver itens</button>
                        <button class="botao-principal" type="button" onclick="continuarComandaNoPDV(${Number(comanda.id)})">Abrir no PDV</button>
                    </div>
                </div>
            </article>
        `).join("");
    } catch (erro) {
        console.error(erro);
        lista.innerHTML = `
            <div class="comandas-vazio erro">
                <strong>Não foi possível carregar as comandas</strong>
                <span>${escaparHtmlComanda(erro.message)}</span>
            </div>
        `;
    }
}

async function criarComanda(nome, observacao = "") {
    const resposta = await fetch("/api/comandas", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ nome, observacao })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
        throw new Error(
            dados.mensagem ||
            "Não foi possível abrir a comanda."
        );
    }

    return dados.comanda;
}

async function adicionarCarrinhoNaComanda(comandaId, manterAtiva = true) {
    if (!carrinhoPDV.length) {
        await modalAviso(
            "Adicione produtos ao carrinho antes de guardar na comanda.",
            "Carrinho vazio"
        );
        return false;
    }

    const resposta = await fetch(
        `/api/comandas/${comandaId}/itens`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                itens: carrinhoPDV.map(item => ({
                    produto_id: item.produto_id,
                    quantidade: item.quantidade
                }))
            })
        }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
        await modalErro(
            dados.mensagem ||
            "Não foi possível guardar os itens na comanda."
        );
        return false;
    }

    carrinhoPDV = [];

    if (manterAtiva) {
        comandaAtivaPDV = dados.comanda;
    }

    await carregarProdutosPDV();
    atualizarCarrinhoPDV();
    await carregarResumoEstoque();
    await carregarComandas();

    return true;
}

function atualizarBannerComandaPDV() {
    const banner = document.getElementById("comandaAtivaBanner");
    const nome = document.getElementById("comandaAtivaNome");
    const resumo = document.getElementById("comandaAtivaResumo");
    const guardar = document.getElementById("btnGuardarComandaPDV");
    const finalizar = document.getElementById("btnFinalizarVenda");

    if (!banner) return;

    if (!comandaAtivaPDV) {
        banner.style.display = "none";
        if (guardar) guardar.innerHTML = "⌁ Guardar em comanda";
        if (finalizar && finalizar.textContent !== "Finalizando...") {
            finalizar.textContent = "Finalizar Venda";
        }
        return;
    }

    banner.style.display = "flex";

    // Hotfix 1.8.1:
    // versões antigas do HTML podem ficar em cache no WebView2 durante
    // uma atualização e não conter ainda os elementos internos do banner.
    // A ausência deles não pode impedir a abertura da comanda.
    if (nome) {
        nome.textContent =
            `#${comandaAtivaPDV.id} • ${comandaAtivaPDV.nome}`;
    }

    if (resumo) {
        resumo.textContent =
            `${Number(comandaAtivaPDV.quantidade_itens || 0)} itens • ${formatarDinheiro(comandaAtivaPDV.subtotal)} já consumidos`;
    }

    if (guardar) {
        guardar.innerHTML = carrinhoPDV.length
            ? "+ Salvar novos itens na comanda"
            : "✓ Comanda ativa";
    }

    if (finalizar && !finalizar.disabled) {
        finalizar.textContent = "Receber Comanda";
    }
}

async function continuarComandaNoPDV(id) {
    let etapaAberturaComanda =
        "consultar a comanda";

    try {
        const resposta =
            await fetch(
                `/api/comandas/${id}`
            );

        const dados =
            await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                dados.mensagem ||
                "Comanda não encontrada."
            );
        }

        if (dados.status !== "aberta") {
            throw new Error(
                "Esta comanda não está mais aberta."
            );
        }

        if (carrinhoPDV.length) {
            etapaAberturaComanda =
                "confirmar a troca do carrinho";

            const confirmar =
                await modalConfirmar(
                    "O carrinho atual será limpo para abrir a comanda. Os itens ainda não salvos não serão enviados.",
                    "Abrir comanda no PDV?",
                    "Abrir"
                );

            if (!confirmar) return;
        }

        etapaAberturaComanda =
            "preparar os dados da comanda";

        carrinhoPDV = [];
        comandaAtivaPDV = dados;
        produtoCarrinhoSelecionadoPDV = null;

        etapaAberturaComanda =
            "fechar as janelas de comandas";

        fecharModalComanda(
            "modalDetalhesComanda"
        );

        fecharModalComanda(
            "modalSelecionarComanda"
        );

        etapaAberturaComanda =
            "abrir a tela do PDV";

        abrirTela(
            "pdv"
        );

        etapaAberturaComanda =
            "atualizar o cabeçalho da comanda";

        atualizarBannerComandaPDV();

        etapaAberturaComanda =
            "atualizar o carrinho do PDV";

        atualizarCarrinhoPDV();

        const pesquisa =
            document.getElementById(
                "pesquisaPDV"
            );

        pesquisa?.focus();
    } catch (erro) {
        console.error(
            "Erro ao abrir comanda:",
            etapaAberturaComanda,
            erro
        );

        // Se algo visual falhar, não deixa uma comanda parcialmente
        // marcada como ativa.
        comandaAtivaPDV = null;

        await modalErro(
            `${erro?.message || "Erro inesperado."}\n\nEtapa: ${etapaAberturaComanda}.`,
            "Não foi possível abrir a comanda"
        );
    }
}

window.continuarComandaNoPDV = continuarComandaNoPDV;

async function verDetalhesComanda(id) {
    try {
        const resposta = await fetch(`/api/comandas/${id}`);
        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.mensagem || "Comanda não encontrada.");
        }

        detalhesComandaAbertaId = Number(id);

        const tituloDetalhes =
            document.getElementById("detalhesComandaTitulo");
        const metaDetalhes =
            document.getElementById("detalhesComandaMeta");
        const qtdDetalhes =
            document.getElementById("detalhesComandaQtd");
        const totalDetalhes =
            document.getElementById("detalhesComandaTotal");
        const lista =
            document.getElementById("detalhesComandaItens");

        if (
            !tituloDetalhes ||
            !metaDetalhes ||
            !qtdDetalhes ||
            !totalDetalhes ||
            !lista
        ) {
            throw new Error(
                "A interface de comandas está desatualizada. Reinicie o Adega PDV para recarregar os arquivos da versão atual."
            );
        }

        tituloDetalhes.textContent =
            `#${dados.id} • ${dados.nome}`;

        metaDetalhes.textContent =
            `Aberta ${formatarDataHoraComanda(dados.criado_em)} • ${dados.usuario_abertura_nome || "Usuário"}`;

        qtdDetalhes.textContent =
            Number(dados.quantidade_itens || 0);

        totalDetalhes.textContent =
            formatarDinheiro(dados.subtotal);

        if (!Array.isArray(dados.itens) || !dados.itens.length) {
            lista.innerHTML = `
                <div class="comandas-vazio compacto">
                    <strong>Comanda vazia</strong>
                    <span>Adicione produtos pelo PDV.</span>
                </div>
            `;
        } else {
            lista.innerHTML = dados.itens.map(item => `
                <div class="comanda-item-linha">
                    <div>
                        <strong>${escaparHtmlComanda(item.produto_nome)}</strong>
                        <span>${Number(item.quantidade)} × ${formatarDinheiro(item.preco_unitario)}</span>
                    </div>
                    <div class="comanda-item-linha-final">
                        <strong>${formatarDinheiro(item.subtotal)}</strong>
                        <button
                            class="comanda-item-remover"
                            type="button"
                            title="Remover este consumo e devolver ao estoque"
                            onclick="removerItemComanda(${Number(dados.id)}, ${Number(item.id)})"
                        >×</button>
                    </div>
                </div>
            `).join("");
        }

        abrirModalComanda("modalDetalhesComanda");
    } catch (erro) {
        await modalErro(erro.message, "Erro ao abrir comanda");
    }
}

window.verDetalhesComanda = verDetalhesComanda;

async function removerItemComanda(comandaId, itemId) {
    const confirmar = await modalConfirmar(
        "O item será removido da comanda e a quantidade correspondente voltará para o estoque.",
        "Remover item?",
        "Remover"
    );

    if (!confirmar) return;

    try {
        const resposta = await fetch(
            `/api/comandas/${comandaId}/itens/${itemId}`,
            { method: "DELETE" }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.mensagem || "Não foi possível remover o item.");
        }

        if (comandaAtivaPDV?.id === Number(comandaId)) {
            comandaAtivaPDV = dados.comanda;
            atualizarCarrinhoPDV();
        }

        await carregarProdutosPDV();
        await carregarResumoEstoque();
        await carregarComandas();
        await verDetalhesComanda(comandaId);
    } catch (erro) {
        await modalErro(erro.message, "Erro ao remover item");
    }
}

window.removerItemComanda = removerItemComanda;

async function cancelarComanda(id) {
    const confirmar = await modalConfirmar(
        "Todos os itens reservados serão devolvidos ao estoque. Esta ação encerra a comanda.",
        "Cancelar comanda?",
        "Cancelar comanda"
    );

    if (!confirmar) return;

    try {
        const resposta = await fetch(`/api/comandas/${id}/cancelar`, {
            method: "POST"
        });
        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.mensagem || "Não foi possível cancelar a comanda.");
        }

        if (comandaAtivaPDV?.id === Number(id)) {
            comandaAtivaPDV = null;
            carrinhoPDV = [];
            atualizarCarrinhoPDV();
        }

        fecharModalComanda("modalDetalhesComanda");
        await carregarProdutosPDV();
        await carregarResumoEstoque();
        await carregarComandas();
        await modalSucesso(
            "Comanda cancelada e estoque restaurado.",
            "Comanda cancelada"
        );
    } catch (erro) {
        await modalErro(erro.message, "Erro ao cancelar comanda");
    }
}

async function abrirSeletorComandaPDV() {
    if (comandaAtivaPDV) {
        if (!carrinhoPDV.length) {
            await modalAviso(
                "Esta comanda já está ativa. Adicione novos produtos ao carrinho para salvá-los.",
                "Comanda ativa"
            );
            return;
        }

        const ok = await adicionarCarrinhoNaComanda(comandaAtivaPDV.id, true);
        if (ok) {
            await modalSucesso(
                "Novos itens adicionados à comanda.",
                "Comanda atualizada"
            );
        }
        return;
    }

    if (!carrinhoPDV.length) {
        await modalAviso(
            "Adicione produtos ao carrinho antes de criar ou escolher uma comanda.",
            "Carrinho vazio"
        );
        return;
    }

    try {
        const resposta = await fetch("/api/comandas?status=aberta");
        const comandas = await resposta.json();

        if (!resposta.ok) {
            throw new Error(comandas.mensagem || "Não foi possível carregar as comandas.");
        }

        const lista = document.getElementById("listaSelecionarComanda");

        lista.innerHTML = comandas.length
            ? comandas.map(comanda => `
                <button class="comanda-seletor-item" type="button" onclick="usarComandaParaCarrinho(${Number(comanda.id)})">
                    <div>
                        <strong>#${Number(comanda.id)} • ${escaparHtmlComanda(comanda.nome)}</strong>
                        <span>${Number(comanda.quantidade_itens || 0)} itens já consumidos</span>
                    </div>
                    <strong>${formatarDinheiro(comanda.subtotal)}</strong>
                </button>
            `).join("")
            : `<div class="comandas-vazio compacto"><strong>Nenhuma comanda aberta</strong><span>Crie uma acima.</span></div>`;

        document.getElementById("novaComandaRapidaNome").value = "";
        abrirModalComanda("modalSelecionarComanda");
        setTimeout(() => document.getElementById("novaComandaRapidaNome")?.focus(), 80);
    } catch (erro) {
        await modalErro(erro.message, "Erro ao abrir comandas");
    }
}

async function usarComandaParaCarrinho(id) {
    const ok = await adicionarCarrinhoNaComanda(Number(id), true);

    if (!ok) return;

    fecharModalComanda("modalSelecionarComanda");

    await modalSucesso(
        `Itens guardados na comanda #${id}. Você pode continuar adicionando consumo e receber tudo no final.`,
        "Comanda atualizada"
    );
}

window.usarComandaParaCarrinho = usarComandaParaCarrinho;

// Eventos da tela de comandas.
document.getElementById("formNovaComanda")?.addEventListener(
    "submit",
    async evento => {
        evento.preventDefault();

        // event.currentTarget só é garantido enquanto o evento está sendo
        // despachado. Depois de um await, navegadores podem limpá-lo.
        // Guardamos a referência do formulário antes da chamada assíncrona.
        const formulario =
            evento.currentTarget;

        const campoNome =
            document.getElementById(
                "novaComandaNome"
            );

        const campoObservacao =
            document.getElementById(
                "novaComandaObservacao"
            );

        const nome =
            String(
                campoNome?.value ||
                ""
            ).trim();

        const observacao =
            String(
                campoObservacao?.value ||
                ""
            ).trim();

        if (!nome) {
            campoNome?.focus();
            return;
        }

        try {
            const comanda =
                await criarComanda(
                    nome,
                    observacao
                );

            // Usa a referência preservada, e não evento.currentTarget.
            if (
                formulario &&
                typeof formulario.reset ===
                    "function"
            ) {
                formulario.reset();
            }

            await carregarComandas();

            await modalSucesso(
                `Comanda #${comanda.id} aberta para ${comanda.nome}.`,
                "Comanda aberta"
            );
        } catch (erro) {
            console.error(
                "Erro ao abrir comanda:",
                erro
            );

            await modalErro(
                erro.message ||
                "Não foi possível abrir a comanda.",
                "Erro ao abrir comanda"
            );
        }
    }
);

document.getElementById("btnFocarNovaComanda")?.addEventListener(
    "click",
    () => document.getElementById("novaComandaNome")?.focus()
);

document.getElementById("btnAtualizarComandas")?.addEventListener(
    "click",
    carregarComandas
);

document.getElementById("btnGuardarComandaPDV")?.addEventListener(
    "click",
    abrirSeletorComandaPDV
);

document.getElementById("btnSairComandaPDV")?.addEventListener(
    "click",
    async () => {
        const possuiNovos = carrinhoPDV.length > 0;

        if (possuiNovos) {
            const confirmar = await modalConfirmar(
                "Há itens novos ainda não salvos na comanda. Ao sair, esses itens serão removidos do carrinho.",
                "Sair da comanda?",
                "Sair"
            );
            if (!confirmar) return;
        }

        carrinhoPDV = [];
        comandaAtivaPDV = null;
        atualizarCarrinhoPDV();
    }
);

document.getElementById("fecharModalSelecionarComanda")?.addEventListener(
    "click",
    () => fecharModalComanda("modalSelecionarComanda")
);

document.getElementById("btnCriarComandaRapida")?.addEventListener(
    "click",
    async () => {
        const campo = document.getElementById("novaComandaRapidaNome");
        const nome = campo.value.trim();

        if (!nome) {
            campo.focus();
            return;
        }

        try {
            const comanda = await criarComanda(nome);
            const ok = await adicionarCarrinhoNaComanda(comanda.id, true);
            if (!ok) return;

            fecharModalComanda("modalSelecionarComanda");
            await modalSucesso(
                `Comanda #${comanda.id} criada e consumo registrado.`,
                "Comanda aberta"
            );
        } catch (erro) {
            await modalErro(erro.message, "Erro ao criar comanda");
        }
    }
);

document.getElementById("novaComandaRapidaNome")?.addEventListener(
    "keydown",
    evento => {
        if (evento.key === "Enter") {
            evento.preventDefault();
            document.getElementById("btnCriarComandaRapida")?.click();
        }
    }
);

document.getElementById("fecharModalDetalhesComanda")?.addEventListener(
    "click",
    () => fecharModalComanda("modalDetalhesComanda")
);

document.getElementById("btnContinuarComandaDetalhes")?.addEventListener(
    "click",
    () => {
        if (detalhesComandaAbertaId) {
            continuarComandaNoPDV(detalhesComandaAbertaId);
        }
    }
);

document.getElementById("btnReceberComandaDetalhes")?.addEventListener(
    "click",
    () => {
        if (detalhesComandaAbertaId) {
            continuarComandaNoPDV(detalhesComandaAbertaId);
        }
    }
);

document.getElementById("btnCancelarComandaDetalhes")?.addEventListener(
    "click",
    () => {
        if (detalhesComandaAbertaId) {
            cancelarComanda(detalhesComandaAbertaId);
        }
    }
);

