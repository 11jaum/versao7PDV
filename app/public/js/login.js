const formLogin =
    document.getElementById("formLogin");

const usuarioInput =
    document.getElementById("usuario");

const senhaInput =
    document.getElementById("senha");

const erroLogin =
    document.getElementById("erroLogin");

const erroLoginTexto =
    document.getElementById("erroLoginTexto");

const btnEntrar =
    document.getElementById("btnEntrar");

const btnMostrarSenha =
    document.getElementById("btnMostrarSenha");


function mostrarErroLogin(mensagem) {
    if (erroLoginTexto) {
        erroLoginTexto.textContent =
            mensagem;
    } else if (erroLogin) {
        erroLogin.textContent =
            mensagem;
    }

    erroLogin?.classList.add("ativo");
}


function limparErroLogin() {
    erroLogin?.classList.remove("ativo");

    if (erroLoginTexto) {
        erroLoginTexto.textContent = "";
    }
}


function definirCarregandoLogin(carregando) {
    if (!btnEntrar) return;

    btnEntrar.disabled =
        Boolean(carregando);

    btnEntrar.classList.toggle(
        "carregando",
        Boolean(carregando)
    );
}


async function verificarSessao() {
    try {
        const resposta =
            await fetch(
                "/api/auth/sessao",
                {
                    cache: "no-store"
                }
            );

        if (resposta.ok) {
            window.location.href = "/";
        }
    } catch {
        // O formulário permanece disponível.
    }
}


btnMostrarSenha?.addEventListener(
    "click",
    () => {
        const mostrar =
            senhaInput.type ===
            "password";

        senhaInput.type =
            mostrar
                ? "text"
                : "password";

        btnMostrarSenha.title =
            mostrar
                ? "Ocultar senha"
                : "Mostrar senha";

        btnMostrarSenha.setAttribute(
            "aria-label",
            btnMostrarSenha.title
        );

        senhaInput.focus();
    }
);


[usuarioInput, senhaInput].forEach(
    campo => {
        campo?.addEventListener(
            "input",
            limparErroLogin
        );
    }
);


formLogin?.addEventListener(
    "submit",
    async evento => {
        evento.preventDefault();

        limparErroLogin();

        const usuario =
            usuarioInput.value.trim();

        const senha =
            senhaInput.value;

        if (!usuario || !senha) {
            mostrarErroLogin(
                "Informe usuário e senha para continuar."
            );

            (
                !usuario
                    ? usuarioInput
                    : senhaInput
            ).focus();

            return;
        }

        definirCarregandoLogin(true);

        try {
            const resposta =
                await fetch(
                    "/api/auth/login",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body:
                            JSON.stringify({
                                usuario,
                                senha
                            })
                    }
                );

            const dados =
                await resposta.json()
                    .catch(() => ({}));

            if (resposta.status === 402) {
                window.location.href =
                    "/ativacao.html";
                return;
            }

            if (!resposta.ok) {
                throw new Error(
                    dados.mensagem ||
                    "Usuário ou senha inválidos."
                );
            }

            btnEntrar
                ?.classList.add(
                    "login-sucesso"
                );

            setTimeout(
                () => {
                    window.location.href = "/";
                },
                180
            );

        } catch (erro) {
            mostrarErroLogin(
                erro.message ||
                "Não foi possível entrar no sistema."
            );

            senhaInput.select();
            definirCarregandoLogin(false);
        }
    }
);


verificarSessao();
