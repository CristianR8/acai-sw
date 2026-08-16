from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import db, models, schemas
from .thermal_printer import print_thermal_text

router = APIRouter(prefix="/pos", tags=["pos"])
logger = logging.getLogger("uvicorn.error")

INC_RATE = Decimal("0.08")


BAR_CATEGORY_KEYS = {
    "bebidas",
    "sodas",
    "gaseosas",
    "para el almuerzo",
    "cervezas nacionales",
    "cervezas internacionales",
    "micheladas",
    "licores y shots",
    "cubetazos",
    "cocteleria",
    "vinos",
}


def _norm(value: str) -> str:
    return value.strip().lower()


def _table_or_404(db_session: Session, table_id: int) -> models.PosTable:
    table = (
        db_session.query(models.PosTable)
        .filter(models.PosTable.id == table_id, models.PosTable.is_active == True)  # noqa: E712
        .first()
    )
    if not table:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    return table


def _menu_item_or_404(db_session: Session, menu_item_id: int) -> models.MenuItem:
    item = (
        db_session.query(models.MenuItem)
        .filter(models.MenuItem.id == menu_item_id, models.MenuItem.is_active == True)  # noqa: E712
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail=f"Menu item {menu_item_id} no encontrado")
    return item


def _compute_order_totals(items: list[models.PosOrderItem], service_total: Decimal):
    subtotal = sum((i.line_subtotal for i in items), Decimal("0"))
    tax_total = sum((i.line_tax for i in items), Decimal("0"))
    total = subtotal + tax_total + service_total
    discount_total = sum((i.discount_amount for i in items), Decimal("0"))
    courtesy_total = sum((i.unit_price * i.quantity for i in items if i.courtesy), Decimal("0"))
    return subtotal, tax_total, discount_total, courtesy_total, total


def _compute_line_amounts(
    quantity: Decimal,
    unit_price: Decimal,
    discount_amount: Decimal,
    tax_rate: Decimal,
) -> tuple[Decimal, Decimal, Decimal]:
    price_before_discount = unit_price * quantity
    line_subtotal = max(price_before_discount - discount_amount, Decimal("0"))
    line_tax = line_subtotal * tax_rate
    return line_subtotal, line_tax, line_subtotal + line_tax


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _format_quantity(value: Decimal) -> str:
    qty = Decimal(value)
    if qty == qty.to_integral_value():
        return str(int(qty))
    normalized = f"{qty.normalize():f}"
    return normalized.rstrip("0").rstrip(".")


def _format_cop(value: Decimal) -> str:
    rounded = Decimal(value).quantize(Decimal("1"))
    return f"${int(rounded):,}".replace(",", ".")


def _build_ticket_text(
    *,
    order_id: int,
    table_name: str,
    zone_label: str,
    created_at: datetime,
    items: list[models.PosOrderItem],
) -> str:
    created_local = created_at.astimezone().strftime("%Y-%m-%d %H:%M")
    lines = [
        "ACAIPARK POS",
        f"COMANDA #{order_id}",
        f"MESA: {table_name}",
        f"ZONA: {zone_label}",
        f"FECHA: {created_local}",
        "-" * 40,
    ]

    for item in items:
        qty_text = _format_quantity(Decimal(item.quantity))
        item_name = (item.name or "").strip()
        lines.append(f"{qty_text} x {item_name}")
        note = (item.note or "").strip()
        if note:
            lines.append(f"  Nota: {note}")

    lines.append("-" * 40)
    lines.append("")
    return "\n".join(lines)


def _build_sale_receipt_text(
    *,
    sale: models.Sale,
    order: models.PosOrder,
    customer: models.Customer | None,
) -> str:
    width = 40
    separator = "-" * width
    created_at = sale.created_at or order.closed_at or datetime.now(timezone.utc)
    created_local = created_at.astimezone().strftime("%Y-%m-%d %H:%M")
    business_name = (os.getenv("POS_RECEIPT_BUSINESS_NAME") or "ACAI PARK").strip()
    tax_id = (os.getenv("POS_RECEIPT_TAX_ID") or "").strip()
    address = (os.getenv("POS_RECEIPT_ADDRESS") or "").strip()
    phone = (os.getenv("POS_RECEIPT_PHONE") or "").strip()
    footer = (
        os.getenv("POS_RECEIPT_FOOTER")
        or "Gracias por tu compra. Te esperamos pronto."
    ).strip()

    lines = [business_name.upper()]
    if tax_id:
        lines.append(f"NIT: {tax_id}")
    if address:
        lines.append(address)
    if phone:
        lines.append(f"Tel: {phone}")

    lines.extend(
        [
            separator,
            f"RECIBO DE VENTA #{sale.id}",
            f"Pedido: #{order.id}",
            f"Fecha: {created_local}",
        ]
    )
    if customer:
        lines.append(f"Cliente: {customer.name}")
        lines.append(f"Documento: {customer.identity_document}")
        if customer.phone:
            lines.append(f"Telefono: {customer.phone}")
    else:
        lines.append("Cliente: Consumidor final")
    if order.table:
        lines.append(f"Punto: {order.table.name}")
    lines.append(separator)

    for item in order.items:
        quantity = Decimal(item.quantity)
        unit_price = Decimal(item.unit_price)
        lines.append((item.name or "Producto").strip())
        lines.append(
            f"{_format_quantity(quantity)} x {_format_cop(unit_price)}"
            f" = {_format_cop(Decimal(item.line_total))}"
        )

    lines.extend([separator, f"Subtotal: {_format_cop(Decimal(sale.subtotal))}"])
    if Decimal(sale.discount_total) > 0:
        lines.append(f"Descuentos: {_format_cop(Decimal(sale.discount_total))}")
    if Decimal(sale.tax_total) > 0:
        lines.append(f"INC: {_format_cop(Decimal(sale.tax_total))}")
    if Decimal(sale.service_total) > 0:
        lines.append(f"Servicio: {_format_cop(Decimal(sale.service_total))}")
    lines.extend(
        [
            f"TOTAL: {_format_cop(Decimal(sale.total))}",
            separator,
            footer,
            "",
        ]
    )
    return "\n".join(lines)


def _send_text_to_windows_printer(*, text: str, printer_hint: str, copies: int) -> None:
    print_thermal_text(text=text, printer_hint=printer_hint, copies=copies)


def _auto_print_comanda(
    *,
    order_id: int,
    table_name: str,
    created_at: datetime,
    items: list[models.PosOrderItem],
) -> None:
    if not _env_bool("POS_AUTO_PRINT_COMANDA", default=os.name == "nt"):
        return

    printer_hint = (
        os.getenv("POS_COMANDA_PRINTER")
        or os.getenv("POS_THERMAL_PRINTER")
        or "80mm Series Thermal Receipt Printer"
    ).strip()
    if not printer_hint:
        logger.warning("POS_AUTO_PRINT_COMANDA activo pero POS_COMANDA_PRINTER vacio")
        return

    split_by_zone = _env_bool("POS_COMANDA_SPLIT_BY_ZONE", default=True)
    copies_raw = (os.getenv("POS_COMANDA_COPIES") or "1").strip()
    try:
        copies = int(copies_raw)
    except ValueError:
        copies = 1

    if split_by_zone:
        zones: list[tuple[str, list[models.PosOrderItem]]] = [
            ("COCINA", [i for i in items if str(i.zone).lower() != "bar"]),
            ("BAR", [i for i in items if str(i.zone).lower() == "bar"]),
        ]
    else:
        zones = [("GENERAL", list(items))]

    for zone_label, zone_items in zones:
        if not zone_items:
            continue
        ticket_text = _build_ticket_text(
            order_id=order_id,
            table_name=table_name,
            zone_label=zone_label,
            created_at=created_at,
            items=zone_items,
        )
        try:
            _send_text_to_windows_printer(text=ticket_text, printer_hint=printer_hint, copies=copies)
            logger.info(
                "Comanda #%s enviada a impresora '%s' (zona=%s, items=%s)",
                order_id,
                printer_hint,
                zone_label,
                len(zone_items),
            )
        except Exception as exc:
            logger.warning(
                "No se pudo imprimir comanda #%s en '%s' (zona=%s): %s",
                order_id,
                printer_hint,
                zone_label,
                exc,
            )


def _auto_print_sale_receipt(
    *,
    sale: models.Sale,
    order: models.PosOrder,
    customer: models.Customer | None,
) -> None:
    if not _env_bool("POS_AUTO_PRINT_RECEIPT", default=os.name == "nt"):
        return

    printer_hint = (
        os.getenv("POS_RECEIPT_PRINTER")
        or os.getenv("POS_COMANDA_PRINTER")
        or os.getenv("POS_THERMAL_PRINTER")
        or "80mm Series Thermal Receipt Printer"
    ).strip()
    if not printer_hint:
        logger.warning("POS_AUTO_PRINT_RECEIPT activo pero POS_RECEIPT_PRINTER vacio")
        return

    copies_raw = (os.getenv("POS_RECEIPT_COPIES") or "1").strip()
    try:
        copies = int(copies_raw)
    except ValueError:
        copies = 1

    receipt_text = _build_sale_receipt_text(
        sale=sale,
        order=order,
        customer=customer,
    )
    try:
        _send_text_to_windows_printer(
            text=receipt_text,
            printer_hint=printer_hint,
            copies=copies,
        )
        logger.info(
            "Recibo de venta #%s enviado a impresora '%s' (cliente=%s)",
            sale.id,
            printer_hint,
            customer.id if customer else "ocasional",
        )
    except Exception as exc:
        logger.warning(
            "No se pudo imprimir recibo de venta #%s en '%s': %s",
            sale.id,
            printer_hint,
            exc,
        )


def _recompute_order_for_close(order: models.PosOrder, apply_inc: bool) -> None:
    effective_tax_rate = INC_RATE if apply_inc else Decimal("0")
    items = list(order.items)

    for item in items:
        if item.courtesy:
            item.tax_rate = Decimal("0")
            item.line_subtotal = Decimal("0")
            item.line_tax = Decimal("0")
            item.line_total = Decimal("0")
            continue

        line_subtotal, line_tax, line_total = _compute_line_amounts(
            quantity=Decimal(item.quantity),
            unit_price=Decimal(item.unit_price),
            discount_amount=Decimal(item.discount_amount),
            tax_rate=effective_tax_rate,
        )
        item.tax_rate = effective_tax_rate
        item.line_subtotal = line_subtotal
        item.line_tax = line_tax
        item.line_total = line_total

    subtotal, tax_total, discount_total, courtesy_total, total = _compute_order_totals(
        items, Decimal(order.service_total)
    )
    order.subtotal = subtotal
    order.tax_total = tax_total
    order.discount_total = discount_total
    order.courtesy_total = courtesy_total
    order.total = total


def _create_sale_from_order(
    db_session: Session,
    order: models.PosOrder,
    customer_id: int | None = None,
) -> models.Sale:
    if order.sale:
        if customer_id is not None:
            order.sale.customer_id = customer_id
        return order.sale

    sale_subtotal = Decimal("0")
    sale_tax_total = Decimal("0")
    sale_items_payload: list[dict[str, Decimal | int | str]] = []
    for item in order.items:
        line_subtotal, line_tax, line_total = _compute_line_amounts(
            quantity=Decimal(item.quantity),
            unit_price=Decimal(item.unit_price),
            discount_amount=Decimal(item.discount_amount),
            tax_rate=Decimal(item.tax_rate),
        )
        sale_subtotal += line_subtotal
        sale_tax_total += line_tax
        sale_items_payload.append(
            {
                "menu_item_id": item.menu_item_id,
                "name": item.name,
                "category": item.category,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "tax_rate": item.tax_rate,
                "line_subtotal": line_subtotal,
                "line_tax": line_tax,
                "line_total": line_total,
            }
        )

    sale = models.Sale(
        order_id=order.id,
        customer_id=customer_id,
        subtotal=sale_subtotal,
        tax_total=sale_tax_total,
        discount_total=order.discount_total,
        courtesy_total=order.courtesy_total,
        service_total=order.service_total,
        total=sale_subtotal + sale_tax_total + Decimal(order.service_total),
    )
    db_session.add(sale)
    db_session.flush()

    if customer_id is not None:
        customer = db_session.query(models.Customer).filter(models.Customer.id == customer_id).first()
        if customer:
            stamps = int(customer.loyalty_stamps or 0) + 1
            if stamps >= 10:
                customer.loyalty_stamps = 0
                customer.loyalty_rewards = int(customer.loyalty_rewards or 0) + 1
            else:
                customer.loyalty_stamps = stamps
            db_session.add(customer)

    for payload in sale_items_payload:
        sale_item = models.SaleItem(
            sale_id=sale.id,
            menu_item_id=int(payload["menu_item_id"]),
            name=str(payload["name"]),
            category=str(payload["category"]),
            quantity=Decimal(payload["quantity"]),
            unit_price=Decimal(payload["unit_price"]),
            tax_rate=Decimal(payload["tax_rate"]),
            line_subtotal=Decimal(payload["line_subtotal"]),
            line_tax=Decimal(payload["line_tax"]),
            line_total=Decimal(payload["line_total"]),
        )
        db_session.add(sale_item)

    return sale


@router.post("/tables", response_model=schemas.PosTableOut, status_code=201)
def create_table(payload: schemas.PosTableCreate, db_session: Session = Depends(db.get_db)):
    name = payload.name.strip()
    existing = (
        db_session.query(models.PosTable)
        .filter(models.PosTable.is_active == True, models.PosTable.name == name)  # noqa: E712
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="La mesa ya existe")
    table = models.PosTable(name=name)
    db_session.add(table)
    db_session.commit()
    db_session.refresh(table)
    return table


@router.get("/tables", response_model=list[schemas.PosTableOut])
def list_tables(db_session: Session = Depends(db.get_db)):
    return (
        db_session.query(models.PosTable)
        .filter(models.PosTable.is_active == True)  # noqa: E712
        .order_by(models.PosTable.id.asc())
        .all()
    )


@router.delete("/tables/{table_id}", status_code=204)
def delete_table(table_id: int, db_session: Session = Depends(db.get_db)):
    table = db_session.query(models.PosTable).filter(models.PosTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")

    table.is_active = False
    db_session.add(table)
    db_session.commit()
    return None


@router.post("/orders", response_model=schemas.PosOrderOut, status_code=201)
def create_order(payload: schemas.PosOrderCreate, db_session: Session = Depends(db.get_db)):
    table = _table_or_404(db_session, payload.table_id)

    order = models.PosOrder(table_id=table.id, status="open", service_total=payload.service_total)
    db_session.add(order)
    db_session.flush()

    items: list[models.PosOrderItem] = []
    now = datetime.now(timezone.utc)

    for item_payload in payload.items:
        menu_item = _menu_item_or_404(db_session, item_payload.menu_item_id)
        zone = "bar" if _norm(menu_item.category) in BAR_CATEGORY_KEYS else "kitchen"

        qty = Decimal(item_payload.quantity)
        unit_price = Decimal(item_payload.unit_price)
        discount_amount = Decimal(item_payload.discount_amount)
        tax_rate = Decimal("0")

        if discount_amount < 0:
            raise HTTPException(status_code=400, detail="Descuento inválido")

        if item_payload.courtesy:
            line_subtotal = Decimal("0")
            line_tax = Decimal("0")
            line_total = Decimal("0")
        else:
            line_subtotal, line_tax, line_total = _compute_line_amounts(
                quantity=qty,
                unit_price=unit_price,
                discount_amount=discount_amount,
                tax_rate=tax_rate,
            )

        pos_item = models.PosOrderItem(
            order_id=order.id,
            menu_item_id=menu_item.id,
            name=menu_item.name,
            category=menu_item.category,
            zone=zone,
            quantity=qty,
            unit_price=unit_price,
            tax_rate=tax_rate,
            discount_amount=discount_amount,
            courtesy=item_payload.courtesy,
            note=item_payload.note,
            line_subtotal=line_subtotal,
            line_tax=line_tax,
            line_total=line_total,
            sent_at=now,
        )
        items.append(pos_item)
        db_session.add(pos_item)

    subtotal, tax_total, discount_total, courtesy_total, total = _compute_order_totals(
        items, payload.service_total
    )
    order.subtotal = subtotal
    order.tax_total = tax_total
    order.discount_total = discount_total
    order.courtesy_total = courtesy_total
    order.total = total
    order.sent_at = now

    db_session.add(order)
    db_session.commit()
    db_session.refresh(order)
    _auto_print_comanda(
        order_id=order.id,
        table_name=table.name,
        created_at=now,
        items=items,
    )
    return order


@router.get("/orders", response_model=list[schemas.PosOrderOut])
def list_orders(db_session: Session = Depends(db.get_db)):
    return (
        db_session.query(models.PosOrder)
        .order_by(models.PosOrder.id.desc())
        .limit(200)
        .all()
    )


@router.delete("/orders/finished")
def clear_finished_orders(db_session: Session = Depends(db.get_db)):
    cleared = (
        db_session.query(func.count(models.PosOrder.id))
        .filter(models.PosOrder.status.in_(["closed", "void"]))
        .scalar()
        or 0
    )
    return {"cleared": int(cleared)}


@router.get("/orders/{order_id}", response_model=schemas.PosOrderOut)
def get_order(order_id: int, db_session: Session = Depends(db.get_db)):
    order = db_session.query(models.PosOrder).filter(models.PosOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return order


@router.post("/orders/{order_id}/deliver", response_model=schemas.PosOrderOut)
def mark_order_delivered(
    order_id: int, payload: schemas.PosOrderDeliver, db_session: Session = Depends(db.get_db)
):
    order = db_session.query(models.PosOrder).filter(models.PosOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    if payload.delivered:
        now = datetime.now(timezone.utc)
        order.delivered_at = now
        # A paid order is completed only after the physical delivery.
        # Older orders used ``delivered`` before payment, so keep that
        # state for backwards compatibility when no payment exists yet.
        order.status = "closed" if order.status == "paid" else "delivered"
        for item in order.items:
            item.delivered_at = item.delivered_at or now
    else:
        order.delivered_at = None
        order.status = "sent"
        for item in order.items:
            item.delivered_at = None

    db_session.add(order)
    db_session.commit()
    db_session.refresh(order)
    return order


@router.post("/orders/{order_id}/close", response_model=schemas.PosOrderOut)
def mark_order_closed(
    order_id: int,
    payload: schemas.PosOrderClose | None = None,
    db_session: Session = Depends(db.get_db),
):
    order = db_session.query(models.PosOrder).filter(models.PosOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    customer_id = None
    if payload is not None:
        if payload.customer_id is not None:
            customer = (
                db_session.query(models.Customer)
                .filter(models.Customer.id == payload.customer_id)
                .first()
            )
            if not customer:
                raise HTTPException(status_code=404, detail="Cliente no encontrado")
            customer_id = customer.id
        else:
            name = (payload.customer_name or "").strip()
            identity_document = (payload.customer_identity_document or "").strip()
            if name or identity_document:
                if not name or not identity_document:
                    raise HTTPException(
                        status_code=400, detail="Nombre y documento son requeridos"
                    )
                existing = (
                    db_session.query(models.Customer)
                    .filter(func.lower(models.Customer.identity_document) == _norm(identity_document))
                    .first()
                )
                if existing:
                    customer_id = existing.id
                else:
                    phone = payload.customer_phone.strip() if payload.customer_phone else None
                    customer = models.Customer(
                        name=name,
                        identity_document=identity_document,
                        phone=phone or None,
                        is_active=True,
                    )
                    db_session.add(customer)
                    db_session.flush()
                    customer_id = customer.id

    apply_inc = bool(payload.apply_inc) if payload is not None else False
    _recompute_order_for_close(order, apply_inc=apply_inc)

    now = datetime.now(timezone.utc)
    order.closed_at = now
    # Payment and delivery are separate steps in the POS flow. The order
    # remains active as ``paid`` until it is physically delivered.
    order.status = "paid"

    should_print_receipt = order.sale is None or (
        customer_id is not None and order.sale.customer_id != customer_id
    )
    sale = _create_sale_from_order(
        db_session,
        order,
        customer_id=customer_id,
    )
    db_session.add(order)
    db_session.commit()
    db_session.refresh(order)
    db_session.refresh(sale)

    if should_print_receipt:
        customer = None
        if customer_id is not None:
            customer = (
                db_session.query(models.Customer)
                .filter(models.Customer.id == customer_id)
                .first()
            )
        _auto_print_sale_receipt(
            sale=sale,
            order=order,
            customer=customer,
        )
    return order


@router.post("/orders/{order_id}/void", response_model=schemas.PosOrderOut)
def mark_order_void(order_id: int, db_session: Session = Depends(db.get_db)):
    order = db_session.query(models.PosOrder).filter(models.PosOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    now = datetime.now(timezone.utc)
    order.status = "void"
    order.closed_at = now

    db_session.add(order)
    db_session.commit()
    db_session.refresh(order)
    return order
