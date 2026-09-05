"""Manual month grouping of inventory products; does not change stock or costs."""
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import tuple_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload, joinedload

from . import db, models, schemas

router = APIRouter(prefix="/inventory/month-groups", tags=["inventory"])
MONTHS = ("Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre")


class AssignProducts(BaseModel):
    purchase_item_ids: list[int] = Field(min_length=1, max_length=10000)


class CreateMonthGroup(AssignProducts):
    year: int = Field(ge=1900, le=2100)
    month: int = Field(ge=1, le=12)


class MonthGroupOut(BaseModel):
    id: int
    year: int
    month: int
    name: str
    purchase_item_ids: list[int]


def group_out(group: models.InventoryMonthGroup) -> MonthGroupOut:
    return MonthGroupOut(id=group.id, year=group.period.year, month=group.period.month,
                         name=f"{MONTHS[group.period.month - 1]} {group.period.year}",
                         purchase_item_ids=sorted(item.id for item in group.items))


def selected_products(session: Session, ids: list[int]):
    selected = (session.query(models.PurchaseItem)
                .join(models.InventoryProduct)
                .filter(models.PurchaseItem.id.in_(set(ids)), models.InventoryProduct.is_active.is_(True))
                .all())
    if len(selected) != len(set(ids)):
        raise HTTPException(status_code=400, detail="Algún registro de compra ya no está disponible. Actualiza la página.")
    # Repeated lines of the same product in ONE purchase are one registration:
    # they move together. Different purchases may belong to different months.
    keys = {(item.purchase_id, item.product_id) for item in selected}
    return (session.query(models.PurchaseItem)
            .filter(tuple_(models.PurchaseItem.purchase_id, models.PurchaseItem.product_id).in_(keys))
            .order_by(models.PurchaseItem.id).with_for_update().all())


class PurchaseRegistrationOut(BaseModel):
    id: int
    purchase_id: int
    product_id: int
    name: str
    category: str | None
    supplier_name: str | None
    purchased_at: datetime | None
    quantity: Decimal
    unit: str | None
    presentation: str | None
    cost: Decimal | None
    grams_per_ice_cream: Decimal | None
    topping_cost: Decimal | None
    unit_cost: Decimal
    line_total: Decimal
    month_group_id: int | None


@router.get("/purchase-items", response_model=list[PurchaseRegistrationOut])
def list_purchase_registrations(kind: schemas.InventoryProductKind | None = None, db_session: Session = Depends(db.get_db)):
    query = (db_session.query(models.PurchaseItem).join(models.InventoryProduct)
             .filter(models.InventoryProduct.is_active.is_(True))
             .options(joinedload(models.PurchaseItem.product), joinedload(models.PurchaseItem.supplier),
                      joinedload(models.PurchaseItem.purchase).joinedload(models.Purchase.supplier))
             .order_by(models.PurchaseItem.purchase_id.desc(), models.PurchaseItem.id))
    if kind is not None:
        query = query.filter(models.InventoryProduct.kind == kind.value)
    return [PurchaseRegistrationOut(
        id=item.id, purchase_id=item.purchase_id, product_id=item.product_id,
        name=item.product.name, category=item.product.category,
        supplier_name=(item.supplier.name if item.supplier else item.purchase.supplier.name if item.purchase.supplier else None),
        purchased_at=item.purchase.purchased_at or item.purchase.created_at,
        quantity=item.quantity, unit=item.product.unit, presentation=item.product.presentation,
        cost=item.product.cost, grams_per_ice_cream=item.product.grams_per_ice_cream, topping_cost=item.product.topping_cost,
        unit_cost=item.unit_cost, line_total=item.line_total,
        month_group_id=item.month_group_id,
    ) for item in query.all()]


@router.get("", response_model=list[MonthGroupOut])
def list_month_groups(db_session: Session = Depends(db.get_db)):
    groups = (db_session.query(models.InventoryMonthGroup)
              .options(selectinload(models.InventoryMonthGroup.items))
              .order_by(models.InventoryMonthGroup.period.desc()).all())
    return [group_out(group) for group in groups]


@router.post("", response_model=MonthGroupOut, status_code=201)
def create_month_group(payload: CreateMonthGroup, db_session: Session = Depends(db.get_db)):
    period = date(payload.year, payload.month, 1)
    if db_session.query(models.InventoryMonthGroup.id).filter(models.InventoryMonthGroup.period == period).first():
        raise HTTPException(status_code=409, detail="Ya existe un grupo para ese mes. Agrega los registros de compra al grupo existente.")
    products = selected_products(db_session, payload.purchase_item_ids)
    group = models.InventoryMonthGroup(period=period)
    db_session.add(group)
    try:
        db_session.flush()
        for product in products:
            product.month_group_id = group.id
        db_session.commit()
    except IntegrityError as exc:
        db_session.rollback()
        raise HTTPException(status_code=409, detail="El mes ya fue creado por otra solicitud. Actualiza los grupos e intenta de nuevo.") from exc
    db_session.refresh(group)
    return group_out(group)


@router.put("/{group_id}/products", response_model=MonthGroupOut)
def assign_month_products(group_id: int, payload: AssignProducts, db_session: Session = Depends(db.get_db)):
    group = db_session.query(models.InventoryMonthGroup).filter(models.InventoryMonthGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo de inventario no encontrado")
    for product in selected_products(db_session, payload.purchase_item_ids):
        product.month_group_id = group.id
    db_session.commit()
    db_session.refresh(group)
    return group_out(group)
