from datetime import datetime, timezone
from decimal import Decimal
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app import models, sales, inventory
from app.reporting_periods import month_bounds


class ReportingMonthsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://')
        models.Base.metadata.create_all(self.engine)
        self.session = Session(self.engine)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_calendar_bounds_and_bogota_timezone(self):
        start, end = month_bounds('2024-02')
        self.assertEqual((end-start).days, 29)
        self.assertEqual(start.astimezone(timezone.utc).isoformat(), '2024-02-01T05:00:00+00:00')
        self.assertEqual(month_bounds('2026-12')[1].isoformat(), '2027-01-01T00:00:00-05:00')
        for invalid in ['2026-13', '2026-00', '2026', 'foo', '0000-01']:
            with self.assertRaises(HTTPException):
                month_bounds(invalid)

    def test_all_sales_of_one_month_and_summaries(self):
        table = models.PosTable(name='Mesa 1')
        product = models.MenuItem(name='Producto', category='Otros', price=10)
        self.session.add_all([table, product])
        self.session.flush()
        for index in range(207):
            when = datetime(2026, 9, 15)
            if index == 205:
                when = datetime(2026, 8, 31, 23, 59, 59)
            if index == 206:
                when = datetime(2026, 10, 1)
            order = models.PosOrder(table_id=table.id)
            self.session.add(order)
            self.session.flush()
            sale = models.Sale(order_id=order.id, created_at=when, total=10, payment_method='cash')
            self.session.add(sale)
            self.session.flush()
            self.session.add(models.SaleItem(sale_id=sale.id, menu_item_id=product.id, name='Producto', category='Otros', quantity=1, unit_price=10, tax_rate=0, line_subtotal=10, line_tax=0, line_total=10))
        self.session.commit()
        self.assertEqual(len(sales.list_sales('2026-09', self.session)), 205)
        self.assertEqual(sales.sales_by_product('2026-09', self.session)[0].total, Decimal(2050))
        self.assertEqual(sales.sales_by_table('2026-09', self.session)[0].total, Decimal(2050))
        rows = sales.sales_adjustments_by_month('2026-09', self.session)
        self.assertEqual([(row.year, row.month) for row in rows], [(2026, 9)])
        self.assertEqual(sales.list_sales('2025-09', self.session), [])
        with patch('app.sales.month_bounds', return_value=month_bounds('2026-09')):
            self.assertEqual(len(sales.list_sales(None, self.session)), 205)

    def test_purchase_month_filter_search_and_no_ten_row_limit(self):
        supplier = models.Supplier(name='Proveedor especial')
        self.session.add(supplier)
        self.session.flush()
        for index in range(14):
            self.session.add(models.Purchase(supplier_id=supplier.id, purchased_at=datetime(2026, 9 if index < 12 else 8, 10), total_cost=20))
        self.session.add(models.Purchase(supplier_id=supplier.id, purchased_at=None, received_at=datetime(2026, 9, 20), total_cost=20))
        self.session.commit()
        rows = inventory.list_purchases(history='recent', month='2026-09', search='especial', db_session=self.session)
        self.assertEqual(len(rows), 13)
        self.assertEqual(inventory.list_purchases(history='all', month='2026-10', search=None, db_session=self.session), [])
        self.assertEqual(inventory.list_purchases(history='all', month='2026-09', search='inexistente', db_session=self.session), [])
