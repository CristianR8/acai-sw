from __future__ import annotations

from collections import defaultdict
import re
import unicodedata

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from io import BytesIO
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import case, func, literal
from sqlalchemy.orm import Session

from . import db, models, schemas
from .reporting_periods import month_bounds

router = APIRouter(prefix="/sales", tags=["sales"])
COLOMBIA_TZ = ZoneInfo("America/Bogota")


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
def list_sales(period: str | None = None, db_session: Session = Depends(db.get_db)):
    query = db_session.query(models.Sale)
    start_date = _period_start(period)
    if start_date is not None:
        query = query.filter(models.Sale.created_at >= start_date)
    if not period or re.fullmatch(r"\d{4}-\d{2}", period):
        query = query.filter(models.Sale.created_at < month_bounds(period)[1])
    return query.order_by(models.Sale.id.desc()).all()


@router.get("/{sale_id}", response_model=schemas.SaleOut)
def get_sale(sale_id: int, db_session: Session = Depends(db.get_db)):
    sale = db_session.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return sale


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
    start = datetime.combine(day, time.min, tzinfo=COLOMBIA_TZ)
    cash_sales = db_session.query(models.Sale).filter(
        models.Sale.created_at >= start,
        models.Sale.created_at < start + timedelta(days=1),
        func.coalesce(models.Sale.payment_method, "cash") == "cash",
    ).all()
    openings = db_session.query(models.CashDrawerOpening).filter(
        models.CashDrawerOpening.business_date == day,
    ).all()
    opening_total = sum((Decimal(item.opening_amount) for item in openings), Decimal("0"))
    counts = defaultdict(int)
    for sale in cash_sales:
        for denomination, quantity in (sale.cash_denominations or {}).items():
            counts[int(denomination)] += quantity
    missing = sum(sale.cash_denominations is None for sale in cash_sales)

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
    cells(5, ["Denominación", "Cantidad", "Total ($)", "Medio de Pago", "Comprobante / Ref", "Monto Sistema ($)"], total=True)
    for row, denomination in enumerate([100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50], 6):
        cells(row, [denomination, counts[denomination], f"=A{row}*B{row}"])
        sheet.cell(row, 1).number_format = money_format
    cells(17, ["TOTAL EFECTIVO RECIBIDO", "", "=SUM(C6:C16)"], total=True)
    cells(6, ["Ventas en Efectivo", "POS Sistema", float(totals["cash"])], 4)
    cells(7, ["Datáfono / Tarjetas", "Vouchers / Lote", float(totals["dataphone"])], 4)
    cells(8, ["Transferencias", "Bancos / billeteras", float(totals["transfer"])], 4)
    cells(9, ["TOTAL VENTAS REGISTRADAS", "", "=SUM(F6:F8)"], 4, True)
    section(11, "GASTOS Y SALIDAS DE CAJA", 4, 6)
    cells(12, ["Gasto", "Concepto / Ref", "Monto ($)"], 4, True)
    row = 13
    for expense in daily_expenses:
        cells(row, [expense.fixed_expense.name, expense.concept or expense.fixed_expense.category or "", float(expense.amount)], 4)
        row += 1
    if not daily_expenses:
        cells(row, ["Sin gastos registrados", "", 0], 4)
        row += 1
    expense_total_row = row
    cells(row, ["TOTAL GASTOS CAJA", "", f"=SUM(F13:F{row-1})"], 4, True)
    row = max(row, 17) + 2
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
    reconciliation(5, "Efectivo Real en Caja (conteo físico al cierre)", None)
    sheet.cell(row+5, 6).fill = styles.PatternFill("solid", fgColor="FFF2CC")
    reconciliation(6, "DIFERENCIA DE CAJA (Real - Esperado)", f'=IF(OR(F{row+5}="",F{row+4}=""),"",F{row+5}-F{row+4})', True)
    section(row+8, "OBSERVACIONES / NOVEDADES DEL TURNO")
    sheet.merge_cells(start_row=row+9, start_column=1, end_row=row+11, end_column=6)
    notes = ["Las denominaciones corresponden al efectivo recibido en pagos; no descuentan cambio ni gastos. Registre el conteo físico final en la celda amarilla."]
    if missing:
        notes.append(f"{missing} pago(s) en efectivo sin desglose de denominaciones; no se incluyen en el total recibido por denominación.")
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


def _is_custom_acai(name: str) -> bool:
    normalized = "".join(c for c in unicodedata.normalize("NFKD", name) if not unicodedata.combining(c))
    return normalized.strip().casefold() == "acai personalizado"


def _acai_size(note: str | None) -> str | None:
    match = re.search(r"configurado:\s*vaso\s*(8|12|16)\s*oz\b", note or "", re.IGNORECASE)
    return {"8": "pequeño", "12": "mediano", "16": "grande"}.get(match.group(1)) if match else None


@router.get("/summary/products", response_model=list[schemas.SalesByProductOut])
def sales_by_product(period: str | None = None, db_session: Session = Depends(db.get_db)):
    start_date = _period_start(period)
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
    for item in notes_query.all():
        if _is_custom_acai(item.name):
            key = (item.order_id, item.menu_item_id, item.unit_price, item.quantity)
            sizes[key].add(_acai_size(item.note))

    grouped = {}
    for row in query.all():
        name = row.name
        if _is_custom_acai(name):
            matches = sizes.get((row.order_id, row.menu_item_id, row.unit_price, row.quantity), set())
            size = next(iter(matches)) if len(matches) == 1 else None
            name = f"Açaí de vaso {size}" if size else "Açaí personalizado (sin tamaño registrado)"
        key = (row.menu_item_id, name, row.category)
        if key not in grouped:
            grouped[key] = schemas.SalesByProductOut(
                menu_item_id=row.menu_item_id, name=name, category=row.category,
                quantity=Decimal("0"), total=Decimal("0"),
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
    db_session: Session = Depends(db.get_db),
):
    start_date = _period_start(period)
    if not period or re.fullmatch(r"\d{4}-\d{2}", period):
        selected_start, _ = month_bounds(period)
        year_expr = literal(selected_start.year)
        month_expr = literal(selected_start.month)
    else:
        year_expr = func.extract("year", models.Sale.created_at)
        month_expr = func.extract("month", models.Sale.created_at)

    query = (
        db_session.query(
            year_expr.label("year"),
            month_expr.label("month"),
            func.coalesce(
                func.sum(case((models.PosOrderItem.courtesy.is_(True), 1), else_=0)),
                0,
            ).label("courtesy_count"),
            func.coalesce(
                func.sum(case((models.PosOrderItem.discount_amount > 0, 1), else_=0)),
                0,
            ).label("discount_count"),
        )
        .select_from(models.Sale)
        .join(models.PosOrder, models.PosOrder.id == models.Sale.order_id)
        .outerjoin(models.PosOrderItem, models.PosOrderItem.order_id == models.PosOrder.id)
        .group_by(year_expr, month_expr)
        .order_by(year_expr.desc(), month_expr.desc())
    )
    if start_date is not None:
        query = query.filter(models.Sale.created_at >= start_date)
    if not period or re.fullmatch(r"\d{4}-\d{2}", period):
        query = query.filter(models.Sale.created_at < month_bounds(period)[1])
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
