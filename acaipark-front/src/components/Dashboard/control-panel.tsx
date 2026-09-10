"use client";

import type { DateRange } from "@/components/DateRangeFilter";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DailyPaymentMethodChart } from "@/components/Dashboard/daily-payment-method-chart";
import { useEffect, useState } from "react";

type Sale = {
  id: number;
  total: number | string;
  courtesy_total: number | string;
  payment_method?: string | null;
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

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function ControlPanel({ range }: { range: DateRange }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<ExpensePayment[]>([]);
  const [topProducts, setTopProducts] = useState<SalesByProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [salesRes, purchasesRes, expensesRes, productsRes] =
          await Promise.all([
            fetch(`/api/sales?from_date=${range.from}&to_date=${range.to}`, { cache: "no-store" }),
            fetch(`/api/inventory/purchases?from_date=${range.from}&to_date=${range.to}`, { cache: "no-store" }),
            fetch(`/api/expenses/payments?from_date=${range.from}&to_date=${range.to}`, { cache: "no-store" }),
            fetch(`/api/sales/summary/products?from_date=${range.from}&to_date=${range.to}`, { cache: "no-store" }),
          ]);

        if (![salesRes, purchasesRes, expensesRes, productsRes].every((response) => response.ok)) throw new Error("No se pudo cargar el panel del período seleccionado.");
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
        setError("No se pudo cargar el panel del período seleccionado.");
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
  }, [range]);

  const totalSales = sales.reduce((sum, sale) => sum + safeNumber(sale.total), 0);
  const totalCourtesy = sales.reduce((sum, sale) => sum + safeNumber(sale.courtesy_total), 0);
  const totalPurchases = purchases.reduce((sum, purchase) => sum + safeNumber(purchase.total_cost), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + safeNumber(expense.amount), 0);
  const monthlyPayments = sales.reduce((totals, sale) => {
    const method = sale.payment_method || "cash";
    if (method === "cash") totals.cash_total += safeNumber(sale.total);
    if (method === "transfer") totals.transfer_total += safeNumber(sale.total);
    if (method === "dataphone" || method === "card") totals.dataphone_total += safeNumber(sale.total);
    totals.total += safeNumber(sale.total);
    return totals;
  }, { cash_total: 0, transfer_total: 0, dataphone_total: 0, total: 0 });

  const topProductsRows = topProducts
    .slice()
    .sort((a, b) => safeNumber(b.total) - safeNumber(a.total))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="text-red">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Ventas del período" value={loading ? "Cargando..." : formatMoney(totalSales)} />
        <StatCard title="Cortesías del período" value={loading ? "Cargando..." : formatMoney(totalCourtesy)} />
        <StatCard title="Compras del período" value={loading ? "Cargando..." : formatMoney(totalPurchases)} />
        <StatCard title="Gastos del período" value={loading ? "Cargando..." : formatMoney(totalExpenses)} />
        <StatCard title="Ingresos vs egresos" value={loading ? "Cargando..." : `${formatMoney(totalSales)} / ${formatMoney(totalPurchases + totalExpenses)}`} />
      </div>

      <section className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-black dark:text-white">Ingresos por medio de pago</h3>
            <p className="text-sm text-body">Ingresos del período seleccionado.</p>
          </div>

        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Efectivo" value={formatMoney(monthlyPayments?.cash_total)} helper={`${range.from} — ${range.to}`} />
          <StatCard title="Transferencia" value={formatMoney(monthlyPayments?.transfer_total)} helper={`${range.from} — ${range.to}`} />
          <StatCard title="Datáfono" value={formatMoney(monthlyPayments?.dataphone_total)} helper={`${range.from} — ${range.to}`} />
          <StatCard title="Total del período" value={formatMoney(monthlyPayments?.total)} helper={loading ? "Cargando..." : `${range.from} — ${range.to}`} />
        </div>
      </section>

      <section className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="text-xl font-semibold text-black dark:text-white">Frecuencia de ingresos por medio de pago</h3>
        <p className="mb-3 text-sm text-body">Distribución de los ingresos entre {range.from} y {range.to}.</p>
        {loading ? (
          <p className="text-sm text-body">Cargando gráfica...</p>
        ) : (
          <DailyPaymentMethodChart
            cash={safeNumber(monthlyPayments?.cash_total)}
            transfer={safeNumber(monthlyPayments?.transfer_total)}
            dataphone={safeNumber(monthlyPayments?.dataphone_total)}
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
