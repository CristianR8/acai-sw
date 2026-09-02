"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DailyPaymentMethodChart } from "@/components/Dashboard/daily-payment-method-chart";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { useEffect, useMemo, useState } from "react";

dayjs.extend(utc);
dayjs.extend(timezone);

const COLOMBIA_TZ = "America/Bogota";

type Sale = {
  id: number;
  total: number | string;
  courtesy_total: number | string;
  created_at: string;
};

type Purchase = {
  total_cost: number | string;
  created_at: string;
  purchased_at?: string | null;
  received_at?: string | null;
};

type ExpensePayment = { amount: number | string; payment_date: string };

type SalesByProduct = {
  menu_item_id: number;
  name: string;
  category: string;
  quantity: number | string;
  total: number | string;
};

type DailyPaymentSummary = {
  date: string;
  cash_total: number | string;
  transfer_total: number | string;
  dataphone_total: number | string;
  total: number | string;
};

type StatCardProps = {
  title: string;
  value: string;
  helper?: string;
};

function StatCard({ title, value, helper }: StatCardProps) {
  return (
    <div className="rounded-sm border border-stroke bg-white px-5 py-4 shadow-default transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-dark-3 dark:bg-gray-dark">
      <p className="text-sm text-body">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-black dark:text-white">
        {value}
      </p>
      {helper ? (
        <p className="mt-1 text-xs text-body-color dark:text-dark-6">{helper}</p>
      ) : null}
    </div>
  );
}

function safeNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value: unknown) {
  const num = safeNumber(value);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(num);
}

function formatQty(value: unknown) {
  const num = safeNumber(value);
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(num);
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

function isOnOrAfter(date: dayjs.Dayjs, reference: dayjs.Dayjs) {
  return date.isAfter(reference) || date.isSame(reference);
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function ControlPanel() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<ExpensePayment[]>([]);
  const [topProducts, setTopProducts] = useState<SalesByProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(() => dayjs().tz(COLOMBIA_TZ).format("YYYY-MM-DD"));
  const [dailyPayments, setDailyPayments] = useState<DailyPaymentSummary | null>(null);
  const [dailyPaymentsLoading, setDailyPaymentsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [salesRes, purchasesRes, expensesRes, productsRes] =
          await Promise.all([
            fetch("/api/sales", { cache: "no-store" }),
            fetch("/api/inventory/purchases?history=all", { cache: "no-store" }),
            fetch("/api/expenses/payments?from_date=2000-01-01", { cache: "no-store" }),
            fetch("/api/sales/summary/products", { cache: "no-store" }),
          ]);

        const [salesPayload, purchasesPayload, expensesPayload, productsPayload] =
          await Promise.all([
            safeJson(salesRes),
            safeJson(purchasesRes),
            safeJson(expensesRes),
            safeJson(productsRes),
          ]);

        if (cancelled) return;

        setSales(Array.isArray(salesPayload) ? (salesPayload as Sale[]) : []);
        setPurchases(Array.isArray(purchasesPayload) ? (purchasesPayload as Purchase[]) : []);
        setExpenses(Array.isArray(expensesPayload) ? (expensesPayload as ExpensePayment[]) : []);
        setTopProducts(
          Array.isArray(productsPayload) ? (productsPayload as SalesByProduct[]) : [],
        );
      } catch {
        if (cancelled) return;
        setSales([]);
        setPurchases([]);
        setExpenses([]);
        setTopProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDailyPaymentsLoading(true);
    fetch(`/api/sales/summary/daily-payment-methods?day=${encodeURIComponent(selectedDay)}`, { cache: "no-store" })
      .then(safeJson)
      .then((payload) => {
        if (!cancelled) setDailyPayments(payload && typeof payload === "object" ? payload as DailyPaymentSummary : null);
      })
      .catch(() => {
        if (!cancelled) setDailyPayments(null);
      })
      .finally(() => {
        if (!cancelled) setDailyPaymentsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedDay]);

  const now = dayjs().tz(COLOMBIA_TZ);
  const todayStart = now.startOf("day");
  const weekStart = now.subtract(6, "day").startOf("day");
  const monthStart = now.subtract(29, "day").startOf("day");
  const yearStart = now.startOf("year");

  const salesToday = useMemo(() => {
    return sales.filter((sale) => {
      const created = parseDate(sale.created_at);
      return created ? isOnOrAfter(created, todayStart) : false;
    });
  }, [sales, todayStart]);

  const sales7Days = useMemo(() => {
    return sales.filter((sale) => {
      const created = parseDate(sale.created_at);
      return created ? isOnOrAfter(created, weekStart) : false;
    });
  }, [sales, weekStart]);

  const sales30Days = useMemo(() => {
    return sales.filter((sale) => {
      const created = parseDate(sale.created_at);
      return created ? isOnOrAfter(created, monthStart) : false;
    });
  }, [sales, monthStart]);

  const salesYear = useMemo(() => {
    return sales.filter((sale) => {
      const created = parseDate(sale.created_at);
      return created ? isOnOrAfter(created, yearStart) : false;
    });
  }, [sales, yearStart]);

  const purchases30Days = useMemo(() => {
    return purchases.filter((purchase) => {
      const created = purchaseDate(purchase);
      return created ? isOnOrAfter(created, monthStart) : false;
    });
  }, [purchases, monthStart]);

  const totalSalesToday = salesToday.reduce(
    (acc, sale) => acc + safeNumber(sale.total),
    0,
  );
  const totalCourtesyToday = salesToday.reduce(
    (acc, sale) => acc + safeNumber(sale.courtesy_total),
    0,
  );
  const totalSales7Days = sales7Days.reduce(
    (acc, sale) => acc + safeNumber(sale.total),
    0,
  );
  const totalSales30Days = sales30Days.reduce(
    (acc, sale) => acc + safeNumber(sale.total),
    0,
  );
  const totalSalesYear = salesYear.reduce(
    (acc, sale) => acc + safeNumber(sale.total),
    0,
  );
  const totalPurchaseExpenses30Days = purchases30Days.reduce(
    (acc, purchase) => acc + safeNumber(purchase.total_cost),
    0,
  );
  const totalManualExpenses30Days = expenses.reduce((acc, expense) => {
    const paidAt = parseDate(expense.payment_date);
    return paidAt && isOnOrAfter(paidAt, monthStart) ? acc + safeNumber(expense.amount) : acc;
  }, 0);

  const topProductsRows = topProducts
    .slice()
    .sort((a, b) => safeNumber(b.total) - safeNumber(a.total))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Venta del dia"
          value={formatMoney(totalSalesToday)}
          helper={`Hora: ${now.format("HH:mm")}`}
        />
        <StatCard
          title="Cortesias del dia"
          value={formatMoney(totalCourtesyToday)}
        />
        <StatCard
          title="Ventas 7 dias"
          value={formatMoney(totalSales7Days)}
        />
        <StatCard
          title="Ventas 30 dias"
          value={formatMoney(totalSales30Days)}
        />
        <StatCard title="Ventas anuales" value={formatMoney(totalSalesYear)} />
        <StatCard
          title="Ingresos vs egresos"
          value={`${formatMoney(totalSales30Days)} / ${formatMoney(totalPurchaseExpenses30Days + totalManualExpenses30Days)}`}
          helper="Ultimos 30 dias"
        />
      </div>

      <section className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-black dark:text-white">Ingresos por medio de pago</h3>
            <p className="text-sm text-body">Consulta los ingresos de un día específico.</p>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-black dark:text-white">
            Día
            <input
              type="date"
              value={selectedDay}
              onChange={(event) => setSelectedDay(event.target.value)}
              className="rounded-md border border-stroke bg-transparent px-3 py-2 text-sm text-black dark:border-dark-3 dark:text-white"
            />
          </label>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Efectivo" value={formatMoney(dailyPayments?.cash_total)} helper={selectedDay} />
          <StatCard title="Transferencia" value={formatMoney(dailyPayments?.transfer_total)} helper={selectedDay} />
          <StatCard title="Datáfono" value={formatMoney(dailyPayments?.dataphone_total)} helper={selectedDay} />
          <StatCard title="Total del día" value={formatMoney(dailyPayments?.total)} helper={dailyPaymentsLoading ? "Cargando..." : selectedDay} />
        </div>
      </section>

      <section className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="text-xl font-semibold text-black dark:text-white">Frecuencia de ingresos por medio de pago</h3>
        <p className="mb-3 text-sm text-body">Distribución de los ingresos del {selectedDay}.</p>
        {dailyPaymentsLoading ? (
          <p className="text-sm text-body">Cargando gráfica...</p>
        ) : (
          <DailyPaymentMethodChart
            cash={safeNumber(dailyPayments?.cash_total)}
            transfer={safeNumber(dailyPayments?.transfer_total)}
            dataphone={safeNumber(dailyPayments?.dataphone_total)}
          />
        )}
      </section>

      <div>
        <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <h3 className="text-xl font-semibold text-black dark:text-white">
            5 productos mas vendidos
          </h3>
          <p className="mb-4 text-sm text-body">Ranking por total vendido.</p>
          {loading ? (
            <p className="text-sm text-body">Cargando...</p>
          ) : topProductsRows.length === 0 ? (
            <p className="text-sm text-body">Sin datos por ahora.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/10 text-primary hover:bg-primary/10 dark:hover:bg-primary/10">
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vendidos</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProductsRows.map((row) => (
                  <TableRow
                    key={row.menu_item_id}
                    className="transition-colors hover:bg-primary/5"
                  >
                    <TableCell className="font-medium text-black dark:text-white">
                      {row.name}
                    </TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>{formatQty(row.quantity)}</TableCell>
                    <TableCell className="font-semibold text-black dark:text-white">
                      {formatMoney(row.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

      </div>
    </div>
  );
}
