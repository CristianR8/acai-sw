"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "@/components/DateRangeFilter";
import {
  summarizeExpenseSpending,
  type ExpenseCatalogEntry,
  type ExpenseSpendingPayment,
  type ExpenseSpending,
} from "@/lib/expense-spending";

const money = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

async function fetchRows<T>(url: string, signal: AbortSignal): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error();
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error();
  return payload as T[];
}

export default function ExpenseSpendingChart({
  range,
  reloadToken = 0,
}: {
  range: DateRange;
  reloadToken?: number;
}) {
  const [rows, setRows] = useState<ExpenseSpending[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setRows(null);
    setError(null);
    async function load() {
      try {
        const params = new URLSearchParams({
          from_date: range.from,
          to_date: range.to,
        });
        const [catalog, payments] = await Promise.all([
          fetchRows<ExpenseCatalogEntry>(
            "/api/expenses/fixed",
            controller.signal,
          ),
          fetchRows<ExpenseSpendingPayment>(
            `/api/expenses/payments?${params}`,
            controller.signal,
          ),
        ]);
        if (!controller.signal.aborted)
          setRows(summarizeExpenseSpending(catalog, payments, range));
      } catch {
        if (!controller.signal.aborted)
          setError(
            "No se pudo cargar el gráfico de gastos del período seleccionado.",
          );
      }
    }
    void load();
    return () => controller.abort();
  }, [range.from, range.to, reloadToken, retryToken]);

  const maximum = rows ? Math.max(0, ...rows.map((row) => row.total)) : 0;
  const total = rows?.reduce((sum, row) => sum + row.total, 0) ?? 0;

  return (
    <section
      className="mt-8 border-t border-stroke pt-6 dark:border-dark-3"
      aria-label="Gastos por tipo del período"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-dark dark:text-white">
            Gastos por tipo del período
          </h2>
          <p className="mt-1 text-sm text-body">
            Del {range.from} al {range.to}. Ordenados de mayor a menor gasto;
            los anulados no se incluyen.
          </p>
        </div>
        {rows && !error ? (
          <p className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            Total gastos: {money(total)}
          </p>
        ) : null}
      </div>
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 text-sm text-red"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRetryToken((value) => value + 1)}
            className="rounded-md border border-stroke px-3 py-2 text-dark dark:border-dark-3 dark:text-white"
          >
            Reintentar
          </button>
        </div>
      ) : rows === null ? (
        <p role="status" className="text-sm text-body">
          Cargando gráfico de gastos...
        </p>
      ) : (
        <>
          {total === 0 ? (
            <p className="mb-4 text-sm text-body">
              No hay gastos registrados en este período. Los tipos de gasto se
              muestran en cero.
            </p>
          ) : null}
          <ul
            className="space-y-4"
            aria-label="Comparación del dinero gastado por tipo de gasto"
          >
            {rows.map((row) => (
              <li key={row.id}>
                <div className="mb-1.5 flex items-start justify-between gap-4 text-sm">
                  <span className="min-w-0 font-medium text-dark dark:text-white">
                    {row.name}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-dark dark:text-white">
                    {money(row.total)}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-5 overflow-hidden rounded-md bg-gray-2 dark:bg-dark-2"
                >
                  <div
                    className="h-full rounded-md bg-primary transition-[width] duration-300"
                    style={{
                      width: `${maximum > 0 ? (Math.max(0, row.total) / maximum) * 100 : 0}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
