"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { useCallback, useEffect, useMemo, useState } from "react";

dayjs.extend(utc);
dayjs.extend(timezone);

const COLOMBIA_TZ = "America/Bogota";

type SaleItem = {
  id: number;
  menu_item_id: number;
  name: string;
  category: string;
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
  subtotal: number | string;
  tax_total: number | string;
  discount_total: number | string;
  courtesy_total: number | string;
  discount_count: number | string;
  courtesy_count: number | string;
  service_total: number | string;
  total: number | string;
  created_at: string;
  items: SaleItem[];
};

type SalesByProduct = {
  menu_item_id: number;
  name: string;
  category: string;
  quantity: number | string;
  total: number | string;
};

type SalesAdjustmentsByMonth = {
  year: number | string;
  month: number | string;
  courtesy_count: number | string;
  discount_count: number | string;
};

const SALES_HISTORY_PAGE_SIZE = 10;
const ADJUSTMENTS_MONTHLY_PAGE_SIZE = 8;
const SALES_BY_PRODUCT_PAGE_SIZE = 8;
type TimeFilter = "all" | "week" | "month" | "quarter" | "year";

const TIME_FILTER_OPTIONS: Array<{ value: TimeFilter; label: string }> = [
  { value: "all", label: "Mostrar todo" },
  { value: "week", label: "Semana" },
  { value: "month", label: "1 mes" },
  { value: "quarter", label: "3 meses" },
  { value: "year", label: "Año" },
];

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

function formatDate(value: string) {
  const withOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const parsed = withOffset ? dayjs(value) : dayjs.tz(value, COLOMBIA_TZ);
  if (!parsed.isValid()) return value;
  return parsed.tz(COLOMBIA_TZ).format("DD/MM/YYYY HH:mm");
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

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

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

function TimeFilterSelect({
  value,
  onChange,
}: {
  value: TimeFilter;
  onChange: (nextValue: TimeFilter) => void;
}) {
  return (
    <label className="text-body flex items-center gap-2 text-sm">
      Tiempo
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as TimeFilter)}
        className="rounded-md border border-stroke bg-white px-2 py-1 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
      >
        {TIME_FILTER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesByProduct, setSalesByProduct] = useState<SalesByProduct[]>([]);
  const [salesAdjustmentsByMonth, setSalesAdjustmentsByMonth] = useState<
    SalesAdjustmentsByMonth[]
  >([]);
  const [salesHistoryPage, setSalesHistoryPage] = useState(1);
  const [salesByProductPage, setSalesByProductPage] = useState(1);
  const [adjustmentsMonthlyPage, setAdjustmentsMonthlyPage] = useState(1);
  const [salesHistoryFilter, setSalesHistoryFilter] =
    useState<TimeFilter>("all");
  const [salesByProductFilter, setSalesByProductFilter] =
    useState<TimeFilter>("all");
  const [adjustmentsMonthlyFilter, setAdjustmentsMonthlyFilter] =
    useState<TimeFilter>("all");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const withPeriodParam = useCallback(
    (basePath: string, period: TimeFilter) => {
      return `${basePath}?period=${encodeURIComponent(period)}`;
    },
    [],
  );

  const loadSalesData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [
        salesResponse,
        productsResponse,
        adjustmentsMonthlyResponse,
      ] = await Promise.all([
        fetch(withPeriodParam("/api/sales", salesHistoryFilter), {
          cache: "no-store",
        }),
        fetch(
          withPeriodParam("/api/sales/summary/products", salesByProductFilter),
          {
            cache: "no-store",
          },
        ),
        fetch(
          withPeriodParam(
            "/api/sales/summary/adjustments/monthly",
            adjustmentsMonthlyFilter,
          ),
          { cache: "no-store" },
        ),
      ]);

      const [
        salesPayload,
        productsPayload,
        adjustmentsMonthlyPayload,
      ] = await Promise.all([
        safeJson(salesResponse),
        safeJson(productsResponse),
        safeJson(adjustmentsMonthlyResponse),
      ]);

      if (!salesResponse.ok) {
        throw new Error(
          (salesPayload as any)?.message ||
            "No se pudo cargar el historial de ventas",
        );
      }
      if (!productsResponse.ok) {
        throw new Error(
          (productsPayload as any)?.message ||
            "No se pudo cargar ventas por producto",
        );
      }
      if (!adjustmentsMonthlyResponse.ok) {
        throw new Error(
          (adjustmentsMonthlyPayload as any)?.message ||
            "No se pudo cargar cortesias/descuentos por mes",
        );
      }
      setSales(Array.isArray(salesPayload) ? (salesPayload as Sale[]) : []);
      setSalesByProduct(
        Array.isArray(productsPayload)
          ? (productsPayload as SalesByProduct[])
          : [],
      );
      setSalesAdjustmentsByMonth(
        Array.isArray(adjustmentsMonthlyPayload)
          ? (adjustmentsMonthlyPayload as SalesAdjustmentsByMonth[])
          : [],
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo cargar ventas";
      setErrorMessage(message);
      setSales([]);
      setSalesByProduct([]);
      setSalesAdjustmentsByMonth([]);
    } finally {
      setLoading(false);
    }
  }, [
    adjustmentsMonthlyFilter,
    salesByProductFilter,
    salesHistoryFilter,
    withPeriodParam,
  ]);

  useEffect(() => {
    loadSalesData();
  }, [loadSalesData]);

  const totalSalesValue = useMemo(
    () => sales.reduce((acc, sale) => acc + safeNumber(sale.total), 0),
    [sales],
  );
  const totalSalesCount = sales.length;
  const totalCourtesyApplied = useMemo(
    () => sales.reduce((acc, sale) => acc + safeNumber(sale.courtesy_count), 0),
    [sales],
  );
  const totalDiscountApplied = useMemo(
    () => sales.reduce((acc, sale) => acc + safeNumber(sale.discount_count), 0),
    [sales],
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
  }, [salesHistoryFilter]);

  useEffect(() => {
    setSalesByProductPage(1);
  }, [salesByProductFilter]);

  useEffect(() => {
    setAdjustmentsMonthlyPage(1);
  }, [adjustmentsMonthlyFilter]);

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
            {totalSalesCount}
          </p>
        </div>
        <div className="rounded-sm border border-stroke bg-white px-5 py-4 shadow-default transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-body text-sm">Total vendido</p>
          <p className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {formatMoney(totalSalesValue)}
          </p>
        </div>
        <div className="rounded-sm border border-stroke bg-white px-5 py-4 shadow-default transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-body text-sm">Cortesías aplicadas</p>
          <p className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {formatCount(totalCourtesyApplied)}
          </p>
        </div>
        <div className="rounded-sm border border-stroke bg-white px-5 py-4 shadow-default transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-body text-sm">Descuentos aplicados</p>
          <p className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {formatCount(totalDiscountApplied)}
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
            <TimeFilterSelect
              value={salesHistoryFilter}
              onChange={setSalesHistoryFilter}
            />
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
        ) : errorMessage ? (
          <p className="text-danger text-sm">{errorMessage}</p>
        ) : sales.length === 0 ? (
          <p className="text-body text-sm">No hay ventas registradas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venta</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Fecha</TableHead>
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
                    <TableCell>{formatDate(sale.created_at)}</TableCell>
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
        {!loading && !errorMessage ? (
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
              <p className="text-body text-sm">Acumulado por item del menu.</p>
            </div>
            <TimeFilterSelect
              value={salesByProductFilter}
              onChange={setSalesByProductFilter}
            />
          </div>
          {loading ? (
            <p className="text-body text-sm">Cargando resumen...</p>
          ) : salesByProduct.length === 0 ? (
            <p className="text-body text-sm">No hay datos para mostrar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-none bg-[#F7F9FC] dark:bg-dark-2">
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSalesByProduct.map((row) => (
                  <TableRow key={row.menu_item_id}>
                    <TableCell className="font-medium text-black dark:text-white">
                      {row.name}
                    </TableCell>
                    <TableCell className="text-black dark:text-white">
                      {row.category}
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
          {!loading ? (
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
            <TimeFilterSelect
              value={adjustmentsMonthlyFilter}
              onChange={setAdjustmentsMonthlyFilter}
            />
          </div>
          {loading ? (
            <p className="text-body text-sm">Cargando resumen...</p>
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
          {!loading ? (
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
