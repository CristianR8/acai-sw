from __future__ import annotations

from collections import defaultdict
import re
import unicodedata

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from io import BytesIO
from textwrap import wrap
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from . import db, models, schemas
from .reporting_periods import month_bounds

router = APIRouter(prefix="/sales", tags=["sales"])
COLOMBIA_TZ = ZoneInfo("America/Bogota")
CASH_DENOMINATIONS = (100000, 50000, 20000, 10000, 5000, 2000, 1000)
LEGACY_COIN_DENOMINATIONS = (500, 200, 100, 50)


def _period_start(period: str | None) -> datetime | None:
    if not period or re.fullmatch(r"\d{4}-\d{2}", period):
        return month_bounds(period)[0]
    if period == "all":
        return None
    days_by_period = {
        "week": 7,
        "month": 30,
        "quarter": 90,
        "year": 365,
    }
    days = days_by_period.get(period)
    if days is None:
        raise HTTPException(
            status_code=400,
            detail="Periodo invalido. Usa: all, week, month, quarter, year",
        )
    return datetime.now(timezone.utc) - timedelta(days=days)


@router.get("", response_model=list[schemas.SaleOut])
def list_sales(period: str | None = None, from_date: date | None = None, to_date: date | None = None, db_session: Session = Depends(db.get_db)):
    query = db_session.query(models.Sale)
    if from_date and to_date:
        if from_date > to_date: raise HTTPException(status_code=400, detail="La fecha Desde no puede ser posterior a Hasta")
        start = datetime.combine(from_date, time.min, tzinfo=COLOMBIA_TZ)
        query = query.filter(models.Sale.created_at >= start, models.Sale.created_at < start + timedelta(days=(to_date - from_date).days + 1))
        return query.order_by(models.Sale.id.desc()).all()
    start_date = _period_start(period)
    if start_date is not None:
        query = query.filter(models.Sale.created_at >= start_date)
    if not period or re.fullmatch(r"\d{4}-\d{2}", period):
        query = query.filter(models.Sale.created_at < month_bounds(period)[1])
    return query.order_by(models.Sale.id.desc()).all()


def _daily_payment_summary(day: date, db_session: Session) -> dict[str, Decimal]:
    """Return one Colombia calendar day, grouping legacy card payments as dataphone."""
    start = datetime.combine(day, time.min, tzinfo=COLOMBIA_TZ)
    end = start + timedelta(days=1)
    rows = (
        db_session.query(
            models.Sale.payment_method,
            func.coalesce(func.sum(models.Sale.total), 0).label("total"),
        )
        .filter(models.Sale.created_at >= start, models.Sale.created_at < end)
        .group_by(models.Sale.payment_method)
        .all()
    )

    totals: dict[str, Decimal] = {
        "cash": Decimal("0"),
        "transfer": Decimal("0"),
        "dataphone": Decimal("0"),
    }
    for row in rows:
        method = (row.payment_method or "cash").strip().lower()
        key = "dataphone" if method in {"card", "dataphone"} else method
        if key in totals:
            totals[key] += Decimal(row.total or 0)
    totals["total"] = sum(totals.values(), Decimal("0"))
    return totals


def _normalize_cash_counts(raw_counts: dict | None) -> dict[str, int]:
    raw_counts = raw_counts or {}
    counts = {
        str(value): max(0, int(raw_counts.get(str(value), 0) or 0))
        for value in CASH_DENOMINATIONS
    }
    coins = max(0, int(raw_counts.get("coins", 0) or 0))
    coins += sum(
        value * max(0, int(raw_counts.get(str(value), 0) or 0))
        for value in LEGACY_COIN_DENOMINATIONS
    )
    counts["coins"] = coins
    return counts


def _automatic_cash_counts(day: date, db_session: Session) -> dict[str, int]:
    start = datetime.combine(day, time.min, tzinfo=COLOMBIA_TZ)
    end = start + timedelta(days=1)
    rows = (
        db_session.query(models.Sale.cash_denomination_counts)
        .filter(
            models.Sale.created_at >= start,
            models.Sale.created_at < end,
            models.Sale.payment_method == "cash",
        )
        .all()
    )
    counts = _normalize_cash_counts(None)
    for (sale_counts,) in rows:
        normalized = _normalize_cash_counts(sale_counts)
        for key in counts:
            counts[key] += normalized[key]
    return counts


def _cash_closing(day: date, db_session: Session) -> schemas.CashClosingOut:
    totals = _daily_payment_summary(day, db_session)
    opening_total = sum((Decimal(item.opening_amount) for item in db_session.query(models.CashDrawerOpening).filter(models.CashDrawerOpening.business_date == day).all()), Decimal("0"))
    expenses_total = sum((Decimal(item.amount) for item in db_session.query(models.FixedExpensePayment).filter(models.FixedExpensePayment.status == "manual", models.FixedExpensePayment.due_date == day).all()), Decimal("0"))
    closing = db_session.query(models.CashDrawerClosing).filter(models.CashDrawerClosing.business_date == day).first()
    counts = _normalize_cash_counts(closing.denomination_counts) if closing and closing.denomination_counts else _automatic_cash_counts(day, db_session)
    physical_cash = sum((Decimal(value) * counts[str(value)] for value in CASH_DENOMINATIONS), Decimal("0")) + Decimal(counts["coins"])
    expected_cash = opening_total + totals["cash"] - expenses_total
    return schemas.CashClosingOut(date=day, cash_total=totals["cash"], transfer_total=totals["transfer"], dataphone_total=totals["dataphone"], total=totals["total"], opening_total=opening_total, expenses_total=expenses_total, expected_cash=expected_cash, denomination_counts=counts, physical_cash=physical_cash, difference=physical_cash - expected_cash)


@router.get("/cash-closing", response_model=schemas.CashClosingOut)
def get_cash_closing(day: date, db_session: Session = Depends(db.get_db)):
    return _cash_closing(day, db_session)


@router.put("/cash-closing", response_model=schemas.CashClosingOut)
def update_cash_closing(day: date, payload: schemas.CashClosingUpdate, db_session: Session = Depends(db.get_db)):
    allowed = {str(value) for value in CASH_DENOMINATIONS} | {"coins"}
    if any(key not in allowed or type(value) is not int or value < 0 for key, value in payload.denomination_counts.items()):
        raise HTTPException(status_code=400, detail="Conteo de efectivo inválido")
    closing = db_session.query(models.CashDrawerClosing).filter(models.CashDrawerClosing.business_date == day).first()
    if closing is None:
        closing = models.CashDrawerClosing(business_date=day, denomination_counts=_normalize_cash_counts(payload.denomination_counts))
        db_session.add(closing)
    else:
        closing.denomination_counts = _normalize_cash_counts(payload.denomination_counts)
    db_session.commit()
    return _cash_closing(day, db_session)


@router.get(
    "/summary/daily-payment-methods",
    response_model=schemas.DailyPaymentMethodSummaryOut,
)
def daily_payment_methods(
    day: date,
    db_session: Session = Depends(db.get_db),
):
    totals = _daily_payment_summary(day, db_session)

    return schemas.DailyPaymentMethodSummaryOut(
        date=day,
        cash_total=totals["cash"],
        transfer_total=totals["transfer"],
        dataphone_total=totals["dataphone"],
        total=totals["total"],
    )


@router.get("/summary/daily-payment-methods.xlsx")
def export_daily_payment_methods_xlsx(
    day: date,
    db_session: Session = Depends(db.get_db),
):
    try:
        import openpyxl  # type: ignore
    except Exception:
        raise HTTPException(
            status_code=501,
            detail="Exportar a Excel requiere `openpyxl` instalado en el backend",
        )

    totals = _daily_payment_summary(day, db_session)
    daily_expenses = (
        db_session.query(models.FixedExpensePayment)
        .join(models.FixedExpense)
        .filter(
            models.FixedExpensePayment.status == "manual",
            models.FixedExpensePayment.due_date == day,
        )
        .order_by(models.FixedExpense.name.asc())
        .all()
    )
    openings = db_session.query(models.CashDrawerOpening).filter(
        models.CashDrawerOpening.business_date == day,
    ).all()
    opening_total = sum((Decimal(item.opening_amount) for item in openings), Decimal("0"))
    closing_data = _cash_closing(day, db_session)
    counts = closing_data.denomination_counts
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Cierre de caja"
    styles = openpyxl.styles
    border = styles.Border(**{side: styles.Side(style="thin", color="B7C3BE") for side in ("left", "right", "top", "bottom")})
    money_format = '$ #,##0.00;[Red]-$ #,##0.00;$ "-"'

    def section(row, title, first=1, last=6):
        sheet.merge_cells(start_row=row, start_column=first, end_row=row, end_column=last)
        for col in range(first, last + 1):
            cell = sheet.cell(row, col)
            cell.fill = styles.PatternFill("solid", fgColor="174D3D")
        cell = sheet.cell(row, first, title)
        cell.font = styles.Font(bold=True, color="FFFFFF", size=11)

    def cells(row, values, first=1, total=False):
        for col, value in enumerate(values, first):
            cell = sheet.cell(row, col, value)
            cell.border = border
            cell.alignment = styles.Alignment(vertical="center", wrap_text=True)
            if total:
                cell.fill = styles.PatternFill("solid", fgColor="E8F1ED")
                cell.font = styles.Font(bold=True, color="174D3D")
            if col in (3, 6):
                cell.number_format = money_format

    section(1, "CIERRE DE CAJA DIARIO")
    cells(2, ["Fecha", day.strftime("%d/%m/%Y")])
    sheet.merge_cells("D2:F2")
    sheet["D2"] = "Cajero(a): __________________________"
    section(4, "EFECTIVO RECIBIDO (BILLETES Y MONEDAS)", 1, 3)
    section(4, "RESUMEN DE VENTAS Y MEDIOS DE PAGO", 4, 6)
    cells(5, ["Denominación", "Cantidad", "Total ($)", "Medio de pago", "Comprobante / Ref", "Monto Sistema ($)"], total=True)
    for count_row, denomination in enumerate(CASH_DENOMINATIONS, 6):
        cells(count_row, [denomination, int(counts.get(str(denomination), 0)), f"=A{count_row}*B{count_row}"])
        sheet.cell(count_row, 1).number_format = money_format
    coins_row = 6 + len(CASH_DENOMINATIONS)
    cells(coins_row, ["Monedas", "", int(counts.get("coins", 0))])
    sheet.cell(coins_row, 3).number_format = money_format
    cash_total_row = coins_row + 1
    cells(cash_total_row, ["TOTAL EFECTIVO RECIBIDO", "", f"=SUM(C6:C{coins_row})"], total=True)
    cells(6, ["Ventas en efectivo", "POS Sistema", float(totals["cash"])], 4)
    cells(7, ["Datáfono / tarjetas", "Vouchers / lote", float(totals["dataphone"])], 4)
    cells(8, ["Transferencias", "Bancos / billeteras", float(totals["transfer"])], 4)
    cells(9, ["TOTAL VENTAS REGISTRADAS", "", "=SUM(F6:F8)"], 4, True)
    expenses_header_row = cash_total_row + 2
    section(expenses_header_row, "GASTOS Y SALIDAS DE CAJA")
    cells(expenses_header_row + 1, ["Gasto", "", "", "Concepto / Ref", "", "Monto ($)"], total=True)
    row = expenses_header_row + 2
    expenses_first_row = row
    for expense in daily_expenses:
        cells(row, [expense.fixed_expense.name, "", "", expense.concept or expense.fixed_expense.category or "", "", float(expense.amount)])
        row += 1
    if not daily_expenses:
        cells(row, ["Sin gastos registrados", "", "", "", "", 0])
        row += 1
    expense_total_row = row
    cells(row, ["TOTAL GASTOS CAJA", "", "", "", "", f"=SUM(F{expenses_first_row}:F{row-1})"], total=True)
    row += 2
    section(row, "CONCILIACIÓN FINAL DE CAJA")
    def reconciliation(offset, label, value, total=False):
        r = row + offset
        sheet.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)
        cells(r, [label], total=total)
        cells(r, [value], 6, total)
    reconciliation(1, "Base Inicial (aperturas registradas del día)", float(opening_total) if openings else None)
    reconciliation(2, "Ventas Efectivo", "=F6")
    reconciliation(3, "Gastos registrados del día", f"=F{expense_total_row}")
    reconciliation(4, "Efectivo Esperado en Caja (= Base Inicial + Ventas Efectivo - Gastos)", f'=IF(F{row+1}="","",F{row+1}+F{row+2}-F{row+3})', True)
    reconciliation(5, "Efectivo Real en Caja (conteo físico al cierre)", f"=C{cash_total_row}")
    reconciliation(6, "DIFERENCIA DE CAJA (Real - Esperado)", f'=IF(OR(F{row+5}="",F{row+4}=""),"",F{row+5}-F{row+4})', True)
    section(row+8, "OBSERVACIONES / NOVEDADES DEL TURNO")
    sheet.merge_cells(start_row=row+9, start_column=1, end_row=row+11, end_column=6)
    notes = []
    if not openings:
        notes.append("No hay base inicial registrada para esta fecha; conciliación pendiente.")
    sheet.cell(row+9, 1, " ".join(notes)).alignment = styles.Alignment(wrap_text=True, vertical="top")
    sheet.merge_cells(start_row=row+14, start_column=1, end_row=row+14, end_column=3)
    sheet.cell(row+14, 1, "Firma Cajero(a) / Responsable: __________________")
    sheet.merge_cells(start_row=row+14, start_column=4, end_row=row+14, end_column=6)
    sheet.cell(row+14, 4, "Firma Supervisor / Administrador: __________________")
    for col, width in {"A": 29, "B": 13, "C": 21, "D": 31, "E": 25, "F": 22}.items():
        sheet.column_dimensions[col].width = width
    for r in range(1, row+15):
        sheet.row_dimensions[r].height = 28
    sheet.freeze_panes = "A6"
    sheet.sheet_view.showGridLines = False
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.page_setup.orientation = "landscape"
    sheet.page_setup.paperSize = sheet.PAPERSIZE_A4
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 1
    sheet.print_options.horizontalCentered = True
    sheet.print_area = f"A1:F{row+14}"

    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    filename = f"cierre-caja-{day.isoformat()}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _configured_product_kind(name: str) -> str | None:
    normalized = "".join(c for c in unicodedata.normalize("NFKD", name) if not unicodedata.combining(c))
    normalized = normalized.strip().casefold()
    return {
        "acai personalizado": "cup",
        "vaso 8 oz": "cup",
        "vaso 12 oz": "cup",
        "vaso 16 oz": "cup",
        "bowl personalizado": "bowl",
        "bowl": "bowl",
        "cono personalizado": "cone",
        "cono": "cone",
    }.get(normalized)


def _acai_size(note: str | None) -> str | None:
    match = re.search(r"configurado:\s*vaso\s*(8|12|16)\s*oz\b", note or "", re.IGNORECASE)
    return {"8": "pequeño", "12": "mediano", "16": "grande"}.get(match.group(1)) if match else None


def _configured_base(note: str | None) -> str | None:
    match = re.search(r"base:\s*(yogurt|a[cç]a[ií]|mix)\b", note or "", re.IGNORECASE)
    if not match:
        return None
    normalized = "".join(
        character
        for character in unicodedata.normalize("NFKD", match.group(1))
        if not unicodedata.combining(character)
    ).casefold()
    return {"yogurt": "Yogurt", "acai": "Açaí", "mix": "Mix"}[normalized]


@router.get("/summary/products", response_model=list[schemas.SalesByProductOut])
def sales_by_product(
    period: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    db_session: Session = Depends(db.get_db),
):
    query = (
        db_session.query(
            models.Sale.order_id,
            models.SaleItem.menu_item_id,
            models.SaleItem.name,
            models.SaleItem.category,
            models.SaleItem.unit_price,
            models.SaleItem.quantity,
            models.SaleItem.line_total,
        )
        .join(models.Sale, models.Sale.id == models.SaleItem.sale_id)
    )
    notes_query = (
        db_session.query(models.PosOrderItem)
        .join(models.Sale, models.Sale.order_id == models.PosOrderItem.order_id)
    )
    if bool(from_date) != bool(to_date):
        raise HTTPException(status_code=400, detail="Debes indicar Desde y Hasta")
    if from_date and to_date:
        if from_date > to_date:
            raise HTTPException(status_code=400, detail="La fecha Desde no puede ser posterior a Hasta")
        start_date = datetime.combine(from_date, time.min, tzinfo=COLOMBIA_TZ)
        end_date = datetime.combine(to_date + timedelta(days=1), time.min, tzinfo=COLOMBIA_TZ)
        query = query.filter(models.Sale.created_at >= start_date, models.Sale.created_at < end_date)
        notes_query = notes_query.filter(models.Sale.created_at >= start_date, models.Sale.created_at < end_date)
    else:
        start_date = _period_start(period)
        if start_date is not None:
            query = query.filter(models.Sale.created_at >= start_date)
            notes_query = notes_query.filter(models.Sale.created_at >= start_date)
        if not period or re.fullmatch(r"\d{4}-\d{2}", period):
            end_date = month_bounds(period)[1]
            query = query.filter(models.Sale.created_at < end_date)
            notes_query = notes_query.filter(models.Sale.created_at < end_date)

    # Historical sale lines do not retain the order-line ID or its note.
    # Match their stored attributes without joining and multiplying sale totals.
    sizes = defaultdict(set)
    bases = defaultdict(set)
    for item in notes_query.all():
        if _configured_product_kind(item.name):
            key = (item.order_id, item.menu_item_id, item.unit_price, item.quantity)
            sizes[key].add(_acai_size(item.note))
            bases[key].add(_configured_base(item.note))

    grouped = {}
    for row in query.all():
        name = row.name
        base = None
        kind = _configured_product_kind(name)
        if kind:
            match_key = (row.order_id, row.menu_item_id, row.unit_price, row.quantity)
            size_matches = sizes.get(match_key, set())
            base_matches = bases.get(match_key, set())
            size = next(iter(size_matches)) if len(size_matches) == 1 else None
            base = next(iter(base_matches)) if len(base_matches) == 1 else None
            if kind == "cup":
                name = f"Açaí de vaso {size}" if size else "Açaí personalizado (sin tamaño registrado)"
            elif kind == "bowl":
                name = "Bowl"
            else:
                name = "Cono"
        key = (row.menu_item_id, name, row.category, base)
        if key not in grouped:
            grouped[key] = schemas.SalesByProductOut(
                menu_item_id=row.menu_item_id, name=name, category=row.category,
                base=base, quantity=Decimal("0"), total=Decimal("0"),
            )
        grouped[key].quantity += row.quantity
        grouped[key].total += row.line_total
    return sorted(grouped.values(), key=lambda row: row.total, reverse=True)


@router.get("/summary/tables", response_model=list[schemas.SalesByTableOut])
def sales_by_table(period: str | None = None, db_session: Session = Depends(db.get_db)):
    start_date = _period_start(period)
    query = (
        db_session.query(
            models.PosOrder.table_id,
            models.PosTable.name,
            models.PosTable.is_active,
            func.coalesce(func.count(models.Sale.id), 0).label("quantity"),
            func.coalesce(func.sum(models.Sale.total), 0).label("total"),
        )
        .select_from(models.Sale)
        .join(models.PosOrder, models.PosOrder.id == models.Sale.order_id)
        .outerjoin(models.PosTable, models.PosTable.id == models.PosOrder.table_id)
        .group_by(models.PosOrder.table_id, models.PosTable.name, models.PosTable.is_active)
        .order_by(func.sum(models.Sale.total).desc())
    )
    if start_date is not None:
        query = query.filter(models.Sale.created_at >= start_date)
    if not period or re.fullmatch(r"\d{4}-\d{2}", period):
        query = query.filter(models.Sale.created_at < month_bounds(period)[1])
    rows = query.all()
    return [
        schemas.SalesByTableOut(
            table_id=row.table_id,
            name=row.name,
            is_active=row.is_active,
            quantity=row.quantity,
            total=row.total,
        )
        for row in rows
    ]


@router.get("/summary/adjustments/monthly", response_model=list[schemas.SalesAdjustmentsByMonthOut])
def sales_adjustments_by_month(
    period: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    db_session: Session = Depends(db.get_db),
):
    start_date = _period_start(period)
    courtesy_count = func.coalesce(
        func.sum(case((models.PosOrderItem.courtesy.is_(True), 1), else_=0)),
        0,
    ).label("courtesy_count")
    discount_count = func.coalesce(
        func.sum(case((models.PosOrderItem.discount_amount > 0, 1), else_=0)),
        0,
    ).label("discount_count")

    base_query = (
        db_session.query(courtesy_count, discount_count)
        .select_from(models.Sale)
        .join(models.PosOrder, models.PosOrder.id == models.Sale.order_id)
        .outerjoin(models.PosOrderItem, models.PosOrderItem.order_id == models.PosOrder.id)
    )

    if bool(from_date) != bool(to_date):
        raise HTTPException(status_code=400, detail="Debes indicar Desde y Hasta")
    if from_date and to_date:
        if from_date > to_date:
            raise HTTPException(status_code=400, detail="La fecha Desde no puede ser posterior a Hasta")
        start_date = datetime.combine(from_date, time.min, tzinfo=COLOMBIA_TZ)
        end_date = datetime.combine(to_date + timedelta(days=1), time.min, tzinfo=COLOMBIA_TZ)
    elif not period or re.fullmatch(r"\d{4}-\d{2}", period):
        selected_start, selected_end = month_bounds(period)
        row = (
            base_query
            .filter(models.Sale.created_at >= selected_start)
            .filter(models.Sale.created_at < selected_end)
            .one()
        )
        return [
            schemas.SalesAdjustmentsByMonthOut(
                year=selected_start.year,
                month=selected_start.month,
                courtesy_count=int(row.courtesy_count or 0),
                discount_count=int(row.discount_count or 0),
            )
        ]
    else:
        end_date = None

    year_expr = func.extract("year", models.Sale.created_at)
    month_expr = func.extract("month", models.Sale.created_at)
    query = (
        db_session.query(year_expr.label("year"), month_expr.label("month"), courtesy_count, discount_count)
        .select_from(models.Sale)
        .join(models.PosOrder, models.PosOrder.id == models.Sale.order_id)
        .outerjoin(models.PosOrderItem, models.PosOrderItem.order_id == models.PosOrder.id)
        .group_by(year_expr, month_expr)
        .order_by(year_expr.desc(), month_expr.desc())
    )
    if start_date is not None:
        query = query.filter(models.Sale.created_at >= start_date)
    if end_date is not None:
        query = query.filter(models.Sale.created_at < end_date)
    rows = query.all()
    return [
        schemas.SalesAdjustmentsByMonthOut(
            year=int(row.year or 0),
            month=int(row.month or 0),
            courtesy_count=int(row.courtesy_count or 0),
            discount_count=int(row.discount_count or 0),
        )
        for row in rows
    ]


@router.get("/cash-closing.pdf")
def export_cash_closing_pdf(day: date, db_session: Session = Depends(db.get_db)):
    try:
        from reportlab.lib.pagesizes import A4  # type: ignore
        from reportlab.pdfgen import canvas  # type: ignore
    except Exception:
        raise HTTPException(status_code=501, detail="Exportar a PDF requiere `reportlab` instalado en el backend")
    closing = _cash_closing(day, db_session)
    daily_expenses = (
        db_session.query(models.FixedExpensePayment)
        .join(models.FixedExpense)
        .filter(
            models.FixedExpensePayment.status == "manual",
            models.FixedExpensePayment.due_date == day,
        )
        .order_by(models.FixedExpense.name.asc(), models.FixedExpensePayment.id.asc())
        .all()
    )
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4)
    y = 800
    def line(text: str, bold: bool = False):
        nonlocal y
        for chunk in wrap(str(text), width=100) or [""]:
            if y < 55:
                pdf.showPage()
                y = 800
            pdf.setFont("Helvetica-Bold" if bold else "Helvetica", 11 if bold else 9)
            pdf.drawString(42, y, chunk)
            y -= 18
    line("CIERRE DE CAJA", True); line(f"Día: {day.strftime('%d/%m/%Y')}")
    line("EFECTIVO RECIBIDO (BILLETES Y MONEDAS)", True)
    for denomination in CASH_DENOMINATIONS:
        quantity = closing.denomination_counts[str(denomination)]
        line(f"${denomination:,.0f}: {quantity}  =  ${denomination * quantity:,.0f}")
    line(f"Monedas: ${closing.denomination_counts['coins']:,.0f}")
    line(f"Efectivo real contado: ${closing.physical_cash:,.0f}", True)
    line("RESUMEN DE VENTAS Y MEDIOS DE PAGO", True)
    line(f"Efectivo: ${closing.cash_total:,.0f}"); line(f"Datáfono: ${closing.dataphone_total:,.0f}"); line(f"Transferencias: ${closing.transfer_total:,.0f}")
    line("GASTOS Y SALIDAS DE CAJA", True)
    if daily_expenses:
        for index, expense in enumerate(daily_expenses, 1):
            concept = expense.concept or expense.fixed_expense.category or "Sin concepto"
            line(f"{index}. {expense.fixed_expense.name}", True)
            line(f"   Concepto / Ref: {concept}    Monto: ${Decimal(expense.amount):,.0f}")
    else:
        line("Sin gastos registrados")
    line(f"TOTAL GASTOS CAJA: ${closing.expenses_total:,.0f}", True)
    line("CONCILIACIÓN FINAL DE CAJA", True); line(f"Base inicial: ${closing.opening_total:,.0f}"); line(f"Efectivo esperado: ${closing.expected_cash:,.0f}"); line(f"Diferencia: ${closing.difference:,.0f}")
    line("OBSERVACIONES / NOVEDADES DEL TURNO", True); line("_______________________________________________")
    pdf.save(); output.seek(0)
    return Response(content=output.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="cierre-caja-{day.isoformat()}.pdf"'})


@router.get("/{sale_id}", response_model=schemas.SaleOut)
def get_sale(sale_id: int, db_session: Session = Depends(db.get_db)):
    sale = db_session.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return sale
