from datetime import date
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import db, expenses, models


class ExpenseTypesTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        models.Base.metadata.create_all(self.engine)
        app = FastAPI()
        app.include_router(expenses.router)

        def get_db():
            with Session(self.engine) as session:
                yield session

        app.dependency_overrides[db.get_db] = get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_created_type_persists_and_can_register_payment(self):
        response = self.client.post("/expenses/fixed", json={
            "name": "  Mantenimiento de equipos  ",
        })
        self.assertEqual(response.status_code, 201, response.text)
        expense = response.json()
        self.assertEqual(expense["name"], "Mantenimiento de equipos")
        self.assertEqual(expense["category"], "Otros")
        self.assertTrue(expense["is_active"])
        listed = self.client.get("/expenses/fixed").json()
        self.assertIn(expense, listed)
        response = self.client.post("/expenses/payments", json={
            "fixed_expense_id": expense["id"],
            "payment_date": date.today().isoformat(),
            "amount": 45000,
            "concept": "Reparación de nevera",
        })
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["name"], expense["name"])
        self.assertEqual(Decimal(response.json()["amount"]), Decimal(45000))

    def test_duplicate_names_are_rejected(self):
        for name in ("Mantenimiento", "  mantenimiento  "):
            response = self.client.post("/expenses/fixed", json={
                "name": name,
            })
            self.assertEqual(response.status_code, 201 if name == "Mantenimiento" else 409)
        with Session(self.engine) as session:
            count = session.query(models.FixedExpense).filter(
                models.FixedExpense.name == "Mantenimiento"
            ).count()
            self.assertEqual(count, 1)

    def test_default_name_cannot_be_created_before_first_listing(self):
        response = self.client.post("/expenses/fixed", json={
            "name": "Servicio de luz",
        })
        self.assertEqual(response.status_code, 409)

    def test_empty_and_oversized_names_are_rejected(self):
        for name in ("   ", "x" * 121):
            with self.subTest(name=name):
                response = self.client.post("/expenses/fixed", json={"name": name})
                self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.post("/expenses/fixed", json={}).status_code, 422)

    def test_edit_payment_updates_fields_and_date_range(self):
        expense = self.client.post("/expenses/fixed", json={"name": "Mantenimiento"}).json()
        payment = self.client.post("/expenses/payments", json={
            "fixed_expense_id": expense["id"],
            "payment_date": "2020-01-15",
            "amount": 45000,
            "concept": "Reparación inicial",
        }).json()
        other = self.client.post("/expenses/fixed", json={"name": "Reparaciones"}).json()
        response = self.client.put(f"/expenses/payments/{payment['id']}", json={
            "fixed_expense_id": other["id"],
            "payment_date": "2020-02-15",
            "amount": 52500.5,
            "concept": "  Reparación de nevera  ",
            "expense_type": "operacional_variable",
        })
        self.assertEqual(response.status_code, 200, response.text)
        updated = response.json()
        self.assertEqual(updated["id"], payment["id"])
        self.assertEqual(updated["name"], "Reparaciones")
        self.assertEqual(updated["concept"], "Reparación de nevera")
        self.assertEqual(Decimal(updated["amount"]), Decimal("52500.5"))
        self.assertEqual(updated["expense_type"], "operacional_variable")
        january = self.client.get("/expenses/payments?from_date=2020-01-01&to_date=2020-01-31").json()
        february = self.client.get("/expenses/payments?from_date=2020-02-01&to_date=2020-02-29").json()
        self.assertEqual(january, [])
        self.assertEqual(february, [updated])

    def test_invalid_edit_leaves_payment_unchanged(self):
        expense = self.client.post("/expenses/fixed", json={"name": "Mantenimiento"}).json()
        payment = self.client.post("/expenses/payments", json={
            "fixed_expense_id": expense["id"],
            "payment_date": "2020-01-15",
            "amount": 45000,
        }).json()
        for amount in (0, -1):
            response = self.client.put(f"/expenses/payments/{payment['id']}", json={
                "fixed_expense_id": expense["id"],
                "payment_date": "2020-01-15",
                "amount": amount,
            })
            self.assertEqual(response.status_code, 422)
        listed = self.client.get("/expenses/payments?from_date=2020-01-01&to_date=2020-01-31").json()
        self.assertEqual(listed, [payment])

    def test_created_type_survives_database_reconnect(self):
        def client_for_engine(engine):
            app = FastAPI()
            app.include_router(expenses.router)

            def get_db():
                with Session(engine) as session:
                    yield session

            app.dependency_overrides[db.get_db] = get_db
            return TestClient(app)

        with TemporaryDirectory() as directory:
            url = f"sqlite:///{Path(directory) / 'expenses.db'}"
            engine = create_engine(url, connect_args={"check_same_thread": False})
            models.Base.metadata.create_all(engine)
            try:
                with client_for_engine(engine) as client:
                    response = client.post("/expenses/fixed", json={"name": "Mantenimiento persistente"})
                    self.assertEqual(response.status_code, 201, response.text)
                    created = response.json()
            finally:
                engine.dispose()

            reopened = create_engine(url, connect_args={"check_same_thread": False})
            try:
                with client_for_engine(reopened) as client:
                    for _ in range(2):
                        response = client.get("/expenses/fixed")
                        self.assertEqual(response.status_code, 200)
                        self.assertIn(created, response.json())
                    response = client.post("/expenses/payments", json={
                        "fixed_expense_id": created["id"],
                        "payment_date": date.today().isoformat(),
                        "amount": 50000,
                    })
                    self.assertEqual(response.status_code, 201, response.text)
                    self.assertEqual(response.json()["name"], created["name"])
            finally:
                reopened.dispose()


if __name__ == "__main__":
    unittest.main()
