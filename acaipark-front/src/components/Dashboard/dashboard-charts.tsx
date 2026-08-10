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

type Sale = {
  total: number | string;
  created_at: string;
};

type Purchase = {
  total_cost: number | string;
  created_at: string;
  purchased_at?: string | null;
  received_at?: string | null;
};

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

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function DashboardCharts() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangePreset, setRangePreset] = useState<"1m" | "2m" | "3m" | "custom">("1m");
  const [customStart, setCustomStart] = useState(() =>
    dayjs().tz(COLOMBIA_TZ).subtract(1, "month").format("YYYY-MM-DD"),
  );
  const [customEnd, setCustomEnd] = useState(() =>
    dayjs().tz(COLOMBIA_TZ).format("YYYY-MM-DD"),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [salesRes, purchasesRes] = await Promise.all([
          fetch("/api/sales", { cache: "no-store" }),
          fetch("/api/inventory/purchases", { cache: "no-store" }),
        ]);

        const [salesPayload, purchasesPayload] = await Promise.all([
          safeJson(salesRes),
          safeJson(purchasesRes),
        ]);

        if (cancelled) return;

        setSales(Array.isArray(salesPayload) ? (salesPayload as Sale[]) : []);
        setPurchases(
          Array.isArray(purchasesPayload) ? (purchasesPayload as Purchase[]) : [],
        );
      } catch {
        if (cancelled) return;
        setSales([]);
        setPurchases([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const now = dayjs().tz(COLOMBIA_TZ);
  const defaultEnd = now.startOf("day");

  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    if (rangePreset === "custom") {
      const startCandidate = dayjs.tz(customStart, COLOMBIA_TZ).startOf("day");
      const endCandidate = dayjs.tz(customEnd, COLOMBIA_TZ).startOf("day");
      const validStart = startCandidate.isValid() ? startCandidate : defaultEnd;
      const validEnd = endCandidate.isValid() ? endCandidate : defaultEnd;
      const start = validStart.isAfter(validEnd) ? validEnd : validStart;
      const end = validStart.isAfter(validEnd) ? validStart : validEnd;
      return {
        rangeStart: start,
        rangeEnd: end,
        rangeLabel: `Del ${start.format("DD/MM/YYYY")} al ${end.format("DD/MM/YYYY")}`,
      };
    }

    const months = rangePreset === "2m" ? 2 : rangePreset === "3m" ? 3 : 1;
    const start = defaultEnd.subtract(months, "month").startOf("day");
    const end = defaultEnd;
    const label = `Ultimos ${months} mes${months > 1 ? "es" : ""}`;
    return { rangeStart: start, rangeEnd: end, rangeLabel: label };
  }, [rangePreset, customStart, customEnd, defaultEnd]);

  const dailySeries = useMemo(() => {
    const totalDays = rangeEnd.diff(rangeStart, "day");
    const useWeeklyBuckets = totalDays > 45;

    if (useWeeklyBuckets) {
      const firstWeek = rangeStart.startOf("week");
      const lastWeek = rangeEnd.endOf("week");
      const weeks = Array.from(
        { length: lastWeek.diff(firstWeek, "week") + 1 },
        (_, index) => firstWeek.add(index, "week"),
      );

      const received = weeks.map((weekStart) => {
        const weekEnd = weekStart.endOf("week");
        const total = sales.reduce((acc, sale) => {
          const created = parseDate(sale.created_at);
          if (!created) return acc;
          if (created.isBefore(weekStart) || created.isAfter(weekEnd)) return acc;
          return acc + safeNumber(sale.total);
        }, 0);
        return { x: weekStart.format("DD/MM"), y: Math.round(total) };
      });

      const due = weeks.map((weekStart) => {
        const weekEnd = weekStart.endOf("week");
        const total = purchases.reduce((acc, purchase) => {
          const created = purchaseDate(purchase);
          if (!created) return acc;
          if (created.isBefore(weekStart) || created.isAfter(weekEnd)) return acc;
          return acc + safeNumber(purchase.total_cost);
        }, 0);
        return { x: weekStart.format("DD/MM"), y: Math.round(total) };
      });

      return { received, due };
    }

    const days = Array.from({ length: totalDays + 1 }, (_, index) =>
      rangeStart.add(index, "day"),
    );

    const received = days.map((day) => {
      const total = sales.reduce((acc, sale) => {
        const created = parseDate(sale.created_at);
        if (!created) return acc;
        if (!created.isSame(day, "day")) return acc;
        return acc + safeNumber(sale.total);
      }, 0);
      return { x: day.format("DD/MM"), y: Math.round(total) };
    });

    const due = days.map((day) => {
      const total = purchases.reduce((acc, purchase) => {
        const created = purchaseDate(purchase);
        if (!created) return acc;
        if (!created.isSame(day, "day")) return acc;
        return acc + safeNumber(purchase.total_cost);
      }, 0);
      return { x: day.format("DD/MM"), y: Math.round(total) };
    });

    return { received, due };
  }, [sales, purchases, rangeStart, rangeEnd]);

  const weeklySeries = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) =>
      now.subtract(6 - index, "day").startOf("day"),
    );

    const salesData = days.map((day) => {
      const total = sales.reduce((acc, sale) => {
        const created = parseDate(sale.created_at);
        if (!created) return acc;
        if (!created.isSame(day, "day")) return acc;
        return acc + safeNumber(sale.total);
      }, 0);
      return { x: day.format("dd"), y: Math.round(total) };
    });

    const expensesData = days.map((day) => {
      const total = purchases.reduce((acc, purchase) => {
        const created = purchaseDate(purchase);
        if (!created) return acc;
        if (!created.isSame(day, "day")) return acc;
        return acc + safeNumber(purchase.total_cost);
      }, 0);
      return { x: day.format("dd"), y: Math.round(total) };
    });

    return { sales: salesData, revenue: expensesData };
  }, [sales, purchases, now]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-[10px] bg-white px-7.5 pb-6 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-body-2xlg font-bold text-dark dark:text-white">
              Ingresos y egresos
            </h2>
            <p className="text-sm text-body">{rangeLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={rangePreset}
              onChange={(event) =>
                setRangePreset(event.target.value as typeof rangePreset)
              }
              className="h-9 rounded-md border border-stroke bg-white px-3 text-sm text-dark shadow-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            >
              <option value="1m">1 mes</option>
              <option value="2m">2 meses</option>
              <option value="3m">3 meses</option>
              <option value="custom">Personalizado</option>
            </select>
            {rangePreset === "custom" ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="h-9 rounded-md border border-stroke bg-white px-2 text-sm text-dark shadow-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                />
                <span className="text-sm text-body">a</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="h-9 rounded-md border border-stroke bg-white px-2 text-sm text-dark shadow-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                />
              </div>
            ) : null}
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-body">Cargando grafica...</p>
        ) : (
          <PaymentsOverviewChart data={dailySeries} />
        )}
      </div>

      <div className="rounded-[10px] bg-white px-7.5 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="mb-2">
          <h2 className="text-body-2xlg font-bold text-dark dark:text-white">
            Ingresos vs Egresos
          </h2>
          <p className="text-sm text-body">Comparativo ultimos 7 dias.</p>
        </div>
        {loading ? (
          <p className="text-sm text-body">Cargando grafica...</p>
        ) : (
          <WeeksProfitChart data={weeklySeries} />
        )}
      </div>
    </div>
  );
}
