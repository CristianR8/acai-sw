"use client";

import { PaymentsOverviewChart } from "@/components/Charts/payments-overview/chart";
import { WeeksProfitChart } from "@/components/Charts/weeks-profit/chart";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { useEffect, useMemo, useState } from "react";

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

export default function DashboardCharts() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<ExpensePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangePreset, setRangePreset] = useState<"1m" | "custom">("1m");
  const [customStart, setCustomStart] = useState(() => dayjs().tz(COLOMBIA_TZ).subtract(1, "month").format("YYYY-MM-DD"));
  const [customEnd, setCustomEnd] = useState(() => dayjs().tz(COLOMBIA_TZ).format("YYYY-MM-DD"));
  const [purchasesMonth, setPurchasesMonth] = useState(() => dayjs().tz(COLOMBIA_TZ).format("YYYY-MM"));
  const [expensesMonth, setExpensesMonth] = useState(() => dayjs().tz(COLOMBIA_TZ).format("YYYY-MM"));
  const [incomeExpenseView, setIncomeExpenseView] = useState<"both" | "income" | "expense">("both");

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const today = dayjs().tz(COLOMBIA_TZ).format("YYYY-MM-DD");
        const [salesRes, purchasesRes, expensesRes] = await Promise.all([
          fetch("/api/sales", { cache: "no-store" }),
          fetch("/api/inventory/purchases?history=all", { cache: "no-store" }),
          fetch(`/api/expenses/payments?from_date=2000-01-01&to_date=${today}`, { cache: "no-store" }),
        ]);
        const [salesPayload, purchasesPayload, expensesPayload] = await Promise.all([safeJson(salesRes), safeJson(purchasesRes), safeJson(expensesRes)]);
        if (cancelled) return;
        setSales(Array.isArray(salesPayload) ? salesPayload as Sale[] : []);
        setPurchases(Array.isArray(purchasesPayload) ? purchasesPayload as Purchase[] : []);
        setExpenses(Array.isArray(expensesPayload) ? expensesPayload as ExpensePayment[] : []);
      } catch {
        if (cancelled) return;
        setSales([]); setPurchases([]); setExpenses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => { cancelled = true; };
  }, []);

  const defaultEnd = dayjs().tz(COLOMBIA_TZ).startOf("day");
  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    if (rangePreset === "custom") {
      const startCandidate = dayjs.tz(customStart, COLOMBIA_TZ).startOf("day");
      const endCandidate = dayjs.tz(customEnd, COLOMBIA_TZ).startOf("day");
      const validStart = startCandidate.isValid() ? startCandidate : defaultEnd;
      const validEnd = endCandidate.isValid() ? endCandidate : defaultEnd;
      const start = validStart.isAfter(validEnd) ? validEnd : validStart;
      const end = validStart.isAfter(validEnd) ? validStart : validEnd;
      return { rangeStart: start, rangeEnd: end, rangeLabel: `Del ${start.format("DD/MM/YYYY")} al ${end.format("DD/MM/YYYY")}` };
    }
    return { rangeStart: defaultEnd.subtract(1, "month").startOf("day"), rangeEnd: defaultEnd, rangeLabel: "Último mes" };
  }, [rangePreset, customStart, customEnd, defaultEnd]);

  const salesSeries = useMemo(() => buildSeries(sales, rangeStart, rangeEnd, (sale) => parseDate(sale.created_at), (sale) => safeNumber(sale.total)), [sales, rangeStart, rangeEnd]);
  const purchasesMonthRange = useMemo(() => {
    const month = dayjs(`${purchasesMonth}-01`).tz(COLOMBIA_TZ);
    return { start: month.startOf("month"), end: month.endOf("month") };
  }, [purchasesMonth]);
  const expensesMonthRange = useMemo(() => {
    const month = dayjs(`${expensesMonth}-01`).tz(COLOMBIA_TZ);
    return { start: month.startOf("month"), end: month.endOf("month") };
  }, [expensesMonth]);
  const purchasesSeries = useMemo(() => buildSeries(purchases, purchasesMonthRange.start, purchasesMonthRange.end, purchaseDate, (purchase) => safeNumber(purchase.total_cost)), [purchases, purchasesMonthRange]);
  const expensesSeries = useMemo(() => buildSeries(expenses, expensesMonthRange.start, expensesMonthRange.end, (expense) => parseDate(expense.payment_date), (expense) => safeNumber(expense.amount)), [expenses, expensesMonthRange]);
  const totalExpensesSeries = useMemo(() => {
    const allPurchases = buildSeries(purchases, rangeStart, rangeEnd, purchaseDate, (purchase) => safeNumber(purchase.total_cost));
    const allExpenses = buildSeries(expenses, rangeStart, rangeEnd, (expense) => parseDate(expense.payment_date), (expense) => safeNumber(expense.amount));
    return allPurchases.map((point, index) => ({ x: point.x, y: point.y + (allExpenses[index]?.y ?? 0) }));
  }, [purchases, expenses, rangeStart, rangeEnd]);

  const weeklyRangeStart = defaultEnd.subtract(6, "day");
  const weeklySales = useMemo(() => buildSeries(sales, weeklyRangeStart, defaultEnd, (sale) => parseDate(sale.created_at), (sale) => safeNumber(sale.total)), [sales, weeklyRangeStart, defaultEnd]);
  const weeklyPurchases = useMemo(() => buildSeries(purchases, weeklyRangeStart, defaultEnd, purchaseDate, (purchase) => safeNumber(purchase.total_cost)), [purchases, weeklyRangeStart, defaultEnd]);
  const weeklyExpenses = useMemo(() => buildSeries(expenses, weeklyRangeStart, defaultEnd, (expense) => parseDate(expense.payment_date), (expense) => safeNumber(expense.amount)), [expenses, weeklyRangeStart, defaultEnd]);
  const weeklyTotalExpenses = useMemo(() => weeklyPurchases.map((point, index) => ({ x: point.x, y: point.y + (weeklyExpenses[index]?.y ?? 0) })), [weeklyPurchases, weeklyExpenses]);

  const controls = <div className="flex flex-wrap items-center gap-2"><select value={rangePreset} onChange={(event) => setRangePreset(event.target.value as "1m" | "custom")} className="h-9 rounded-md border border-stroke bg-white px-3 text-sm text-dark shadow-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"><option value="1m">1 mes</option><option value="custom">Personalizado</option></select>{rangePreset === "custom" ? <div className="flex flex-wrap items-center gap-2"><input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="h-9 rounded-md border border-stroke bg-white px-2 text-sm text-dark shadow-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white" /><span className="text-sm text-body">a</span><input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="h-9 rounded-md border border-stroke bg-white px-2 text-sm text-dark shadow-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white" /></div> : null}</div>;

  return <div className="grid gap-4 md:grid-cols-2">
    <section className="rounded-[10px] bg-white px-7.5 pb-6 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card"><div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-body-2xlg font-bold text-dark dark:text-white">Ingresos y egresos</h2><p className="text-sm text-body">{rangeLabel}</p></div><div className="flex flex-wrap items-center gap-2">{controls}<select value={incomeExpenseView} onChange={(event) => setIncomeExpenseView(event.target.value as "both" | "income" | "expense")} className="h-9 rounded-md border border-stroke bg-white px-3 text-sm text-dark shadow-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"><option value="both">Ambos</option><option value="income">Solo ingresos</option><option value="expense">Solo egresos</option></select></div></div>{loading ? <p className="text-sm text-body">Cargando gráfica...</p> : <PaymentsOverviewChart data={{ received: incomeExpenseView === "expense" ? [] : salesSeries, due: incomeExpenseView === "income" ? undefined : totalExpensesSeries }} receivedLabel="Ingresos" dueLabel="Egresos totales" />}</section>
    <section className="rounded-[10px] bg-white px-7.5 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card"><div className="mb-2"><h2 className="text-body-2xlg font-bold text-dark dark:text-white">Ingresos vs egresos</h2><p className="text-sm text-body">Comparativo de los últimos 7 días.</p></div>{loading ? <p className="text-sm text-body">Cargando gráfica...</p> : <WeeksProfitChart data={{ sales: weeklySales, revenue: weeklyTotalExpenses }} />}</section>
    <section className="rounded-[10px] bg-white px-7.5 pb-6 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card"><div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-body-2xlg font-bold text-dark dark:text-white">Egresos por compras</h2><p className="text-sm text-body">{purchasesMonthRange.start.format("MMMM YYYY")}</p></div><input type="month" value={purchasesMonth} onChange={(event) => setPurchasesMonth(event.target.value)} className="h-9 rounded-md border border-stroke bg-white px-2 text-sm text-dark shadow-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white" /></div>{loading ? <p className="text-sm text-body">Cargando gráfica...</p> : <PaymentsOverviewChart data={{ received: purchasesSeries }} receivedLabel="Compras" colors={["#ff2056"]} />}</section>
    <section className="rounded-[10px] bg-white px-7.5 pb-6 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card"><div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-body-2xlg font-bold text-dark dark:text-white">Egresos por gastos</h2><p className="text-sm text-body">Pagos manuales registrados · {expensesMonthRange.start.format("MMMM YYYY")}</p></div><input type="month" value={expensesMonth} onChange={(event) => setExpensesMonth(event.target.value)} className="h-9 rounded-md border border-stroke bg-white px-2 text-sm text-dark shadow-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white" /></div>{loading ? <p className="text-sm text-body">Cargando gráfica...</p> : <PaymentsOverviewChart data={{ received: expensesSeries }} receivedLabel="Gastos" colors={["#f59e0b"]} />}</section>
  </div>;
}
