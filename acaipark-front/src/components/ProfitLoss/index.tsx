"use client";

import { useEffect, useState } from "react";
import MonthFilter, {
  currentMonth,
  initialDay,
  monthLastDay,
} from "@/components/MonthFilter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StatementRow = {
  excel_row: number;
  concept: string;
  amount: number | string;
  percentage: number | string | null;
  total: boolean;
};
type ExpenseGroup = {
  name: string;
  category: string;
  target_concept: string;
  excel_row: number;
  amount: number | string;
  count: number;
  needs_classification: boolean;
};
type Statement = {
  month: string;
  rows: StatementRow[];
  sales_count: number;
  purchase_count: number;
  expense_count: number;
  expenses_total: number | string;
  expenses_included: number | string;
  expense_breakdown: ExpenseGroup[];
  provisional: boolean;
  warnings: string[];
};
type Expense = {
  id: number;
  name: string;
  category: string;
  concept: string | null;
  amount: number | string;
  status: string;
};
const money = (value: number | string) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value));
const percent = (value: number | string | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("es-CO", {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(Number(value));

function CashExpenses({ month }: { month: string }) {
  const [day, setDay] = useState(() => initialDay(month));
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setExpenses(null);
    setError(null);
    async function load() {
      try {
        const response = await fetch(
          `/api/expenses/payments?from_date=${day}&to_date=${day}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error();
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) throw new Error();
        if (!cancelled)
          setExpenses(
            (payload as Expense[]).filter(
              (expense) => expense.status === "manual",
            ),
          );
      } catch {
        if (!cancelled)
          setError(
            "No se pudieron cargar los gastos y salidas de caja de este día.",
          );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [day]);

  return (
    <section className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-dark dark:text-white">
            Gastos y salidas de caja
          </h2>
          <p className="mt-1 text-sm text-body">
            Detalle de los gastos registrados del día seleccionado.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Día de gastos
          <input
            type="date"
            value={day}
            min={`${month}-01`}
            max={monthLastDay(month)}
            onChange={(event) => {
              const value = event.target.value;
              if (value && value.slice(0, 7) === month) setDay(value);
            }}
            className="rounded border border-stroke bg-transparent px-3 py-2 dark:border-dark-3"
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-red">
          {error}
        </p>
      ) : expenses === null ? (
        <p role="status">Cargando gastos...</p>
      ) : (
        <>
          <p className="mb-4 text-lg font-bold">
            Total gastos:{" "}
            {money(
              expenses.reduce(
                (sum, expense) => sum + Number(expense.amount),
                0,
              ),
            )}
          </p>
          {expenses.length === 0 ? (
            <p className="text-sm text-body">
              Sin gastos registrados para este día.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gasto</TableHead>
                  <TableHead>Concepto / Ref</TableHead>
                  <TableHead className="text-right">Monto (COP)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.name}</TableCell>
                    <TableCell>
                      {expense.concept || expense.category || "Sin concepto"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(expense.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </section>
  );
}

export default function ProfitLoss() {
  const [month, setMonth] = useState(currentMonth);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatement(null);
    setError(null);
    async function load() {
      try {
        const response = await fetch(`/api/sales/pl-statement?month=${month}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error();
        const payload: Statement = await response.json();
        if (
          payload.month !== month ||
          !Array.isArray(payload.rows) ||
          !Array.isArray(payload.expense_breakdown) ||
          !Array.isArray(payload.warnings) ||
          !Number.isFinite(Number(payload.expenses_total)) ||
          !Number.isFinite(Number(payload.expenses_included))
        )
          throw new Error();
        if (!cancelled) setStatement(payload);
      } catch {
        if (!cancelled)
          setError(
            "No se pudo cargar el estado de pérdidas y ganancias del mes seleccionado.",
          );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [month]);

  return (
    <div className="space-y-6">
      <MonthFilter value={month} onChange={setMonth}>
        <a
          href={`/api/sales/pl-statement/export?month=${month}`}
          className="rounded-lg bg-primary px-4 py-2 font-medium text-white"
        >
          Descargar pérdidas y ganancias (Excel)
        </a>
      </MonthFilter>
      <section className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="text-xl font-bold text-dark dark:text-white">
          Estado de Resultados Mensual (PyG Proforma - Açaí Park)
        </h2>
        <p className="mb-5 mt-1 text-sm text-body">
          Período: {month.slice(5, 7)}/{month.slice(0, 4)}
        </p>
        {error ? (
          <p role="alert" className="text-red">
            {error}
          </p>
        ) : statement === null ? (
          <p role="status">Cargando estado de resultados...</p>
        ) : (
          <>
            {statement.warnings.length > 0 ? (
              <div
                role="status"
                className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-dark dark:border-amber-800 dark:bg-amber-950/30 dark:text-white"
              >
                <p className="mb-2 font-semibold">
                  {statement.provisional
                    ? "Resultado provisional: hay información por confirmar"
                    : "Comprobaciones del período"}
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {statement.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/10">
                  <TableHead>Cuenta / Concepto</TableHead>
                  <TableHead className="text-right">Valor (COP)</TableHead>
                  <TableHead className="text-right">% sobre Ventas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.rows.map((row) => (
                  <TableRow
                    key={row.excel_row}
                    className={row.total ? "bg-primary/5 font-bold" : undefined}
                  >
                    <TableCell
                      className={
                        row.total ? "text-dark dark:text-white" : "pl-8"
                      }
                    >
                      {row.concept.trim()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {money(row.amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {percent(row.percentage)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-4 text-sm text-body">
              Todos los gastos registrados del mes se descuentan una sola vez.
              Los conceptos sin clasificación se incluyen en Otros y se señalan
              para revisión. La pantalla y el Excel usan el mismo cálculo.
            </p>
            <p className="mt-2 text-sm text-body">
              Cuando no hay ventas, el porcentaje sobre ventas se muestra como
              —.
            </p>
          </>
        )}
      </section>
      {statement && !error ? (
        <section className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <h2 className="text-xl font-bold text-dark dark:text-white">
            Comprobación de gastos del período
          </h2>
          <p className="mt-1 text-sm text-body">
            {statement.sales_count} ventas, {statement.purchase_count} compras y{" "}
            {statement.expense_count} registros de gastos incluidos.
          </p>
          <div className="my-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
              <p className="text-sm text-body">Gastos registrados</p>
              <p className="mt-1 font-bold">
                {money(statement.expenses_total)}
              </p>
            </div>
            <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
              <p className="text-sm text-body">Gastos descontados en PyG</p>
              <p className="mt-1 font-bold">
                {money(statement.expenses_included)}
              </p>
            </div>
            <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
              <p className="text-sm text-body">Diferencia</p>
              <p className="mt-1 font-bold">
                {money(
                  Number(statement.expenses_total) -
                    Number(statement.expenses_included),
                )}
              </p>
            </div>
          </div>
          {statement.expense_breakdown.length === 0 ? (
            <p className="text-sm text-body">
              Sin gastos registrados en este mes.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gasto / Categoría</TableHead>
                  <TableHead>Incluido en</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.expense_breakdown.map((group, index) => (
                  <TableRow
                    key={`${group.name}-${group.category}-${group.excel_row}-${index}`}
                  >
                    <TableCell>
                      {group.name}
                      <p className="mt-1 text-xs text-body">{group.category}</p>
                    </TableCell>
                    <TableCell>
                      {group.target_concept}
                      {group.needs_classification ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                          Incluido; clasificación pendiente de revisión.
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{group.count}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {money(group.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      ) : null}
      <CashExpenses key={month} month={month} />
    </div>
  );
}
