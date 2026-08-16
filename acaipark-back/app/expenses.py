from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from . import db, models, schemas

router = APIRouter(prefix="/expenses", tags=["expenses"])

DEFAULT_FIXED_EXPENSES = [
    ("Arriendo del local", "Local"),
    ("Servicio de luz", "Servicios"),
    ("Servicio de agua", "Servicios"),
    ("Servicio de gas", "Servicios"),
    ("Internet", "Servicios"),
    ("Nómina de cajero", "Nómina"),
    ("Personal de seguridad", "Nómina"),
    ("Póliza de inventario", "Seguros"),
]


def ensure_default_fixed_expenses(db_session: Session) -> None:
    existing_names = {row.name for row in db_session.query(models.FixedExpense.name).all()}
    missing = [
        models.FixedExpense(name=name, category=category, monthly_amount=0, due_day=1)
        for name, category in DEFAULT_FIXED_EXPENSES
        if name not in existing_names
    ]
    if missing:
        db_session.add_all(missing)
        db_session.commit()


def _payment_out(payment: models.FixedExpensePayment) -> dict:
    return {
        "id": payment.id,
        "fixed_expense_id": payment.fixed_expense_id,
        "name": payment.fixed_expense.name,
        "category": payment.fixed_expense.category,
        "payment_date": payment.due_date,
        "amount": payment.amount,
        "paid_at": payment.paid_at,
    }


@router.get("/fixed", response_model=list[schemas.FixedExpenseOut])
def list_fixed_expenses(db_session: Session = Depends(db.get_db)):
    ensure_default_fixed_expenses(db_session)
    return db_session.query(models.FixedExpense).order_by(
        models.FixedExpense.category, models.FixedExpense.name
    ).all()


@router.get("/payments", response_model=list[schemas.ManualExpensePaymentOut])
def list_manual_expense_payments(
    year: int | None = Query(default=None, ge=2020, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    db_session: Session = Depends(db.get_db),
):
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=400, detail="La fecha inicial no puede ser posterior a la fecha final")
    today = date.today()
    query = (
        db_session.query(models.FixedExpensePayment)
        .options(joinedload(models.FixedExpensePayment.fixed_expense))
        .filter(
            models.FixedExpensePayment.status == "manual",
        )
    )
    if from_date or to_date:
        if from_date:
            query = query.filter(models.FixedExpensePayment.due_date >= from_date)
        if to_date:
            query = query.filter(models.FixedExpensePayment.due_date <= to_date)
    else:
        target_year = year or today.year
        target_month = month or today.month
        query = query.filter(
            models.FixedExpensePayment.due_date >= date(target_year, target_month, 1),
            models.FixedExpensePayment.due_date < (
                date(target_year + 1, 1, 1)
                if target_month == 12
                else date(target_year, target_month + 1, 1)
            ),
        )
    query = query.order_by(models.FixedExpensePayment.due_date.desc(), models.FixedExpensePayment.id.desc())
    return [_payment_out(payment) for payment in query.all()]


@router.post("/payments", response_model=schemas.ManualExpensePaymentOut, status_code=201)
def register_manual_expense_payment(
    payload: schemas.FixedExpensePaymentCreate,
    db_session: Session = Depends(db.get_db),
):
    ensure_default_fixed_expenses(db_session)
    if payload.payment_date > date.today():
        raise HTTPException(status_code=400, detail="La fecha del gasto no puede ser futura")
    expense = (
        db_session.query(models.FixedExpense)
        .filter(models.FixedExpense.id == payload.fixed_expense_id, models.FixedExpense.is_active == True)  # noqa: E712
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Concepto de gasto no encontrado")

    period = payload.payment_date.replace(day=1)
    existing = (
        db_session.query(models.FixedExpensePayment)
        .filter(
            models.FixedExpensePayment.fixed_expense_id == expense.id,
            models.FixedExpensePayment.period == period,
        )
        .first()
    )
    if existing and existing.status == "manual":
        raise HTTPException(
            status_code=409,
            detail="Este gasto ya fue registrado manualmente este mes.",
        )

    # Los registros antiguos con estado scheduled fueron generados por el
    # calendario automático. Al registrar el gasto real, se reutiliza ese
    # registro para que no bloquee el pago manual ni se duplique el periodo.
    if existing:
        existing.due_date = payload.payment_date
        existing.amount = payload.amount
        existing.status = "manual"
        existing.paid_at = datetime.now(timezone.utc)
        db_session.add(existing)
        db_session.commit()
        db_session.refresh(existing)
        return _payment_out(existing)

    payment = models.FixedExpensePayment(
        fixed_expense_id=expense.id,
        period=period,
        due_date=payload.payment_date,
        amount=payload.amount,
        status="manual",
        paid_at=datetime.now(timezone.utc),
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)
    return _payment_out(payment)
