from datetime import datetime
from decimal import Decimal
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import db, models, sales


class SalesProductSummaryTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            'sqlite://',
            connect_args={'check_same_thread': False},
            poolclass=StaticPool,
        )
        models.Base.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        table = models.PosTable(name='Mesa de prueba')
        product = models.MenuItem(name='Producto registrado', category='Otros', price=10000)
        self.session.add_all([table, product])
        self.session.commit()
        self.table_id = table.id
        self.product_id = product.id

        def get_db():
            with Session(self.engine) as session:
                yield session

        app = FastAPI()
        app.include_router(sales.router)
        app.dependency_overrides[db.get_db] = get_db
        self.client = TestClient(app, raise_server_exceptions=False)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.session.close()
        self.engine.dispose()

    def add_sale(self, name, menu_item_id=None, quantity=1, status='active', day=15, note=None):
        order = models.PosOrder(table_id=self.table_id)
        self.session.add(order)
        self.session.flush()
        total = Decimal(10000 * quantity)
        sale = models.Sale(order_id=order.id, created_at=datetime(2026, 10, day, 12), total=total, status=status)
        self.session.add(sale)
        self.session.flush()
        self.session.add(models.SaleItem(
            sale_id=sale.id, menu_item_id=menu_item_id, name=name,
            category='Otros', quantity=quantity, unit_price=10000,
            tax_rate=0, line_subtotal=total, line_tax=0, line_total=total,
        ))
        if note is not None:
            self.session.add(models.PosOrderItem(
                order_id=order.id, menu_item_id=menu_item_id, name=name,
                category='Otros', zone='bar', quantity=quantity,
                unit_price=10000, note=note,
            ))
        self.session.commit()

    def summary(self):
        response = self.client.get('/sales/summary/products', params={
            'from_date': '2026-10-01', 'to_date': '2026-10-31',
        })
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_products_without_menu_id_keep_names_quantities_and_totals(self):
        self.add_sale('Producto personalizado', quantity=2)
        self.add_sale('Producto personalizado', quantity=1)
        self.add_sale('Otro producto', quantity=1)
        rows = {row['name']: row for row in self.summary()}
        self.assertEqual(len(rows), 2)
        self.assertIsNone(rows['Producto personalizado']['menu_item_id'])
        self.assertEqual(Decimal(rows['Producto personalizado']['quantity']), 3)
        self.assertEqual(Decimal(rows['Producto personalizado']['total']), 30000)
        self.assertEqual(Decimal(rows['Otro producto']['total']), 10000)

    def test_registered_and_custom_products_coexist_and_void_sales_are_excluded(self):
        self.add_sale('Mismo nombre', self.product_id)
        self.add_sale('Mismo nombre', quantity=2)
        self.add_sale('Venta anulada', quantity=10, status='void')
        rows = self.summary()
        self.assertEqual(len(rows), 2)
        self.assertEqual({row['menu_item_id'] for row in rows}, {None, self.product_id})
        self.assertEqual(sum(Decimal(row['total']) for row in rows), 30000)

    def test_configured_products_without_id_keep_size_and_base(self):
        self.add_sale('Açaí personalizado', note='Configurado: Vaso 12 oz; Base: Yogurt')
        row, = self.summary()
        self.assertIsNone(row['menu_item_id'])
        self.assertEqual(row['name'], 'Açaí de vaso mediano')
        self.assertEqual(row['base'], 'Yogurt')
        self.assertEqual(Decimal(row['total']), 10000)

    def test_empty_period_returns_an_empty_list(self):
        self.assertEqual(self.summary(), [])
