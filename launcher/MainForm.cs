using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Diagnostics;
using System.Net.Http;
using System.Reflection;
using System.Text;
using System.Text.Json;

namespace AdegaPDV.Launcher;

public sealed class MainForm : Form
{
    private const string AppVersion = "2.1.7";

    private readonly WebView2 webView = new();
    private readonly LoadingExperience loadingExperience =
        new(AppVersion);

    private Process? serverProcess;
    private bool serverStartedByLauncher;
    private bool closing;

    private readonly string rootDirectory;
    private readonly string appDirectory;
    private readonly string dataDirectory;
    private readonly string logsDirectory;
    private readonly string databaseDirectory;
    private readonly string databaseFile;
    private readonly string backupsDirectory;
    private readonly string automaticBackupsDirectory;

    private readonly string serverUrl = "http://127.0.0.1:3000";
    private readonly string statusUrl = "http://127.0.0.1:3000/api/status";

    public MainForm()
    {
        rootDirectory = AppContext.BaseDirectory;
        appDirectory = Path.Combine(rootDirectory, "app");
        dataDirectory = Path.Combine(rootDirectory, "data");
        logsDirectory = Path.Combine(rootDirectory, "logs");

        databaseDirectory =
            Path.Combine(appDirectory, "database");

        databaseFile =
            Path.Combine(databaseDirectory, "adega.db");

        backupsDirectory =
            Path.Combine(appDirectory, "backups");

        automaticBackupsDirectory =
            Path.Combine(backupsDirectory, "automaticos");

        Directory.CreateDirectory(dataDirectory);
        Directory.CreateDirectory(logsDirectory);
        Directory.CreateDirectory(databaseDirectory);
        Directory.CreateDirectory(backupsDirectory);
        Directory.CreateDirectory(automaticBackupsDirectory);

        Text = $"Adega PDV {AppVersion}";

        try
        {
            Icon = Icon.ExtractAssociatedIcon(
                Application.ExecutablePath
            );
        }
        catch
        {
        }

        StartPosition = FormStartPosition.CenterScreen;
        Width = 1440;
        Height = 900;
        MinimumSize = new Size(1024, 700);
        KeyPreview = true;

        webView.Dock = DockStyle.Fill;
        webView.Visible = false;

        loadingExperience.SetStep(
            "Iniciando ambiente seguro...",
            10,
            "Preparando seu caixa, estoque e dados locais"
        );

        Controls.Add(webView);
        Controls.Add(loadingExperience);
        loadingExperience.BringToFront();

        Shown +=
            async (_, _) =>
                await InicializarAsync();

        FormClosing += AoFechar;
        KeyDown += AoPressionarTecla;
    }

    private async Task InicializarAsync()
    {
        try
        {
            AtualizarLoading(
                "Verificando arquivos do sistema...",
                20
            );

            ValidarEstrutura();

            AtualizarLoading(
                "Verificando servidor local...",
                34
            );

            if (!await ServidorAdegaEstaAtivoAsync())
            {
                AtualizarLoading(
                    "Iniciando servidor local...",
                    52
                );

                IniciarServidorNode();

                bool iniciou =
                    await AguardarServidorAsync(
                        TimeSpan.FromSeconds(25)
                    );

                if (!iniciou)
                {
                    throw new InvalidOperationException(
                        "O servidor local não respondeu a tempo.\n\n" +
                        "Veja o arquivo logs\\server.log para mais detalhes."
                    );
                }
            }

            AtualizarLoading(
                "Carregando interface...",
                82
            );

            string webViewUserData =
                Path.Combine(
                    dataDirectory,
                    "WebView2"
                );

            CoreWebView2Environment env =
                await CoreWebView2Environment.CreateAsync(
                    userDataFolder: webViewUserData
                );

            await webView.EnsureCoreWebView2Async(env);

            webView.CoreWebView2.WebMessageReceived += (_, e) =>
            {
                try
                {
                    using JsonDocument doc =
                        JsonDocument.Parse(e.WebMessageAsJson);

                    if (
                        doc.RootElement.TryGetProperty(
                            "tipo",
                            out JsonElement tipo
                        ) &&
                        tipo.GetString() == "alternar-tela-cheia"
                    )
                    {
                        BeginInvoke(AlternarTelaCheia);
                    }
                }
                catch
                {
                    // Outras mensagens do webapp são ignoradas aqui.
                }
            };


            ConfigurarWebView();

            // Cache-buster por versão: garante que index.html seja
            // revalidado após uma atualização do aplicativo.
            webView.Source =
                new Uri(
                    $"{serverUrl}/?appVersion={Uri.EscapeDataString(AppVersion)}"
                );

            AtualizarLoading(
                "Tudo pronto",
                100
            );

            await Task.Delay(420);

            webView.Visible = true;
            webView.BringToFront();
            loadingExperience.Visible = false;
            webView.Focus();
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show(
                "O Microsoft Edge WebView2 Runtime não foi encontrado.\n\n" +
                "Instale o WebView2 Evergreen Runtime e abra o Adega PDV novamente.",
                "WebView2 não encontrado",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );

            Close();
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                ex.Message,
                "Não foi possível abrir o Adega PDV",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );

            Close();
        }
    }

    private void AtualizarLoading(
        string etapa,
        int progresso
    )
    {
        string detalhe =
            progresso switch
            {
                <= 20 =>
                    "Validando arquivos essenciais e integridade local",
                <= 40 =>
                    "Conferindo os serviços necessários para abrir o PDV",
                <= 65 =>
                    "Ativando o servidor local e preparando sua sessão",
                <= 90 =>
                    "Montando a interface e conectando os módulos",
                _ =>
                    "Ambiente pronto. Entrando no Adega PDV..."
            };

        loadingExperience.SetStep(
            etapa,
            progresso,
            detalhe
        );
    }

    private void ValidarEstrutura()
    {
        string serverFile =
            Path.Combine(
                appDirectory,
                "server.js"
            );

        if (!File.Exists(serverFile))
        {
            throw new FileNotFoundException(
                "Não encontrei app\\server.js.\n\n" +
                "Mantenha a pasta app ao lado do AdegaPDV.exe."
            );
        }

        string packageFile =
            Path.Combine(
                appDirectory,
                "package.json"
            );

        if (!File.Exists(packageFile))
        {
            throw new FileNotFoundException(
                "Não encontrei app\\package.json."
            );
        }
    }

    private void ConfigurarWebView()
    {
        if (webView.CoreWebView2 == null)
            return;

        var settings =
            webView.CoreWebView2.Settings;

        settings.IsStatusBarEnabled = false;
        settings.AreDevToolsEnabled = false;
        settings.AreDefaultScriptDialogsEnabled = true;
        settings.AreBrowserAcceleratorKeysEnabled = true;

        webView.CoreWebView2.WebMessageReceived +=
            async (_, e) =>
            {
                try
                {
                    string json =
                        e.WebMessageAsJson;

                    using JsonDocument doc =
                        JsonDocument.Parse(json);

                    if (
                        !doc.RootElement.TryGetProperty(
                            "acao",
                            out JsonElement acaoElement
                        )
                    )
                    {
                        return;
                    }

                    string? acao =
                        acaoElement.GetString();

                    if (acao == "abrir-backups")
                    {
                        string pasta =
                            Path.Combine(
                                appDirectory,
                                "backups"
                            );

                        Directory.CreateDirectory(
                            pasta
                        );

                        Process.Start(
                            new ProcessStartInfo
                            {
                                FileName = pasta,
                                UseShellExecute = true
                            }
                        );

                        return;
                    }

                    if (acao == "obter-info-host")
                    {
                        var resposta = new
                        {
                            tipo = "info-host",
                            versaoApp = AppVersion,
                            webview2 =
                                webView.CoreWebView2
                                    ?.Environment
                                    .BrowserVersionString
                                ?? "Disponível"
                        };

                        webView.CoreWebView2
                            .PostWebMessageAsJson(
                                JsonSerializer.Serialize(
                                    resposta
                                )
                            );

                        return;
                    }

                    if (acao == "reiniciar-servidor")
                    {
                        await Task.Delay(2200);

                        await ReiniciarServidorAsync();

                        return;
                    }

                    if (acao == "aplicar-atualizacao")
                    {
                        string pacote =
                            Path.Combine(
                                appDirectory,
                                "temp",
                                "atualizacao-pendente.zip"
                            );

                        string atualizador =
                            Path.Combine(
                                rootDirectory,
                                "ATUALIZAR-SISTEMA.ps1"
                            );

                        if (!File.Exists(pacote))
                        {
                            throw new FileNotFoundException(
                                "O pacote de atualização não foi encontrado."
                            );
                        }

                        if (!File.Exists(atualizador))
                        {
                            throw new FileNotFoundException(
                                "O atualizador do Adega PDV não foi encontrado."
                            );
                        }

                        string executavel =
                            Application.ExecutablePath;

                        int processoAtual =
                            Environment.ProcessId;

                        var infoAtualizador =
                            new ProcessStartInfo
                            {
                                FileName = "powershell.exe",
                                Arguments =
                                    $"-NoProfile -ExecutionPolicy Bypass -File \"{atualizador}\" " +
                                    $"-ZipAtualizacao \"{pacote}\" " +
                                    $"-ProcessId {processoAtual} " +
                                    $"-Executavel \"{executavel}\"",
                                WorkingDirectory =
                                    rootDirectory,
                                UseShellExecute = false,
                                CreateNoWindow = true
                            };

                        Process.Start(
                            infoAtualizador
                        );

                        BeginInvoke(() =>
                        {
                            Close();
                        });

                        return;
                    }
                }
                catch (Exception ex)
                {
                    RegistrarLog(
                        Path.Combine(
                            logsDirectory,
                            "server.log"
                        ),
                        "[HOST] " + ex.Message
                    );
                }
            };

        webView.CoreWebView2.NewWindowRequested +=
            (_, e) =>
            {
                e.Handled = true;

                if (
                    Uri.TryCreate(
                        e.Uri,
                        UriKind.Absolute,
                        out Uri? uri
                    )
                )
                {
                    if (
                        uri.Host.Equals(
                            "127.0.0.1",
                            StringComparison.OrdinalIgnoreCase
                        ) ||
                        uri.Host.Equals(
                            "localhost",
                            StringComparison.OrdinalIgnoreCase
                        )
                    )
                    {
                        webView.CoreWebView2.Navigate(
                            e.Uri
                        );

                        return;
                    }

                    try
                    {
                        Process.Start(
                            new ProcessStartInfo
                            {
                                FileName = e.Uri,
                                UseShellExecute = true
                            }
                        );
                    }
                    catch
                    {
                    }
                }
            };

        webView.CoreWebView2.NavigationCompleted +=
            (_, e) =>
            {
                if (!e.IsSuccess)
                {
                    Text =
                        $"Adega PDV {AppVersion} - erro de navegação ({e.WebErrorStatus})";
                }
                else
                {
                    Text =
                        $"Adega PDV {AppVersion}";
                }
            };

        webView.CoreWebView2.ProcessFailed +=
            (_, _) =>
            {
                BeginInvoke(async () =>
                {
                    try
                    {
                        await webView.CoreWebView2
                            .Profile
                            .ClearBrowsingDataAsync(
                                CoreWebView2BrowsingDataKinds.DiskCache
                            );
                    }
                    catch
                    {
                    }

                    MessageBox.Show(
                        "A interface do aplicativo foi interrompida.\n" +
                        "Feche e abra o Adega PDV novamente.",
                        "Adega PDV",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning
                    );
                });
            };
    }

    private string LocalizarNode()
    {
        string nodeEmbutido =
            Path.Combine(
                rootDirectory,
                "runtime",
                "node.exe"
            );

        if (File.Exists(nodeEmbutido))
            return nodeEmbutido;

        string? nodeSistema =
            EncontrarNoPath(
                "node.exe"
            );

        if (
            !string.IsNullOrWhiteSpace(
                nodeSistema
            )
        )
        {
            return nodeSistema;
        }

        throw new FileNotFoundException(
            "Node.js não foi encontrado.\n\n" +
            "Execute PREPARAR-WEBVIEW2.bat antes de gerar a distribuição."
        );
    }

    private static string? EncontrarNoPath(
        string nomeArquivo
    )
    {
        string? path =
            Environment.GetEnvironmentVariable(
                "PATH"
            );

        if (
            string.IsNullOrWhiteSpace(path)
        )
        {
            return null;
        }

        foreach (
            string pasta
            in path.Split(
                Path.PathSeparator
            )
        )
        {
            try
            {
                string candidato =
                    Path.Combine(
                        pasta.Trim().Trim('"'),
                        nomeArquivo
                    );

                if (File.Exists(candidato))
                    return candidato;
            }
            catch
            {
            }
        }

        return null;
    }

    private void IniciarServidorNode()
    {
        string node =
            LocalizarNode();

        string server =
            Path.Combine(
                appDirectory,
                "server.js"
            );

        string logFile =
            Path.Combine(
                logsDirectory,
                "server.log"
            );

        var info =
            new ProcessStartInfo
            {
                FileName = node,
                Arguments =
                    $"\"{server}\"",

                WorkingDirectory =
                    appDirectory,

                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

        info.Environment["PDV_HOST"] =
            "127.0.0.1";

        info.Environment["PDV_PORT"] =
            "3000";

        info.Environment["PDV_DESKTOP"] =
            "1";

        serverProcess =
            new Process
            {
                StartInfo = info,
                EnableRaisingEvents = true
            };

        serverProcess.OutputDataReceived +=
            (_, e) =>
            {
                if (
                    !string.IsNullOrWhiteSpace(
                        e.Data
                    )
                )
                {
                    RegistrarLog(
                        logFile,
                        e.Data
                    );
                }
            };

        serverProcess.ErrorDataReceived +=
            (_, e) =>
            {
                if (
                    !string.IsNullOrWhiteSpace(
                        e.Data
                    )
                )
                {
                    RegistrarLog(
                        logFile,
                        "[ERRO] " + e.Data
                    );
                }
            };

        if (!serverProcess.Start())
        {
            throw new InvalidOperationException(
                "O processo do servidor não pôde ser iniciado."
            );
        }

        serverStartedByLauncher = true;

        serverProcess.BeginOutputReadLine();
        serverProcess.BeginErrorReadLine();
    }

    private static readonly object logLock =
        new();

    private static void RegistrarLog(
        string arquivo,
        string mensagem
    )
    {
        try
        {
            lock (logLock)
            {
                // Rotação simples: mantém até ~5 MB por log.
                if (
                    File.Exists(arquivo) &&
                    new FileInfo(arquivo).Length >
                    5 * 1024 * 1024
                )
                {
                    string antigo =
                        arquivo + ".1";

                    try
                    {
                        if (File.Exists(antigo))
                            File.Delete(antigo);

                        File.Move(
                            arquivo,
                            antigo
                        );
                    }
                    catch
                    {
                    }
                }

                File.AppendAllText(
                    arquivo,
                    $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {mensagem}{Environment.NewLine}",
                    Encoding.UTF8
                );
            }
        }
        catch
        {
        }
    }

    private async Task<bool>
        ServidorAdegaEstaAtivoAsync()
    {
        try
        {
            using HttpClient client =
                new()
                {
                    Timeout =
                        TimeSpan.FromMilliseconds(
                            900
                        )
                };

            string json =
                await client.GetStringAsync(
                    statusUrl
                );

            using JsonDocument doc =
                JsonDocument.Parse(json);

            if (
                doc.RootElement
                    .TryGetProperty(
                        "sucesso",
                        out JsonElement sucesso
                    ) &&
                sucesso.ValueKind ==
                    JsonValueKind.True
            )
            {
                return true;
            }

            return false;
        }
        catch
        {
            return false;
        }
    }

    private async Task<bool>
        AguardarServidorAsync(
            TimeSpan limite
        )
    {
        DateTime fim =
            DateTime.UtcNow.Add(
                limite
            );

        while (
            DateTime.UtcNow < fim
        )
        {
            if (
                serverProcess != null &&
                serverProcess.HasExited
            )
            {
                return false;
            }

            if (
                await ServidorAdegaEstaAtivoAsync()
            )
            {
                return true;
            }

            await Task.Delay(350);
        }

        return false;
    }

    private async Task PararServidorAsync()
    {
        try
        {
            if (
                serverProcess != null &&
                !serverProcess.HasExited
            )
            {
                serverProcess.Kill(
                    entireProcessTree: true
                );

                await serverProcess
                    .WaitForExitAsync();

                serverProcess.Dispose();
            }
        }
        catch
        {
        }
        finally
        {
            serverProcess = null;
            serverStartedByLauncher = false;
        }

        // Dá tempo para o SQLite liberar handles.
        await Task.Delay(500);
    }

    private async Task ReiniciarServidorAsync()
    {
        try
        {
            // O endpoint de restauração encerra o Node após responder.
            // Se ainda estiver vivo, encerra aqui para garantir reabertura limpa.
            if (
                serverProcess != null &&
                !serverProcess.HasExited
            )
            {
                try
                {
                    serverProcess.Kill(
                        entireProcessTree: true
                    );

                    await serverProcess
                        .WaitForExitAsync();
                }
                catch
                {
                }

                try
                {
                    serverProcess.Dispose();
                }
                catch
                {
                }

                serverProcess = null;
                serverStartedByLauncher = false;
            }

            await Task.Delay(500);

            IniciarServidorNode();

            bool iniciou =
                await AguardarServidorAsync(
                    TimeSpan.FromSeconds(25)
                );

            if (!iniciou)
            {
                throw new InvalidOperationException(
                    "O servidor não voltou a responder."
                );
            }

            BeginInvoke(() =>
            {
                webView.Source =
                    new Uri(serverUrl);
            });
        }
        catch (Exception ex)
        {
            BeginInvoke(() =>
            {
                MessageBox.Show(
                    $"O banco foi restaurado, mas o servidor não reiniciou automaticamente.\n\n{ex.Message}\n\nFeche e abra o Adega PDV.",
                    "Adega PDV",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
            });
        }
    }


    private void AoPressionarTecla(
        object? sender,
        KeyEventArgs e
    )
    {
        if (e.KeyCode == Keys.F11)
        {
            AlternarTelaCheia();
            e.Handled = true;
            return;
        }

        if (
            e.Control &&
            e.KeyCode == Keys.R &&
            webView.CoreWebView2 != null
        )
        {
            webView.Reload();
            e.Handled = true;
        }
    }

    private bool telaCheia;
    private FormBorderStyle bordaAnterior;
    private FormWindowState estadoAnterior;
    private Rectangle limitesAnteriores;
    private bool topMostAnterior;

    private void AlternarTelaCheia()
    {
        if (!telaCheia)
        {
            // Guarda o estado exato da janela para restauração.
            bordaAnterior =
                FormBorderStyle;

            estadoAnterior =
                WindowState;

            limitesAnteriores =
                Bounds;

            topMostAnterior =
                TopMost;

            Screen telaAtual =
                Screen.FromControl(
                    this
                );

            SuspendLayout();

            try
            {
                // Não usamos Maximized aqui porque o Windows maximiza
                // apenas até a WorkingArea, deixando a barra de tarefas
                // ou uma pequena borda visível.
                WindowState =
                    FormWindowState.Normal;

                FormBorderStyle =
                    FormBorderStyle.None;

                // Garante que a janela cubra a tela física inteira,
                // inclusive a área normalmente reservada à taskbar.
                Bounds =
                    telaAtual.Bounds;

                TopMost =
                    true;

                BringToFront();

                telaCheia =
                    true;
            }
            finally
            {
                ResumeLayout(
                    true
                );
            }
        }
        else
        {
            SuspendLayout();

            try
            {
                TopMost =
                    topMostAnterior;

                FormBorderStyle =
                    bordaAnterior;

                WindowState =
                    FormWindowState.Normal;

                Bounds =
                    limitesAnteriores;

                // Restaura o estado anterior somente depois dos limites.
                if (
                    estadoAnterior !=
                    FormWindowState.Normal
                )
                {
                    WindowState =
                        estadoAnterior;
                }

                telaCheia =
                    false;
            }
            finally
            {
                ResumeLayout(
                    true
                );
            }
        }

        EnviarEstadoTelaCheia();
    }

    private void EnviarEstadoTelaCheia()
    {
        if (webView.CoreWebView2 == null)
            return;

        string ativo =
            telaCheia
                ? "true"
                : "false";

        webView.CoreWebView2.PostWebMessageAsJson(
            "{\"tipo\":\"estado-tela-cheia\",\"ativo\":" +
            ativo +
            "}"
        );
    }

    private void AoFechar(
        object? sender,
        FormClosingEventArgs e
    )
    {
        if (closing)
            return;

        closing = true;

        try
        {
            if (
                serverStartedByLauncher &&
                serverProcess != null &&
                !serverProcess.HasExited
            )
            {
                serverProcess.Kill(
                    entireProcessTree: true
                );

                serverProcess.WaitForExit(
                    2500
                );
            }
        }
        catch
        {
        }
        finally
        {
            try
            {
                serverProcess?.Dispose();
            }
            catch
            {
            }
        }
    }
}
