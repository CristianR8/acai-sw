from __future__ import annotations

from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session

from . import db, models, schemas

router = APIRouter(prefix="/reservations", tags=["reservations"])

_RESERVATION_TIME_FORMATS = ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p")


def _parse_reservation_time(time_value: str) -> time | None:
    normalized = time_value.strip()
    for fmt in _RESERVATION_TIME_FORMATS:
        try:
            return datetime.strptime(normalized, fmt).time()
        except ValueError:
            continue
    return None


def _cleanup_expired_reservations(db_session: Session) -> None:
    now = datetime.now()
    expired_reservations: list[models.Reservation] = []
    reservations = db_session.query(models.Reservation).all()

    for reservation in reservations:
        parsed_time = _parse_reservation_time(reservation.reservation_time)
        if parsed_time is None:
            continue

        scheduled_at = datetime.combine(reservation.reservation_date, parsed_time)
        if scheduled_at < now:
            expired_reservations.append(reservation)

    if not expired_reservations:
        return

    for reservation in expired_reservations:
        db_session.delete(reservation)
    db_session.commit()


def _reservation_or_404(db_session: Session, reservation_id: int) -> models.Reservation:
    reservation = (
        db_session.query(models.Reservation)
        .filter(models.Reservation.id == reservation_id)
        .first()
    )
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    return reservation


@router.post("", response_model=schemas.ReservationOut, status_code=201)
def create_reservation(
    payload: schemas.ReservationCreate, db_session: Session = Depends(db.get_db)
):
    existing = (
        db_session.query(models.Reservation)
        .filter(models.Reservation.reservation_date == payload.reservation_date)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe una reserva para ese dia")

    reservation = models.Reservation(
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        reservation_date=payload.reservation_date,
        reservation_time=payload.reservation_time.strip(),
        party_size=payload.party_size,
    )
    db_session.add(reservation)
    db_session.commit()
    db_session.refresh(reservation)
    return reservation


@router.patch("/{reservation_id}", response_model=schemas.ReservationOut)
def update_reservation(
    reservation_id: int,
    payload: schemas.ReservationUpdate,
    db_session: Session = Depends(db.get_db),
):
    reservation = _reservation_or_404(db_session, reservation_id)

    next_date = payload.reservation_date or reservation.reservation_date
    if next_date != reservation.reservation_date:
        existing = (
            db_session.query(models.Reservation)
            .filter(
                models.Reservation.reservation_date == next_date,
                models.Reservation.id != reservation_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Ya existe una reserva para ese dia")

    if payload.name is not None:
        reservation.name = payload.name.strip()
    if payload.phone is not None:
        reservation.phone = payload.phone.strip()
    if payload.reservation_date is not None:
        reservation.reservation_date = payload.reservation_date
    if payload.reservation_time is not None:
        reservation.reservation_time = payload.reservation_time.strip()
    if payload.party_size is not None:
        reservation.party_size = payload.party_size

    db_session.add(reservation)
    db_session.commit()
    db_session.refresh(reservation)
    return reservation


@router.delete("/{reservation_id}", status_code=204)
def delete_reservation(reservation_id: int, db_session: Session = Depends(db.get_db)):
    reservation = _reservation_or_404(db_session, reservation_id)
    db_session.delete(reservation)
    db_session.commit()
    return None


@router.get("", response_model=list[schemas.ReservationOut])
def list_reservations(
    month: str | None = None, db_session: Session = Depends(db.get_db)
):
    _cleanup_expired_reservations(db_session)
    query = db_session.query(models.Reservation)

    if month:
        try:
            start = datetime.strptime(f"{month}-01", "%Y-%m-%d").date()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Formato de mes invalido (YYYY-MM)") from exc
        if start.month == 12:
            end = date(start.year + 1, 1, 1)
        else:
            end = date(start.year, start.month + 1, 1)
        query = query.filter(
            and_(
                models.Reservation.reservation_date >= start,
                models.Reservation.reservation_date < end,
            )
        )

    return query.order_by(models.Reservation.reservation_date.asc()).all()
