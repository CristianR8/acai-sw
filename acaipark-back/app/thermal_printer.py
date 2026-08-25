from __future__ import annotations

import base64
import ctypes
import json
import os
import subprocess
import tempfile
import urllib.error
import urllib.request
from pathlib import Path


THERMAL_WIDTH = 315
# 80 mm is the paper width, not the printable width. XP-80C-class printers
# commonly expose about 72 mm of reliable print area, so reserve a wider
# safety margin to avoid clipping text on the right edge.
THERMAL_PADDING = 24
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

function Get-PrinterScore([string]$printerName, [string]$preferredNormalized) {{
  $name = Normalize-PrinterValue $printerName
  if ($name -match 'onenote|pdf|xps|fax|microsoft print') {{ return -1000 }}
  $score = 0
  if ($preferredNormalized) {{
    if ($name -eq $preferredNormalized) {{ $score += 1000 }}
    elseif ($name -like "*$preferredNormalized*" -or $preferredNormalized -like "*$name*") {{ $score += 800 }}
  }}
  if ($name -match 'xp.?80|thermal|receipt|recept|ticket|pos|esc pos|xprinter') {{ $score += 220 }}
  return $score
}}

$printerDiscoveryStarted = [Diagnostics.Stopwatch]::StartNew()
Add-Type -AssemblyName System.Drawing
$preferredNormalized = Normalize-PrinterValue $preferred
$printers = @([System.Drawing.Printing.PrinterSettings]::InstalledPrinters | ForEach-Object {{ [string]$_ }})
$selectedEntry = $printers | ForEach-Object {{ [PSCustomObject]@{{ Name = $_; Score = Get-PrinterScore $_ $preferredNormalized }} }} | Sort-Object Score -Descending | Select-Object -First 1
if (-not $selectedEntry -or $selectedEntry.Score -le 0) {{
  $available = ($printers -join '; ')
  throw "No se encontró una impresora térmica válida. Instaladas: $available"
}}
$printerDiscoveryStarted.Stop()

$logo = if ($logoFile) {{ [System.Drawing.Image]::FromFile($logoFile) }} else {{ $null }}
$font = New-Object System.Drawing.Font('Consolas', {THERMAL_FONT_SIZE}, [System.Drawing.FontStyle]::Regular)
$emphasisFont = New-Object System.Drawing.Font('Consolas', 10.5, [System.Drawing.FontStyle]::Bold)
$lines = $text -split "`r?`n"
$measureBitmap = New-Object System.Drawing.Bitmap 1, 1
$measureGraphics = [System.Drawing.Graphics]::FromImage($measureBitmap)
$lineHeight = [Math]::Ceiling($font.GetHeight($measureGraphics)) + 1

function Wrap-ThermalLine([string]$line, $graphics, $font, [int]$width) {{
  if ([string]::IsNullOrEmpty($line)) {{ return @('') }}
  $wrapped = @()
  $remaining = $line.TrimEnd()
  while ($remaining.Length -gt 0) {{
    $fitLength = 0
    $lastWhitespace = 0
    for ($index = 0; $index -lt $remaining.Length; $index++) {{
      if ($graphics.MeasureString($remaining.Substring(0, $index + 1), $font).Width -gt $width) {{ break }}
      $fitLength = $index + 1
      if ([char]::IsWhiteSpace($remaining[$index])) {{ $lastWhitespace = $fitLength }}
    }}
    if ($fitLength -eq 0) {{ $fitLength = 1 }}
    $takeLength = if ($fitLength -lt $remaining.Length -and $lastWhitespace -gt 0) {{ $lastWhitespace }} else {{ $fitLength }}
    $wrapped += $remaining.Substring(0, $takeLength).TrimEnd()
    $remaining = $remaining.Substring($takeLength).TrimStart()
  }}
  return $wrapped
}}

$renderLines = @()
foreach ($line in $lines) {{
  $renderLines += Wrap-ThermalLine $line $measureGraphics $font {THERMAL_CONTENT_WIDTH}
}}
$logoWidth = 0; $logoHeight = 0
if ($logo) {{
  $scale = [Math]::Min([double]{THERMAL_LOGO_MAX_WIDTH} / $logo.Width, [double]{THERMAL_LOGO_MAX_HEIGHT} / $logo.Height)
  if ($scale -gt 1) {{ $scale = 1 }}
  $logoWidth = [int][Math]::Round($logo.Width * $scale)
  $logoHeight = [int][Math]::Round($logo.Height * $scale)
}}
$firstPageTop = 16 + $logoHeight + $(if ($logo) {{ 8 }} else {{ 0 }})
# A normal ticket gets its exact height. Very large orders continue on extra
# 16-inch pages instead of silently clipping after the first sheet.
$emphasisLines = @($renderLines | Where-Object {{ $_ -like 'TOTAL A PAGAR:*' }}).Count
$pageHeight = [Math]::Max(180, [Math]::Min(1600, $firstPageTop + (($renderLines.Count + 2) * $lineHeight) + ($emphasisLines * 6)))
$measureGraphics.Dispose(); $measureBitmap.Dispose()

$document = New-Object System.Drawing.Printing.PrintDocument
$document.PrinterSettings.PrinterName = $selectedEntry.Name
if (-not $document.PrinterSettings.IsValid) {{ throw "La impresora seleccionada no es válida: $($selectedEntry.Name)" }}
$document.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('Thermal80Receipt', {THERMAL_WIDTH}, $pageHeight)
$document.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$document.OriginAtMargins = $false
$document.PrintController = New-Object System.Drawing.Printing.StandardPrintController
$lineIndex = 0
$pageIndex = 0
$document.add_PrintPage({{ param($sender, $event)
  $y = 0
  if ($pageIndex -eq 0 -and $logo) {{
    $x = [int][Math]::Round({THERMAL_PADDING} + (({THERMAL_CONTENT_WIDTH} - $logoWidth) / 2))
    $event.Graphics.DrawImage($logo, $x, $y, $logoWidth, $logoHeight)
    $y += $logoHeight + 8
  }}
  elseif ($pageIndex -gt 0) {{
    $continuation = '--- CONTINUA ---'
    $continuationWidth = $event.Graphics.MeasureString($continuation, $font).Width
    $continuationX = [Math]::Max({THERMAL_PADDING}, {THERMAL_PADDING} + (({THERMAL_CONTENT_WIDTH} - $continuationWidth) / 2))
    $event.Graphics.DrawString($continuation, $font, [System.Drawing.Brushes]::Black, $continuationX, $y)
    $y += [Math]::Ceiling($font.GetHeight($event.Graphics)) + 3
  }}
  while ($lineIndex -lt $renderLines.Count -and ($y + $lineHeight) -le ($pageHeight - 16)) {{
    $lineText = [string]$renderLines[$lineIndex]
    $lineFont = if ($lineText -like 'TOTAL A PAGAR:*') {{ $emphasisFont }} else {{ $font }}
    $actualLineHeight = [Math]::Ceiling($lineFont.GetHeight($event.Graphics)) + 1
    if (($y + $actualLineHeight) -gt ($pageHeight - 16)) {{ break }}
    # Align receipt content to the printable left margin. Centering every line
    # makes narrow 80 mm printers appear shifted to the right.
    $event.Graphics.DrawString($lineText, $lineFont, [System.Drawing.Brushes]::Black, {THERMAL_PADDING}, $y)
    $y += $actualLineHeight
    $lineIndex++
  }}
  $pageIndex++
  $event.HasMorePages = $lineIndex -lt $renderLines.Count
}})
$document.Print()
$document.Dispose(); $font.Dispose(); $emphasisFont.Dispose(); if ($logo) {{ $logo.Dispose() }}
@{{ printerName = $selectedEntry.Name; discoveryMs = $printerDiscoveryStarted.ElapsedMilliseconds }} | ConvertTo-Json -Compress
"""


def _print_through_agent(*, text: str, printer_hint: str, copies: int, fast_text: bool) -> dict[str, str]:
    agent_url = os.getenv("PRINT_AGENT_URL", "").strip().rstrip("/")
    agent_token = os.getenv("PRINT_AGENT_TOKEN", "").strip()
    if not agent_url or not agent_token:
        raise RuntimeError("La impresión desde Docker requiere configurar el agente local.")

    payload = json.dumps({"text": text, "printer_hint": printer_hint, "copies": max(1, min(copies, 5)), "fast_text": fast_text}).encode("utf-8")
    request = urllib.request.Request(
        f"{agent_url}/print",
        data=payload,
        headers={"Content-Type": "application/json", "X-Acai-Print-Token": agent_token},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            return json.loads(response.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"El agente de impresión rechazó el trabajo: {exc.read().decode('utf-8', errors='replace')}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"No se pudo conectar con el agente de impresión: {exc.reason}") from exc


def _print_raw_windows(*, text: str, printer_name: str, copies: int) -> dict[str, str]:
    """Send a kitchen comanda directly to the ESC/POS spooler without PowerShell."""
    class DocInfo(ctypes.Structure):
        _fields_ = [("pDocName", ctypes.c_wchar_p), ("pOutputFile", ctypes.c_wchar_p), ("pDatatype", ctypes.c_wchar_p)]

    winspool = ctypes.WinDLL("winspool.drv", use_last_error=True)
    handle = ctypes.c_void_p()
    if not winspool.OpenPrinterW(printer_name, ctypes.byref(handle), None):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        for _ in range(max(1, min(copies, 5))):
            document = DocInfo("ACAI PARK Comanda", None, "RAW")
            if not winspool.StartDocPrinterW(handle, 1, ctypes.byref(document)):
                raise ctypes.WinError(ctypes.get_last_error())
            try:
                if not winspool.StartPagePrinter(handle):
                    raise ctypes.WinError(ctypes.get_last_error())
                try:
                    # ESC @ initializes; ESC t 2 selects CP850; GS V cuts paper.
                    payload = b"\x1b@\x1bt\x02" + text.encode("cp850", errors="replace") + b"\n\n\x1dV\x00"
                    buffer = ctypes.create_string_buffer(payload)
                    written = ctypes.c_ulong()
                    if not winspool.WritePrinter(handle, buffer, len(payload), ctypes.byref(written)):
                        raise ctypes.WinError(ctypes.get_last_error())
                    if written.value != len(payload):
                        raise RuntimeError("La impresora no recibió la comanda completa")
                finally:
                    winspool.EndPagePrinter(handle)
            finally:
                winspool.EndDocPrinter(handle)
    finally:
        winspool.ClosePrinter(handle)
    return {"printerName": printer_name, "mode": "raw", "bytes": str(len(payload))}


def print_thermal_text(*, text: str, printer_hint: str, copies: int = 1, fast_text: bool = False) -> dict[str, str]:
    if os.name != "nt":
        return _print_through_agent(text=text, printer_hint=printer_hint, copies=copies, fast_text=fast_text)
    if fast_text:
        return _print_raw_windows(text=text, printer_name=printer_hint, copies=copies)

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
        # Long, paginated orders can take longer for the Windows spooler to
        # process. Keep the normal limit short while allowing large comandas
        # enough time to finish instead of being cut off mid-print.
        timeout_seconds = min(180, max(30, 20 + (len(text) // 40)))
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
                timeout=timeout_seconds,
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
