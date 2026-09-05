
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
public class AuditSize { public double Width = 10; }
public class AuditFont { public double Height = 12; public double GetHeight(object g) { return Height; } }
public class AuditGraphics {
 public List<string> Lines = new List<string>();
 public void DrawString(string s, object f, object b, double x, double y) { Lines.Add(s); }
 public AuditSize MeasureString(string s, object f) { return new AuditSize(); }
}
public class AuditPage : EventArgs { public bool HasMorePages; public bool Cancel; public AuditGraphics Graphics = new AuditGraphics(); }
public class AuditDocument {
 public event EventHandler<AuditPage> PrintPage;
 public List<AuditPage> Pages = new List<AuditPage>();
 public void PrintBounded() { for(int i=0;i<60;i++) { var p=new AuditPage(); Pages.Add(p); PrintPage(this,p); if(p.Cancel || !p.HasMorePages) break; } }
}
'@
