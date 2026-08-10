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
  electronic_invoice_status?: string | null;
  electronic_invoice_number?: string | null;
  electronic_invoice_environment?: string | null;
  electronic_invoice_cufe?: string | null;
  electronic_invoice_qr_url?: string | null;
  electronic_invoice_email_status?: string | null;
  electronic_invoice_email_address?: string | null;
  electronic_invoice_email_error?: string | null;
  items: SaleItem[];
};

type Purchase = {
  id: number;
  total_cost: number | string;
  purchased_at?: string | null;
  received_at?: string | null;
  created_at: string;
  supplier_name?: string | null;
};

type SalesByProduct = {
  menu_item_id: number;
  name: string;
  category: string;
  quantity: number | string;
  total: number | string;
};

type SalesByCategory = {
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

type SalesAdjustmentsByMonth = {
  year: number | string;
  month: number | string;
  courtesy_count: number | string;
  discount_count: number | string;
};

const SALES_HISTORY_PAGE_SIZE = 10;
const ADJUSTMENTS_MONTHLY_PAGE_SIZE = 8;
const SALES_BY_PRODUCT_PAGE_SIZE = 8;
const SALES_BY_CATEGORY_PAGE_SIZE = 8;
const SALES_BY_WAITER_PAGE_SIZE = 8;
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
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [salesByProduct, setSalesByProduct] = useState<SalesByProduct[]>([]);
  const [salesByCategory, setSalesByCategory] = useState<SalesByCategory[]>([]);
  const [salesByWaiter, setSalesByWaiter] = useState<SalesByWaiter[]>([]);
  const [salesAdjustmentsByMonth, setSalesAdjustmentsByMonth] = useState<
    SalesAdjustmentsByMonth[]
  >([]);
  const [salesHistoryPage, setSalesHistoryPage] = useState(1);
  const [salesByProductPage, setSalesByProductPage] = useState(1);
  const [salesByCategoryPage, setSalesByCategoryPage] = useState(1);
  const [salesByWaiterPage, setSalesByWaiterPage] = useState(1);
  const [adjustmentsMonthlyPage, setAdjustmentsMonthlyPage] = useState(1);
  const [salesHistoryFilter, setSalesHistoryFilter] =
    useState<TimeFilter>("all");
  const [salesByProductFilter, setSalesByProductFilter] =
    useState<TimeFilter>("all");
  const [salesByCategoryFilter, setSalesByCategoryFilter] =
    useState<TimeFilter>("all");
  const [salesByWaiterFilter, setSalesByWaiterFilter] =
    useState<TimeFilter>("all");
  const [adjustmentsMonthlyFilter, setAdjustmentsMonthlyFilter] =
    useState<TimeFilter>("all");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sendingEmailSaleId, setSendingEmailSaleId] = useState<number | null>(
    null,
  );

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
        categoriesResponse,
        waitersResponse,
        adjustmentsMonthlyResponse,
        purchasesResponse,
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
            "/api/sales/summary/categories",
            salesByCategoryFilter,
          ),
          {
            cache: "no-store",
          },
        ),
        fetch(
          withPeriodParam("/api/sales/summary/waiters", salesByWaiterFilter),
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
        fetch("/api/inventory/purchases", { cache: "no-store" }),
      ]);

      const [
        salesPayload,
        productsPayload,
        categoriesPayload,
        waitersPayload,
        adjustmentsMonthlyPayload,
        purchasesPayload,
      ] = await Promise.all([
        safeJson(salesResponse),
        safeJson(productsResponse),
        safeJson(categoriesResponse),
        safeJson(waitersResponse),
        safeJson(adjustmentsMonthlyResponse),
        safeJson(purchasesResponse),
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
      if (!categoriesResponse.ok) {
        throw new Error(
          (categoriesPayload as any)?.message ||
            "No se pudo cargar ventas por categoria",
        );
      }
      if (!waitersResponse.ok) {
        throw new Error(
          (waitersPayload as any)?.message ||
            "No se pudo cargar ventas por mesero",
        );
      }
      if (!adjustmentsMonthlyResponse.ok) {
        throw new Error(
          (adjustmentsMonthlyPayload as any)?.message ||
            "No se pudo cargar cortesias/descuentos por mes",
        );
      }
      if (!purchasesResponse.ok) {
        throw new Error(
          (purchasesPayload as any)?.message || "No se pudieron cargar los egresos",
        );
      }

      setSales(Array.isArray(salesPayload) ? (salesPayload as Sale[]) : []);
      setSalesByProduct(
        Array.isArray(productsPayload)
          ? (productsPayload as SalesByProduct[])
          : [],
      );
      setSalesByCategory(
        Array.isArray(categoriesPayload)
          ? (categoriesPayload as SalesByCategory[])
          : [],
      );
      setSalesByWaiter(
        Array.isArray(waitersPayload)
          ? (waitersPayload as SalesByWaiter[])
          : [],
      );
      setSalesAdjustmentsByMonth(
        Array.isArray(adjustmentsMonthlyPayload)
          ? (adjustmentsMonthlyPayload as SalesAdjustmentsByMonth[])
          : [],
      );
      setPurchases(Array.isArray(purchasesPayload) ? (purchasesPayload as Purchase[]) : []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo cargar ventas";
      setErrorMessage(message);
      setSales([]);
      setSalesByProduct([]);
      setSalesByCategory([]);
      setSalesByWaiter([]);
      setSalesAdjustmentsByMonth([]);
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [
    adjustmentsMonthlyFilter,
    salesByCategoryFilter,
    salesByProductFilter,
    salesByWaiterFilter,
    salesHistoryFilter,
    withPeriodParam,
  ]);

  useEffect(() => {
    loadSalesData();
  }, [loadSalesData]);

  const handleResendEmail = useCallback(
    async (sale: Sale) => {
      const suggestedEmail = sale.electronic_invoice_email_address ?? "";
      const emailInput = window.prompt(
        "Correo destino para enviar la factura",
        suggestedEmail,
      );
      const email = emailInput?.trim() ?? "";
      if (!email) return;

      setSendingEmailSaleId(sale.id);
      try {
        const response = await fetch(
          `/api/factus/sales/${sale.id}/send-email`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email }),
          },
        );
        const payload = await safeJson(response);
        if (!response.ok) {
          throw new Error(
            (payload as any)?.message ||
              (payload as any)?.detail ||
              "No se pudo reenviar el correo",
          );
        }
        await loadSalesData();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo reenviar el correo";
        window.alert(message);
      } finally {
        setSendingEmailSaleId(null);
      }
    },
    [loadSalesData],
  );

  const totalSalesValue = useMemo(
    () => sales.reduce((acc, sale) => acc + safeNumber(sale.total), 0),
    [sales],
  );
  const totalSalesCount = sales.length;
  const totalItemsSold = useMemo(
    () =>
      sales.reduce(
        (acc, sale) =>
          acc +
          sale.items.reduce(
            (inner, item) => inner + safeNumber(item.quantity),
            0,
          ),
        0,
      ),
    [sales],
  );
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
  const salesByCategoryTotalPages = Math.max(
    1,
    Math.ceil(salesByCategory.length / SALES_BY_CATEGORY_PAGE_SIZE),
  );
  const salesByWaiterTotalPages = Math.max(
    1,
    Math.ceil(salesByWaiter.length / SALES_BY_WAITER_PAGE_SIZE),
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
    setSalesByCategoryPage((prev) => Math.min(prev, salesByCategoryTotalPages));
  }, [salesByCategoryTotalPages]);

  useEffect(() => {
    setSalesByWaiterPage((prev) => Math.min(prev, salesByWaiterTotalPages));
  }, [salesByWaiterTotalPages]);

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
    setSalesByCategoryPage(1);
  }, [salesByCategoryFilter]);

  useEffect(() => {
    setSalesByWaiterPage(1);
  }, [salesByWaiterFilter]);

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

  const paginatedSalesByCategory = useMemo(() => {
    const start = (salesByCategoryPage - 1) * SALES_BY_CATEGORY_PAGE_SIZE;
    return salesByCategory.slice(start, start + SALES_BY_CATEGORY_PAGE_SIZE);
  }, [salesByCategory, salesByCategoryPage]);

  const paginatedSalesByWaiter = useMemo(() => {
    const start = (salesByWaiterPage - 1) * SALES_BY_WAITER_PAGE_SIZE;
    return salesByWaiter.slice(start, start + SALES_BY_WAITER_PAGE_SIZE);
  }, [salesByWaiter, salesByWaiterPage]);

  const paginatedAdjustmentsByMonth = useMemo(() => {
    const start = (adjustmentsMonthlyPage - 1) * ADJUSTMENTS_MONTHLY_PAGE_SIZE;
    return salesAdjustmentsByMonth.slice(
      start,
      start + ADJUSTMENTS_MONTHLY_PAGE_SIZE,
    );
  }, [salesAdjustmentsByMonth, adjustmentsMonthlyPage]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
          <p className="text-body text-sm">Items vendidos</p>
          <p className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {formatQty(totalItemsSold)}
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
                <TableHead>Factura electronica</TableHead>
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
                    <TableCell>
                      {sale.electronic_invoice_status === "issued" ? (
                        <div className="space-y-1">
                          <p className="text-success text-xs font-medium">
                            Emitida
                            {sale.electronic_invoice_number
                              ? ` #${sale.electronic_invoice_number}`
                              : ""}
                          </p>
                          {sale.electronic_invoice_cufe ? (
                            <p
                              className="text-body max-w-[220px] truncate text-[11px]"
                              title={sale.electronic_invoice_cufe}
                            >
                              CUFE: {sale.electronic_invoice_cufe}
                            </p>
                          ) : null}
                          {sale.electronic_invoice_qr_url ? (
                            <a
                              href={sale.electronic_invoice_qr_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Ver FE
                            </a>
                          ) : null}
                          <a
                            href={`/api/factus/sales/${sale.id}/document`}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs font-medium text-primary hover:underline"
                          >
                            Descargar PDF
                          </a>
                          {sale.electronic_invoice_email_status === "sent" ? (
                            <p
                              className="text-success max-w-[220px] truncate text-[11px]"
                              title={
                                sale.electronic_invoice_email_address ?? ""
                              }
                            >
                              Correo enviado
                              {sale.electronic_invoice_email_address
                                ? `: ${sale.electronic_invoice_email_address}`
                                : ""}
                            </p>
                          ) : sale.electronic_invoice_email_status ===
                            "failed" ? (
                            <p
                              className="text-danger max-w-[220px] truncate text-[11px]"
                              title={sale.electronic_invoice_email_error ?? ""}
                            >
                              Correo fallido
                            </p>
                          ) : sale.electronic_invoice_email_status ===
                            "requested" ? (
                            <p
                              className="text-body max-w-[220px] truncate text-[11px]"
                              title={
                                sale.electronic_invoice_email_address ?? ""
                              }
                            >
                              Correo solicitado a Factus
                              {sale.electronic_invoice_email_address
                                ? `: ${sale.electronic_invoice_email_address}`
                                : ""}
                            </p>
                          ) : (
                            <p className="text-body text-[11px]">
                              Correo no solicitado
                            </p>
                          )}
                          {sale.electronic_invoice_environment === "sandbox" ? (
                            <p className="text-body text-[11px]">
                              Reenvio manual no disponible en sandbox.
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleResendEmail(sale)}
                              disabled={sendingEmailSaleId === sale.id}
                              className="rounded border border-stroke px-2 py-1 text-[11px] font-medium text-black hover:bg-gray-2 disabled:opacity-60 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                            >
                              {sendingEmailSaleId === sale.id
                                ? "Enviando..."
                                : "Reenviar correo"}
                            </button>
                          )}
                        </div>
                      ) : sale.electronic_invoice_status === "failed" ? (
                        <span className="text-danger text-xs font-medium">
                          Fallida
                        </span>
                      ) : sale.electronic_invoice_status === "pending" ? (
                        <span className="text-warning text-xs font-medium">
                          Pendiente
                        </span>
                      ) : (
                        <span className="text-body text-xs">No emitida</span>
                      )}
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

      <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-black dark:text-white">
            Egresos por compras
          </h3>
          <p className="text-body text-sm">
            Compras de inventario y utensilios registradas en el sistema.
          </p>
        </div>

        {loading ? (
          <p className="text-body text-sm">Cargando egresos...</p>
        ) : errorMessage ? (
          <p className="text-danger text-sm">{errorMessage}</p>
        ) : purchases.length === 0 ? (
          <p className="text-body text-sm">No hay compras registradas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Compra</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Monto gastado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell className="font-medium text-black dark:text-white">
                    #{purchase.id}
                  </TableCell>
                  <TableCell>
                    {formatDate(
                      purchase.purchased_at ?? purchase.received_at ?? purchase.created_at,
                    )}
                  </TableCell>
                  <TableCell>{purchase.supplier_name ?? "Sin proveedor"}</TableCell>
                  <TableCell className="text-right font-semibold text-black dark:text-white">
                    {formatMoney(purchase.total_cost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
                Ventas por categoria
              </h3>
              <p className="text-body text-sm">
                Acumulado por categoria del menu.
              </p>
            </div>
            <TimeFilterSelect
              value={salesByCategoryFilter}
              onChange={setSalesByCategoryFilter}
            />
          </div>
          {loading ? (
            <p className="text-body text-sm">Cargando resumen...</p>
          ) : salesByCategory.length === 0 ? (
            <p className="text-body text-sm">No hay datos para mostrar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSalesByCategory.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell className="font-medium text-black dark:text-white">
                      {row.category}
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
          {!loading ? (
            <PaginationControls
              page={salesByCategoryPage}
              totalPages={salesByCategoryTotalPages}
              onPageChange={(nextPage) =>
                setSalesByCategoryPage(
                  Math.max(1, Math.min(nextPage, salesByCategoryTotalPages)),
                )
              }
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xl font-semibold text-black dark:text-white">
                Ventas por mesero
              </h3>
              <p className="text-body text-sm">
                Acumulado por mesero asignado.
              </p>
            </div>
            <TimeFilterSelect
              value={salesByWaiterFilter}
              onChange={setSalesByWaiterFilter}
            />
          </div>
          {loading ? (
            <p className="text-body text-sm">Cargando resumen...</p>
          ) : salesByWaiter.length === 0 ? (
            <p className="text-body text-sm">No hay datos para mostrar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mesero</TableHead>
                  <TableHead>Ventas</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSalesByWaiter.map((row) => (
                  <TableRow key={row.waiter_id ?? row.name}>
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
          {!loading ? (
            <PaginationControls
              page={salesByWaiterPage}
              totalPages={salesByWaiterTotalPages}
              onPageChange={(nextPage) =>
                setSalesByWaiterPage(
                  Math.max(1, Math.min(nextPage, salesByWaiterTotalPages)),
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
