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
        self.session.add(models.Sale(order_id=1, total=91000, payment_method='cash', cash_received=100000, cash_denominations={'50000': 2}, created_at=datetime(2026, 9, 9, 12)))
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
        self.assertEqual(sheet['F13'].value, 80000)
        self.assertEqual(sheet['F20'].value, 124000)
        self.assertEqual(sheet['F23'].value, '=IF(F20="","",F20+F21-F22)')
        self.assertIsNone(sheet['F24'].value)
        self.assertEqual(sheet['F25'].value, '=IF(OR(F24="",F23=""),"",F24-F23)')
        self.assertFalse(any(str(c.value).startswith(('3. ', '4. ', '5. ', '6. ')) for row in sheet for c in row))

    def test_missing_opening_and_legacy_payment_are_explicit(self):
        self.session.add(models.Sale(order_id=1, total=10000, payment_method='cash', created_at=datetime(2026, 9, 9, 12)))
        self.session.commit()
        sheet = self.workbook()
        self.assertIsNone(sheet['F20'].value)
        self.assertIn('1 pago(s)', sheet['A28'].value)
        self.assertIn('No hay base inicial', sheet['A28'].value)

    def test_denominations_persist_and_validate(self):
        order = models.PosOrder(table_id=1)
        self.session.add(order)
        self.session.flush()
        sale = pos._create_sale_from_order(self.session, order, payment_method='cash', cash_received=Decimal(100000), cash_denominations={'50000': 2})
        self.session.commit()
        self.session.expire_all()
        self.assertEqual(sale.cash_denominations, {'50000': 2})
        with self.assertRaises(HTTPException):
            pos._create_sale_from_order(self.session, order, payment_method='cash', cash_received=Decimal(100000), cash_denominations={'50000': 1})
        with self.assertRaises(ValidationError):
            schemas.PosOrderClose(cash_denominations={'50000': 1.5})
        with self.assertRaises(HTTPException):
            pos._create_sale_from_order(self.session, order, payment_method='cash', cash_received=Decimal(100000), cash_denominations={'100000': -1})
