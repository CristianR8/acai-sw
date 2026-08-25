import os
import logging

from fastapi import FastAPI
from sqlalchemy.exc import OperationalError
from sqlalchemy import text
from . import auth, db, expenses, factus, inventory, loyalty, menu, models, personnel, pos, reservations, sales

app = FastAPI()

logger = logging.getLogger("uvicorn.error")

def _auto_migrate_schema() -> None:
    if os.getenv("AUTO_MIGRATE_SCHEMA", "1") != "1":
        return
    try:
        with db.engine.begin() as conn:
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
            conn.execute(text("ALTER TABLE IF EXISTS pos_orders DROP COLUMN IF EXISTS waiter_id"))
            conn.execute(text("ALTER TABLE IF EXISTS sales DROP COLUMN IF EXISTS waiter_id"))
            conn.execute(text("DROP TABLE IF EXISTS waiters"))
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS suppliers "
                    "ADD COLUMN IF NOT EXISTS gender VARCHAR NOT NULL DEFAULT 'male'"
                )
            )
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
    except Exception as exc:
        logger.warning("Auto-migration skipped/failed: %s", exc)


@app.on_event("startup")
def _init_db() -> None:
    if os.getenv("AUTO_CREATE_TABLES", "1") != "1":
        return
    try:
        models.Base.metadata.create_all(bind=db.engine)
        _auto_migrate_schema()
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
app.include_router(expenses.router)
app.include_router(personnel.router)
app.include_router(loyalty.router)
app.include_router(pos.router)
app.include_router(sales.router)
app.include_router(reservations.router)
app.include_router(factus.router)
