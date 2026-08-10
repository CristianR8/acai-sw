"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  service_total: number | string;
  courtesy_total: number | string;
  created_at: string;
};

type PosOrder = {
  id: number;
  status: string;
  total: number | string;
  closed_at?: string | null;
};

type Purchase = {
  total_cost: number | string;
  created_at: string;
  purchased_at?: string | null;
  received_at?: string | null;
};

type SalesByProduct = {
  menu_item_id: number;
  name: string;
  category: string;
  quantity: number | string;
  total: number | string;
};

type SalesByWaiter = {
  waiter_id: number | null;
  name: string;
  quantity: number | string;
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
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [topProducts, setTopProducts] = useState<SalesByProduct[]>([]);
  const [topWaiters, setTopWaiters] = useState<SalesByWaiter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [salesRes, ordersRes, purchasesRes, productsRes, waitersRes] =
          await Promise.all([
            fetch("/api/sales", { cache: "no-store" }),
            fetch("/api/pos/orders", { cache: "no-store" }),
            fetch("/api/inventory/purchases", { cache: "no-store" }),
            fetch("/api/sales/summary/products", { cache: "no-store" }),
            fetch("/api/sales/summary/waiters", { cache: "no-store" }),
          ]);

        const [salesPayload, ordersPayload, purchasesPayload, productsPayload, waitersPayload] =
          await Promise.all([
            safeJson(salesRes),
            safeJson(ordersRes),
            safeJson(purchasesRes),
            safeJson(productsRes),
            safeJson(waitersRes),
          ]);

        if (cancelled) return;

        setSales(Array.isArray(salesPayload) ? (salesPayload as Sale[]) : []);
        setOrders(Array.isArray(ordersPayload) ? (ordersPayload as PosOrder[]) : []);
        setPurchases(Array.isArray(purchasesPayload) ? (purchasesPayload as Purchase[]) : []);
        setTopProducts(
          Array.isArray(productsPayload) ? (productsPayload as SalesByProduct[]) : [],
        );
        setTopWaiters(
          Array.isArray(waitersPayload) ? (waitersPayload as SalesByWaiter[]) : [],
        );
      } catch {
        if (cancelled) return;
        setSales([]);
        setOrders([]);
        setPurchases([]);
        setTopProducts([]);
        setTopWaiters([]);
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

  const cancellationsToday = useMemo(() => {
    return orders.filter((order) => {
      if (order.status !== "void") return false;
      const closed = parseDate(order.closed_at ?? null);
      return closed ? isOnOrAfter(closed, todayStart) : false;
    });
  }, [orders, todayStart]);

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
  const totalTipsToday = salesToday.reduce(
    (acc, sale) => acc + safeNumber(sale.service_total),
    0,
  );
  const totalCourtesyToday = salesToday.reduce(
    (acc, sale) => acc + safeNumber(sale.courtesy_total),
    0,
  );
  const totalCancellationsToday = cancellationsToday.reduce(
    (acc, order) => acc + safeNumber(order.total),
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
  const totalExpenses30Days = purchases30Days.reduce(
    (acc, purchase) => acc + safeNumber(purchase.total_cost),
    0,
  );

  const topProductsRows = topProducts
    .slice()
    .sort((a, b) => safeNumber(b.total) - safeNumber(a.total))
    .slice(0, 5);

  const topWaitersRows = topWaiters
    .slice()
    .sort((a, b) => safeNumber(b.total) - safeNumber(a.total))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Venta del dia"
          value={formatMoney(totalSalesToday - totalTipsToday)}
          helper={`Hora: ${now.format("HH:mm")}`}
        />
        <StatCard
          title="Propinas del dia"
          value={formatMoney(totalTipsToday)}
          helper="Solo servicio"
        />
        <StatCard
          title="Cancelaciones del dia"
          value={formatMoney(totalCancellationsToday)}
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
          value={`${formatMoney(totalSales30Days)} / ${formatMoney(totalExpenses30Days)}`}
          helper="Ultimos 30 dias"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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

        <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <h3 className="text-xl font-semibold text-black dark:text-white">
            Top 5 mejores vendedores
          </h3>
          <p className="mb-4 text-sm text-body">Ranking por total vendido.</p>
          {loading ? (
            <p className="text-sm text-body">Cargando...</p>
          ) : topWaitersRows.length === 0 ? (
            <p className="text-sm text-body">Sin datos por ahora.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/15 text-secondary hover:bg-secondary/15 dark:hover:bg-secondary/15">
                  <TableHead>Mesero</TableHead>
                  <TableHead>Ventas</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topWaitersRows.map((row) => (
                  <TableRow
                    key={row.waiter_id ?? row.name}
                    className="transition-colors hover:bg-secondary/10"
                  >
                    <TableCell className="font-medium text-black dark:text-white">
                      {row.name}
                    </TableCell>
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
