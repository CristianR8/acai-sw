"""Presentation costs supplied for the admin inventory, in COP."""
import unicodedata
from decimal import Decimal
from sqlalchemy import text

PRESENTATION_COSTS = [('Arándanos', 'Frutas', 27500), ('Avena', 'Cereales', 13900), ('Banano', 'Frutas', 2390), ('Cerezas', 'Frutas', 96000), ('Chips de chocolate', 'Dulces', 441717), ('Chokis', 'Repostería y snack', 20300), ('Coco deshidratado', 'Fruto seco', 55423), ('Duraznos dulces', 'Repostería y snack', 10800), ('Fresas', 'Frutas', 8000), ('Granola de chocolate', 'Cereales', 29299), ('Granola natural', 'Cereales', 32900), ('Kiwi', 'Frutas', 13000), ('Láminas de almendra', 'Fruto seco', 49900), ('Leche en polvo', 'Modificadores', 104900), ('Maní triturado', 'Fruto seco', 28502), ('Marañón', 'Fruto seco', 99900), ('Minichips', 'Repostería y snack', 15750), ('Oreo triturada', 'Repostería y snack', 86000), ('Crema de almendra', 'Salsa', 34900), ('Pistacho dubai crunchy', 'Salsa', 327593), ('Pistacho', 'Salsa', 268826), ('Chocolate avellana', 'Salsa', 211000), ('Chocolate trozos cookie', 'Salsa', 154200), ('Mantequilla de maní', 'Salsa', 28500), ('Leche condensada', 'Salsa', 28900), ('Arequipe', 'Salsa', 81196), ('Marañón salsa', 'Salsa', 184800)]


def normalized(value):
    return "".join(c for c in unicodedata.normalize("NFKD", value or "").casefold() if c.isalnum())


def reference_cost(name, category=None):
    key = normalized(name)
    aliases = {"laminasdealmendras": "laminasdealmendra", "cremadealmendras": "cremadealmendra", "pistachodubaicrunch": "pistachodubaicrunchy", "chocolatetrozoscookies": "chocolatetrozoscookie"}
    key = aliases.get(key, key)
    if key == "maranon" and normalized(category) == "salsa":
        key = "maranonsalsa"
    for product_name, product_category, cost in PRESENTATION_COSTS:
        if normalized(product_name) == key:
            if normalized(category) and normalized(category) != normalized(product_category):
                continue
            return Decimal(cost)
    return None


def backfill_presentation_costs(conn):
    rows = conn.execute(text("SELECT id, name, category FROM inventory_products WHERE cost IS NULL")).mappings()
    for row in list(rows):
        cost = reference_cost(row["name"], row["category"])
        if cost is not None:
            conn.execute(text("UPDATE inventory_products SET cost = :cost WHERE id = :id AND cost IS NULL"), {"id": row["id"], "cost": int(cost)})
