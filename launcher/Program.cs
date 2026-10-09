using System;
using System.Threading;
using System.Windows.Forms;

namespace AdegaPDV.Launcher;

internal static class Program
{
    private static Mutex? singleInstanceMutex;

    [STAThread]
    static void Main()
    {
        const string mutexName =
            @"Local\AdegaPDV_Desktop_7D93B3C8_1";

        bool createdNew;

        singleInstanceMutex =
            new Mutex(
                initiallyOwned: true,
                name: mutexName,
                createdNew: out createdNew
            );

        if (!createdNew)
        {
            MessageBox.Show(
                "O Adega PDV já está aberto neste computador.",
                "Adega PDV",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information
            );

            singleInstanceMutex.Dispose();
            return;
        }

        try
        {
            ApplicationConfiguration.Initialize();

            Application.SetUnhandledExceptionMode(
                UnhandledExceptionMode.CatchException
            );

            Application.ThreadException += (_, e) =>
            {
                MessageBox.Show(
                    $"O aplicativo encontrou um erro:\n\n{e.Exception.Message}",
                    "Adega PDV",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            };

            Application.Run(new MainForm());
        }
        finally
        {
            try
            {
                singleInstanceMutex.ReleaseMutex();
            }
            catch
            {
            }

            singleInstanceMutex.Dispose();
        }
    }
}
