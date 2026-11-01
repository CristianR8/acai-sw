from datetime import datetime, timezone
from decimal import Decimal
import unittest
from unittest.mock import patch
from zoneinfo import ZoneInfo

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import db, models, sales


class SalesPeriodsTests(unittest.TestCase):
    paths = ('/sales', '/sales/summary/products', '/sales/summary/adjustments/monthly')

    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        models.Base.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        table = models.PosTable(name='Mesa')
        self.session.add(table)
        self.session.commit()
        self.table_id = table.id

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

    def add_sale(self, when, *, amount=100, status='active', courtesy=False, discount=False):
        order = models.PosOrder(table_id=self.table_id)
        self.session.add(order)
        self.session.flush()
        self.session.add(models.PosOrderItem(order_id=order.id, name='Producto sin ID', category='Otros', zone='bar', courtesy=courtesy, discount_amount=10 if discount else 0))
        sale = models.Sale(order_id=order.id, created_at=when, total=amount, status=status, payment_method='cash')
        self.session.add(sale)
        self.session.flush()
        self.session.add(models.SaleItem(sale_id=sale.id, menu_item_id=None, name='Producto sin ID', category='Otros', quantity=1, unit_price=amount, tax_rate=0, line_subtotal=amount, line_tax=0, line_total=amount))
        self.session.commit()
        return sale.id

    def read(self, path, start, end):
        response = self.client.get(path, params={'from_date': start, 'to_date': end})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_full_month_returns_all_sales_including_more_than_200(self):
        for _ in range(207):
            self.add_sale(datetime(2026, 10, 15, 12), discount=True)
        self.add_sale(datetime(2026, 9, 30, 23, 59, 59))
        self.add_sale(datetime(2026, 11, 1))
        history = self.read(self.paths[0], '2026-10-01', '2026-10-31')
        products = self.read(self.paths[1], '2026-10-01', '2026-10-31')
        adjustments = self.read(self.paths[2], '2026-10-01', '2026-10-31')
        self.assertEqual(len(history), 207)
        self.assertEqual(Decimal(products[0]['quantity']), 207)
        self.assertEqual(Decimal(products[0]['total']), sum(Decimal(sale['total']) for sale in history))
        self.assertEqual(adjustments[0]['discount_count'], 207)

    def test_single_day_includes_both_day_boundaries_and_excludes_void_from_totals(self):
        first = self.add_sale(datetime(2026, 10, 31), courtesy=True)
        last = self.add_sale(datetime(2026, 10, 31, 23, 59, 59, 999999), discount=True)
        void = self.add_sale(datetime(2026, 10, 31, 12), status='void', amount=999, courtesy=True)
        self.add_sale(datetime(2026, 10, 30, 23, 59, 59), amount=999)
        self.add_sale(datetime(2026, 11, 1), amount=999)
        history = self.read(self.paths[0], '2026-10-31', '2026-10-31')
        products = self.read(self.paths[1], '2026-10-31', '2026-10-31')
        adjustments = self.read(self.paths[2], '2026-10-31', '2026-10-31')
        self.assertEqual({sale['id'] for sale in history}, {first, last, void})
        self.assertEqual(Decimal(products[0]['total']), 200)
        self.assertEqual((adjustments[0]['courtesy_count'], adjustments[0]['discount_count']), (1, 1))

    def test_range_crossing_years_and_empty_period(self):
        self.add_sale(datetime(2026, 12, 31, 23, 59), courtesy=True)
        self.add_sale(datetime(2027, 1, 1), discount=True)
        self.assertEqual(len(self.read(self.paths[0], '2026-12-31', '2027-01-01')), 2)
        rows = self.read(self.paths[2], '2026-12-31', '2027-01-01')
        self.assertEqual([(row['year'], row['month']) for row in rows], [(2027, 1), (2026, 12)])
        for path in self.paths:
            self.assertEqual(self.read(path, '2025-10-01', '2025-10-31'), [])

    def test_invalid_incomplete_and_reversed_ranges_are_rejected(self):
        for path in self.paths:
            for params in [
                {'from_date': '2026-10-01'}, {'to_date': '2026-10-31'},
                {'from_date': '2026-11-01', 'to_date': '2026-10-01'},
            ]:
                self.assertEqual(self.client.get(path, params=params).status_code, 400)
            self.assertEqual(self.client.get(path, params={'from_date': 'bad', 'to_date': '2026-10-31'}).status_code, 422)

    def test_postgres_month_expression_groups_utc_sales_in_bogota(self):
        # Emulate PostgreSQL timezone() in SQLite to exercise the PostgreSQL
        # expression with UTC timestamps on opposite sides of Bogota midnight.
        raw = self.engine.raw_connection()
        raw.create_function('timezone', 2, lambda zone, value: datetime.fromisoformat(value).replace(tzinfo=timezone.utc).astimezone(ZoneInfo(zone)).replace(tzinfo=None).isoformat(' '))
        raw.close()
        self.add_sale(datetime(2026, 11, 1, 2, tzinfo=timezone.utc), courtesy=True)
        self.add_sale(datetime(2026, 11, 1, 6, tzinfo=timezone.utc), discount=True)
        with patch.object(self.engine.dialect, 'name', 'postgresql'):
            rows = self.read(self.paths[2], '2026-10-01', '2026-11-30')
        self.assertEqual([(row['year'], row['month'], row['courtesy_count'], row['discount_count']) for row in rows], [(2026, 11, 0, 1), (2026, 10, 1, 0)])
