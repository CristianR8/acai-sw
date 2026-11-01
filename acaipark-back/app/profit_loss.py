"""Monthly statement shared by the admin screen and its Excel export."""
from collections import defaultdict
from decimal import Decimal
import re
import unicodedata

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models, schemas
from .reporting_periods import month_bounds


def _norm_key(value: str | None) -> str:
    text = (value or "").strip().casefold()
    text = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^\w\s]", " ", text).split())


def _expense_row(name: str | None, category: str | None, expense_type: str | None) -> tuple[int, bool]:
    """Assign every payment once; unknown concepts remain visible in Others."""
    keys = {_norm_key(name), _norm_key(category)}
    groups = (
        (20, {"local", "arriendo", "arriendo del local", "alquiler", "alquiler del local"}),
        (21, {"nomina", "nomina de cajero", "personal de seguridad"}),
        (22, {"servicios", "servicios publicos", "internet", "servicio de luz", "servicio de agua", "servicio de gas"}),
        (24, {"seguros", "seguro", "poliza de inventario"}),
        (13, {"desechables", "empaques", "desechables y empaques"}),
        (14, {"comisiones", "comisiones por medios de pago", "comisiones por medios de pago datafono", "comision datafono", "comisiones datafono"}),
        (15, {"domicilio", "domicilios", "flete", "fletes", "fletes y domicilios", "flete compra de productos", "transporte"}),
        (23, {"marketing", "publicidad", "marketing y publicidad"}),
        (27, {"imprevistos", "mantenimiento", "imprevistos y mantenimiento"}),
        (30, {"impuesto", "impuestos", "monotributo", "impuesto monotributo otros"}),
    )
    for row, aliases in groups:
        if keys & aliases:
            return row, False
    if expense_type == "operacional_fijo":
        return 25, False
    if expense_type == "operacional_variable":
        return 16, False
    return 16, True


def build_statement(month: str, db_session: Session) -> schemas.ProfitLossStatementOut:
    start, end = month_bounds(month)
    sales_count, sales_total, sales_taxes, sales_service = db_session.query(
        func.count(models.Sale.id), func.coalesce(func.sum(models.Sale.total), 0),
        func.coalesce(func.sum(models.Sale.tax_total), 0),
        func.coalesce(func.sum(models.Sale.service_total), 0),
    ).filter(
        models.Sale.created_at >= start, models.Sale.created_at < end,
        models.Sale.status == "active",
    ).one()
    sales = Decimal(sales_total or 0)
    purchase_date = func.coalesce(models.Purchase.purchased_at, models.Purchase.received_at, models.Purchase.created_at)
    purchase_rows = db_session.query(
        models.Purchase.id, models.Purchase.total_cost,
        func.count(models.PurchaseItem.id).label("item_count"),
        func.coalesce(func.sum(models.PurchaseItem.line_total), 0).label("detail_total"),
    ).outerjoin(models.PurchaseItem, models.PurchaseItem.purchase_id == models.Purchase.id).filter(
        purchase_date >= start, purchase_date < end, models.Purchase.status != "void",
    ).group_by(models.Purchase.id, models.Purchase.total_cost).all()
    purchases = Decimal(0)
    inconsistent_purchases = []
    for purchase in purchase_rows:
        header = Decimal(purchase.total_cost or 0)
        detail = Decimal(purchase.detail_total or 0)
        # The purchase history uses total_cost. Preserve legacy line-only data
        # when its header was left at zero, and surface every discrepancy.
        purchases += detail if header == 0 and detail != 0 else header
        if not purchase.item_count or header != detail:
            inconsistent_purchases.append(purchase.id)

    payments = db_session.query(models.FixedExpensePayment, models.FixedExpense.name, models.FixedExpense.category).outerjoin(
        models.FixedExpense, models.FixedExpense.id == models.FixedExpensePayment.fixed_expense_id,
    ).filter(
        models.FixedExpensePayment.status == "manual",
        models.FixedExpensePayment.due_date >= start.date(),
        models.FixedExpensePayment.due_date < end.date(),
    ).order_by(models.FixedExpensePayment.id).all()
    expenses = defaultdict(lambda: Decimal(0))
    breakdown = {}
    unclassified_count = 0
    expenses_total = Decimal(0)
    for payment, name, category in payments:
        row, unclassified = _expense_row(name, category, payment.expense_type)
        amount = Decimal(payment.amount)
        expenses[row] += amount
        expenses_total += amount
        unclassified_count += int(unclassified)
        key = (payment.fixed_expense_id, name, category, row, unclassified)
        group = breakdown.setdefault(key, schemas.ProfitLossExpenseGroupOut(
            name=name or f"Gasto #{payment.fixed_expense_id}", category=category or "Sin categoría",
            excel_row=row, amount=Decimal(0), count=0, needs_classification=unclassified,
        ))
        group.amount += amount
        group.count += 1
    rows: list[schemas.ProfitLossRowOut] = []
    values: dict[int, Decimal] = {}
    def line(row: int, concept: str, column: str, amount=Decimal(0), *, formula=None, total=False, automatic=False):
        amount = Decimal(amount)
        values[row] = amount
        rows.append(schemas.ProfitLossRowOut(
            excel_row=row, concept=concept, column=column, amount=amount,
            percentage=amount / sales if sales else None,
            formula=formula, total=total, automatic=automatic,
        ))

    line(5, "Ingresos Operacionales (Ventas Totales)", "D", sales, total=True, automatic=True)
    line(7, "  Inventario inicial", "C")
    line(8, "  (+) Compras", "C", purchases, automatic=True)
    line(9, "  (-) Inventario final", "C")
    line(6, "(-) Costo de Ventas", "D", values[7] + values[8] - values[9], formula="=C7+C8-C9", total=True)
    line(10, "(=) UTILIDAD BRUTA", "D", sales - values[6], formula="=D5-D6", total=True)
    line(13, "  Desechables y empaques", "C", expenses[13], automatic=True)
    line(14, "  Comisiones por medios de pago (datafono)", "C", expenses[14], automatic=True)
    line(15, "  Fletes y domicilios", "C", expenses[15], automatic=True)
    line(16, "  Otros gastos operacionales variables y sin clasificar", "C", expenses[16], automatic=True)
    line(12, "(-) Gastos Operacionales Variables", "D", sum(values[r] for r in (13, 14, 15, 16)), formula="=C13+C14+C15+C16", total=True)
    line(17, "(=) MARGEN DE CONTRIBUCIÓN", "D", values[10] - values[12], formula="=D10-D12", total=True)
    line(20, "  Arriendo", "C", expenses[20], automatic=True)
    line(21, "  Nómina", "C", expenses[21], automatic=True)
    line(22, "  Servicios públicos", "C", expenses[22], automatic=True)
    line(23, "  Marketing y publicidad", "C", expenses[23], automatic=True)
    line(24, "  Seguros", "C", expenses[24], automatic=True)
    line(25, "  Otros gastos operacionales fijos", "C", expenses[25], automatic=True)
    line(19, "(-) Gastos Operacionales Fijos", "D", sum(values[r] for r in (20, 21, 22, 23, 24, 25)), formula="=C20+C21+C22+C23+C24+C25", total=True)
    line(26, "(=) UTILIDAD OPERATIVA (EBITDA)", "D", values[17] - values[19], formula="=D17-D19", total=True)
    line(27, "(-) Imprevistos y Mantenimiento", "C", expenses[27], automatic=True)
    line(28, "(=) UTILIDAD ANTES DE IMPUESTOS", "D", values[26] - values[27], formula="=D26-C27", total=True)
    line(30, "(-) Impuesto / Monotributo / Otros", "C", expenses[30], automatic=True)
    line(31, "(=) RESULTADO PROVISIONAL", "D", values[28] - values[30], formula="=D28-C30", total=True)
    expense_rows = {13, 14, 15, 16, 20, 21, 22, 23, 24, 25, 27, 30}
    included = sum((row.amount for row in rows if row.excel_row in expense_rows), Decimal(0))
    if included != expenses_total or values[31] != sales - values[6] - expenses_total:
        raise ValueError("Los gastos del período no coinciden con los gastos descontados en el resultado del PyG")
    warnings = [
        "Faltan los valores confirmados de inventario inicial y final. Se usan cero provisionalmente; el resultado no es una utilidad neta definitiva.",
        "Las compras se incluyen por fecha de compra (o de recepción/registro si no tiene fecha); los gastos por fecha de pago registrada y las ventas por fecha de venta, en horario de Bogotá.",
    ]
    if sales_taxes or sales_service:
        warnings.append(
            f"Los ingresos usan el total registrado en ventas e incluyen impuestos ({Decimal(sales_taxes)}) y servicio ({Decimal(sales_service)}). Revisa su tratamiento antes de considerar definitiva la utilidad."
        )
    inconsistent_sales = db_session.query(models.Sale.id).join(
        models.PosOrder, models.PosOrder.id == models.Sale.order_id,
    ).filter(
        models.Sale.created_at >= start, models.Sale.created_at < end,
        models.Sale.status == "active",
        models.PosOrder.status.in_(["paid", "closed", "delivered"]),
        models.Sale.total != models.PosOrder.total,
    ).all()
    if inconsistent_sales:
        ids = ", ".join(str(item.id) for item in inconsistent_sales)
        warnings.append(f"Hay diferencias entre el total de venta y el pedido pagado en ventas: {ids}. Se conservan los importes registrados en ventas y se requiere revisar su origen.")
    if unclassified_count:
        warnings.append(f"{unclassified_count} gasto(s) sin clasificación se incluyeron en Otros gastos operacionales variables y sin clasificar; revisa su clasificación.")
    if inconsistent_purchases:
        ids = ", ".join(str(value) for value in inconsistent_purchases)
        warnings.append(f"Compras con diferencias entre total y detalle o sin líneas: {ids}. Se incluye el total registrado; cuando este es cero y hay detalle, se usa la suma del detalle.")
    concepts = {row.excel_row: row.concept.strip() for row in rows}
    for group in breakdown.values():
        group.target_concept = concepts[group.excel_row]
    return schemas.ProfitLossStatementOut(
        month=month, rows=sorted(rows, key=lambda item: item.excel_row),
        expenses_total=expenses_total, expenses_included=included,
        expense_count=len(payments), sales_count=int(sales_count), purchase_count=len(purchase_rows),
        unclassified_expense_count=unclassified_count, warnings=warnings, provisional=True,
        expense_breakdown=sorted(breakdown.values(), key=lambda item: (-item.amount, item.name)),
    )
