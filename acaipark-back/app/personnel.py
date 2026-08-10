from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import db, models, schemas

router = APIRouter(prefix="/personnel", tags=["personnel"])


def _norm(value: str) -> str:
    return value.strip().lower()


def _supplier_or_404(db_session: Session, supplier_id: int) -> models.Supplier:
    supplier = (
        db_session.query(models.Supplier)
        .filter(models.Supplier.id == supplier_id)
        .first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return supplier


def _waiter_or_404(db_session: Session, waiter_id: int) -> models.Waiter:
    waiter = (
        db_session.query(models.Waiter)
        .filter(models.Waiter.id == waiter_id)
        .first()
    )
    if not waiter:
        raise HTTPException(status_code=404, detail="Mesero no encontrado")
    return waiter


def _customer_or_404(db_session: Session, customer_id: int) -> models.Customer:
    customer = (
        db_session.query(models.Customer)
        .filter(models.Customer.id == customer_id)
        .first()
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return customer


@router.post("/suppliers", response_model=schemas.SupplierOut, status_code=201)
def create_supplier(
    payload: schemas.SupplierCreate, db_session: Session = Depends(db.get_db)
):
    existing = (
        db_session.query(models.Supplier)
        .filter(func.lower(models.Supplier.name) == _norm(payload.name))
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Proveedor ya existe")

    supplier = models.Supplier(
        name=payload.name.strip(),
        phone=payload.phone,
        gender=payload.gender.strip() if payload.gender else "male",
        is_active=payload.is_active,
    )
    db_session.add(supplier)
    db_session.commit()
    db_session.refresh(supplier)
    return supplier


@router.get("/suppliers", response_model=list[schemas.SupplierOut])
def list_suppliers(active: bool | None = True, db_session: Session = Depends(db.get_db)):
    query = db_session.query(models.Supplier)
    if active is not None:
        query = query.filter(models.Supplier.is_active == active)
    return query.order_by(models.Supplier.name.asc()).all()


@router.get("/suppliers/{supplier_id}", response_model=schemas.SupplierOut)
def get_supplier(supplier_id: int, db_session: Session = Depends(db.get_db)):
    return _supplier_or_404(db_session, supplier_id)


@router.put("/suppliers/{supplier_id}", response_model=schemas.SupplierOut)
def update_supplier(
    supplier_id: int,
    payload: schemas.SupplierUpdate,
    db_session: Session = Depends(db.get_db),
):
    supplier = _supplier_or_404(db_session, supplier_id)

    data = payload.dict(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        candidate = data["name"].strip()
        existing = (
            db_session.query(models.Supplier)
            .filter(
                func.lower(models.Supplier.name) == _norm(candidate),
                models.Supplier.id != supplier.id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Proveedor ya existe")
        data["name"] = candidate

    if "phone" in data and data["phone"] is not None:
        data["phone"] = data["phone"].strip() or None
    if "gender" in data and data["gender"] is not None:
        data["gender"] = data["gender"].strip() or "male"

    for key, value in data.items():
        setattr(supplier, key, value)

    db_session.add(supplier)
    db_session.commit()
    db_session.refresh(supplier)
    return supplier


@router.post("/waiters", response_model=schemas.WaiterOut, status_code=201)
def create_waiter(payload: schemas.WaiterCreate, db_session: Session = Depends(db.get_db)):
    name = payload.name.strip()
    existing = (
        db_session.query(models.Waiter)
        .filter(func.lower(models.Waiter.name) == _norm(name))
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Mesero ya existe")

    waiter = models.Waiter(
        name=name,
        gender=payload.gender.strip() if payload.gender else "male",
        is_active=payload.is_active,
    )
    db_session.add(waiter)
    db_session.commit()
    db_session.refresh(waiter)
    return waiter


@router.get("/waiters", response_model=list[schemas.WaiterOut])
def list_waiters(active: bool | None = True, db_session: Session = Depends(db.get_db)):
    query = db_session.query(models.Waiter)
    if active is not None:
        query = query.filter(models.Waiter.is_active == active)
    return query.order_by(models.Waiter.name.asc()).all()


@router.get("/waiters/{waiter_id}", response_model=schemas.WaiterOut)
def get_waiter(waiter_id: int, db_session: Session = Depends(db.get_db)):
    return _waiter_or_404(db_session, waiter_id)


@router.put("/waiters/{waiter_id}", response_model=schemas.WaiterOut)
def update_waiter(
    waiter_id: int,
    payload: schemas.WaiterUpdate,
    db_session: Session = Depends(db.get_db),
):
    waiter = _waiter_or_404(db_session, waiter_id)

    data = payload.dict(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        candidate = data["name"].strip()
        existing = (
            db_session.query(models.Waiter)
            .filter(
                func.lower(models.Waiter.name) == _norm(candidate),
                models.Waiter.id != waiter.id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Mesero ya existe")
        data["name"] = candidate
    if "gender" in data and data["gender"] is not None:
        data["gender"] = data["gender"].strip() or "male"

    for key, value in data.items():
        setattr(waiter, key, value)

    db_session.add(waiter)
    db_session.commit()
    db_session.refresh(waiter)
    return waiter


@router.post("/customers", response_model=schemas.CustomerOut, status_code=201)
def create_customer(
    payload: schemas.CustomerCreate, db_session: Session = Depends(db.get_db)
):
    name = payload.name.strip()
    identity_document = payload.identity_document.strip()
    phone = payload.phone.strip() if payload.phone else None

    existing = (
        db_session.query(models.Customer)
        .filter(func.lower(models.Customer.identity_document) == _norm(identity_document))
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Cliente ya existe")

    customer = models.Customer(
        name=name,
        identity_document=identity_document,
        phone=phone,
        gender=payload.gender.strip() if payload.gender else "male",
        is_active=payload.is_active,
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer


@router.get("/customers", response_model=list[schemas.CustomerOut])
def list_customers(active: bool | None = True, db_session: Session = Depends(db.get_db)):
    query = db_session.query(models.Customer)
    if active is not None:
        query = query.filter(models.Customer.is_active == active)
    return query.order_by(models.Customer.name.asc()).all()


@router.get("/customers/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(customer_id: int, db_session: Session = Depends(db.get_db)):
    return _customer_or_404(db_session, customer_id)


@router.put("/customers/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(
    customer_id: int,
    payload: schemas.CustomerUpdate,
    db_session: Session = Depends(db.get_db),
):
    customer = _customer_or_404(db_session, customer_id)

    data = payload.dict(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()

    if "identity_document" in data and data["identity_document"] is not None:
        candidate = data["identity_document"].strip()
        existing = (
            db_session.query(models.Customer)
            .filter(
                func.lower(models.Customer.identity_document) == _norm(candidate),
                models.Customer.id != customer.id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Cliente ya existe")
        data["identity_document"] = candidate

    if "phone" in data and data["phone"] is not None:
        data["phone"] = data["phone"].strip() or None
    if "gender" in data and data["gender"] is not None:
        data["gender"] = data["gender"].strip() or "male"

    for key, value in data.items():
        setattr(customer, key, value)

    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer
