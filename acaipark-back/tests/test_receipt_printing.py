"""Run: DATABASE_URL=sqlite:// python -m unittest discover -s tests -v.

The event tests use PowerShell without opening printers. Set ACAI_TEST_PWSH
if PowerShell is not on PATH. Printing/HTTP are mocked in Python tests.
"""
import inspect
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import models, pos, print_agent, schemas, thermal_printer


class ReceiptTransportTests(unittest.TestCase):
    def test_adapter_matches_printer_signature(self):
        with patch.object(thermal_printer, '_print_through_agent', return_value={}) as agent:
            if os.name == 'nt':
                self.skipTest('Linux adapter path; native printing is not invoked')
            pos._send_text_to_windows_printer(text='receipt', printer_hint='test', copies=1)
            agent.assert_called_once_with(text='receipt', printer_hint='test', copies=1, include_logo=True)

    def test_agent_preserves_logo_option(self):
        with patch.dict(os.environ, {'PRINT_AGENT_TOKEN': 'test'}), patch.object(print_agent, 'print_thermal_text', return_value={}) as printer:
            print_agent.print_job(print_agent.PrintJob(text='receipt', printer_hint='test', include_logo=False), 'test')
            printer.assert_called_once_with(text='receipt', printer_hint='test', copies=1, include_logo=False)

    def test_http_wait_covers_all_copies_without_retrying(self):
        with patch.dict(os.environ, {'PRINT_AGENT_URL': 'http://example.test', 'PRINT_AGENT_TOKEN': 'test'}), patch.object(thermal_printer.urllib.request, 'urlopen') as request:
            request.return_value.__enter__.return_value.read.return_value = b'{}'
            text = 'x' * 20000
            thermal_printer._print_through_agent(text=text, printer_hint='test', copies=9, include_logo=False)
            request.assert_called_once()
            payload = json.loads(request.call_args.args[0].data)
            self.assertEqual(payload['copies'], 5)
            self.assertFalse(payload['include_logo'])
            self.assertGreater(request.call_args.kwargs['timeout'], thermal_printer._print_timeout(text) * 5)


class PaymentReceiptTests(unittest.TestCase):
    def test_repeat_payment_and_customer_changes_do_not_reprint(self):
        engine = create_engine('sqlite://')
        models.Base.metadata.create_all(engine)
        try:
            with Session(engine) as session:
                table = models.PosTable(name='Print regression')
                user = models.User(email='print-test@example.test', hashed_password='test', full_name='Print test')
                customers = [models.Customer(name=name, identity_document=name) for name in ['print-a', 'print-b']]
                session.add_all([table, user, *customers])
                session.flush()
                order = models.PosOrder(table_id=table.id, status='open')
                session.add(order)
                session.commit()
                kwargs = {'current_user': user} if 'current_user' in inspect.signature(pos.mark_order_closed).parameters else {}
                with patch.object(pos, '_auto_print_sale_receipt') as printer:
                    for customer_id in [None, None, customers[0].id, customers[0].id, customers[1].id]:
                        pos.mark_order_closed(order.id, schemas.PosOrderClose(customer_id=customer_id), session, **kwargs)
                        self.assertEqual(printer.call_count, 1)
                    self.assertEqual(session.query(models.Sale).count(), 1)
                    self.assertEqual(order.sale.customer_id, customers[1].id)
        finally:
            engine.dispose()


class ReceiptPaginationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pwsh = os.getenv('ACAI_TEST_PWSH') or shutil.which('pwsh') or shutil.which('powershell.exe')
        if not cls.pwsh:
            raise unittest.SkipTest('PowerShell required for .NET event regression tests')

    def render(self, count, height=1600, font_height=12):
        source = thermal_printer._powershell_script()
        handler = source[source.index('$printState ='):source.index('try {\n  $document.Print()')]
        # Replace only drawing resources. Page transitions and guards are the
        # production code, invoked by a real .NET event using PowerShell scopes.
        handler = handler.replace('[System.Drawing.Brushes]::Black', '$null')
        setup = Path(__file__).with_name('fixtures').joinpath('print_event_harness.ps1').read_text()
        setup += f'''
$font = [AuditFont]::new(); $font.Height = {font_height}; $emphasisFont = $font; $logo = $null
$lineHeight = 13
$renderLines = @(); for ($i = 1; $i -le {count}; $i++) {{ $renderLines += "LINE-$i" }}
$pageHeight = {height}
$document = [AuditDocument]::new()
'''
        trailer = '''
$errorMessage = $null
try { $document.PrintBounded() } catch { $errorMessage = $_.Exception.Message }
@{ error=$errorMessage; lineIndex=$printState.LineIndex; pageIndex=$printState.PageIndex;
 pages=@($document.Pages | ForEach-Object { @{ lines=@($_.Graphics.Lines); more=$_.HasMorePages; cancel=$_.Cancel } }) } | ConvertTo-Json -Depth 6 -Compress
'''
        with tempfile.TemporaryDirectory() as directory:
            script = Path(directory) / 'test.ps1'
            # BOM makes non-ASCII error strings portable to Windows PowerShell 5.
            script.write_text(setup + handler + trailer, encoding='utf-8-sig')
            env = {**os.environ, 'XDG_CACHE_HOME': directory, 'XDG_CONFIG_HOME': directory, 'XDG_DATA_HOME': directory}
            result = subprocess.run([self.pwsh, '-NoProfile', '-File', str(script)], capture_output=True, text=True, env=env, check=True, timeout=30)
            return json.loads(result.stdout)

    def test_short_long_and_empty_receipts_finish_without_duplicates(self):
        for count, height in [(0,180),(5,180),(200,1600),(1000,1600)]:
            with self.subTest(lines=count):
                result = self.render(count, height)
                self.assertIsNone(result['error'])
                lines = [line for page in result['pages'] for line in page['lines'] if line.startswith('LINE-')]
                self.assertEqual(lines, [f'LINE-{i}' for i in range(1,count+1)])
                self.assertFalse(result['pages'][-1]['more'])
                self.assertEqual(result['lineIndex'],count)

    def test_no_progress_cancels_instead_of_looping(self):
        result = self.render(5,180,500)
        self.assertIsNotNone(result['error'])
        self.assertTrue(result['pages'][-1]['cancel'])
        self.assertFalse(result['pages'][-1]['more'])
        self.assertEqual(result['lineIndex'],0)

    def test_page_limit_aborts_excessive_receipt(self):
        result = self.render(7000)
        self.assertIsNotNone(result['error'])
        self.assertEqual(result['pageIndex'],50)
        self.assertTrue(result['pages'][-1]['cancel'])
        self.assertFalse(result['pages'][-1]['more'])


if __name__ == '__main__':
    unittest.main()
