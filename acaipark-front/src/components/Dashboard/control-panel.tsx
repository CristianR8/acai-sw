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
  status?: string;
  created_at: string;
};

type Purchase = {
  total_cost: number | string;
  status?: string;
  created_at: string;
  purchased_at?: string | null;
  received_at?: string | null;
};

type ExpensePayment = { amount: number | string; payment_date: string; status?: string };

type SalesByProduct = {
  menu_item_id: number | null;
  name: string;
  category: string;
  base?: string | null;
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

async function fetchRows<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("Respuesta inválida");
  return payload as T[];
}

type Section = "ventas" | "compras" | "gastos" | "productos más vendidos";
const SECTIONS: Section[] = ["ventas", "compras", "gastos", "productos más vendidos"];

export default function ControlPanel({ range }: { range: DateRange }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<ExpensePayment[]>([]);
  const [topProducts, setTopProducts] = useState<SalesByProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedSections, setFailedSections] = useState<Section[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setFailedSections([]);
      const results = await Promise.allSettled([
        fetchRows<Sale>(`/api/sales?from_date=${range.from}&to_date=${range.to}`),
        fetchRows<Purchase>(`/api/inventory/purchases?from_date=${range.from}&to_date=${range.to}`),
        fetchRows<ExpensePayment>(`/api/expenses/payments?from_date=${range.from}&to_date=${range.to}`),
        fetchRows<SalesByProduct>(`/api/sales/summary/products?from_date=${range.from}&to_date=${range.to}`),
      ]);
      if (cancelled) return;

      const [salesResult, purchasesResult, expensesResult, productsResult] = results;
      setSales(salesResult.status === "fulfilled" ? salesResult.value : []);
      setPurchases(purchasesResult.status === "fulfilled" ? purchasesResult.value : []);
      setExpenses(expensesResult.status === "fulfilled" ? expensesResult.value : []);
      setTopProducts(productsResult.status === "fulfilled" ? productsResult.value : []);
      setFailedSections(SECTIONS.filter((_, index) => results[index].status === "rejected"));
      setLoading(false);
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [range]);

  const salesUnavailable = failedSections.includes("ventas");
  const purchasesUnavailable = failedSections.includes("compras");
  const expensesUnavailable = failedSections.includes("gastos");
  const productsUnavailable = failedSections.includes("productos más vendidos");
  const comparisonUnavailable = salesUnavailable || purchasesUnavailable || expensesUnavailable;

  function amount(value: number, unavailable: boolean) {
    return loading ? "Cargando..." : unavailable ? "No disponible" : formatMoney(value);
  }

  const totalSales = sales
    .filter((sale) => sale.status !== "void")
    .reduce((sum, sale) => sum + safeNumber(sale.total), 0);
  const totalCourtesy = sales
    .filter((sale) => sale.status !== "void")
    .reduce((sum, sale) => sum + safeNumber(sale.courtesy_total), 0);
  const totalPurchases = purchases.reduce((sum, purchase) => sum + (purchase.status === "void" ? 0 : safeNumber(purchase.total_cost)), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.status === "void" ? 0 : safeNumber(expense.amount)), 0);
  const activeSales = sales.filter((sale) => sale.status !== "void");
  const monthlyPayments = activeSales.reduce((totals, sale) => {
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
      {failedSections.length > 0 ? (
        <p role="alert" className="text-red">
          No se pudieron cargar: {failedSections.join(", ")}. Los demás datos del período se muestran normalmente.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Ventas del período" value={amount(totalSales, salesUnavailable)} />
        <StatCard title="Cortesías del período" value={amount(totalCourtesy, salesUnavailable)} />
        <StatCard title="Compras del período" value={amount(totalPurchases, purchasesUnavailable)} />
        <StatCard title="Gastos del período" value={amount(totalExpenses, expensesUnavailable)} />
        <StatCard title="Ingresos vs egresos" value={loading ? "Cargando..." : comparisonUnavailable ? "No disponible" : `${formatMoney(totalSales)} / ${formatMoney(totalPurchases + totalExpenses)}`} />
      </div>

      <section className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-black dark:text-white">Ingresos por medio de pago</h3>
            <p className="text-sm text-body">Ingresos del período seleccionado.</p>
          </div>

        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Efectivo" value={amount(monthlyPayments.cash_total, salesUnavailable)} helper={`${range.from} — ${range.to}`} />
          <StatCard title="Transferencia" value={amount(monthlyPayments.transfer_total, salesUnavailable)} helper={`${range.from} — ${range.to}`} />
          <StatCard title="Datáfono" value={amount(monthlyPayments.dataphone_total, salesUnavailable)} helper={`${range.from} — ${range.to}`} />
          <StatCard title="Total del período" value={amount(monthlyPayments.total, salesUnavailable)} helper={loading ? "Cargando..." : `${range.from} — ${range.to}`} />
        </div>
      </section>

      <section className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="text-xl font-semibold text-black dark:text-white">Frecuencia de ingresos por medio de pago</h3>
        <p className="mb-3 text-sm text-body">Distribución de los ingresos entre {range.from} y {range.to}.</p>
        {loading ? (
          <p className="text-sm text-body">Cargando gráfica...</p>
        ) : salesUnavailable ? (
          <p className="text-sm text-body">No se pudieron cargar los ingresos por medio de pago.</p>
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
          ) : productsUnavailable ? (
            <p className="text-sm text-body">No se pudieron cargar los productos más vendidos.</p>
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
                    key={`${row.menu_item_id}-${row.name}-${row.category}-${row.base ?? "none"}`}
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
