from datetime import date, datetime
from decimal import Decimal
import unittest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app import db, models, inventory_months


class InventoryMonthGroupsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        models.Base.metadata.create_all(self.engine)
        with Session(self.engine) as session:
            supplier = models.Supplier(name='Supplier')
            product = models.InventoryProduct(name='Arándanos',kind='ingredient',unit='GR',on_hand=900,cost=27500,is_purchase_registered=True)
            material = models.InventoryProduct(name='Vasos',kind='material',unit='UND',on_hand=10,is_purchase_registered=True)
            session.add_all([supplier,product,material]);session.flush()
            first = models.Purchase(purchased_at=datetime(2026,8,3),supplier_id=supplier.id)
            second = models.Purchase(purchased_at=datetime(2026,9,3),supplier_id=supplier.id)
            session.add_all([first,second]);session.flush()
            lines = [models.PurchaseItem(purchase_id=first.id,product_id=product.id,quantity=500,unit_cost=55,line_total=27500),
                     models.PurchaseItem(purchase_id=first.id,product_id=product.id,quantity=100,unit_cost=55,line_total=5500),
                     models.PurchaseItem(purchase_id=second.id,product_id=product.id,quantity=300,unit_cost=55,line_total=16500),
                     models.PurchaseItem(purchase_id=first.id,product_id=material.id,quantity=10,unit_cost=100,line_total=1000)]
            session.add_all(lines);session.commit()
            self.ids = [line.id for line in lines]
            self.product_id = product.id
        self.session = Session(self.engine)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def create(self, month, ids, year=2026):
        return inventory_months.create_month_group(inventory_months.CreateMonthGroup(year=year,month=month,purchase_item_ids=ids),self.session)

    def groups(self):
        return inventory_months.list_month_groups(self.session)

    def test_separate_purchases_allow_same_product_in_two_months(self):
        august = self.create(8,[self.ids[0]])
        september = self.create(9,[self.ids[2]])
        self.assertEqual(august.purchase_item_ids,self.ids[:2])
        self.assertEqual(september.purchase_item_ids,[self.ids[2]])
        self.assertEqual([g.name for g in self.groups()],['Septiembre 2026','Agosto 2026'])
        with Session(self.engine) as session:
            product = session.get(models.InventoryProduct,self.product_id)
            self.assertEqual((product.on_hand,product.cost),(Decimal(900),Decimal(27500)))
            self.assertEqual(session.query(models.PurchaseItem).count(),4)

    def test_unique_month_and_database_constraint(self):
        self.create(8,[self.ids[0]])
        with self.assertRaises(HTTPException) as error: self.create(8,[self.ids[2]])
        self.assertEqual(error.exception.status_code,409)
        self.assertEqual(self.create(8,[self.ids[2]],2027).name,'Agosto 2027')
        with Session(self.engine) as session:
            session.add(models.InventoryMonthGroup(period=date(2026,8,1)))
            with self.assertRaises(IntegrityError): session.commit()
            session.rollback()

    def test_same_product_lines_in_one_purchase_move_together(self):
        august = self.create(8,[self.ids[0]])
        september = self.create(9,[self.ids[2]])
        inventory_months.assign_month_products(september.id,inventory_months.AssignProducts(purchase_item_ids=[self.ids[1]]),self.session)
        groups = {g.id:g for g in self.groups()}
        self.assertEqual(groups[august.id].purchase_item_ids,[])
        self.assertEqual(groups[september.id].purchase_item_ids,self.ids[:3])

    def test_assignment_additive_and_repeatable(self):
        group = self.create(8,[self.ids[0]])
        for _ in range(2):
            response = inventory_months.assign_month_products(group.id,inventory_months.AssignProducts(purchase_item_ids=[self.ids[3],self.ids[3]]),self.session)
            self.assertEqual(response.purchase_item_ids,self.ids[:2]+[self.ids[3]])

    def test_invalid_selection_atomic_and_missing_group(self):
        with self.assertRaises(HTTPException) as error: self.create(8,[self.ids[0],999999])
        self.assertEqual(error.exception.status_code,400)
        self.assertEqual(self.groups(),[])
        self.assertIsNone(self.session.get(models.PurchaseItem,self.ids[0]).month_group_id)
        with self.assertRaises(HTTPException) as error:
            inventory_months.assign_month_products(999999,inventory_months.AssignProducts(purchase_item_ids=[self.ids[0]]),self.session)
        self.assertEqual(error.exception.status_code,404)

    def test_validation(self):
        with self.assertRaises(ValidationError): self.create(13,[self.ids[0]])
        with self.assertRaises(ValidationError): self.create(8,[])

    def test_listing_original_purchase_data_and_kind(self):
        from app import schemas
        rows = inventory_months.list_purchase_registrations(schemas.InventoryProductKind.ingredient,self.session)
        self.assertEqual(len(rows),3)
        self.assertEqual({row.product_id for row in rows},{self.product_id})
        self.assertEqual(sum(row.quantity for row in rows),900)
        self.assertEqual({row.supplier_name for row in rows},{'Supplier'})
        self.assertEqual(len({row.purchase_id for row in rows}),2)
        self.assertEqual(len(inventory_months.list_purchase_registrations(schemas.InventoryProductKind.material,self.session)),1)

if __name__ == '__main__': unittest.main()
