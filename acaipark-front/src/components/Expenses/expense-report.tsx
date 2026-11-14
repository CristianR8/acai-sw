"use client";

import { useEffect, useState } from "react";
import { currentMonthRange } from "@/components/DateRangeFilter";
import PeriodFilter from "@/components/PeriodFilter";
import ExpenseSpendingChart from "./expense-spending-chart";
import ExpenseHistory from "./expense-history";
import { money, numericAmount, type ExpensePayment } from "./shared";

export default function ExpenseReport() {
  const [range, setRange] = useState(currentMonthRange);
  const [payments, setPayments] = useState<ExpensePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPayments([]);
    async function load() {
      try {
        const params = new URLSearchParams({
          from_date: range.from,
          to_date: range.to,
        });
        const response = await fetch(`/api/expenses/payments?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(payload)) throw new Error();
        if (!controller.signal.aborted) setPayments(payload);
      } catch {
        if (!controller.signal.aborted)
          setError(
            "No se pudieron cargar los gastos del período seleccionado.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [range, retryToken]);

  const activePayments = payments.filter(
    (payment) => payment.status !== "void",
  );
  const total = activePayments.reduce(
    (sum, payment) => sum + numericAmount(payment.amount),
    0,
  );

  return (
    <div className="space-y-6">
      <section
        aria-label="Período del informe de gastos"
        className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">
          Período del informe
        </h2>
        <PeriodFilter value={range} onChange={setRange} />
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
        ) : null}
      </section>
      <section
        aria-label="Gastos del período"
        className="rounded-[10px] bg-gradient-to-br from-primary to-[#163c62] p-6 text-white shadow-1"
      >
        <p className="text-sm font-medium text-white/75">Gastos del período</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">
              {error ? "No disponible" : loading ? "Cargando..." : money(total)}
            </h2>
            <p className="mt-1 text-sm text-white/80">
              Corresponde al rango seleccionado e incluye solo gastos
              registrados; los anulados no suman.
            </p>
          </div>
          {!loading && !error ? (
            <div className="rounded-lg bg-white/15 px-4 py-3 text-sm">
              {activePayments.length}{" "}
              {activePayments.length === 1 ? "registro" : "registros"}
            </div>
          ) : null}
        </div>
      </section>
      <ExpenseSpendingChart range={range} reloadToken={retryToken} />
      <ExpenseHistory range={range} onChanged={() => setRetryToken((value) => value + 1)} />
    </div>
  );
}
