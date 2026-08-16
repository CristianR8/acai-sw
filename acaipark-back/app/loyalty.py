from __future__ import annotations

import secrets
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import db, models, schemas

router = APIRouter(prefix="/loyalty", tags=["loyalty"])
REGISTRATION_TTL = timedelta(minutes=30)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _session_or_404(token: str, db_session: Session) -> models.LoyaltyRegistrationSession:
    registration = (
        db_session.query(models.LoyaltyRegistrationSession)
        .filter(models.LoyaltyRegistrationSession.token == token)
        .first()
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Registro de fidelizacion no encontrado")

    if registration.status == "pending" and registration.expires_at <= _now():
        registration.status = "expired"
        db_session.commit()
    return registration


def _out(registration: models.LoyaltyRegistrationSession) -> schemas.LoyaltyRegistrationOut:
    customer = registration.customer
    return schemas.LoyaltyRegistrationOut(
        token=registration.token,
        order_id=registration.order_id,
        status=registration.status,
        expires_at=registration.expires_at,
        customer_id=customer.id if customer else None,
        customer_name=customer.name if customer else None,
        loyalty_stamps=customer.loyalty_stamps if customer else None,
        loyalty_rewards=customer.loyalty_rewards if customer else None,
        loyalty_code=customer.loyalty_code if customer else None,
    )


@router.post("/registration-sessions", response_model=schemas.LoyaltyRegistrationOut, status_code=201)
def create_registration_session(
    payload: schemas.LoyaltyRegistrationCreate,
    db_session: Session = Depends(db.get_db),
):
    order = db_session.query(models.PosOrder).filter(models.PosOrder.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if order.status in {"closed", "void"}:
        raise HTTPException(status_code=409, detail="El pedido ya no admite registro de cliente")

    existing = (
        db_session.query(models.LoyaltyRegistrationSession)
        .filter(
            models.LoyaltyRegistrationSession.order_id == order.id,
            models.LoyaltyRegistrationSession.status == "pending",
        )
        .first()
    )
    if existing and existing.expires_at > _now():
        return _out(existing)

    registration = models.LoyaltyRegistrationSession(
        token=secrets.token_urlsafe(32),
        order_id=order.id,
        status="pending",
        expires_at=_now() + REGISTRATION_TTL,
    )
    db_session.add(registration)
    db_session.commit()
    db_session.refresh(registration)
    return _out(registration)


@router.get("/registration-sessions/{token}", response_model=schemas.LoyaltyRegistrationOut)
def get_registration_session(token: str, db_session: Session = Depends(db.get_db)):
    return _out(_session_or_404(token, db_session))


@router.post("/registration-sessions/{token}/complete", response_model=schemas.LoyaltyRegistrationOut)
def complete_registration_session(
    token: str,
    payload: schemas.LoyaltyRegistrationComplete,
    db_session: Session = Depends(db.get_db),
):
    registration = _session_or_404(token, db_session)
    if registration.status == "completed":
        return _out(registration)
    if registration.status != "pending":
        raise HTTPException(status_code=410, detail="El QR de registro ya no esta vigente")

    name = payload.name.strip()
    phone = payload.phone.strip()
    if not name or not phone:
        raise HTTPException(status_code=400, detail="Nombre y telefono son requeridos")
    if payload.birth_date > date.today():
        raise HTTPException(status_code=400, detail="La fecha de cumpleaños no puede estar en el futuro")

    customer = (
        db_session.query(models.Customer)
        .filter(func.replace(func.replace(models.Customer.phone, " ", ""), "-", "") == phone.replace(" ", "").replace("-", ""))
        .first()
    )
    if customer is None:
        loyalty_code = secrets.token_urlsafe(12)
        customer = models.Customer(
            name=name,
            identity_document=f"FID-{loyalty_code}",
            phone=phone,
            birth_date=payload.birth_date,
            loyalty_code=loyalty_code,
            loyalty_stamps=0,
            loyalty_rewards=0,
            is_active=True,
        )
        db_session.add(customer)
        db_session.flush()
    else:
        customer.name = name
        customer.phone = phone
        customer.birth_date = payload.birth_date
        if not customer.loyalty_code:
            customer.loyalty_code = secrets.token_urlsafe(12)

    registration.customer_id = customer.id
    registration.status = "completed"
    registration.completed_at = _now()
    db_session.add(registration)
    db_session.commit()
    db_session.refresh(registration)
    return _out(registration)


@router.get("/cards/{loyalty_code}", response_model=schemas.LoyaltyCardOut)
def get_loyalty_card(loyalty_code: str, db_session: Session = Depends(db.get_db)):
    customer = (
        db_session.query(models.Customer)
        .filter(
            models.Customer.loyalty_code == loyalty_code,
            models.Customer.is_active.is_(True),
        )
        .first()
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Tarjeta de fidelizacion no encontrada")
    return schemas.LoyaltyCardOut(
        name=customer.name,
        loyalty_code=customer.loyalty_code,
        loyalty_stamps=customer.loyalty_stamps,
        loyalty_rewards=customer.loyalty_rewards,
    )
