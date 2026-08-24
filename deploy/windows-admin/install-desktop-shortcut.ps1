param([string]$ProjectRoot = "C:\Users\This\acai-sw-admin")

$ErrorActionPreference = "Stop"
$launcher = Join-Path $ProjectRoot "launch-acaipark-admin.vbs"
if (!(Test-Path $launcher)) { throw "No se encontró $launcher" }

$logo = Join-Path $ProjectRoot "acaipark-front\public\images\logo\LogoAP.jpg"
$iconPath = Join-Path $ProjectRoot "acaipark-front\public\images\logo\LogoAP-admin.ico"
if (!(Test-Path $logo)) { throw "No se encontró $logo" }

Add-Type -AssemblyName System.Drawing
$sourceImage = [System.Drawing.Image]::FromFile($logo)
$bitmap = New-Object System.Drawing.Bitmap 64, 64
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.DrawImage($sourceImage, 0, 0, 64, 64)
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$stream = [System.IO.File]::Open($iconPath, [System.IO.FileMode]::Create)
try {
  $icon.Save($stream)
} finally {
  $stream.Dispose()
  $icon.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
  $sourceImage.Dispose()
}

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "ACAI PARK Administrador.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $ProjectRoot
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "Iniciar ACAI PARK Administrador"
$shortcut.Save()

Write-Output "Acceso directo creado: $shortcutPath"
