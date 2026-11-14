"""Payments are cash movements; purchase totals remain inventory costs."""
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from . import models, schemas

METHOD_LABELS = {
    "cash": "Efectivo", "credit": "Crédito",
    "transfer": "Transferencia", "cash_drawer": "Efectivo caja",
}
COLOMBIA_TZ = ZoneInfo("America/Bogota")


def validate_date(payment_date, purchase):
    purchased_at = purchase.purchased_at or purchase.received_at or purchase.created_at
    purchase_day = (purchased_at.astimezone(COLOMBIA_TZ) if purchased_at.tzinfo else purchased_at).date()
    if payment_date < purchase_day or payment_date > datetime.now(COLOMBIA_TZ).date():
        raise HTTPException(400, "La fecha del pago debe estar entre la fecha de compra y hoy.")


def set_initial_payment(purchase, payload):
    """Change only the initial payment; subsequent installments retain their dates."""
    initial = next((item for item in purchase.payments if item.is_initial), None)
    later_total = sum((item.amount for item in purchase.payments if not item.is_initial), Decimal(0))
    for payment in purchase.payments:
        if not payment.is_initial:
            validate_date(payment.payment_date, purchase)
    if not {"payment_method", "initial_payment_amount", "payment_date"} & payload.model_fields_set:
        if purchase.paid_amount > purchase.total_cost:
            raise HTTPException(400, "El total de compra no puede ser menor que los pagos registrados.")
        return
    method = payload.payment_method.value if payload.payment_method else None
    amount = payload.initial_payment_amount
    if amount is None:
        amount = Decimal(0) if method in (None, "credit") else (initial.amount if initial else purchase.total_cost - later_total)
    if method in (None, "credit") and amount:
        raise HTTPException(400, "Selecciona el medio usado para el abono; una compra a crédito no tiene pago inicial.")
    if method not in (None, "credit") and amount <= 0:
        raise HTTPException(400, "Indica el pago inicial o selecciona Crédito.")
    if amount + later_total > purchase.total_cost:
        raise HTTPException(400, "Los pagos no pueden superar el total de la compra.")
    if amount:
        purchased_at = purchase.purchased_at
        day = payload.payment_date or (purchased_at.astimezone(COLOMBIA_TZ) if purchased_at.tzinfo else purchased_at).date()
        validate_date(day, purchase)
        if initial is None:
            initial = models.PurchasePayment(is_initial=True)
            purchase.payments.append(initial)
        initial.payment_method = method
        initial.payment_date = day
        initial.amount = amount
    elif initial is not None:
        purchase.payments.remove(initial)
    purchase.payment_method = method


def add_payment(purchase, payload: schemas.PurchasePaymentCreate):
    if purchase.status == "void":
        raise HTTPException(409, "No se puede abonar a una compra anulada.")
    if purchase.payment_status == "unclassified":
        raise HTTPException(409, "Clasifica primero el pago de esta compra histórica para no duplicar pagos.")
    if payload.payment_method == schemas.PurchasePaymentMethod.credit:
        raise HTTPException(400, "Crédito no es un medio de pago para un abono.")
    validate_date(payload.payment_date, purchase)
    if payload.amount > purchase.balance:
        raise HTTPException(400, "El abono no puede superar el saldo pendiente.")
    purchase.payments.append(models.PurchasePayment(
        payment_date=payload.payment_date, payment_method=payload.payment_method.value,
        amount=payload.amount, is_initial=False,
    ))
