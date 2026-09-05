"""Register the topping sheet as one purchase and wire topping recipes.

Run from acaipark-back with: python -m scripts.register_topping_purchase
The import is idempotent: products already marked with SKU TOP-* are updated, not duplicated.
"""
from datetime import datetime
from decimal import Decimal

from app import db, models


# name, category, supplier/brand, total cost, stock in base unit, unit,
# presentation, grams per ice cream, topping cost
ROWS = [
    ("Arándanos", "Frutas", "Pricesmart", 27500, 500, "GR", "500 GR", 30, 1650),
    ("Avena", "Cereales", "Pricesmart", 13900, 2000, "GR", "2.000 GR", 18, 125),
    ("Banano", "Frutas", "Jumbo", 2390, 500, "GR", "500 GR", 30, 143),
    ("Cerezas", "Frutas", "Pascual", 96000, 4000, "GR", "PQT x 4 KG", None, None),
    ("Chips de chocolate", "Dulces", "Atlantic FC", 441717, 12500, "GR", "PQT x 12,5 KG", 31, 1094),
    ("Chokis", "Repostería y snack", "Chokis", 20300, 304, "GR", "16 PQT x 19 GR", 9, 635),
    ("Coco deshidratado", "Fruto seco", "Coburcos", 55423, 1000, "GR", "PQT x 1 KG", 9, 499),
    ("Duraznos dulces", "Repostería y snack", "Cuisine", 10800, 820, "GR", "820 GR", None, None),
    ("Fresas", "Frutas", "Jumbo", 8000, 500, "GR", "500 GR", 30, 480),
    ("Granola de chocolate", "Cereales", "Tosh", 29299, 500, "GR", "500 GR", 18, 1055),
    ("Granola natural", "Cereales", "Pricesmart", 32900, 2200, "GR", "2.200 GR", 24, 359),
    ("Kiwi", "Frutas", "Jumbo", 13000, 500, "GR", "500 GR", 30, 780),
    ("Láminas de almendra", "Fruto seco", "Pricesmart", 49900, 907, "GR", "907 GR", 20, 1100),
    ("Leche en polvo", "Modificadores", "Klim", 104900, 2400, "GR", "2,4 KG", 18, 787),
    ("Maní triturado", "Fruto seco", "Cordillera", 28502, 800, "GR", "800 GR", 25, 891),
    ("Marañón", "Fruto seco", "Pricesmart", 99900, 907, "GR", "907 GR", 30, 3304),
    ("Minichips", "Repostería y snack", "Minichips", 15750, 420, "GR", "12 PQT x 35 GR", 18, 656),
    ("Oreo triturada", "Repostería y snack", "Oreo", 86000, 4000, "GR", "PQT x 4 KG", None, None),
    ("Crema de almendra", "Salsa", "Tosh", 34900, 290, "GR", "290 GR", 30, 3610),
    ("Pistacho dubai crunchy", "Salsa", "Amapuri", 327593, 4000, "GR", "PQT x 4 KG", 30, 2457),
    ("Pistacho", "Salsa", "Amapuri", 268826, 4000, "GR", "PQT x 4 KG", 30, 2016),
    ("Chocolate avellana", "Salsa", "Amapuri", 211000, 4000, "GR", "PQT x 4 KG", 30, 1583),
    ("Chocolate trozos cookie", "Salsa", "Amapuri", 154200, 4000, "GR", "PQT x 4 KG", 30, 1157),
    ("Mantequilla de maní", "Salsa", "Members Selection", 28500, 1130, "GR", "1,13 KG", 30, 777),
    ("Leche condensada", "Salsa", "La Lechera", 28900, 1179, "GR", "3 PQT x 393 GR", 30, 735),
    ("Arequipe", "Salsa", "Alpina", 81196, 5000, "GR", "PQT x 5 KG", 30, 487),
    ("Marañón salsa", "Salsa", "SM", 184800, 1230, "GR", "1.230 GR", 30, 4507),
]


def norm(value: str) -> str:
    return "".join(c for c in value.casefold() if c.isalnum())


def main() -> None:
    session = db.SessionLocal()
    try:
        if session.query(models.StockMovement).filter(
            models.StockMovement.reason == "Compra toppings"
        ).first():
            print("La compra de toppings ya fue registrada; no se hicieron duplicados.")
            return
        suppliers = {}
        for supplier_name in {row[2] for row in ROWS}:
            supplier = session.query(models.Supplier).filter(models.Supplier.name.ilike(supplier_name)).first()
            if supplier is None:
                supplier = models.Supplier(name=supplier_name, is_active=True)
                session.add(supplier)
                session.flush()
            suppliers[supplier_name] = supplier

        purchase = models.Purchase(purchased_at=datetime.now(), received_at=datetime.now())
        session.add(purchase)
        session.flush()
        total = Decimal("0")

        menu_items = session.query(models.MenuItem).filter(models.MenuItem.is_active.is_(True)).all()
        for index, row in enumerate(ROWS, start=1):
            name, category, supplier_name, cost, quantity, unit, presentation, grams, topping_cost = row
            sku = f"TOP-{index:03d}"
            product = session.query(models.InventoryProduct).filter(models.InventoryProduct.sku == sku).first()
            if product is None:
                product = session.query(models.InventoryProduct).filter(models.InventoryProduct.name.ilike(name)).first()
            if product is None:
                product = models.InventoryProduct(name=name)
                session.add(product)
                session.flush()
            product.sku, product.kind, product.unit = sku, "ingredient", unit
            product.category, product.presentation = category, presentation
            product.grams_per_ice_cream, product.topping_cost = grams, topping_cost
            product.cost = Decimal(str(cost))
            product.supplier_id = suppliers[supplier_name].id
            product.is_active = product.is_purchase_registered = True

            qty, item_cost = Decimal(str(quantity)), Decimal(str(cost))
            unit_cost = item_cost / qty
            before = Decimal(product.on_hand or 0)
            product.average_cost = unit_cost
            product.last_cost, product.on_hand = unit_cost, qty
            session.add(models.PurchaseItem(purchase_id=purchase.id, product_id=product.id,
                supplier_id=product.supplier_id, quantity=qty, unit_cost=unit_cost, line_total=item_cost))
            session.add(models.StockMovement(product_id=product.id, movement_type="in", quantity=qty,
                unit_cost=unit_cost, reason="Compra toppings", reference_type="purchase", reference_id=purchase.id))
            if before:
                session.add(models.StockMovement(product_id=product.id, movement_type="adjust", quantity=-before,
                    unit_cost=unit_cost, reason="Reconciliación con presentación comprada",
                    reference_type="purchase", reference_id=purchase.id))
            total += item_cost

            if grams:
                match = next((m for m in menu_items if norm(m.name) == norm(name)), None)
                if match:
                    recipe = session.query(models.Recipe).filter(models.Recipe.menu_item_id == match.id).first()
                    if recipe is None:
                        recipe = models.Recipe(menu_item_id=match.id, yield_quantity=1, unit="UND")
                    recipe.items = [models.RecipeItem(product_id=product.id, quantity=grams, waste_pct=0)]
                    session.add(recipe)

        purchase.total_cost = total
        session.commit()
        print(f"Compra #{purchase.id}: {len(ROWS)} productos, total COP {total}")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
