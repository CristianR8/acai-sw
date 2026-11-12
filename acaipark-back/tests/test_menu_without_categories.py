from datetime import datetime
from decimal import Decimal
import os
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import db, menu, models, pos, sales


class MenuWithoutCategoriesTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
        )
        models.Base.metadata.create_all(self.engine)
        with Session(self.engine) as session:
            table = models.PosTable(name="Punto de venta")
            session.add(table)
            session.commit()
            self.table_id = table.id
        app = FastAPI()
        app.include_router(menu.router)
        app.include_router(pos.router)
        app.include_router(sales.router)

        def get_db():
            with Session(self.engine) as session:
                yield session

        app.dependency_overrides[db.get_db] = get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_create_and_edit_product_without_category(self):
        response = self.client.post("/menu/items", json={"name": "Producto nuevo", "price": 10000})
        self.assertEqual(response.status_code, 201, response.text)
        product = response.json()
        self.assertNotIn("category", product)
        response = self.client.put(f"/menu/items/{product['id']}", json={"name": "Producto actualizado", "price": 12000})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["name"], "Producto actualizado")
        self.assertNotIn("category", response.json())

    def test_legacy_category_input_does_not_restore_classification(self):
        response = self.client.post("/menu/items", json={"name": "Bebida", "category": "Bebidas", "price": 5000})
        self.assertEqual(response.status_code, 201)
        with Session(self.engine) as session:
            self.assertEqual(session.get(models.MenuItem, response.json()["id"]).category, "")
        duplicate = self.client.post("/menu/items", json={"name": "Bebida", "category": "Sodas", "price": 6000})
        self.assertEqual(duplicate.status_code, 409)

    def test_existing_products_are_all_available_without_category(self):
        with Session(self.engine) as session:
            products = [models.MenuItem(name="Mismo nombre", category=category, price=5000)
                        for category in ("Bebidas", "Sodas")]
            session.add_all(products)
            session.commit()
            ids = {product.id for product in products}
        response = self.client.get("/menu/items")
        self.assertEqual(response.status_code, 200)
        self.assertEqual({product["id"] for product in response.json()}, ids)
        self.assertTrue(all("category" not in product for product in response.json()))

    def test_order_can_be_created_edited_and_paid_without_categories(self):
        with Session(self.engine) as session:
            product = models.MenuItem(name="Bebida existente", category="Bebidas", price=10000)
            session.add(product)
            session.commit()
            product_id = product.id
        body = {"table_id": self.table_id, "items": [{
            "menu_item_id": product_id, "quantity": 1, "unit_price": 10000, "tax_rate": 0,
        }]}
        with patch.object(pos, "_auto_print_comanda"):
            response = self.client.post("/pos/orders", json=body)
        self.assertEqual(response.status_code, 201, response.text)
        order = response.json()
        self.assertNotIn("category", order["items"][0])
        self.assertNotIn("zone", order["items"][0])
        body["items"][0]["quantity"] = 2
        response = self.client.put(f"/pos/orders/{order['id']}", json=body)
        self.assertEqual(response.status_code, 200, response.text)
        with Session(self.engine) as session:
            order_model = session.get(models.PosOrder, order["id"])
            self.assertEqual(order_model.items[0].category, "")
            self.assertEqual(order_model.items[0].zone, "general")
            sale = pos._create_sale_from_order(session, order_model, payment_method="cash")
            session.commit()
            self.assertEqual(sale.total, Decimal(20000))
            self.assertEqual(sale.items[0].category, "")

    def test_comanda_is_single_and_has_no_categories_or_zones(self):
        items = [models.PosOrderItem(name=name, quantity=1, zone=zone)
                 for name, zone in (("Bebida", "bar"), ("Comida", "kitchen"))]
        with patch.dict(os.environ, {"POS_AUTO_PRINT_COMANDA": "1", "POS_COMANDA_SPLIT_BY_ZONE": "1"}), \
             patch.object(pos, "_send_text_to_windows_printer") as printer:
            pos._auto_print_comanda(order_id=1, display_number=1, table_name="Punto de venta", created_at=datetime(2026, 11, 11), items=items)
        printer.assert_called_once()
        text = printer.call_args.kwargs["text"]
        self.assertIn("Bebida", text)
        self.assertIn("Comida", text)
        self.assertNotIn("ZONA", text)
        self.assertNotIn("COCINA", text)
        self.assertNotIn("BAR", text)
