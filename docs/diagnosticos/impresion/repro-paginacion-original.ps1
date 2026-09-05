
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
public class AuditSize { public double Width = 10; }
public class AuditFont { public double GetHeight(object g) { return 12; } }
public class AuditGraphics {
 public List<string> Lines = new List<string>();
 public void DrawString(string s, object f, object b, double x, double y) { Lines.Add(s); }
 public AuditSize MeasureString(string s, object f) { return new AuditSize(); }
}
public class AuditPage : EventArgs { public bool HasMorePages; public AuditGraphics Graphics = new AuditGraphics(); }
public class AuditDocument {
 public event EventHandler<AuditPage> PrintPage;
 public List<AuditPage> Pages = new List<AuditPage>();
 public void PrintBounded() { for(int i=0;i<5;i++) { var p=new AuditPage(); PrintPage(this,p); Pages.Add(p); if(!p.HasMorePages) break; } }
}
'@
$font = [AuditFont]::new(); $emphasisFont = $font; $logo = $null
$lineHeight = 13
$renderLines = @(1..200 | ForEach-Object { 'LINE-' + $_ })
$pageHeight = 1600
$document = [AuditDocument]::new()
$lineIndex = 0
$pageIndex = 0
$document.add_PrintPage({ param($sender, $event)
  $y = 0
  if ($pageIndex -eq 0 -and $logo) {
    $x = [int][Math]::Round(0 + ((291 - $logoWidth) / 2))
    $event.Graphics.DrawImage($logo, $x, $y, $logoWidth, $logoHeight)
    $y += $logoHeight + 8
  }
  elseif ($pageIndex -gt 0) {
    $continuation = '--- CONTINUA ---'
    $continuationWidth = $event.Graphics.MeasureString($continuation, $font).Width
    $continuationX = [Math]::Max(0, 0 + ((291 - $continuationWidth) / 2))
    $event.Graphics.DrawString($continuation, $font, $null, $continuationX, $y)
    $y += [Math]::Ceiling($font.GetHeight($event.Graphics)) + 3
  }
  while ($lineIndex -lt $renderLines.Count -and ($y + $lineHeight) -le ($pageHeight - 16)) {
    $lineText = [string]$renderLines[$lineIndex]
    $lineFont = if ($lineText -like 'TOTAL A PAGAR:*') { $emphasisFont } else { $font }
    $actualLineHeight = [Math]::Ceiling($lineFont.GetHeight($event.Graphics)) + 1
    if (($y + $actualLineHeight) -gt ($pageHeight - 16)) { break }
    # Align receipt content to the printable left margin. Centering every line
    # makes narrow 80 mm printers appear shifted to the right.
    $event.Graphics.DrawString($lineText, $lineFont, $null, 0, $y)
    $y += $actualLineHeight
    $lineIndex++
  }
  $pageIndex++
  $event.HasMorePages = $lineIndex -lt $renderLines.Count
})

$document.PrintBounded()
@{ pages = @($document.Pages | ForEach-Object { @{ first=$_.Graphics.Lines[0]; last=$_.Graphics.Lines[-1]; count=$_.Graphics.Lines.Count; more=$_.HasMorePages } }); outerLineIndex=$lineIndex } | ConvertTo-Json -Depth 5 -Compress
