"""Regressions for every accounting change in the November 2026 comments."""
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from pypdf import PdfReader
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import db, expenses, inventory, models, sales, security


class NovemberAdjustmentsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        models.Base.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.day = date(2026, 10, 15)
        self.session.add_all([
            models.User(email="admin@example.test", hashed_password="unused", full_name="Admin", role="administrator", profile_photo_url="/test.png"),
            models.User(email="cashier@example.test", hashed_password="unused", full_name="Cajero", role="cashier", profile_photo_url="/test.png"),
            models.PosTable(name="Prueba"),
            models.InventoryProduct(name="Fresas", kind="ingredient", unit="gramos", on_hand=0),
        ])
        self.session.commit()
        def get_db():
            with Session(self.engine) as session:
                yield session
        app = FastAPI()
        for router in (inventory.router, sales.router, expenses.router):
            app.include_router(router)
        app.dependency_overrides[db.get_db] = get_db
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.session.close()
        self.engine.dispose()

    def purchase_payload(self, method="cash_drawer", amount=None):
        payload = {"purchased_at": "2026-10-15T12:00:00-05:00", "invoice_id": "FRESA-1", "items": [{"product_id": 1, "quantity": 1000, "unit_cost": 10}]}
        if method is not None:
            payload["payment_method"] = method
        if amount is not None:
            payload["initial_payment_amount"] = amount
        return payload

    def purchase(self, method="cash_drawer", amount=None):
        response = self.client.post("/inventory/purchases", json=self.purchase_payload(method, amount))
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def closing(self, day="2026-10-15"):
        response = self.client.get("/sales/cash-closing", params={"day": day})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def add_sale(self, method="cash", status="active", name="Cono", quantity=5, day=15):
        order = models.PosOrder(table_id=1)
        self.session.add(order)
        self.session.flush()
        sale = models.Sale(order_id=order.id, payment_method=method, total=50000, status=status,
                           created_at=datetime(2026, 10, day, 12), cash_received=50000 if method == "cash" else None,
                           cash_denomination_counts={"50000": 1} if method == "cash" else {})
        sale.items.append(models.SaleItem(name=name, quantity=quantity, unit_price=10000, tax_rate=0, line_subtotal=50000, line_tax=0, line_total=50000))
        self.session.add(sale)
        self.session.commit()
        return sale.id

    def headers(self, email="admin@example.test"):
        return {"authorization": "Bearer " + security.create_access_token({"sub": email})}

    def test_four_methods_and_legacy_only_drawer_payment_affects_cash(self):
        for method in ("cash", "credit", "transfer", "cash_drawer", None):
            purchase = self.purchase(method)
            expected = 0 if method in ("credit", None) else 10000
            self.assertEqual(Decimal(purchase["paid_amount"]), expected)
        closing = self.closing()
        self.assertEqual(Decimal(closing["purchases_total"]), 10000)
        self.assertEqual(Decimal(closing["expected_cash"]), -10000)
        self.assertEqual(len(closing["outflows"]), 1)
        self.assertIn("Fresas", closing["outflows"][0]["concept"])

    def test_partial_payments_use_payment_date_and_do_not_double_count_cost(self):
        purchase = self.purchase(amount=3000)
        self.assertEqual(purchase["payment_status"], "partial")
        response = self.client.post(f'/inventory/purchases/{purchase["id"]}/payments', json={
            "payment_date": "2026-10-16", "payment_method": "cash_drawer", "amount": 2000,
        })
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(Decimal(response.json()["balance"]), 5000)
        self.assertEqual(Decimal(self.closing()["purchases_total"]), 3000)
        self.assertEqual(Decimal(self.closing("2026-10-16")["purchases_total"]), 2000)
        response = self.client.post(f'/inventory/purchases/{purchase["id"]}/payments', json={
            "payment_date": "2026-10-16", "payment_method": "transfer", "amount": 5000,
        })
        self.assertEqual(response.json()["payment_status"], "paid")
        self.assertEqual(Decimal(self.closing("2026-10-16")["purchases_total"]), 2000)
        statement = self.client.get("/sales/pl-statement?month=2026-10").json()
        self.assertEqual(Decimal(next(row["amount"] for row in statement["rows"] if row["excel_row"] == 8)), 10000)

    def test_invalid_installments_do_not_modify_inventory_or_payments(self):
        purchase = self.purchase("credit")
        for changes in ({"amount": 10001}, {"amount": 0}, {"amount": -1}, {"amount": "NaN"}, {"payment_method": "credit"}, {"payment_method": "other"}, {"payment_date": "2026-10-14"}, {"payment_date": "2099-01-01"}):
            payload = {"payment_date": "2026-10-16", "payment_method": "cash_drawer", "amount": 1000, **changes}
            response = self.client.post(f'/inventory/purchases/{purchase["id"]}/payments', json=payload)
            self.assertIn(response.status_code, (400, 422), response.text)
        self.session.expire_all()
        self.assertEqual(self.session.query(models.PurchasePayment).count(), 0)
        self.assertEqual(self.session.get(models.InventoryProduct, 1).on_hand, 1000)

    def test_purchase_edit_and_void_recompute_drawer_without_expense_duplication(self):
        purchase = self.purchase()
        response = self.client.put(f'/inventory/purchases/{purchase["id"]}', json=self.purchase_payload("transfer"))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(Decimal(self.closing()["purchases_total"]), 0)
        response = self.client.put(f'/inventory/purchases/{purchase["id"]}', json=self.purchase_payload("cash_drawer"))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(Decimal(self.closing()["purchases_total"]), 10000)
        response = self.client.post(f'/inventory/purchases/{purchase["id"]}/void')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(Decimal(self.closing()["purchases_total"]), 0)
        self.session.expire_all()
        self.assertEqual(self.session.get(models.InventoryProduct, 1).on_hand, 0)
        self.assertEqual(self.session.query(models.FixedExpensePayment).count(), 0)

    def test_initial_payment_validation_and_preserving_installments(self):
        response = self.client.post("/inventory/purchases", json=self.purchase_payload("cash_drawer", 11000))
        self.assertEqual(response.status_code, 400)
        self.session.expire_all()
        self.assertEqual(self.session.query(models.Purchase).count(), 0)
        self.assertEqual(self.session.get(models.InventoryProduct, 1).on_hand, 0)
        purchase = self.purchase("credit")
        self.client.post(f'/inventory/purchases/{purchase["id"]}/payments', json={"payment_date": "2026-10-16", "payment_method": "cash_drawer", "amount": 7000})
        payload = self.purchase_payload("credit")
        payload["items"][0]["unit_cost"] = 5
        response = self.client.put(f'/inventory/purchases/{purchase["id"]}', json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Decimal(self.closing("2026-10-16")["purchases_total"]), 7000)

    def test_sale_correction_requires_admin_and_rejects_stale_or_void_changes(self):
        sale_id = self.add_sale()
        url = f"/sales/{sale_id}/payment-method"
        payload = {"payment_method": "transfer", "previous_payment_method": "cash"}
        self.assertEqual(self.client.patch(url, json=payload).status_code, 401)
        self.assertEqual(self.client.patch(url, json=payload, headers=self.headers("cashier@example.test")).status_code, 403)
        response = self.client.patch(url, json=payload, headers=self.headers())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(Decimal(response.json()["total"]), 50000)
        self.assertIsNone(response.json()["cash_received"])
        self.assertEqual(response.json()["cash_denomination_counts"], {})
        self.assertEqual(self.client.patch(url, json=payload, headers=self.headers()).status_code, 409)
        self.assertEqual(Decimal(self.closing()["transfer_total"]), 50000)
        self.assertEqual(Decimal(self.closing()["cash_total"]), 0)
        change = self.session.query(models.SalePaymentMethodChange).one()
        self.assertEqual((change.previous_method, change.payment_method, change.previous_denomination_counts), ("cash", "transfer", {"50000": 1}))
        void_id = self.add_sale(status="void")
        self.assertEqual(self.client.patch(f"/sales/{void_id}/payment-method", json=payload, headers=self.headers()).status_code, 409)
        self.assertEqual(self.client.patch(url, json={"payment_method": "invalid", "previous_payment_method": "transfer"}, headers=self.headers()).status_code, 422)

    def test_summary_excludes_void_and_other_dates_and_preserves_product_quantities(self):
        self.add_sale(name="Cono", quantity=5)
        self.add_sale(name="Tiny", quantity=5)
        self.add_sale(name="Classic", quantity=5)
        self.add_sale(name="Cono", quantity=20, status="void")
        self.add_sale(name="Cono", quantity=30, day=14)
        closing = self.closing()
        self.assertEqual(closing["sales_count"], 3)
        self.assertEqual({p["name"]: Decimal(p["quantity"]) for p in closing["products"]}, {"Cono": 5, "Tiny": 5, "Classic": 5})

    def test_excel_and_pdf_include_every_expense_with_concepts_and_products(self):
        expense = models.FixedExpense(name="Nómina", category="Nómina")
        self.session.add(expense)
        self.session.flush()
        for number in range(35):
            self.session.add(models.FixedExpensePayment(fixed_expense_id=expense.id, period=self.day.replace(day=1), due_date=self.day, status="manual", amount=number + 1, concept=f"Detalle individual {number:02d}"))
        self.session.add(models.FixedExpensePayment(fixed_expense_id=expense.id, period=self.day.replace(day=1), due_date=self.day, status="void", amount=999999, concept="Anulado excluido"))
        self.session.commit()
        self.purchase()
        self.add_sale(name="Tiny")
        closing = self.closing()
        self.assertEqual(len(closing["outflows"]), 36)
        self.assertEqual(Decimal(closing["expenses_total"]), sum(range(1, 36)))
        self.assertEqual(Decimal(closing["expected_cash"]), 50000 - 10000 - sum(range(1, 36)))
        response = self.client.get("/sales/summary/daily-payment-methods.xlsx?day=2026-10-15")
        self.assertEqual(response.status_code, 200)
        sheet = load_workbook(BytesIO(response.content)).active
        text = " ".join(str(cell.value) for row in sheet for cell in row if cell.value is not None)
        for number in range(35):
            self.assertIn(f"Detalle individual {number:02d}", text)
        self.assertNotIn("Anulado excluido", text)
        self.assertIn("Fresas", text)
        self.assertIn("Se registraron 1 ventas", text)
        self.assertIn("Tiny", text)
        self.assertEqual(sheet.page_setup.fitToHeight, 0)
        response = self.client.get("/sales/cash-closing.pdf?day=2026-10-15")
        self.assertEqual(response.status_code, 200, response.text[:100])
        pdf = PdfReader(BytesIO(response.content))
        self.assertGreater(len(pdf.pages), 1)
        text = " ".join(page.extract_text() for page in pdf.pages)
        for number in range(35):
            self.assertIn(f"Detalle individual {number:02d}", text)
        self.assertIn("Tiny", text)
        self.assertIn("Fresas", text)

    def test_corrected_sale_is_reflected_in_daily_totals_and_excel(self):
        sale_id = self.add_sale("card")
        response = self.client.patch(f"/sales/{sale_id}/payment-method", json={"payment_method": "cash", "previous_payment_method": "card"}, headers=self.headers())
        self.assertEqual(response.status_code, 200)
        summary = self.client.get("/sales/summary/daily-payment-methods?day=2026-10-15").json()
        self.assertEqual(Decimal(summary["cash_total"]), 50000)
        self.assertEqual(Decimal(summary["dataphone_total"]), 0)
        response = self.client.get("/sales/summary/daily-payment-methods.xlsx?day=2026-10-15")
        sheet = load_workbook(BytesIO(response.content)).active
        self.assertEqual(sheet["F6"].value, 50000)
        self.assertEqual(sheet["F7"].value, 0)

    def test_purchase_export_has_payment_and_balance_details(self):
        self.purchase(amount=3000)
        response = self.client.get("/inventory/exports/purchases.xlsx")
        self.assertEqual(response.status_code, 200)
        workbook = load_workbook(BytesIO(response.content))
        self.assertEqual(workbook["Pagos y saldos"]["F2"].value, 7000)
        self.assertEqual(workbook["Detalle de pagos"]["C2"].value, "Efectivo caja")

    def test_fractional_unit_cost_keeps_exact_paid_total(self):
        payload = self.purchase_payload("cash_drawer", 10000)
        payload["items"] = [{"product_id": 1, "quantity": 3000, "unit_cost": "3.3333", "line_total": 10000}]
        response = self.client.post("/inventory/purchases", json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        purchase = response.json()
        self.assertEqual(Decimal(purchase["total_cost"]), 10000)
        self.assertEqual(Decimal(purchase["paid_amount"]), 10000)
        self.assertEqual(Decimal(self.closing()["purchases_total"]), 10000)
        response = self.client.put(f'/inventory/purchases/{purchase["id"]}', json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(Decimal(response.json()["total_cost"]), 10000)


if __name__ == "__main__":
    unittest.main()
