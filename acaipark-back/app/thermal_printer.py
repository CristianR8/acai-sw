from __future__ import annotations

import base64
import json
import os
import subprocess
import tempfile
from pathlib import Path


THERMAL_WIDTH = 315
THERMAL_PADDING = 12
THERMAL_CONTENT_WIDTH = THERMAL_WIDTH - (THERMAL_PADDING * 2)
THERMAL_FONT_SIZE = 8.2
THERMAL_LOGO_MAX_WIDTH = 150
THERMAL_LOGO_MAX_HEIGHT = 60


def default_logo_path() -> Path | None:
    configured_path = os.getenv("POS_RECEIPT_LOGO_PATH", "").strip()
    candidates = [Path(configured_path)] if configured_path else []
    candidates.append(
        Path(__file__).resolve().parents[2]
        / "acaipark-front"
        / "public"
        / "images"
        / "logo"
        / "LogoAP.jpg"
    )
    return next((path for path in candidates if path.is_file()), None)


def _powershell_script() -> str:
    return f"""
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
$preferred = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:ACAI_PRINTER_NAME_B64))
$text = Get-Content -LiteralPath $env:ACAI_RECEIPT_FILE -Raw -Encoding UTF8
$logoFile = if ($env:ACAI_LOGO_FILE -and (Test-Path -LiteralPath $env:ACAI_LOGO_FILE)) {{ $env:ACAI_LOGO_FILE }} else {{ $null }}

function Normalize-PrinterValue([string]$value) {{
  if (-not $value) {{ return '' }}
  $value = $value.Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object Text.StringBuilder
  foreach ($character in $value.ToCharArray()) {{
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($character) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {{ [void]$builder.Append($character) }}
  }}
  return (($builder.ToString().ToLowerInvariant() -replace '[^a-z0-9]+', ' ').Trim())
}}

function Get-PrinterScore($printer, [string]$preferredNormalized) {{
  $name = Normalize-PrinterValue $printer.Name
  $driver = Normalize-PrinterValue $printer.DriverName
  $port = Normalize-PrinterValue $printer.PortName
  $combined = "$name $driver $port"
  if ($combined -match 'onenote|pdf|xps|fax|microsoft print') {{ return -1000 }}
  $score = 0
  if ($preferredNormalized) {{
    if ($name -eq $preferredNormalized) {{ $score += 1000 }}
    elseif ($name -like "*$preferredNormalized*" -or $preferredNormalized -like "*$name*") {{ $score += 800 }}
    elseif ($driver -like "*$preferredNormalized*") {{ $score += 600 }}
  }}
  if ($combined -match 'xp.?80|thermal|receipt|recept|ticket|pos|esc pos|xprinter') {{ $score += 220 }}
  if ($port -match '^(usb|lpt|com)') {{ $score += 80 }}
  if (-not $printer.WorkOffline) {{ $score += 25 }}
  if ($printer.Default) {{ $score += 10 }}
  return $score
}}

$preferredNormalized = Normalize-PrinterValue $preferred
$printers = Get-CimInstance Win32_Printer | Select-Object Name,DriverName,Default,PortName,WorkOffline
$selectedEntry = $printers | ForEach-Object {{ [PSCustomObject]@{{ Printer = $_; Score = Get-PrinterScore $_ $preferredNormalized }} }} | Sort-Object Score -Descending | Select-Object -First 1
if (-not $selectedEntry -or $selectedEntry.Score -le 0) {{
  $available = (@($printers | ForEach-Object {{ "$($_.Name) [$($_.DriverName)]" }}) -join '; ')
  throw "No se encontró una impresora térmica válida. Instaladas: $available"
}}

Add-Type -AssemblyName System.Drawing
$logo = if ($logoFile) {{ [System.Drawing.Image]::FromFile($logoFile) }} else {{ $null }}
$font = New-Object System.Drawing.Font('Consolas', {THERMAL_FONT_SIZE}, [System.Drawing.FontStyle]::Regular)
$lines = $text -split "`r?`n"
$measureBitmap = New-Object System.Drawing.Bitmap 1, 1
$measureGraphics = [System.Drawing.Graphics]::FromImage($measureBitmap)
$lineHeight = [Math]::Ceiling($font.GetHeight($measureGraphics)) + 1
$logoWidth = 0; $logoHeight = 0
if ($logo) {{
  $scale = [Math]::Min([double]{THERMAL_LOGO_MAX_WIDTH} / $logo.Width, [double]{THERMAL_LOGO_MAX_HEIGHT} / $logo.Height)
  if ($scale -gt 1) {{ $scale = 1 }}
  $logoWidth = [int][Math]::Round($logo.Width * $scale)
  $logoHeight = [int][Math]::Round($logo.Height * $scale)
}}
$pageHeight = [Math]::Max(180, 16 + $logoHeight + (($lines.Count + 2) * $lineHeight))
$measureGraphics.Dispose(); $measureBitmap.Dispose()

$document = New-Object System.Drawing.Printing.PrintDocument
$document.PrinterSettings.PrinterName = $selectedEntry.Printer.Name
if (-not $document.PrinterSettings.IsValid) {{ throw "La impresora seleccionada no es válida: $($selectedEntry.Printer.Name)" }}
$document.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('Thermal80Receipt', {THERMAL_WIDTH}, $pageHeight)
$document.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$document.OriginAtMargins = $false
$document.PrintController = New-Object System.Drawing.Printing.StandardPrintController
$document.add_PrintPage({{ param($sender, $event)
  $y = 0
  if ($logo) {{
    $x = [int][Math]::Round({THERMAL_PADDING} + (({THERMAL_CONTENT_WIDTH} - $logoWidth) / 2))
    $event.Graphics.DrawImage($logo, $x, $y, $logoWidth, $logoHeight)
    $y += $logoHeight + 8
  }}
  foreach ($line in $lines) {{
    $event.Graphics.DrawString([string]$line, $font, [System.Drawing.Brushes]::Black, {THERMAL_PADDING}, $y)
    $y += [Math]::Ceiling($font.GetHeight($event.Graphics)) + 1
  }}
  $event.HasMorePages = $false
}})
$document.Print()
$document.Dispose(); $font.Dispose(); if ($logo) {{ $logo.Dispose() }}
@{{ printerName = $selectedEntry.Printer.Name; driverName = $selectedEntry.Printer.DriverName; portName = $selectedEntry.Printer.PortName }} | ConvertTo-Json -Compress
"""


def print_thermal_text(*, text: str, printer_hint: str, copies: int = 1) -> dict[str, str]:
    if os.name != "nt":
        raise RuntimeError(
            "La impresión directa requiere el agente/backend ejecutándose en el PC Windows donde está instalada la impresora térmica."
        )

    receipt_file = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", suffix=".txt", delete=False
    )
    try:
        receipt_file.write(text)
        receipt_file.close()
        logo_path = default_logo_path()
        script = _powershell_script()
        encoded_script = base64.b64encode(script.encode("utf-16le")).decode("ascii")
        copies = max(1, min(copies, 5))
        result: dict[str, str] = {}
        for _ in range(copies):
            completed = subprocess.run(
                [
                    "powershell.exe",
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-EncodedCommand",
                    encoded_script,
                ],
                capture_output=True,
                text=True,
                timeout=30,
                env={
                    **os.environ,
                    "ACAI_PRINTER_NAME_B64": base64.b64encode(
                        printer_hint.encode("utf-8")
                    ).decode("ascii"),
                    "ACAI_RECEIPT_FILE": receipt_file.name,
                    "ACAI_LOGO_FILE": str(logo_path) if logo_path else "",
                },
            )
            if completed.returncode != 0:
                raise RuntimeError((completed.stderr or completed.stdout).strip())
            result = json.loads(completed.stdout.strip() or "{}")
        return result
    finally:
        try:
            os.unlink(receipt_file.name)
        except FileNotFoundError:
            pass
