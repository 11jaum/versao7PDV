#define MyAppName "Adega PDV"
#define MyAppVersion "2.1.7"
#define MyAppPublisher "Adega PDV"
#define MyAppExeName "AdegaPDV.exe"

[Setup]
AppId={{2B208384-4D4A-4CB6-9EC5-A4C4C7C8AE01}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\AdegaPDV
DefaultGroupName=Adega PDV
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=output
OutputBaseFilename=AdegaPDV-Setup-{#MyAppVersion}
SetupIconFile=..\launcher\Resources\AdegaPDV.ico
UninstallDisplayIcon={app}\AdegaPDV.exe
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
VersionInfoVersion=2.1.7.0
VersionInfoProductName=Adega PDV
VersionInfoDescription=Instalador do Adega PDV
VersionInfoCompany=Adega PDV

[Dirs]
Name: "{app}\app\database"
Name: "{app}\app\backups"
Name: "{app}\data"
Name: "{app}\logs"
Name: "{app}\app\temp"

[Files]
; Arquivos do aplicativo. Dados mutáveis são tratados separadamente.
Source: "..\dist\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; \
    Excludes: "app\database\*;app\backups\*;app\temp\*;data\*;logs\*"

; Se o instalador foi criado COM os dados atuais, o banco entra apenas
; na primeira instalação. Atualizações nunca sobrescrevem o banco existente.
Source: "seed\adega.db"; DestDir: "{app}\app\database"; DestName: "adega.db"; \
    Flags: onlyifdoesntexist ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{autoprograms}\Adega PDV"; Filename: "{app}\AdegaPDV.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\Adega PDV"; Filename: "{app}\AdegaPDV.exe"; WorkingDir: "{app}"

[Run]
Filename: "{app}\AdegaPDV.exe"; Description: "Abrir Adega PDV"; Flags: nowait postinstall skipifsilent

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Db, BackupDir, BackupFile, Stamp: String;
begin
  Result := '';

  Db := ExpandConstant('{app}\app\database\adega.db');

  if FileExists(Db) then
  begin
    BackupDir := ExpandConstant('{app}\app\backups\antes-atualizacao');
    ForceDirectories(BackupDir);

    Stamp := GetDateTimeString('yyyy-mm-dd_hh-nn-ss', '-', ':');
    BackupFile := BackupDir + '\adega_antes_atualizacao_' + Stamp + '.db';

    if not FileCopy(Db, BackupFile, False) then
    begin
      Result :=
        'Não foi possível criar o backup de segurança do banco antes da atualização.' +
        Chr(13) + Chr(10) + Chr(13) + Chr(10) +
        'Feche o Adega PDV e tente novamente.';
    end;
  end;
end;
