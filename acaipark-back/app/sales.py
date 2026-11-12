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
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from . import db, models, schemas
from .reporting_periods import month_bounds
from .profit_loss import build_statement

router = APIRouter(prefix="/sales", tags=["sales"])
COLOMBIA_TZ = ZoneInfo("America/Bogota")
CASH_DENOMINATIONS = (100000, 50000, 20000, 10000, 5000, 2000)
COIN_DENOMINATIONS = (1000, 500, 200, 100, 50)


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
    if bool(from_date) != bool(to_date):
        raise HTTPException(status_code=400, detail="Debes indicar Desde y Hasta")
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
        .filter(models.Sale.created_at >= start, models.Sale.created_at < end, models.Sale.status == "active")
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
    for value in COIN_DENOMINATIONS:
        counts[str(value)] = max(0, int(raw_counts.get(str(value), 0) or 0))
    legacy_total = max(0, int(raw_counts.get("coins", 0) or 0))
    if legacy_total and not any(str(value) in raw_counts for value in COIN_DENOMINATIONS):
        counts["50"] += legacy_total // 50
    counts["coins"] = sum(
        value * counts[str(value)] for value in COIN_DENOMINATIONS
    )
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
            models.Sale.status == "active",
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
    allowed = {str(value) for value in CASH_DENOMINATIONS} | {str(value) for value in COIN_DENOMINATIONS} | {"coins"}
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
        .outerjoin(models.FixedExpense)
        .filter(
            models.FixedExpensePayment.status == "manual",
            models.FixedExpensePayment.due_date == day,
        )
        .order_by(models.FixedExpense.name.asc(), models.FixedExpensePayment.id.asc())
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
    for count_row, denomination in enumerate(CASH_DENOMINATIONS + COIN_DENOMINATIONS, 6):
        cells(count_row, [denomination, int(counts.get(str(denomination), 0)), f"=A{count_row}*B{count_row}"])
        sheet.cell(count_row, 1).number_format = money_format
    cash_total_row = 6 + len(CASH_DENOMINATIONS) + len(COIN_DENOMINATIONS)
    cells(cash_total_row, ["TOTAL EFECTIVO RECIBIDO", "", f"=SUM(C6:C{cash_total_row - 1})"], total=True)
    cells(6, ["Ventas en efectivo", "POS Sistema", float(totals["cash"])], 4)
    cells(7, ["Datáfono / tarjetas", "Vouchers / lote", float(totals["dataphone"])], 4)
    cells(8, ["Transferencias", "Bancos / billeteras", float(totals["transfer"])], 4)
    cells(9, ["TOTAL VENTAS REGISTRADAS", "", "=SUM(F6:F8)"], 4, True)
    expenses_header_row = cash_total_row + 2
    section(expenses_header_row, "GASTOS Y SALIDAS DE CAJA")
    cells(expenses_header_row + 1, ["Gasto", "", "", "Concepto / Ref", "", "Monto ($)"], total=True)
    sheet.merge_cells(start_row=expenses_header_row + 1, start_column=1, end_row=expenses_header_row + 1, end_column=3)
    sheet.merge_cells(start_row=expenses_header_row + 1, start_column=4, end_row=expenses_header_row + 1, end_column=5)
    row = expenses_header_row + 2
    expenses_first_row = row
    for expense in daily_expenses:
        catalog_entry = expense.fixed_expense
        cells(row, [
            catalog_entry.name if catalog_entry else f"Gasto #{expense.fixed_expense_id}", "", "",
            expense.concept or (catalog_entry.category if catalog_entry else "") or "", "", float(expense.amount),
        ])
        sheet.merge_cells(start_row=row, start_column=1, end_row=row, end_column=3)
        sheet.merge_cells(start_row=row, start_column=4, end_row=row, end_column=5)
        row += 1
    if not daily_expenses:
        cells(row, ["Sin gastos registrados", "", "", "", "", 0])
        sheet.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
        row += 1
    expense_total_row = row
    cells(row, ["TOTAL GASTOS CAJA", "", "", "", "", f"=SUM(F{expenses_first_row}:F{row - 1})"], total=True)
    sheet.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
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


@router.get("/pl-statement", response_model=schemas.ProfitLossStatementOut)
def get_pl_statement(month: str, db_session: Session = Depends(db.get_db)):
    return build_statement(month, db_session)


@router.get("/pl-statement.xlsx")
def export_pl_statement_xlsx(
    month: str,
    db_session: Session = Depends(db.get_db),
):
    try:
        import openpyxl  # type: ignore
    except Exception:
        raise HTTPException(
            status_code=501,
            detail="Exportar a Excel requiere `openpyxl` instalado en el backend",
        )
    statement = build_statement(month, db_session)
    start, _ = month_bounds(month)

    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "PyG Acai Park"
    styles = openpyxl.styles
    thin = styles.Side(style="thin", color="B7C3BE")
    border = styles.Border(left=thin, right=thin, top=thin, bottom=thin)
    money_format = '$ #,##0;[Red]-$ #,##0;$ "-"'
    percent_format = "0.0%"
    dark_green = "174D3D"
    total_fill = styles.PatternFill("solid", fgColor="E8F1ED")
    auto_fill = styles.PatternFill("solid", fgColor="EAF3FB")
    editable_fill = styles.PatternFill("solid", fgColor="FFFDE7")

    sheet.merge_cells("B2:E2")
    title = sheet["B2"]
    title.value = "Estado de Resultados Mensual (PyG Proforma - Açaí Park)"
    title.font = styles.Font(bold=True, size=14, color=dark_green)
    title.alignment = styles.Alignment(horizontal="center", vertical="center")

    sheet.merge_cells("B3:E3")
    period = sheet["B3"]
    period.value = f"Periodo: {datetime(start.year, start.month, 1).strftime('%m/%Y')}"
    period.font = styles.Font(bold=True, size=10, color="555555")
    period.alignment = styles.Alignment(horizontal="center")

    header = sheet.cell(4, 2, "Cuenta / Concepto")
    header_value = sheet.cell(4, 3, "Valor (COP)")
    header_percent = sheet.cell(4, 5, "% sobre Ventas")
    for cell in (header, header_value, header_percent):
        cell.fill = styles.PatternFill("solid", fgColor=dark_green)
        cell.font = styles.Font(bold=True, color="FFFFFF")
        cell.border = border
    sheet.merge_cells(start_row=4, start_column=3, end_row=4, end_column=4)

    def write_row(row: int, label: str, col: str, value, kind: str = "line", auto: bool = False) -> None:
        label_cell = sheet.cell(row, 2, label)
        value_cell = sheet.cell(row, 3 if col == "C" else 4, value)
        percent_cell = sheet.cell(row, 5, f'=IF($D$5=0,"",{col}{row}/$D$5)')
        for cell in (label_cell, value_cell, percent_cell):
            cell.border = border
        value_cell.number_format = money_format
        percent_cell.number_format = percent_format
        if kind == "total":
            label_cell.font = styles.Font(bold=True, color=dark_green)
            value_cell.fill = total_fill
            value_cell.font = styles.Font(bold=True, color=dark_green)
        else:
            value_cell.fill = auto_fill if auto else editable_fill

    for row in statement.rows:
        write_row(
            row.excel_row, row.concept, row.column,
            row.formula if row.formula else float(row.amount),
            kind="total" if row.total else "line", auto=row.automatic,
        )

    note_row = 33
    sheet.merge_cells(start_row=note_row, start_column=2, end_row=note_row, end_column=5)
    note = sheet.cell(note_row, 2)
    note.value = (
        "Todos los gastos registrados del período se incluyen una sola vez. "
        "Consulta su asignación y la conciliación en la hoja Control de gastos. "
        + " ".join(statement.warnings)
    )
    note.font = styles.Font(italic=True, size=9, color="777777")
    note.alignment = styles.Alignment(wrap_text=True, vertical="top")
    sheet.row_dimensions[note_row].height = max(60, 12 * (len(note.value) // 95 + 2))

    for col, width in {"B": 52, "C": 15, "D": 15, "E": 13}.items():
        sheet.column_dimensions[col].width = width
    sheet.column_dimensions["A"].width = 3
    sheet.freeze_panes = "A5"
    sheet.sheet_view.showGridLines = False
    sheet.page_setup.orientation = "landscape"
    sheet.page_setup.paperSize = sheet.PAPERSIZE_A4
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.print_options.horizontalCentered = True
    sheet.print_area = f"B2:E{note_row}"

    control = workbook.create_sheet("Control de gastos")
    control.append(["Conciliación de gastos", month])
    control.append(["Gastos registrados", float(statement.expenses_total)])
    control.append(["Gastos incluidos en PyG", float(statement.expenses_included)])
    control.append(["Diferencia", "=B2-B3"])
    control.append(["Cantidad de registros", statement.expense_count])
    control.append([])
    control.append(["Gasto", "Categoría", "Renglón del PyG", "Registros", "Importe (COP)", "Clasificación"])
    for group in statement.expense_breakdown:
        control.append([
            group.name, group.category, group.target_concept, group.count,
            float(group.amount), "Revisar clasificación" if group.needs_classification else "Identificada",
        ])
    for cell in control[7]:
        cell.fill = styles.PatternFill("solid", fgColor=dark_green)
        cell.font = styles.Font(bold=True, color="FFFFFF")
    for row in control.iter_rows(min_row=8):
        row[4].number_format = money_format
        for cell in row:
            cell.alignment = styles.Alignment(vertical="top", wrap_text=True)
    for row in (2, 3, 4):
        control.cell(row, 2).number_format = money_format
    for column, width in {"A": 34, "B": 22, "C": 58, "D": 12, "E": 20, "F": 24}.items():
        control.column_dimensions[column].width = width
    control.freeze_panes = "A8"
    control.auto_filter.ref = f"A7:F{max(7, control.max_row)}"
    control.sheet_view.showGridLines = False

    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    filename = f"estado-pyg-{month}.xlsx"
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
    query = query.filter(models.Sale.status == "active")
    notes_query = notes_query.filter(models.Sale.status == "active")
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
        key = (row.menu_item_id, name, base)
        if key not in grouped:
            grouped[key] = schemas.SalesByProductOut(
                menu_item_id=row.menu_item_id, name=name,
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
    query = query.filter(models.Sale.status == "active")
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
            .filter(models.Sale.status == "active")
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

    reporting_time = models.Sale.created_at
    dialect = db_session.get_bind().dialect.name
    if dialect == "postgresql":
        reporting_time = func.timezone("America/Bogota", reporting_time)
    if dialect == "sqlite":
        # SQLite strftime() rounds 23:59:59.999999 into the following day.
        year_expr = func.substr(reporting_time, 1, 4)
        month_expr = func.substr(reporting_time, 6, 2)
    else:
        year_expr = func.extract("year", reporting_time)
        month_expr = func.extract("month", reporting_time)
    query = (
        db_session.query(year_expr.label("year"), month_expr.label("month"), courtesy_count, discount_count)
        .select_from(models.Sale)
        .join(models.PosOrder, models.PosOrder.id == models.Sale.order_id)
        .outerjoin(models.PosOrderItem, models.PosOrderItem.order_id == models.PosOrder.id)
        .group_by(year_expr, month_expr)
        .order_by(year_expr.desc(), month_expr.desc())
    )
    query = query.filter(models.Sale.status == "active")
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
        from reportlab.lib import colors  # type: ignore
        from reportlab.lib.utils import simpleSplit  # type: ignore
        from reportlab.pdfgen import canvas  # type: ignore
    except Exception:
        raise HTTPException(status_code=501, detail="Exportar a PDF requiere `reportlab` instalado en el backend")
    closing = _cash_closing(day, db_session)
    page_w, page_h = A4
    left, right = 42, page_w - 42
    content_w = right - left

    dark_blue = colors.HexColor("#163c62")
    green = colors.HexColor("#1e7a4f")
    amber = colors.HexColor("#b45309")
    red = colors.HexColor("#b3261e")
    muted = colors.HexColor("#5a6572")
    text_dark = colors.HexColor("#1b2432")
    light_blue = colors.HexColor("#e8eff7")
    light_green = colors.HexColor("#e2f1e8")
    light_amber = colors.HexColor("#fbeed9")
    light_red = colors.HexColor("#f8e3e2")
    line_gray = colors.HexColor("#ccd3da")
    soft_gray = colors.HexColor("#c8d6e4")
    white = colors.white

    y = page_h - 40

    def _render(pdf_obj) -> None:
        nonlocal y
        y = page_h - 40

        def section(title: str, color) -> None:
            nonlocal y
            pdf_obj.setFillColor(color)
            pdf_obj.rect(left, y - 17, content_w, 17, stroke=0, fill=1)
            pdf_obj.setFont("Helvetica-Bold", 8)
            pdf_obj.setFillColor(white)
            pdf_obj.drawString(left + 6, y - 12, title)
            y -= 24

        def text(content, bold: bool = False, size: int = 7.5, color=None, indent: int = 0, gap: int = 11) -> None:
            nonlocal y
            font = "Helvetica-Bold" if bold else "Helvetica"
            pdf_obj.setFont(font, size)
            pdf_obj.setFillColor(color or text_dark)
            for chunk in simpleSplit(str(content), font, size, content_w - indent) or [""]:
                pdf_obj.drawString(left + indent, y, chunk)
                y -= gap

        def row(label: str, value: str, bg, fg, size: int = 10, label_size: int = 8) -> None:
            nonlocal y
            pdf_obj.setFillColor(text_dark)
            pdf_obj.setFont("Helvetica-Bold", label_size)
            pdf_obj.drawString(left + 4, y, label)
            pdf_obj.setFont("Helvetica-Bold", size)
            tw = pdf_obj.stringWidth(value, "Helvetica-Bold", size)
            box_w = tw + 14
            box_h = size + 7
            box_x = right - box_w - 4
            pdf_obj.setFillColor(bg)
            pdf_obj.rect(box_x, y - box_h + 5, box_w, box_h, stroke=0, fill=1)
            pdf_obj.setFillColor(fg)
            pdf_obj.drawString(box_x + 7, y - box_h + 9, value)
            y -= box_h + 6

        # ---- Encabezado ----
        pdf_obj.setFillColor(dark_blue)
        pdf_obj.rect(left, y - 22, content_w, 22, stroke=0, fill=1)
        pdf_obj.setFont("Helvetica-Bold", 14)
        pdf_obj.setFillColor(white)
        pdf_obj.drawString(left + 8, y - 16, "CIERRE DE CAJA")
        pdf_obj.setFont("Helvetica-Bold", 9)
        pdf_obj.setFillColor(soft_gray)
        pdf_obj.drawRightString(right - 8, y - 16, f"CIERRE DEL DÍA: {day.strftime('%d/%m/%Y')}")
        y -= 34

        # ---- Fecha y base inicial ----
        pdf_obj.setFont("Helvetica-Bold", 9)
        pdf_obj.setFillColor(text_dark)
        pdf_obj.drawString(left, y, f"Día: {day.strftime('%d/%m/%Y')}")
        y -= 18
        pdf_obj.setFillColor(light_amber)
        pdf_obj.rect(left, y - 16, content_w, 16, stroke=0, fill=1)
        pdf_obj.setFont("Helvetica-Bold", 9)
        pdf_obj.setFillColor(amber)
        pdf_obj.drawString(left + 6, y - 11, "Base inicial  (apertura de caja):")
        pdf_obj.drawRightString(right - 6, y - 11, f"$ {closing.opening_total:,.0f}")
        y -= 24

        # ---- Efectivo recibido: billetes y monedas ----
        section("EFECTIVO RECIBIDO (BILLETES Y MONEDAS)", green)
        for denomination in CASH_DENOMINATIONS:
            quantity = closing.denomination_counts[str(denomination)]
            text(f"$ {denomination:,.0f}:  {quantity}  =  $ {denomination * quantity:,.0f}", gap=10)
        text("MONEDAS", bold=True, color=muted, gap=10)
        for denomination in COIN_DENOMINATIONS:
            quantity = closing.denomination_counts[str(denomination)]
            text(f"   $ {denomination:,.0f}:  {quantity}  =  $ {denomination * quantity:,.0f}", indent=8, gap=10)
        text(f"Total monedas:  $ {closing.denomination_counts['coins']:,.0f}", bold=True, color=muted, gap=12)
        row("Efectivo real contado", f"$ {closing.physical_cash:,.0f}", green, white, size=10)

        # ---- Resumen de ventas ----
        section("RESUMEN DE VENTAS Y MEDIOS DE PAGO", dark_blue)
        text("Efectivo (ventas del día, base del esperado):", bold=True, gap=10)
        row("Ventas en efectivo", f"$ {closing.cash_total:,.0f}", light_blue, dark_blue, size=10)
        text(f"Datáfono:  $ {closing.dataphone_total:,.0f}", gap=10)
        text(f"Transferencias:  $ {closing.transfer_total:,.0f}", gap=10)
        row("Total ventas registradas", f"$ {closing.total:,.0f}", dark_blue, white, size=10)

        # ---- Conciliación final ----
        section("CONCILIACIÓN FINAL DE CAJA", dark_blue)
        text("Efectivo esperado = Base inicial + Ventas en efectivo − Gastos del día", bold=True, size=7, color=muted, gap=10)
        text(f"  $ {closing.opening_total:,.0f}  +  $ {closing.cash_total:,.0f}  −  $ {closing.expenses_total:,.0f}", size=8, indent=8, gap=16)
        row("Efectivo esperado", f"$ {closing.expected_cash:,.0f}", light_blue, dark_blue, size=11)
        row("Efectivo real contado", f"$ {closing.physical_cash:,.0f}", light_green, green, size=11)
        sign = "-$ " if closing.difference < 0 else "$ "
        row("Diferencia  (real − esperado)", f"{sign}{abs(closing.difference):,.0f}",
            light_red if closing.difference < 0 else light_green,
            red if closing.difference < 0 else green, size=11)

        # ---- Observaciones ----
        section("OBSERVACIONES / NOVEDADES DEL TURNO", muted)
        text("El efectivo esperado usa únicamente ventas pagadas en efectivo y gastos registrados del día.")
        pdf_obj.setStrokeColor(line_gray)
        pdf_obj.setLineWidth(0.8)
        pdf_obj.line(left, y, right, y)
        y -= 22
        pdf_obj.setFont("Helvetica", 8)
        pdf_obj.setFillColor(text_dark)
        pdf_obj.drawString(left, y, "Firma Cajero(a)/Responsable:  ______________________________")
        y -= 14
        pdf_obj.drawString(left, y, "Firma Administrador/Supervisor:  ____________________________")

    measure_out = BytesIO()
    measure_pdf = canvas.Canvas(measure_out, pagesize=A4)
    _render(measure_pdf)
    content_height = (page_h - 40) - y
    available_height = page_h - 60
    scale = min(1.0, available_height / content_height) if content_height > 0 else 1.0

    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4)
    if scale < 1.0:
        pdf.translate(0, page_h)
        pdf.scale(scale, scale)
        pdf.translate(0, -page_h)
    _render(pdf)
    pdf.save()
    output.seek(0)
    return Response(content=output.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="cierre-caja-{day.isoformat()}.pdf"'})


@router.get("/{sale_id}", response_model=schemas.SaleOut)
def get_sale(sale_id: int, db_session: Session = Depends(db.get_db)):
    sale = db_session.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return sale
