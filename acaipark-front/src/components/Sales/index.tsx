"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import MonthFilter, { currentMonth, monthLastDay } from "@/components/MonthFilter";
import DateRangeFilter, { currentMonthRange, type DateRange } from "@/components/DateRangeFilter";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

dayjs.extend(utc);
dayjs.extend(timezone);

const COLOMBIA_TZ = "America/Bogota";

type SaleItem = {
  id: number;
  menu_item_id: number | null;
  name: string;
  quantity: number | string;
  unit_price: number | string;
  tax_rate: number | string;
  line_subtotal: number | string;
  line_tax: number | string;
  line_total: number | string;
};

type Sale = {
  id: number;
  order_id: number;
  created_by_name?: string | null;
  created_by_email?: string | null;
  subtotal: number | string;
  tax_total: number | string;
  discount_total: number | string;
  courtesy_total: number | string;
  discount_count: number | string;
  courtesy_count: number | string;
  service_total: number | string;
  total: number | string;
  payment_method?: "cash" | "card" | "dataphone" | "transfer" | null;
  cash_received?: number | string | null;
  status?: string;
  created_at: string;
  items: SaleItem[];
};

type SalesByProduct = {
  menu_item_id: number | null;
  name: string;
  base?: string | null;
  quantity: number | string;
  total: number | string;
};

type SalesAdjustmentsByMonth = {
  year: number | string;
  month: number | string;
  courtesy_count: number | string;
  discount_count: number | string;
};

type DailyPaymentSummary = {
  date: string;
  cash_total: number | string;
  transfer_total: number | string;
  dataphone_total: number | string;
  total: number | string;
};

const SALES_HISTORY_PAGE_SIZE = 10;
const ADJUSTMENTS_MONTHLY_PAGE_SIZE = 8;
const SALES_BY_PRODUCT_PAGE_SIZE = 8;
function safeNumber(value: unknown) {
  const num =
    typeof value === "number" ? value : Number.parseFloat(String(value));
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
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(num);
}

function formatCount(value: unknown) {
  const num = safeNumber(value);
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(num);
}

function paymentMethodLabel(method: Sale["payment_method"]) {
  const labels: Record<string, string> = {
    cash: "Efectivo",
    card: "Datáfono",
    dataphone: "Datáfono",
    transfer: "Transferencia",
  };
  return labels[method ?? ""] ?? "No registrado";
}

function formatDate(value: string) {
  const withOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const parsed = withOffset ? dayjs(value) : dayjs.tz(value, COLOMBIA_TZ);
  if (!parsed.isValid()) return value;
  return parsed.tz(COLOMBIA_TZ).format("DD/MM/YYYY HH:mm");
}

function saleStatusMeta(status: string | undefined) {
  if (status === "void") {
    return { label: "Anulado", className: "bg-red/10 text-red" };
  }
  return { label: "Pagada", className: "bg-primary/10 text-primary" };
}

function formatMonthLabel(year: unknown, month: unknown) {
  const parsedYear = Math.max(0, Math.trunc(safeNumber(year)));
  const parsedMonth = Math.max(1, Math.min(12, Math.trunc(safeNumber(month))));
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return `${monthNames[parsedMonth - 1]} ${parsedYear}`;
}

async function fetchRows<T>(url: string, signal: AbortSignal): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("Respuesta inválida");
  return payload as T[];
}

type LoadErrors = Partial<Record<"sales" | "products" | "adjustments", string>>;

function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
}) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <p className="text-body text-xs">{`Página ${page} de ${totalPages}`}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded border border-stroke px-2 py-1 text-xs text-dark hover:bg-gray-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
        >
          Anterior
        </button>
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            className={
              "rounded border px-2 py-1 text-xs " +
              (pageNumber === page
                ? "border-primary bg-primary text-white"
                : "border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2")
            }
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded border border-stroke px-2 py-1 text-xs text-dark hover:bg-gray-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export default function Sales() {
  const [month, setMonth] = useState(currentMonth);
  const [range, setRange] = useState<DateRange>(currentMonthRange);
  return <><MonthFilter value={month} onChange={(value) => { setMonth(value); setRange({ from: `${value}-01`, to: monthLastDay(value) }); }}><DateRangeFilter value={range} onChange={setRange} onClear={() => { const value = currentMonth(); setMonth(value); setRange(currentMonthRange()); }} /></MonthFilter><MonthlySales key={`${month}-${range.from}-${range.to}`} month={month} range={range} /></>;
}

function MonthlySales({ month, range }: { month: string; range: DateRange }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesByProduct, setSalesByProduct] = useState<SalesByProduct[]>([]);
  const [salesAdjustmentsByMonth, setSalesAdjustmentsByMonth] = useState<
    SalesAdjustmentsByMonth[]
  >([]);
  const [salesHistoryPage, setSalesHistoryPage] = useState(1);
  const [salesByProductPage, setSalesByProductPage] = useState(1);
  const [adjustmentsMonthlyPage, setAdjustmentsMonthlyPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<LoadErrors>({});
  const requestRef = useRef<AbortController | null>(null);

  const withPeriodParam = useCallback(
    (basePath: string) => {
      return `${basePath}?from_date=${encodeURIComponent(range.from)}&to_date=${encodeURIComponent(range.to)}`;
    },
    [range],
  );

  const loadSalesData = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setErrors({});
    setSales([]);
    setSalesByProduct([]);
    setSalesAdjustmentsByMonth([]);
    const [salesResult, productsResult, adjustmentsResult] = await Promise.allSettled([
      fetchRows<Sale>(withPeriodParam("/api/sales"), controller.signal),
      fetchRows<SalesByProduct>(withPeriodParam("/api/sales/summary/products"), controller.signal),
      fetchRows<SalesAdjustmentsByMonth>(withPeriodParam("/api/sales/summary/adjustments/monthly"), controller.signal),
    ]);
    if (controller.signal.aborted) return;

    const nextErrors: LoadErrors = {};
    if (salesResult.status === "fulfilled") setSales(salesResult.value);
    else nextErrors.sales = "No se pudo cargar el historial de ventas del período seleccionado.";
    if (productsResult.status === "fulfilled") setSalesByProduct(productsResult.value);
    else nextErrors.products = "No se pudieron cargar las ventas por producto del período seleccionado.";
    if (adjustmentsResult.status === "fulfilled") setSalesAdjustmentsByMonth(adjustmentsResult.value);
    else nextErrors.adjustments = "No se pudieron cargar las cortesías y descuentos del período seleccionado.";
    setErrors(nextErrors);
    setLoading(false);
  }, [withPeriodParam]);

  useEffect(() => {
    void loadSalesData();
    return () => requestRef.current?.abort();
  }, [loadSalesData]);

  function salesValue(value: string | number) {
    return loading ? "Cargando..." : errors.sales ? "No disponible" : value;
  }

  const activeSales = useMemo(
    () => sales.filter((sale) => sale.status !== "void"),
    [sales],
  );
  const totalSalesValue = useMemo(
    () => activeSales.reduce((acc, sale) => acc + safeNumber(sale.total), 0),
    [activeSales],
  );
  const totalSalesCount = activeSales.length;
  const totalCourtesyApplied = useMemo(
    () =>
      activeSales.reduce((acc, sale) => acc + safeNumber(sale.courtesy_count), 0),
    [activeSales],
  );
  const totalDiscountApplied = useMemo(
    () =>
      activeSales.reduce((acc, sale) => acc + safeNumber(sale.discount_count), 0),
    [activeSales],
  );
  const salesHistoryTotalPages = Math.max(
    1,
    Math.ceil(sales.length / SALES_HISTORY_PAGE_SIZE),
  );
  const salesByProductTotalPages = Math.max(
    1,
    Math.ceil(salesByProduct.length / SALES_BY_PRODUCT_PAGE_SIZE),
  );
  const adjustmentsMonthlyTotalPages = Math.max(
    1,
    Math.ceil(salesAdjustmentsByMonth.length / ADJUSTMENTS_MONTHLY_PAGE_SIZE),
  );

  useEffect(() => {
    setSalesHistoryPage((prev) => Math.min(prev, salesHistoryTotalPages));
  }, [salesHistoryTotalPages]);

  useEffect(() => {
    setSalesByProductPage((prev) => Math.min(prev, salesByProductTotalPages));
  }, [salesByProductTotalPages]);

  useEffect(() => {
    setAdjustmentsMonthlyPage((prev) =>
      Math.min(prev, adjustmentsMonthlyTotalPages),
    );
  }, [adjustmentsMonthlyTotalPages]);

  useEffect(() => {
    setSalesHistoryPage(1);
  }, [month]);

  useEffect(() => {
    setSalesByProductPage(1);
  }, [month]);

  useEffect(() => {
    setAdjustmentsMonthlyPage(1);
  }, [month]);

  const paginatedSalesHistory = useMemo(() => {
    const start = (salesHistoryPage - 1) * SALES_HISTORY_PAGE_SIZE;
    return sales.slice(start, start + SALES_HISTORY_PAGE_SIZE);
  }, [sales, salesHistoryPage]);

  const paginatedSalesByProduct = useMemo(() => {
    const start = (salesByProductPage - 1) * SALES_BY_PRODUCT_PAGE_SIZE;
    return salesByProduct.slice(start, start + SALES_BY_PRODUCT_PAGE_SIZE);
  }, [salesByProduct, salesByProductPage]);

  const paginatedAdjustmentsByMonth = useMemo(() => {
    const start = (adjustmentsMonthlyPage - 1) * ADJUSTMENTS_MONTHLY_PAGE_SIZE;
    return salesAdjustmentsByMonth.slice(
      start,
      start + ADJUSTMENTS_MONTHLY_PAGE_SIZE,
    );
  }, [salesAdjustmentsByMonth, adjustmentsMonthlyPage]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-sm border border-stroke bg-white px-5 py-4 shadow-default transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-body text-sm">Ventas registradas</p>
          <p className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {salesValue(totalSalesCount)}
          </p>
        </div>
        <div className="rounded-sm border border-stroke bg-white px-5 py-4 shadow-default transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-body text-sm">Total vendido</p>
          <p className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {salesValue(formatMoney(totalSalesValue))}
          </p>
        </div>
        <div className="rounded-sm border border-stroke bg-white px-5 py-4 shadow-default transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-body text-sm">Cortesías aplicadas</p>
          <p className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {salesValue(formatCount(totalCourtesyApplied))}
          </p>
        </div>
        <div className="rounded-sm border border-stroke bg-white px-5 py-4 shadow-default transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-body text-sm">Descuentos aplicados</p>
          <p className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {salesValue(formatCount(totalDiscountApplied))}
          </p>
        </div>
      </div>

      <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xl font-semibold text-black dark:text-white">
              Historial de ventas
            </h3>
            <p className="text-body text-sm">
              Pedidos pagados registrados desde toma de pedidos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadSalesData}
              className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-black transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Actualizar
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-body text-sm">Cargando ventas...</p>
        ) : errors.sales ? (
          <p role="alert" className="text-red text-sm">{errors.sales}</p>
        ) : sales.length === 0 ? (
          <p className="text-body text-sm">No hay ventas registradas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venta</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Realizado por</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Medio de pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Cortesías</TableHead>
                <TableHead>Descuentos</TableHead>
                <TableHead>Monto descuento</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>INC</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSalesHistory.map((sale) => {
                const itemsCount = sale.items.reduce(
                  (acc, item) => acc + safeNumber(item.quantity),
                  0,
                );
                return (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium text-black dark:text-white">
                      #{sale.id}
                    </TableCell>
                    <TableCell>#{sale.order_id}</TableCell>
                    <TableCell>
                      {sale.created_by_name || sale.created_by_email ? (
                        <div className="min-w-36">
                          <p className="font-medium text-black dark:text-white">
                            {sale.created_by_name || "Usuario"}
                          </p>
                          {sale.created_by_email ? (
                            <p className="text-body text-xs">{sale.created_by_email}</p>
                          ) : null}
                        </div>
                      ) : (
                        "No registrado"
                      )}
                    </TableCell>
                    <TableCell>{formatDate(sale.created_at)}</TableCell>
                    <TableCell>{paymentMethodLabel(sale.payment_method)}</TableCell>
                    <TableCell>
                      <div
                        className={`max-w-fit rounded-full px-3.5 py-1 text-sm font-medium ${saleStatusMeta(sale.status).className}`}
                      >
                        {saleStatusMeta(sale.status).label}
                      </div>
                    </TableCell>
                    <TableCell>{formatQty(itemsCount)}</TableCell>
                    <TableCell>{formatCount(sale.courtesy_count)}</TableCell>
                    <TableCell>{formatCount(sale.discount_count)}</TableCell>
                    <TableCell>{formatMoney(sale.discount_total)}</TableCell>
                    <TableCell>{formatMoney(sale.subtotal)}</TableCell>
                    <TableCell>{formatMoney(sale.tax_total)}</TableCell>
                    <TableCell>{formatMoney(sale.service_total)}</TableCell>
                    <TableCell className="font-semibold text-black dark:text-white">
                      {formatMoney(sale.total)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!loading && !errors.sales ? (
          <PaginationControls
            page={salesHistoryPage}
            totalPages={salesHistoryTotalPages}
            onPageChange={(nextPage) =>
              setSalesHistoryPage(
                Math.max(1, Math.min(nextPage, salesHistoryTotalPages)),
              )
            }
          />
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xl font-semibold text-black dark:text-white">
                Ventas por producto
              </h3>
              <p className="text-body text-sm">Acumulado por producto, tamaño y tipo de base.</p>
            </div>
          </div>
          {loading ? (
            <p className="text-body text-sm">Cargando resumen...</p>
          ) : errors.products ? (
            <p role="alert" className="text-red text-sm">{errors.products}</p>
          ) : salesByProduct.length === 0 ? (
            <p className="text-body text-sm">No hay datos para mostrar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-none bg-[#F7F9FC] dark:bg-dark-2">
                  <TableHead>Producto</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSalesByProduct.map((row) => (
                  <TableRow key={`${row.menu_item_id}-${row.name}-${row.base ?? "none"}`}>
                    <TableCell className="font-medium text-black dark:text-white">
                      {row.name}
                    </TableCell>
                    <TableCell className="text-black dark:text-white">
                      {row.base ?? "Sin base registrada"}
                    </TableCell>
                    <TableCell className="text-black dark:text-white">
                      {formatQty(row.quantity)}
                    </TableCell>
                    <TableCell className="font-semibold text-black dark:text-white">
                      {formatMoney(row.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && !errors.products ? (
            <PaginationControls
              page={salesByProductPage}
              totalPages={salesByProductTotalPages}
              onPageChange={(nextPage) =>
                setSalesByProductPage(
                  Math.max(1, Math.min(nextPage, salesByProductTotalPages)),
                )
              }
            />
          ) : null}
        </div>
        <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xl font-semibold text-black dark:text-white">
                Cortesías y descuentos por mes
              </h3>
              <p className="text-body text-sm">
                Cantidad de ajustes aplicados agrupados por mes.
              </p>
            </div>
          </div>
          {loading ? (
            <p className="text-body text-sm">Cargando resumen...</p>
          ) : errors.adjustments ? (
            <p role="alert" className="text-red text-sm">{errors.adjustments}</p>
          ) : salesAdjustmentsByMonth.length === 0 ? (
            <p className="text-body text-sm">No hay datos para mostrar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead>Cortesías</TableHead>
                  <TableHead>Descuentos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAdjustmentsByMonth.map((row) => (
                  <TableRow key={`${row.year}-${row.month}`}>
                    <TableCell className="font-medium text-black dark:text-white">
                      {formatMonthLabel(row.year, row.month)}
                    </TableCell>
                    <TableCell>{formatCount(row.courtesy_count)}</TableCell>
                    <TableCell>{formatCount(row.discount_count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && !errors.adjustments ? (
            <PaginationControls
              page={adjustmentsMonthlyPage}
              totalPages={adjustmentsMonthlyTotalPages}
              onPageChange={(nextPage) =>
                setAdjustmentsMonthlyPage(
                  Math.max(1, Math.min(nextPage, adjustmentsMonthlyTotalPages)),
                )
              }
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
