const instalacaoEl =
    document.getElementById("instalacaoId");

const statusTexto =
    document.getElementById("statusLicencaTexto");

const form =
    document.getElementById("formAtivacao");

const chaveInput =
    document.getElementById("chaveLicenca");

const btnAtivar =
    document.getElementById("btnAtivar");

const btnCopiar =
    document.getElementById("btnCopiarInstalacao");

const erroEl =
    document.getElementById("erroAtivacao");

const sucessoEl =
    document.getElementById("sucessoAtivacao");

let instalacaoId = "";

function mostrarMensagem(
    elemento,
    mensagem
) {
    if (!elemento) return;

    elemento.textContent =
        mensagem || "";

    elemento.classList.toggle(
        "ativo",
        Boolean(mensagem)
    );
}

function limparMensagens() {
    mostrarMensagem(erroEl, "");
    mostrarMensagem(sucessoEl, "");
}

function definirCarregando(ativo) {
    if (!btnAtivar) return;

    btnAtivar.disabled =
        Boolean(ativo);

    const span =
        btnAtivar.querySelector("span");

    if (span) {
        span.textContent = ativo
            ? "Validando chave..."
            : "Ativar sistema";
    }
}

async function carregarStatus() {
    try {
        const resposta =
            await fetch(
                "/api/licenca/status",
                {
                    cache: "no-store"
                }
            );

        const dados =
            await resposta.json();

        instalacaoId =
            dados.instalacao_id || "";

        if (instalacaoEl) {
            instalacaoEl.textContent =
                instalacaoId ||
                "Não disponível";
        }

        if (dados.valida) {
            const modoTroca =
                new URLSearchParams(
                    window.location.search
                ).get("trocar") === "1";

            if (statusTexto) {
                statusTexto.textContent =
                    dados.tipo === "permanente"
                        ? "Licença permanente válida neste computador."
                        : `Licença temporária válida por mais ${dados.dias_restantes ?? 0} dia(s).`;
            }

            if (!modoTroca) {
                setTimeout(
                    () => {
                        window.location.href =
                            "/login.html";
                    },
                    450
                );

                return;
            }

            if (statusTexto) {
                statusTexto.textContent +=
                    " Cole uma nova chave abaixo para substituir a licença atual.";
            }
        }

        if (
            statusTexto &&
            dados.codigo &&
            dados.codigo !== "NAO_ATIVADA"
        ) {
            statusTexto.textContent =
                dados.mensagem ||
                "A licença precisa ser renovada.";
        }
    } catch (erro) {
        mostrarMensagem(
            erroEl,
            "Não foi possível consultar o status da licença."
        );
    }
}

btnCopiar?.addEventListener(
    "click",
    async () => {
        if (!instalacaoId) return;

        try {
            await navigator.clipboard.writeText(
                instalacaoId
            );

            const anterior =
                btnCopiar.textContent;

            btnCopiar.textContent =
                "Copiado ✓";

            setTimeout(
                () => {
                    btnCopiar.textContent =
                        anterior;
                },
                1200
            );
        } catch {
            const area =
                document.createElement("textarea");

            area.value =
                instalacaoId;

            document.body.appendChild(area);
            area.select();
            document.execCommand("copy");
            area.remove();
        }
    }
);

chaveInput?.addEventListener(
    "input",
    limparMensagens
);

form?.addEventListener(
    "submit",
    async evento => {
        evento.preventDefault();
        limparMensagens();

        const chave =
            chaveInput?.value
                ?.replace(/\s+/g, "")
                .trim() || "";

        if (!chave) {
            mostrarMensagem(
                erroEl,
                "Cole uma chave de licença para continuar."
            );
            chaveInput?.focus();
            return;
        }

        definirCarregando(true);

        try {
            const resposta =
                await fetch(
                    "/api/licenca/ativar",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body: JSON.stringify({
                            chave
                        })
                    }
                );

            const dados =
                await resposta.json()
                    .catch(() => ({}));

            if (!resposta.ok) {
                throw new Error(
                    dados.mensagem ||
                    "A chave não pôde ser validada."
                );
            }

            const descricao =
                dados.tipo === "permanente"
                    ? "Licença permanente ativada."
                    : `Licença temporária ativada até ${new Date(dados.expira_em).toLocaleDateString("pt-BR")}.`;

            mostrarMensagem(
                sucessoEl,
                `${descricao} Abrindo o Adega PDV...`
            );

            chaveInput.value = "";

            setTimeout(
                () => {
                    window.location.href =
                        "/login.html";
                },
                900
            );
        } catch (erro) {
            mostrarMensagem(
                erroEl,
                erro.message ||
                "Não foi possível ativar a licença."
            );
            definirCarregando(false);
        }
    }
);

carregarStatus();
