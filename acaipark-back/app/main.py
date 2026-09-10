import os
import logging

from fastapi import FastAPI
from sqlalchemy.exc import OperationalError
from sqlalchemy import text
from . import inventory_months
from . import auth, db, expenses, factus, inventory, loyalty, menu, models, personnel, pos, reservations, sales

app = FastAPI()

logger = logging.getLogger("uvicorn.error")

def _auto_migrate_schema() -> None:
    if os.getenv("AUTO_MIGRATE_SCHEMA", "1") != "1":
        return
    try:
        with db.engine.begin() as conn:
            conn.execute(text("CREATE TABLE IF NOT EXISTS cash_drawer_closings (id SERIAL PRIMARY KEY, business_date DATE NOT NULL UNIQUE, denomination_counts JSON NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"))
            conn.execute(text("ALTER TABLE IF EXISTS purchase_items ADD COLUMN IF NOT EXISTS month_group_id INTEGER REFERENCES inventory_month_groups(id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_purchase_items_month_group_id ON purchase_items(month_group_id)"))
            conn.execute(text("ALTER TABLE IF EXISTS purchases ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(100)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_purchases_invoice_id ON purchases(invoice_id)"))
            conn.execute(
                text(
                    "INSERT INTO inventory_month_groups (period) "
                    "SELECT DISTINCT date_trunc('month', COALESCE(p.purchased_at, p.received_at, p.created_at))::date "
                    "FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id "
                    "WHERE COALESCE(p.purchased_at, p.received_at, p.created_at) IS NOT NULL "
                    "ON CONFLICT (period) DO NOTHING"
                )
            )
            conn.execute(
                text(
                    "UPDATE purchase_items pi SET month_group_id = g.id "
                    "FROM purchases p JOIN inventory_month_groups g "
                    "ON g.period = date_trunc('month', COALESCE(p.purchased_at, p.received_at, p.created_at))::date "
                    "WHERE pi.purchase_id = p.id AND pi.month_group_id IS DISTINCT FROM g.id"
                )
            )
            conn.execute(text("ALTER TABLE IF EXISTS inventory_products ADD COLUMN IF NOT EXISTS cost NUMERIC(14, 4)"))
            from .inventory_costs import backfill_presentation_costs
            backfill_presentation_costs(conn)
            conn.execute(text("ALTER TABLE IF EXISTS fixed_expense_payments ADD COLUMN IF NOT EXISTS concept TEXT"))
            conn.execute(text("ALTER TABLE IF EXISTS inventory_products ALTER COLUMN unit DROP NOT NULL"))
            conn.execute(text("ALTER TABLE IF EXISTS inventory_products DROP COLUMN IF EXISTS reorder_point"))
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS inventory_products "
                    "ADD COLUMN IF NOT EXISTS is_purchase_registered BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
            conn.execute(text("ALTER TABLE IF EXISTS inventory_products ADD COLUMN IF NOT EXISTS category VARCHAR"))
            conn.execute(text("ALTER TABLE IF EXISTS inventory_products ADD COLUMN IF NOT EXISTS presentation VARCHAR"))
            conn.execute(text("ALTER TABLE IF EXISTS inventory_products ADD COLUMN IF NOT EXISTS grams_per_ice_cream NUMERIC(14, 4)"))
            conn.execute(text("ALTER TABLE IF EXISTS inventory_products ADD COLUMN IF NOT EXISTS topping_cost NUMERIC(14, 4)"))
            conn.execute(text("ALTER TABLE IF EXISTS inventory_products ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id)"))
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS menu_items "
                    "ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"
                )
            )
            conn.execute(text("ALTER TABLE IF EXISTS suppliers DROP COLUMN IF EXISTS email"))
            conn.execute(text("ALTER TABLE IF EXISTS suppliers DROP COLUMN IF EXISTS notes"))
            conn.execute(text("ALTER TABLE IF EXISTS purchases DROP COLUMN IF EXISTS invoice_number"))
            conn.execute(
                text("ALTER TABLE IF EXISTS purchase_items ADD COLUMN IF NOT EXISTS supplier_id INTEGER")
            )
            conn.execute(
                text("ALTER TABLE IF EXISTS sales ADD COLUMN IF NOT EXISTS customer_id INTEGER")
            )
            conn.execute(
                text("ALTER TABLE IF EXISTS sales ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30)")
            )
            conn.execute(
                text("ALTER TABLE IF EXISTS sales ADD COLUMN IF NOT EXISTS cash_received NUMERIC(14, 2)")
            )
            conn.execute(
                text("ALTER TABLE IF EXISTS sales ADD COLUMN IF NOT EXISTS cash_denomination_counts JSON NOT NULL DEFAULT '{}'")
            )
            conn.execute(text("ALTER TABLE IF EXISTS pos_orders DROP COLUMN IF EXISTS waiter_id"))
            conn.execute(text("ALTER TABLE IF EXISTS sales DROP COLUMN IF EXISTS waiter_id"))
            conn.execute(text("DROP TABLE IF EXISTS waiters"))
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS suppliers "
                    "ADD COLUMN IF NOT EXISTS gender VARCHAR NOT NULL DEFAULT 'male'"
                )
            )
            conn.execute(text("ALTER TABLE IF EXISTS suppliers ADD COLUMN IF NOT EXISTS nit VARCHAR(50)"))
            conn.execute(text("ALTER TABLE IF EXISTS suppliers ADD COLUMN IF NOT EXISTS contact_name VARCHAR(200)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_suppliers_nit ON suppliers(nit)"))
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS customers "
                    "ADD COLUMN IF NOT EXISTS gender VARCHAR NOT NULL DEFAULT 'male'"
                )
            )
            conn.execute(text("ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS birth_date DATE"))
            conn.execute(text("ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS loyalty_code VARCHAR"))
            conn.execute(text("ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS loyalty_stamps INTEGER NOT NULL DEFAULT 0"))
            conn.execute(text("ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS loyalty_rewards INTEGER NOT NULL DEFAULT 0"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_customers_loyalty_code ON customers (loyalty_code)"))
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS recipes "
                    "ADD COLUMN IF NOT EXISTS unit VARCHAR"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS users "
                    "ADD COLUMN IF NOT EXISTS full_name VARCHAR"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS users "
                    "ADD COLUMN IF NOT EXISTS profile_photo_url TEXT"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS users "
                    "ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'administrator'"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS pos_orders "
                    "ADD COLUMN IF NOT EXISTS history_cleared BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
            conn.execute(text("ALTER TABLE IF EXISTS pos_orders ADD COLUMN IF NOT EXISTS inventory_consumed BOOLEAN NOT NULL DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE IF EXISTS pos_orders ADD COLUMN IF NOT EXISTS display_number INTEGER"))
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS pos_order_items "
                    "ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS pos_order_items "
                    "ADD COLUMN IF NOT EXISTS courtesy BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_pos_orders_display_number ON pos_orders (display_number) WHERE display_number IS NOT NULL"))
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS pos_orders "
                    "ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_pos_orders_created_by_user_id "
                    "ON pos_orders (created_by_user_id)"
                )
            )
    except Exception as exc:
        logger.warning("Auto-migration skipped/failed: %s", exc)


def _ensure_guided_addons() -> None:
    """Create the menu items required by the guided POS flow.

    Guided orders must always reference an actual menu item so they can be
    persisted as a POS order item. Older databases predate these add-ons.
    """
    db_session = db.SessionLocal()
    try:
        addons = (
            ("Topping", "2000.00"),
            ("Salsa", "3000.00"),
            ("Café Americano", "5000.00"),
        )
        for name, price in addons:
            item = (
                db_session.query(models.MenuItem)
                .filter(models.MenuItem.name.ilike(name))
                .first()
            )
            if item is None and name == "Café Americano":
                item = (
                    db_session.query(models.MenuItem)
                    .filter(models.MenuItem.name.ilike("Café"))
                    .first()
                )
            if item is None:
                db_session.add(
                    models.MenuItem(
                        name=name,
                        category="Adicionales",
                        price=price,
                        description="Adicional listo para servir.",
                        is_active=True,
                    )
                )
            else:
                item.is_active = True
                if name in {"Topping", "Café Americano"}:
                    item.price = price
                if name == "Café Americano":
                    item.name = name
        db_session.commit()
    except Exception as exc:
        db_session.rollback()
        logger.warning("Guided add-ons setup skipped/failed: %s", exc)
    finally:
        db_session.close()


@app.on_event("startup")
def _init_db() -> None:
    if os.getenv("AUTO_CREATE_TABLES", "1") != "1":
        return
    try:
        models.Base.metadata.create_all(bind=db.engine)
        _auto_migrate_schema()
        _ensure_guided_addons()
    except OperationalError as exc:
        database_url = os.getenv("DATABASE_URL", "DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/acai_dev")
        logger.error("Database connection failed. Check DATABASE_URL and Postgres auth.")
        logger.error("DATABASE_URL=%s", database_url)
        if database_url.startswith("postgresql:///") or database_url.startswith("postgres:///"):
            logger.error(
                "Hint: this URL uses a local Unix socket; ensure Postgres is running locally (socket like /var/run/postgresql/.s.PGSQL.5432)."
            )
        logger.error("%s", exc)
        raise

app.include_router(auth.router)
app.include_router(menu.router)
app.include_router(inventory.router)
app.include_router(inventory_months.router)
app.include_router(expenses.router)
app.include_router(personnel.router)
app.include_router(loyalty.router)
app.include_router(pos.router)
app.include_router(sales.router)
app.include_router(reservations.router)
app.include_router(factus.router)
