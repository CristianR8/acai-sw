"use client";

import type { DateRange } from "@/components/DateRangeFilter";

import { PaymentsOverviewChart } from "@/components/Charts/payments-overview/chart";
import { WeeksProfitChart } from "@/components/Charts/weeks-profit/chart";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { useEffect, useState } from "react";

dayjs.extend(utc);
dayjs.extend(timezone);

const COLOMBIA_TZ = "America/Bogota";

type Sale = { total: number | string; created_at: string };
type Purchase = { total_cost: number | string; created_at: string; purchased_at?: string | null; received_at?: string | null };
type ExpensePayment = { amount: number | string; payment_date: string };
type ChartPoint = { x: string; y: number };

function safeNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(num) ? num : 0;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const withOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const parsed = withOffset ? dayjs(value) : dayjs.tz(value, COLOMBIA_TZ);
  return parsed.isValid() ? parsed.tz(COLOMBIA_TZ) : null;
}

function purchaseDate(purchase: Purchase) {
  return parseDate(purchase.purchased_at ?? purchase.received_at ?? purchase.created_at);
}

function buildSeries<T>(values: T[], rangeStart: dayjs.Dayjs, rangeEnd: dayjs.Dayjs, dateFor: (value: T) => dayjs.Dayjs | null, amountFor: (value: T) => number): ChartPoint[] {
  const totalDays = rangeEnd.diff(rangeStart, "day");
  if (totalDays > 45) {
    const firstWeek = rangeStart.startOf("week");
    const lastWeek = rangeEnd.endOf("week");
    return Array.from({ length: lastWeek.diff(firstWeek, "week") + 1 }, (_, index) => firstWeek.add(index, "week")).map((weekStart) => {
      const weekEnd = weekStart.endOf("week");
      const total = values.reduce((sum, value) => {
        const date = dateFor(value);
        return !date || date.isBefore(weekStart) || date.isAfter(weekEnd) ? sum : sum + amountFor(value);
      }, 0);
      return { x: weekStart.format("DD/MM"), y: Math.round(total) };
    });
  }
  return Array.from({ length: totalDays + 1 }, (_, index) => rangeStart.add(index, "day")).map((day) => {
    const total = values.reduce((sum, value) => {
      const date = dateFor(value);
      return date?.isSame(day, "day") ? sum + amountFor(value) : sum;
    }, 0);
    return { x: day.format("DD/MM"), y: Math.round(total) };
  });
}

async function safeJson(response: Response) {
  return response.json().catch(() => null);
}

export default function DashboardCharts({ range }: { range: DateRange }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<ExpensePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incomeExpenseView, setIncomeExpenseView] = useState<"both" | "income" | "expense">("both");

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [salesRes, purchasesRes, expensesRes] = await Promise.all([
          fetch(`/api/sales?from_date=${range.from}&to_date=${range.to}`, { cache: "no-store" }),
          fetch(`/api/inventory/purchases?from_date=${range.from}&to_date=${range.to}`, { cache: "no-store" }),
          fetch(`/api/expenses/payments?from_date=${range.from}&to_date=${range.to}`, { cache: "no-store" }),
        ]);
        if (![salesRes, purchasesRes, expensesRes].every((response) => response.ok)) throw new Error("No se pudieron cargar las gráficas.");
        const [salesPayload, purchasesPayload, expensesPayload] = await Promise.all([safeJson(salesRes), safeJson(purchasesRes), safeJson(expensesRes)]);
        if (cancelled) return;
        setSales(Array.isArray(salesPayload) ? salesPayload as Sale[] : []);
        setPurchases(Array.isArray(purchasesPayload) ? purchasesPayload as Purchase[] : []);
        setExpenses(Array.isArray(expensesPayload) ? expensesPayload as ExpensePayment[] : []);
      } catch {
        if (cancelled) return;
        setError("No se pudieron cargar las gráficas del período seleccionado.");
        setSales([]); setPurchases([]); setExpenses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [range]);

  const rangeStart = dayjs.tz(range.from, COLOMBIA_TZ).startOf("day");
  const rangeEnd = dayjs.tz(range.to, COLOMBIA_TZ).startOf("day");
  const salesSeries = buildSeries(sales, rangeStart, rangeEnd, (sale) => parseDate(sale.created_at), (sale) => safeNumber(sale.total));
  const purchasesSeries = buildSeries(purchases, rangeStart, rangeEnd, purchaseDate, (purchase) => safeNumber(purchase.total_cost));
  const expensesSeries = buildSeries(expenses, rangeStart, rangeEnd, (expense) => parseDate(expense.payment_date), (expense) => safeNumber(expense.amount));
  const totalExpensesSeries = purchasesSeries.map((point, index) => ({ x: point.x, y: point.y + (expensesSeries[index]?.y ?? 0) }));

  return <>
    {error ? <p role="alert" className="mb-4 text-red">{error}</p> : null}
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark">
        <div className="mb-3 flex flex-wrap justify-between gap-3">
          <h2 className="text-xl font-bold text-dark dark:text-white">Ingresos y egresos del período</h2>
          <select aria-label="Mostrar ingresos o egresos" value={incomeExpenseView} onChange={(event) => setIncomeExpenseView(event.target.value as "both" | "income" | "expense")} className="rounded border border-stroke bg-transparent px-3 py-2 text-sm">
            <option value="both">Ambos</option><option value="income">Solo ingresos</option><option value="expense">Solo egresos</option>
          </select>
        </div>
        {loading ? <p>Cargando gráfica...</p> : <PaymentsOverviewChart data={{ received: incomeExpenseView === "expense" ? [] : salesSeries, due: incomeExpenseView === "income" ? undefined : totalExpensesSeries }} receivedLabel="Ingresos" dueLabel="Egresos totales" />}
      </section>
      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark">
        <h2 className="mb-3 text-xl font-bold text-dark dark:text-white">Ingresos vs egresos del período</h2>
        {loading ? <p>Cargando gráfica...</p> : <WeeksProfitChart data={{ sales: salesSeries, revenue: totalExpensesSeries }} />}
      </section>
      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark">
        <h2 className="mb-3 text-xl font-bold text-dark dark:text-white">Egresos por compras del período</h2>
        {loading ? <p>Cargando gráfica...</p> : <PaymentsOverviewChart data={{ received: purchasesSeries }} receivedLabel="Compras" colors={["#ff2056"]} />}
      </section>
      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark">
        <h2 className="mb-3 text-xl font-bold text-dark dark:text-white">Egresos por gastos del período</h2>
        {loading ? <p>Cargando gráfica...</p> : <PaymentsOverviewChart data={{ received: expensesSeries }} receivedLabel="Gastos" colors={["#f59e0b"]} />}
      </section>
    </div>
  </>;
}
