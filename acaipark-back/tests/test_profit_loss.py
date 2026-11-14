from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
import re
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy import create_engine, func
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import db, models, sales


class ProfitLossTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        models.Base.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        table = models.PosTable(name='Mesa')
        product = models.InventoryProduct(name='Insumo')
        self.session.add_all([table, product])
        self.session.flush()
        for when, amount, status in [(datetime(2026, 10, 15, 12), 1000000, 'active'), (datetime(2026, 10, 15), 900000, 'void'), (datetime(2026, 9, 30), 500000, 'active')]:
            order = models.PosOrder(table_id=table.id)
            self.session.add(order)
            self.session.flush()
            self.session.add(models.Sale(order_id=order.id, total=amount, status=status, created_at=when, payment_method='cash'))
        for when, amount, status, received in [(datetime(2026, 10, 10), 100000, 'manual', False), (datetime(2026, 10, 12), 20000, 'manual', True), (datetime(2026, 10, 10), 90000, 'void', False), (datetime(2026, 9, 30), 80000, 'manual', False)]:
            purchase = models.Purchase(purchased_at=None if received else when, received_at=when if received else None, status=status, total_cost=amount)
            self.session.add(purchase)
            self.session.flush()
            self.session.add(models.PurchaseItem(purchase_id=purchase.id, product_id=product.id, quantity=1, unit_cost=amount, line_total=amount))
        for index, (category, amount, status) in enumerate([('Local', 50000, 'manual'), ('Nómina', 60000, 'manual'), ('nomina', 5000, 'manual'), ('Servicios', 10000, 'manual'), ('Seguros', 5000, 'manual'), ('Otros', 7000, 'manual'), ('Local', 900000, 'void'), ('Local', 800000, 'scheduled')]):
            expense = models.FixedExpense(name=f'Gasto {index}', category=category)
            self.session.add(expense)
            self.session.flush()
            self.session.add(models.FixedExpensePayment(fixed_expense_id=expense.id, period=date(2026, 10, 1), due_date=date(2026, 10, 15), amount=amount, status=status))
        self.session.commit()

        def get_db():
            with Session(self.engine) as session:
                yield session

        app = FastAPI()
        app.include_router(sales.router)
        app.dependency_overrides[db.get_db] = get_db
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.session.close()
        self.engine.dispose()

    def test_json_includes_all_concepts_and_correct_calculations(self):
        response = self.client.get('/sales/pl-statement?month=2026-10')
        self.assertEqual(response.status_code, 200, response.text)
        statement = response.json()
        self.assertEqual(statement['month'], '2026-10')
        self.assertEqual(len(statement['rows']), 24)
        values = {row['excel_row']: Decimal(row['amount']) for row in statement['rows']}
        self.assertEqual(values[5], 1000000)
        self.assertEqual(values[8], 120000)
        self.assertEqual(values[6], 120000)
        self.assertEqual(values[10], 880000)
        self.assertEqual(values[21], 65000)
        self.assertEqual(values[19], 130000)
        self.assertEqual(values[31], 743000)
        self.assertEqual(values[16], 7000)
        self.assertEqual(Decimal(statement['expenses_total']), 137000)
        self.assertEqual(statement['expenses_total'], statement['expenses_included'])
        self.assertEqual(statement['expense_count'], 6)
        for row in statement['rows']:
            self.assertEqual(Decimal(row['percentage']), Decimal(row['amount']) / 1000000)

    def test_excel_matches_every_screen_row_and_formula(self):
        statement = sales.get_pl_statement('2026-10', self.session)
        sheet = load_workbook(BytesIO(sales.export_pl_statement_xlsx('2026-10', self.session).body)).active

        def calculated(cell):
            value = sheet[cell].value
            if not isinstance(value, str) or not value.startswith('='):
                return Decimal(str(value or 0))
            terms = re.findall(r'([+-]?)([CD]\d+)', value[1:])
            return sum((calculated(ref) * (-1 if sign == '-' else 1) for sign, ref in terms), Decimal(0))

        for row in statement.rows:
            with self.subTest(concept=row.concept):
                self.assertEqual(sheet.cell(row.excel_row, 2).value, row.concept)
                ref = f'{row.column}{row.excel_row}'
                self.assertEqual(calculated(ref), row.amount)
                if row.formula:
                    self.assertEqual(sheet[ref].value, row.formula)
                self.assertEqual(sheet.cell(row.excel_row, 5).value, f'=IF($D$5=0,"",{ref}/$D$5)')

    def test_empty_month_has_no_division_by_zero(self):
        report = sales.get_pl_statement('2026-11', self.session)
        self.assertTrue(all(row.amount == 0 and row.percentage is None for row in report.rows))
        sheet = load_workbook(BytesIO(sales.export_pl_statement_xlsx('2026-11', self.session).body)).active
        self.assertEqual(sheet['E5'].value, '=IF($D$5=0,"",D5/$D$5)')

    def test_expenses_without_sales_show_a_loss_and_no_percentage(self):
        self.session.query(models.Sale).update({models.Sale.status: 'void'})
        self.session.commit()
        report = sales.get_pl_statement('2026-10', self.session)
        values = {row.excel_row: row.amount for row in report.rows}
        self.assertEqual(values[5], 0)
        self.assertEqual(values[31], -257000)
        self.assertTrue(all(row.percentage is None for row in report.rows))

    def test_invalid_month_rejected_by_json_and_excel(self):
        for month in ['2026-13', '2026-00', '0000-01', 'foo']:
            for path in ['/sales/pl-statement', '/sales/pl-statement.xlsx']:
                self.assertEqual(self.client.get(path, params={'month': month}).status_code, 400)

    def test_cash_closing_keeps_expense_detail_and_reconciliation(self):
        day = date(2026, 10, 15)
        closing = sales.get_cash_closing(day, self.session)
        self.assertEqual(closing.cash_total, 1000000)
        self.assertEqual(closing.expenses_total, 137000)
        self.assertEqual(closing.expected_cash, 863000)
        sheet = load_workbook(BytesIO(sales.export_daily_payment_methods_xlsx(day, self.session).body)).active
        labels = [str(cell.value) for row in sheet for cell in row]
        self.assertIn('GASTOS Y SALIDAS DE CAJA', labels)
        for label in ['EFECTIVO RECIBIDO (BILLETES Y MONEDAS)', 'RESUMEN DE VENTAS Y MEDIOS DE PAGO', 'CONCILIACIÓN FINAL DE CAJA', 'OBSERVACIONES / NOVEDADES DEL TURNO']:
            self.assertIn(label, labels)
        expense_row = next(row for row in sheet if row[0].value == 'Gastos y compras pagadas con efectivo caja')
        section_row = next(row[0].row for row in sheet if row[0].value == 'GASTOS Y SALIDAS DE CAJA')
        total_row = next(row[0].row for row in sheet if row[0].value == 'TOTAL SALIDAS DE CAJA (GASTOS + COMPRAS)')
        detail = list(sheet.iter_rows(min_row=section_row + 2, max_row=total_row - 1))
        self.assertEqual(len(detail), 6)
        self.assertEqual(sum(Decimal(str(row[5].value)) for row in detail), closing.expenses_total)
        self.assertNotIn('Gasto 6', [row[0].value for row in detail])
        self.assertNotIn('Gasto 7', [row[0].value for row in detail])
        self.assertEqual(sheet.cell(total_row, 6).value, f'=SUM(F{section_row + 2}:F{total_row - 1})')
        self.assertEqual(expense_row[5].value, f'=F{total_row}')
        self.assertGreater(next(row[0].row for row in sheet if row[0].value == 'CONCILIACIÓN FINAL DE CAJA'), total_row)
        pdf = sales.export_cash_closing_pdf(day, self.session)
        self.assertTrue(pdf.body.startswith(b'%PDF-'))

    def test_cash_closing_empty_day_keeps_expense_section_with_zero(self):
        day = date(2026, 10, 16)
        sheet = load_workbook(BytesIO(sales.export_daily_payment_methods_xlsx(day, self.session).body)).active
        empty_row = next(row for row in sheet if row[0].value == 'Sin gastos registrados')
        self.assertEqual(empty_row[5].value, 0)
        total_row = next(row[0].row for row in sheet if row[0].value == 'TOTAL SALIDAS DE CAJA (GASTOS + COMPRAS)')
        self.assertEqual(sheet.cell(total_row, 6).value, f'=SUM(F{empty_row[0].row}:F{empty_row[0].row})')
        self.assertEqual(sales.get_cash_closing(day, self.session).expenses_total, 0)

    def add_expense(self, name, category, amount, expense_type=None, *, day=date(2026, 10, 15), status='manual', active=True):
        expense = models.FixedExpense(name=name, category=category, is_active=active)
        self.session.add(expense)
        self.session.flush()
        self.session.add(models.FixedExpensePayment(fixed_expense_id=expense.id, period=day.replace(day=1), due_date=day, amount=amount, expense_type=expense_type, status=status))
        self.session.commit()

    def test_every_expense_is_included_once_even_with_unknown_or_inactive_categories(self):
        cases = [
            ('Domicilio', 'Transporte', '3000.25', None, 15),
            ('Flete: compra de productos', 'Transporte', '5000.75', None, 15),
            ('Bolsas', 'Desechables y empaques', '700', None, 13),
            ('Comisión datáfono', 'Comisiones', '500', None, 14),
            ('Anuncio', 'Marketing y publicidad', '800', None, 23),
            ('Arreglo de nevera', 'Mantenimiento', '900', None, 27),
            ('Impuesto local', 'Impuestos', '1000', None, 30),
            ('Nuevo gasto fijo', 'Personalizada', '1100', 'operacional_fijo', 25),
            ('Nuevo gasto variable', 'Personalizada', '1200', 'operacional_variable', 16),
            ('Nuevo sin clasificar', 'Personalizada', '1300', None, 16),
        ]
        for name, category, amount, kind, expected in cases:
            self.add_expense(name, category, Decimal(amount), kind)
        self.add_expense('Gasto desactivado', 'Personalizada', 200, active=False)
        self.add_expense('Fuera del mes', 'Personalizada', 99999, day=date(2026, 11, 1))
        self.add_expense('Anulado', 'Personalizada', 88888, status='void')
        self.add_expense('Programado', 'Personalizada', 77777, status='scheduled')
        self.session.add(models.FixedExpensePayment(fixed_expense_id=999999, period=date(2026, 10, 1), due_date=date(2026, 10, 15), amount=77, status='manual'))
        self.session.commit()
        report = sales.get_pl_statement('2026-10', self.session)
        values = {row.excel_row: row.amount for row in report.rows}
        expected_total = self.session.query(func.sum(models.FixedExpensePayment.amount)).filter(models.FixedExpensePayment.status == 'manual', models.FixedExpensePayment.due_date >= date(2026, 10, 1), models.FixedExpensePayment.due_date < date(2026, 11, 1)).scalar()
        leaf_rows = (13, 14, 15, 16, 20, 21, 22, 23, 24, 25, 27, 30)
        self.assertEqual(sum(values[row] for row in leaf_rows), expected_total)
        self.assertEqual(report.expenses_total, report.expenses_included)
        self.assertEqual(report.expenses_total, expected_total)
        self.assertEqual(values[31], values[5] - values[8] - expected_total)
        self.assertEqual(sum(group.count for group in report.expense_breakdown), report.expense_count)
        groups = {group.name: group for group in report.expense_breakdown}
        for name, category, amount, kind, expected in cases:
            self.assertEqual(groups[name].excel_row, expected)
            self.assertEqual(groups[name].amount, Decimal(amount))
        self.assertIn('Gasto #999999', groups)
        self.assertTrue(groups['Nuevo sin clasificar'].needs_classification)
        self.assertTrue(report.provisional)

    def test_purchase_without_lines_and_header_detail_mismatches_are_not_omitted(self):
        product = self.session.query(models.InventoryProduct).first()
        for header, detail in [(6000, None), (0, 4000), (3000, 2000)]:
            purchase = models.Purchase(purchased_at=datetime(2026, 10, 15), total_cost=header)
            self.session.add(purchase)
            self.session.flush()
            if detail is not None:
                self.session.add(models.PurchaseItem(purchase_id=purchase.id, product_id=product.id, quantity=1, unit_cost=detail, line_total=detail))
        self.session.commit()
        report = sales.get_pl_statement('2026-10', self.session)
        self.assertEqual(next(row.amount for row in report.rows if row.excel_row == 8), 133000)
        self.assertEqual(report.purchase_count, 5)
        self.assertTrue(any('sin líneas' in warning for warning in report.warnings))

    def test_payment_date_not_creation_period_or_paid_timestamp_selects_the_expense_month(self):
        expense = models.FixedExpense(name='Pago histórico', category='Otros')
        self.session.add(expense)
        self.session.flush()
        self.session.add(models.FixedExpensePayment(fixed_expense_id=expense.id, period=date(2026, 9, 1), due_date=date(2026, 10, 31), created_at=datetime(2026, 11, 1), paid_at=datetime(2026, 11, 1), amount=1234, status='manual'))
        self.session.commit()
        october = sales.get_pl_statement('2026-10', self.session)
        november = sales.get_pl_statement('2026-11', self.session)
        self.assertEqual(october.expenses_total, 138234)
        self.assertEqual(november.expenses_total, 0)

    def test_excel_contains_the_same_expense_control_and_includes_others(self):
        report = sales.get_pl_statement('2026-10', self.session)
        workbook = load_workbook(BytesIO(sales.export_pl_statement_xlsx('2026-10', self.session).body))
        control = workbook['Control de gastos']
        self.assertEqual(control['B2'].value, float(report.expenses_total))
        self.assertEqual(control['B3'].value, float(report.expenses_included))
        self.assertEqual(control['B4'].value, '=B2-B3')
        self.assertEqual(sum(Decimal(str(control.cell(row, 5).value)) for row in range(8, control.max_row + 1)), report.expenses_total)
        self.assertIn('inventario', workbook.active['B33'].value.lower())
        self.assertEqual(workbook.active['D31'].value, '=D28-C30')

    def test_source_sales_inconsistencies_and_tax_service_are_flagged(self):
        sale = self.session.query(models.Sale).filter(models.Sale.status == 'active', models.Sale.created_at >= datetime(2026, 10, 1)).first()
        sale.order.status = 'paid'
        sale.order.total = 1
        sale.tax_total = 100
        sale.service_total = 50
        self.session.commit()
        report = sales.get_pl_statement('2026-10', self.session)
        self.assertTrue(any('impuestos' in warning and 'servicio' in warning for warning in report.warnings))
        self.assertTrue(any('pedido pagado' in warning for warning in report.warnings))

    def test_sales_and_purchase_date_boundaries_are_inclusive_then_exclusive(self):
        table_id = self.session.query(models.PosTable.id).first()[0]
        product_id = self.session.query(models.InventoryProduct.id).first()[0]
        for when, amount in [(datetime(2026, 10, 1), 10), (datetime(2026, 10, 31, 23, 59, 59, 999999), 20), (datetime(2026, 11, 1), 999)]:
            order = models.PosOrder(table_id=table_id)
            self.session.add(order)
            self.session.flush()
            self.session.add(models.Sale(order_id=order.id, created_at=when, total=amount))
        for purchased_at, received_at, created_at, amount in [
            (datetime(2026, 9, 30), datetime(2026, 10, 1), datetime(2026, 10, 1), 999),
            (None, datetime(2026, 10, 31, 23, 59, 59, 999999), datetime(2026, 11, 1), 10),
            (None, None, datetime(2026, 10, 1), 20),
            (None, None, datetime(2026, 11, 1), 999),
        ]:
            purchase = models.Purchase(purchased_at=purchased_at, received_at=received_at, created_at=created_at, total_cost=amount)
            self.session.add(purchase)
            self.session.flush()
            self.session.add(models.PurchaseItem(purchase_id=purchase.id, product_id=product_id, quantity=1, unit_cost=amount, line_total=amount))
        self.session.commit()
        report = sales.get_pl_statement('2026-10', self.session)
        values = {row.excel_row: row.amount for row in report.rows}
        self.assertEqual(values[5], 1000030)
        self.assertEqual(values[8], 120030)
