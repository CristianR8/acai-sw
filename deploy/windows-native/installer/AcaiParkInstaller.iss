#define MyAppName "ACAIPARK POS"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "ACAIPARK"
#define MyAppExeName "launch-acaipark.bat"

[Setup]
AppId={{7BDB263F-0E3A-4D6D-B3A2-1F19B8E2C3C1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\AcaiParkSW
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=.
OutputBaseFilename=AcaiParkSetup
SetupIconFile=..\..\..\acaipark-front\public\images\favicon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear icono en escritorio"; GroupDescription: "Accesos directos:"

[Files]
Source: "..\..\..\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion; Excludes: ".git\*,node_modules\*,logs\*,acaipark-front\.next\cache\*,*.log"

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\acaipark-front\public\images\favicon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\acaipark-front\public\images\favicon.ico"; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\deploy\windows-native\quick-install.ps1"" -ProjectRoot ""{app}"""; Description: "Ejecutar instalacion asistida ahora"; Flags: postinstall waituntilterminated
