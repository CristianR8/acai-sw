from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
import unittest

from fastapi import HTTPException
from openpyxl import load_workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app import models, pos, sales, schemas
from pydantic import ValidationError


class CashClosingTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://')
        models.Base.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.day = date(2026, 9, 9)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def workbook(self):
        response = sales.export_daily_payment_methods_xlsx(self.day, self.session)
        return load_workbook(BytesIO(response.body)).active

    def test_export_shared_opening_expenses_and_denominations(self):
        self.session.add(models.CashDrawerOpening(user_id=1, business_date=self.day, opening_amount=124000, source='manual'))
        self.session.add(models.Sale(order_id=1, total=91000, payment_method='cash', cash_received=100000, cash_denomination_counts={'50000': 2}, created_at=datetime(2026, 9, 9, 12)))
        self.session.add(models.Sale(order_id=2, total=64000, payment_method='card', created_at=datetime(2026, 9, 9, 12)))
        expense = models.FixedExpense(name='Compras', category='Gastos')
        self.session.add(expense)
        self.session.flush()
        self.session.add(models.FixedExpensePayment(fixed_expense_id=expense.id, period=self.day, due_date=self.day, amount=80000, status='manual'))
        self.session.commit()
        sheet = self.workbook()
        self.assertEqual(sheet['B7'].value, 2)
        self.assertEqual(sheet['C7'].value, '=A7*B7')
        self.assertEqual(sheet['F6'].value, 91000)
        self.assertEqual(sheet['F7'].value, 64000)
        expense_row = next(row for row in sheet if str(row[0].value).startswith('Gasto #'))
        self.assertEqual(expense_row[5].value, 80000)
        opening_row = next(row[0].row for row in sheet if str(row[0].value).startswith('Base Inicial'))
        self.assertEqual(sheet.cell(opening_row, 6).value, 124000)
        self.assertEqual(sheet.cell(opening_row + 3, 6).value, f'=IF(F{opening_row}="","",F{opening_row}+F{opening_row+1}-F{opening_row+2})')
        self.assertEqual(sheet.cell(opening_row + 4, 6).value, '=C17')
        closing = sales._cash_closing(self.day, self.session)
        self.assertEqual(closing.expected_cash, 135000)

    def test_missing_opening_and_legacy_payment_are_explicit(self):
        self.session.add(models.Sale(order_id=1, total=10000, payment_method='cash', created_at=datetime(2026, 9, 9, 12)))
        self.session.commit()
        sheet = self.workbook()
        opening_row = next(row[0].row for row in sheet if str(row[0].value).startswith('Base Inicial'))
        self.assertIsNone(sheet.cell(opening_row, 6).value)
        self.assertTrue(any('No hay base inicial' in str(cell.value) for row in sheet for cell in row))
        self.assertEqual(sales._cash_closing(self.day, self.session).denomination_counts['50000'], 0)

    def test_denominations_persist_and_validate(self):
        order = models.PosOrder(table_id=1)
        self.session.add(order)
        self.session.flush()
        sale = pos._create_sale_from_order(self.session, order, payment_method='cash', cash_received=Decimal(100000), cash_denomination_counts={'50000': 2})
        self.session.commit()
        self.session.expire_all()
        self.assertEqual(sale.cash_denomination_counts, {'50000': 2})
        closing = sales.update_cash_closing(self.day, schemas.CashClosingUpdate(denomination_counts={'50000': 1, '500': 3}), self.session)
        self.assertEqual(closing.physical_cash, 51500)
        self.assertEqual(sales._cash_closing(self.day, self.session).physical_cash, 51500)
        with self.assertRaises(HTTPException):
            sales.update_cash_closing(self.day, schemas.CashClosingUpdate(denomination_counts={'123': 1}), self.session)
        with self.assertRaises(ValidationError):
            schemas.CashClosingUpdate(denomination_counts={'50000': 1.5})
        with self.assertRaises(HTTPException):
            sales.update_cash_closing(self.day, schemas.CashClosingUpdate(denomination_counts={'100000': -1}), self.session)
