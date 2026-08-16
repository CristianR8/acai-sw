"use client";

import { CheckIcon } from "@/assets/icons";
import { DownloadIcon, PreviewIcon } from "@/components/Tables/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { FaRegEdit, FaRegTrashAlt } from "react-icons/fa";
import { HiOutlineCash } from "react-icons/hi";
import { RiProhibited2Line } from "react-icons/ri";
import GuidedOrderBuilder, { type GuidedOrder } from "@/components/Pos/GuidedOrderBuilder";
import { useCurrentUserRole } from "@/hooks/use-current-user-role";

dayjs.extend(utc);
dayjs.extend(timezone);

const COLOMBIA_TZ = "America/Bogota";
const INC_RATE = 0.08;
const POS_HIDDEN_FINISHED_ORDERS_KEY = "pos_hidden_finished_orders_v1";

function loadHiddenFinishedOrderIdsFromStorage() {
  if (typeof window === "undefined") return new Set<number>();
  try {
    const raw = window.localStorage.getItem(POS_HIDDEN_FINISHED_ORDERS_KEY);
    if (!raw) return new Set<number>();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set<number>();
    const ids = parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    return new Set<number>(ids);
  } catch {
    return new Set<number>();
  }
}

function persistHiddenFinishedOrderIds(ids: Set<number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      POS_HIDDEN_FINISHED_ORDERS_KEY,
      JSON.stringify(Array.from(ids.values())),
    );
  } catch {
    // Ignore local storage write errors.
  }
}

type MenuItem = {
  id: number;
  name: string;
  category: string;
  price: string | number;
  description?: string | null;
  ingredients?: MenuIngredient[] | string[] | null;
};

type MenuIngredient = {
  name: string;
  unit: string;
  weight: string | number;
  price: string | number;
  total?: string | number;
};

type PosTable = {
  id: number;
  name: string;
  is_active: boolean;
};

type Customer = {
  id: number;
  name: string;
  identity_document: string;
  phone?: string | null;
  is_active: boolean;
};

type LoyaltyRegistration = {
  token: string;
  status: "pending" | "completed" | "expired";
  customer_id?: number | null;
  customer_name?: string | null;
  loyalty_stamps?: number | null;
  loyalty_rewards?: number | null;
  loyalty_code?: string | null;
};

type PaymentMethod = "cash" | "card" | "transfer";

type PosOrderItemCreate = {
  menu_item_id: number;
  quantity: number;
  unit_price: number;
  tax_rate: number | null;
  discount_rate: number | null;
  courtesy: boolean;
  note?: string | null;
};

type CartEditDraft = GuidedOrder & { cartItemId: number };

type PosOrderOut = {
  id: number;
  table_id: number;
  sale_id?: number | null;
  status: string;
  electronic_invoice_status?: string | null;
  electronic_invoice_number?: string | null;
  subtotal: number | string;
  tax_total: number | string;
  discount_total: number | string;
  courtesy_total: number | string;
  service_total: number | string;
  total: number | string;
  opened_at: string;
  sent_at?: string | null;
  delivered_at?: string | null;
  closed_at?: string | null;
  items: Array<{
    id: number;
    menu_item_id: number;
    name: string;
    category: string;
    zone: string;
    quantity: number | string;
    unit_price: number | string;
    tax_rate: number | string;
    discount_amount: number | string;
    courtesy: boolean;
    note?: string | null;
    line_subtotal?: number | string;
    line_tax?: number | string;
    line_total: number | string;
  }>;
};

function formatMoney(value: unknown) {
  const num =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(num)) return String(value ?? "");
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(num);
}

function categoryKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toColombiaTime(value?: string | null) {
  if (!value) return null;
  const hasTzOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  if (hasTzOffset) {
    const withOffset = dayjs(value);
    return withOffset.isValid() ? withOffset.tz(COLOMBIA_TZ) : null;
  }
  const asBogota = dayjs.tz(value, COLOMBIA_TZ);
  return asBogota.isValid() ? asBogota : null;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const ORDER_STATUS_META: Record<
  string,
  {
    label: string;
    className: string;
  }
> = {
  open: { label: "En curso", className: "bg-[#FFA70B]/[0.12] text-[#FFA70B]" },
  sent: { label: "Enviado", className: "bg-[#219653]/[0.08] text-[#219653]" },
  delivered: {
    label: "Entregado",
    className: "bg-[#219653]/[0.08] text-[#219653]",
  },
  paid: { label: "Pagado", className: "bg-[#1F2937]/10 text-[#1F2937]" },
  closed: { label: "Pagado", className: "bg-[#1F2937]/10 text-[#1F2937]" },
  void: { label: "Anulado", className: "bg-[#D34053]/[0.12] text-[#D34053]" },
};

function orderStatusMeta(status: string) {
  return (
    ORDER_STATUS_META[status] ?? {
      label: status,
      className: "bg-gray-2 text-dark dark:bg-dark-3 dark:text-white",
    }
  );
}

function buildOrderPdf(order: PosOrderOut) {
  const doc = new jsPDF();
  const status = orderStatusMeta(order.status);
  const createdAt = toColombiaTime(order.opened_at);

  doc.setFontSize(16);
  doc.text(`Pedido #${order.id}`, 14, 16);
  doc.setFontSize(11);
  doc.text(`Estado: ${status.label}`, 14, 26);
  doc.text(
    `Creado: ${createdAt?.isValid() ? createdAt.format("DD/MM/YYYY HH:mm") : "—"}`,
    14,
    32,
  );
  doc.text(`Total: ${formatMoney(order.total)}`, 14, 38);

  doc.setFontSize(13);
  doc.text("Comanda", 14, 48);
  doc.setFontSize(10);

  let y = 56;
  order.items.forEach((item, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const lineTotal =
      Number(item.line_total ?? 0) ||
      Number(item.unit_price) * Math.max(1, Number(item.quantity) || 1);

    doc.text(`${index + 1}. ${item.name} x${item.quantity}`, 14, y);
    doc.text(`${formatMoney(item.unit_price)} c/u`, 14, y + 6);
    doc.text("Zona: Preparación", 80, y + 6);
    doc.text(`Total: ${formatMoney(lineTotal)}`, 196, y, { align: "right" });
    if (item.note) {
      doc.text(`Nota: ${item.note}`, 14, y + 12);
      y += 20;
    } else {
      y += 16;
    }
  });

  y += 4;
  const totals: Array<[string, number | string]> = [
    ["Subtotal", order.subtotal],
    ["INC", order.tax_total],
    ["Descuentos", order.discount_total],
    ["Cortesías", order.courtesy_total],
    ["Servicio", order.service_total],
    ["Total", order.total],
  ];

  doc.setFontSize(11);
  totals.forEach(([label, value]) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(label, 140, y);
    doc.text(formatMoney(value), 196, y, { align: "right" });
    y += 8;
  });

  return doc;
}

// Modal para ver pedido existente
function ViewOrderModal({
  order,
  onClose,
}: {
  order: PosOrderOut | null;
  onClose: () => void;
}) {
  if (!order) return null;
  const zoneLabel = (_zone: string) => "Preparación";
  const status = orderStatusMeta(order.status);
  return (
    <div
      className="fixed inset-0 z-99 flex animate-[fadeIn_160ms_ease-out_forwards] items-center justify-center bg-black/60 p-4 opacity-0"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl animate-[fadeIn_200ms_ease-out_60ms_forwards] overflow-hidden rounded-2xl border border-stroke bg-white opacity-0 shadow-2xl dark:border-dark-3 dark:bg-gray-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stroke px-4 py-3 dark:border-dark-3">
          <div>
            <h3 className="text-base font-semibold text-dark dark:text-white">
              Pedido #{order.id}
            </h3>
            <p className="text-body-color text-xs dark:text-dark-6">
              Estado: {status.label} · Total: {formatMoney(order.total)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stroke px-3 py-1.5 text-sm font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          >
            Cerrar
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-3">
          {order.items.length === 0 ? (
            <p className="text-sm text-dark-6 dark:text-dark-6">Sin items.</p>
          ) : (
            order.items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-stroke bg-white p-3 text-sm text-dark shadow-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-xs text-dark-6 dark:text-dark-6">
                      {item.category} · {zoneLabel(item.zone)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-primary">
                    {formatMoney(Number(item.unit_price))}
                  </div>
                </div>
                <div className="mt-1 text-xs text-dark-6 dark:text-dark-6">
                  Cant: {item.quantity} · INC: {Number(item.tax_rate) * 100}% ·
                  Desc:{" "}
                  {Number(item.discount_amount) > 0
                    ? formatMoney(item.discount_amount)
                    : "0"}
                  {item.courtesy ? " · Cortesía" : ""}
                </div>
                <div className="mt-1 text-xs font-semibold text-dark dark:text-white">
                  Total línea: {formatMoney(Number(item.line_total))}
                </div>
              </div>
            ))
          )}

          <div className="space-y-1 text-sm text-dark dark:text-white">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>{formatMoney(Number(order.subtotal))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>INC</span>
              <span>{formatMoney(Number(order.tax_total))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Descuentos</span>
              <span>{formatMoney(Number(order.discount_total))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cortesías</span>
              <span>{formatMoney(Number(order.courtesy_total))}</span>
            </div>
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>{formatMoney(Number(order.total))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PosScreen() {
  const { isAdministrator } = useCurrentUserRole();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<PosOrderOut[]>([]);

  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [viewOrder, setViewOrder] = useState<PosOrderOut | null>(null);
  const [cart, setCart] = useState<Record<number, PosOrderItemCreate>>({});
  const [guidedEditDraft, setGuidedEditDraft] = useState<CartEditDraft | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [clearFinishedStatus, setClearFinishedStatus] = useState<
    "idle" | "loading"
  >("idle");
  const [hiddenFinishedOrderIds, setHiddenFinishedOrderIds] = useState<
    Set<number>
  >(loadHiddenFinishedOrderIdsFromStorage);

  const [submitStatus, setSubmitStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"choice" | "new" | "existing">(
    "choice",
  );
  const [paymentOrder, setPaymentOrder] = useState<PosOrderOut | null>(null);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearchInput, setCustomerSearchInput] = useState("");
  const [loyaltyRegistration, setLoyaltyRegistration] =
    useState<LoyaltyRegistration | null>(null);
  const [loyaltyQrDataUrl, setLoyaltyQrDataUrl] = useState("");
  const [applyConsumptionTax, setApplyConsumptionTax] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [receivedAmountInput, setReceivedAmountInput] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const [deliveryStatus, setDeliveryStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartTotals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let discount = 0;
    let courtesy = 0;
    for (const item of cartItems) {
      const qty = item.quantity;
      const price = item.unit_price;
      const lineBase = price * qty;
      const lineDiscount = lineBase * (item.discount_rate ?? 0);
      const lineSubtotal = Math.max(lineBase - lineDiscount, 0);
      const lineTax = lineSubtotal * (item.tax_rate ?? 0);
      subtotal += item.courtesy ? 0 : lineSubtotal;
      tax += item.courtesy ? 0 : lineTax;
      discount += lineDiscount;
      courtesy += item.courtesy ? lineBase : 0;
    }
    return {
      subtotal,
      tax,
      discount,
      courtesy,
      total: subtotal + tax,
    };
  }, [cartItems]);

  const paymentPreview = useMemo(() => {
    if (!paymentOrder) return null;
    const subtotal = Number(paymentOrder.subtotal) || 0;
    const serviceTotal = Number(paymentOrder.service_total) || 0;
    const incTotal = applyConsumptionTax ? subtotal * INC_RATE : 0;
    return {
      subtotal,
      incTotal,
      serviceTotal,
      total: subtotal + incTotal + serviceTotal,
    };
  }, [paymentOrder, applyConsumptionTax]);

  const receivedAmount = Number.parseFloat(receivedAmountInput);
  const paymentChange = paymentPreview
    ? receivedAmount - paymentPreview.total
    : null;
  const hasEnoughCash =
    Number.isFinite(receivedAmount) && paymentChange !== null && paymentChange >= 0;
  const canCompletePayment = paymentMethod !== "cash" || hasEnoughCash;

  const activeOrders = useMemo(
    () => orders.filter((o) => !["closed", "void"].includes(o.status)),
    [orders],
  );
  const finishedOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          ["closed", "void"].includes(o.status) &&
          !hiddenFinishedOrderIds.has(Number(o.id)),
      ),
    [orders, hiddenFinishedOrderIds],
  );

  function handlePreviewPdf(order: PosOrderOut) {
    const doc = buildOrderPdf(order);
    doc.output("dataurlnewwindow");
  }

  function handleDownloadPdf(order: PosOrderOut) {
    const doc = buildOrderPdf(order);
    doc.save(`pedido-${order.id}.pdf`);
  }

  async function handleMarkOrderDelivered(orderId: number) {
    try {
      setDeliveryStatus({ kind: "loading" });
      const res = await fetch(`/api/pos/orders/${orderId}/deliver`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delivered: true }),
      });
      const responsePayload = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setDeliveryStatus({
          kind: "error",
          message:
            (typeof responsePayload?.message === "string" &&
              responsePayload.message) ||
            (typeof responsePayload?.detail === "string" &&
              responsePayload.detail) ||
            "No se pudo marcar el pedido como entregado.",
        });
        return false;
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? (responsePayload as PosOrderOut) : o,
        ),
      );
      setDeliveryStatus({ kind: "success", message: "Pedido entregado." });
      return true;
    } catch {
      setDeliveryStatus({
        kind: "error",
        message: "Error marcando el pedido como entregado.",
      });
      return false;
    }
  }

  async function handleMarkOrderPaid(
    orderId: number,
    payload?: {
      customer_id?: number | null;
      customer_email?: string | null;
      apply_inc?: boolean;
    },
  ): Promise<PosOrderOut | null> {
    try {
      setPaymentStatus({ kind: "loading" });
      const closePayload = {
        ...(payload ?? {}),
        apply_inc: payload?.apply_inc ?? applyConsumptionTax,
      };
      const res = await fetch(`/api/pos/orders/${orderId}/close`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(closePayload),
      });
      const responsePayload = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setPaymentStatus({
          kind: "error",
          message:
            (typeof responsePayload?.message === "string" &&
              responsePayload.message) ||
            (typeof responsePayload?.detail === "string" &&
              responsePayload.detail) ||
            "No se pudo marcar el pedido como pagado.",
        });
        return null;
      }
      const updatedOrder = responsePayload as PosOrderOut;
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? updatedOrder : o)),
      );
      setPaymentStatus({ kind: "success", message: "Pedido pagado." });
      return updatedOrder;
    } catch {
      setPaymentStatus({
        kind: "error",
        message: "Error marcando el pedido como pagado.",
      });
      return null;
    }
  }

  async function handleMarkOrderVoided(orderId: number) {
    if (!window.confirm("¿Anular este pedido?")) return;
    try {
      const res = await fetch(`/api/pos/orders/${orderId}/void`, {
        method: "POST",
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        window.alert(
          (typeof payload?.message === "string" && payload.message) ||
            (typeof payload?.detail === "string" && payload.detail) ||
            "No se pudo anular el pedido.",
        );
        return;
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? (payload as PosOrderOut) : o)),
      );
    } catch {
      window.alert("Error anulando el pedido.");
    }
  }

  async function handleClearFinishedOrders() {
    if (finishedOrders.length === 0) return;
    if (!window.confirm("¿Limpiar historial de pedidos finalizados?")) return;
    setClearFinishedStatus("loading");
    try {
      const res = await fetch("/api/pos/orders/finished", { method: "DELETE" });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        window.alert(
          (typeof payload?.message === "string" && payload.message) ||
            (typeof payload?.detail === "string" && payload.detail) ||
            "No se pudo limpiar el historial.",
        );
        return;
      }
      setHiddenFinishedOrderIds((prev) => {
        const next = new Set(prev);
        for (const order of finishedOrders) {
          next.add(Number(order.id));
        }
        persistHiddenFinishedOrderIds(next);
        return next;
      });
    } catch {
      window.alert("Error limpiando el historial.");
    } finally {
      setClearFinishedStatus("idle");
    }
  }

  function resetPaymentForm() {
    setPaymentStep("choice");
    setSelectedCustomerId("");
    setCustomerSearchInput("");
    setLoyaltyRegistration(null);
    setLoyaltyQrDataUrl("");
    setApplyConsumptionTax(false);
    setPaymentMethod("cash");
    setReceivedAmountInput("");
    setPaymentStatus({ kind: "idle" });
  }

  function validateReceivedAmount() {
    if (paymentMethod !== "cash") return true;
    if (!paymentPreview) return false;
    if (!Number.isFinite(receivedAmount) || receivedAmount < 0) {
      setPaymentStatus({
        kind: "error",
        message: "Ingresa el efectivo recibido para calcular el cambio.",
      });
      return false;
    }
    if (receivedAmount < paymentPreview.total) {
      setPaymentStatus({
        kind: "error",
        message: `Faltan ${formatMoney(paymentPreview.total - receivedAmount)} para completar el pago.`,
      });
      return false;
    }
    return true;
  }

  function openPaymentModal(order: PosOrderOut) {
    setPaymentOrder(order);
    setPaymentModalOpen(true);
    resetPaymentForm();
  }

  function closePaymentModal() {
    setPaymentModalOpen(false);
    setPaymentOrder(null);
    resetPaymentForm();
  }

  async function loadCustomers() {
    setLoadingCustomers(true);
    try {
      const res = await fetch("/api/personnel/customers?active=true", {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        throw new Error(
          (typeof payload?.message === "string" && payload.message) ||
            "No se pudo cargar clientes.",
        );
      }
      setCustomerList(Array.isArray(payload) ? (payload as Customer[]) : []);
    } catch {
      setCustomerList([]);
    } finally {
      setLoadingCustomers(false);
    }
  }

  async function handleStartLoyaltyRegistration() {
    if (!paymentOrder) return;
    setPaymentStep("new");
    setPaymentStatus({ kind: "loading" });
    setLoyaltyRegistration(null);
    setLoyaltyQrDataUrl("");
    try {
      const response = await fetch("/api/loyalty/registration-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order_id: paymentOrder.id }),
      });
      const payload = (await response.json().catch(() => null)) as LoyaltyRegistration & {
        message?: string;
      };
      if (!response.ok || !payload?.token) {
        throw new Error(payload?.message || "No se pudo generar el QR de registro.");
      }
      const publicUrlResponse = await fetch("/api/loyalty/public-url", { cache: "no-store" });
      const publicUrlPayload = (await publicUrlResponse.json().catch(() => null)) as { url?: string } | null;
      const loyaltyAppUrl =
        publicUrlPayload?.url ||
        process.env.NEXT_PUBLIC_LOYALTY_APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        window.location.origin;
      const registrationUrl = `${loyaltyAppUrl.replace(/\/$/, "")}/loyalty/register/${encodeURIComponent(payload.token)}`;
      const qrDataUrl = await QRCode.toDataURL(registrationUrl, {
        width: 280,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      setLoyaltyRegistration(payload);
      setLoyaltyQrDataUrl(qrDataUrl);
      setPaymentStatus({ kind: "idle" });
    } catch (error) {
      setPaymentStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "No se pudo generar el QR de registro.",
      });
    }
  }

  useEffect(() => {
    if (
      paymentStep !== "new" ||
      !paymentOrder ||
      !loyaltyRegistration?.token ||
      loyaltyRegistration.status !== "pending"
    ) {
      return;
    }

    let active = true;
    const checkRegistration = async () => {
      try {
        const response = await fetch(
          `/api/loyalty/registration-sessions/${encodeURIComponent(loyaltyRegistration.token)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as LoyaltyRegistration;
        if (active && response.ok && payload) setLoyaltyRegistration(payload);
      } catch {
        // The next polling cycle retries while the QR remains open.
      }
    };

    const interval = window.setInterval(checkRegistration, 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [paymentStep, paymentOrder, loyaltyRegistration]);

  async function handleOccasionalPayment() {
    if (!paymentOrder) return;
    if (!validateReceivedAmount()) return;
    const closedOrder = await handleMarkOrderPaid(paymentOrder.id, {
      apply_inc: applyConsumptionTax,
    });
    if (closedOrder) {
      closePaymentModal();
    }
  }

  async function handleExistingCustomerPayment() {
    if (!paymentOrder) return;
    if (!validateReceivedAmount()) return;
    const parsedId = Number(selectedCustomerId);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      setPaymentStatus({ kind: "error", message: "Selecciona un cliente." });
      return;
    }
    const closePayload = {
      customer_id: parsedId,
      apply_inc: applyConsumptionTax,
    };
    const closedOrder = await handleMarkOrderPaid(
      paymentOrder.id,
      closePayload,
    );
    if (!closedOrder) return;

    closePaymentModal();
  }

  async function handleNewCustomerPayment() {
    if (!paymentOrder) return;
    if (!validateReceivedAmount()) return;
    if (
      !loyaltyRegistration ||
      loyaltyRegistration.status !== "completed" ||
      !loyaltyRegistration.customer_id
    ) {
      setPaymentStatus({
        kind: "error",
        message: "Espera a que el cliente complete el formulario del QR.",
      });
      return;
    }
    const closePayload = {
      customer_id: loyaltyRegistration.customer_id,
      apply_inc: applyConsumptionTax,
    };
    const closedOrder = await handleMarkOrderPaid(
      paymentOrder.id,
      closePayload,
    );
    if (!closedOrder) return;

    closePaymentModal();
  }

  const filteredCustomerList = useMemo(() => {
    const rawQuery = normalizeSearchText(customerSearchInput);
    if (!rawQuery) return customerList;
    const compactQuery = rawQuery.replace(/[^a-z0-9]/g, "");

    return customerList.filter((customer) => {
      const name = normalizeSearchText(customer.name ?? "");
      const document = normalizeSearchText(customer.identity_document ?? "");
      const compactDocument = document.replace(/[^a-z0-9]/g, "");
      return (
        name.includes(rawQuery) ||
        document.includes(rawQuery) ||
        (compactQuery !== "" && compactDocument.includes(compactQuery))
      );
    });
  }, [customerList, customerSearchInput]);

  useEffect(() => {
    if (paymentStep !== "existing") return;

    if (filteredCustomerList.length === 0) {
      if (selectedCustomerId !== "") setSelectedCustomerId("");
      return;
    }

    const selectedStillVisible = filteredCustomerList.some(
      (customer) => String(customer.id) === selectedCustomerId,
    );
    if (selectedStillVisible) return;

    if (filteredCustomerList.length === 1) {
      setSelectedCustomerId(String(filteredCustomerList[0].id));
      return;
    }

    setSelectedCustomerId("");
  }, [paymentStep, filteredCustomerList, selectedCustomerId]);

  useEffect(() => {
    fetch("/api/menu/items")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setMenuItems(data));

    async function selectOrderPoint() {
      try {
        const response = await fetch("/api/pos/tables", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as unknown;
        if (!response.ok || !Array.isArray(payload)) throw new Error();

        const availableTables = payload as PosTable[];
        let orderPoint =
          availableTables.find(
            (table) => categoryKey(table.name) === "punto de venta",
          ) ?? availableTables[0];

        if (!orderPoint) {
          const createResponse = await fetch("/api/pos/tables", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "Punto de venta" }),
          });
          const created = (await createResponse
            .json()
            .catch(() => null)) as PosTable | null;
          if (!createResponse.ok || !created?.id) throw new Error();
          orderPoint = created;
        }

        setSelectedTableId(orderPoint.id);
      } catch {
        setSubmitStatus({
          kind: "error",
          message:
            "No se pudo preparar el punto de venta para recibir pedidos.",
        });
      }
    }

    void selectOrderPoint();
    void loadOrders();
  }, []);

  useEffect(() => {
    persistHiddenFinishedOrderIds(hiddenFinishedOrderIds);
  }, [hiddenFinishedOrderIds]);

  function addConfiguredToCart(configuredOrder: {
    name: string;
    menuItemName?: string;
    price: number;
    note: string;
  }) {
    const baseItem = menuItems.find((item) => {
      if (configuredOrder.menuItemName) {
        return normalizeSearchText(item.name) === normalizeSearchText(configuredOrder.menuItemName);
      }
      const name = normalizeSearchText(item.name);
      return (
        name.includes("acai") || name.includes("açaí") || name.includes("bowl")
      );
    });

    if (!baseItem) {
      setSubmitStatus({
        kind: "error",
        message: "No se pudo preparar el producto configurado.",
      });
      return;
    }

    setCart((prev) => {
      const draft = { ...prev };
      const editingItem = guidedEditDraft ? draft[guidedEditDraft.cartItemId] : undefined;
      if (guidedEditDraft) delete draft[guidedEditDraft.cartItemId];
      const existing = draft[baseItem.id];
      return {
        ...draft,
        [baseItem.id]: {
          menu_item_id: baseItem.id,
          quantity: editingItem?.quantity ?? (existing ? existing.quantity + 1 : 1),
          unit_price: configuredOrder.price,
          tax_rate: 0,
          discount_rate: editingItem?.discount_rate ?? existing?.discount_rate ?? null,
          courtesy: editingItem?.courtesy ?? existing?.courtesy ?? false,
          note: editingItem ? configuredOrder.note : existing?.note
            ? `${existing.note}\n${configuredOrder.note}`
            : configuredOrder.note,
        },
      };
    });
    setGuidedEditDraft(null);
    setSubmitStatus({
      kind: "success",
      message: `${configuredOrder.name} agregado al pedido.`,
    });
  }

  function updateCart(
    id: number,
    updater: (item: PosOrderItemCreate) => PosOrderItemCreate | null,
  ) {
    setCart((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const next = updater(current);
      if (!next) {
        const clone = { ...prev };
        delete clone[id];
        return clone;
      }
      return { ...prev, [id]: next };
    });
  }

  async function handleCreateOrder() {
    if (!selectedTableId) {
      window.alert(
        "El punto de venta todavía se está preparando. Intenta de nuevo.",
      );
      return;
    }
    if (cartItems.length === 0) {
      window.alert("Agrega items al pedido");
      return;
    }

    setSubmitStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/pos/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          table_id: selectedTableId,
          service_total: 0,
          items: cartItems.map((ci) => {
            const lineBase = ci.unit_price * ci.quantity;
            const discount_amount = lineBase * (ci.discount_rate ?? 0);
            return {
              menu_item_id: ci.menu_item_id,
              quantity: ci.quantity,
              unit_price: ci.unit_price,
              tax_rate: ci.tax_rate ?? 0,
              discount_amount,
              courtesy: ci.courtesy,
              note: ci.note ?? null,
            };
          }),
        }),
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setSubmitStatus({
          kind: "error",
          message:
            (typeof payload?.message === "string" && payload.message) ||
            "No se pudo crear la orden.",
        });
        return;
      }
      await loadOrders();
      setCart({});
      setGuidedEditDraft(null);
      setNoteInput("");
      setSubmitStatus({ kind: "success", message: "Orden creada." });
    } catch {
      setSubmitStatus({ kind: "error", message: "Error creando la orden." });
    }
  }

  async function loadOrders() {
    try {
      const response = await fetch("/api/pos/orders", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok || !Array.isArray(payload)) return false;
      setOrders(payload as PosOrderOut[]);
      return true;
    } catch {
      return false;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div>
            <h2 className="text-lg font-semibold text-dark dark:text-white">
              Pedidos en curso
            </h2>
            <p className="text-body-color text-sm dark:text-dark-6">
              Comandas abiertas o enviadas listas para ver, exportar o marcar
              como entregadas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="ml-auto rounded-lg border border-primary/40 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            Actualizar pedidos
          </button>
        </div>

        {activeOrders.length === 0 ? (
          <p className="text-sm text-dark-6 dark:text-dark-6">
            No hay pedidos en curso.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-none bg-[#F7F9FC] dark:bg-dark-2 [&>th]:py-4 [&>th]:text-base [&>th]:text-dark [&>th]:dark:text-white">
                <TableHead className="min-w-[180px] xl:pl-7.5">
                  Nombre del pedido
                </TableHead>
                <TableHead className="min-w-[160px]">Creado</TableHead>
                <TableHead className="min-w-[160px]">Entregado</TableHead>
                <TableHead className="min-w-[140px]">Tiempo entrega</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right xl:pr-7.5">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeOrders.map((order) => {
                const status = orderStatusMeta(order.status);
                const createdAt = toColombiaTime(order.opened_at);
                const deliveredAt = toColombiaTime(order.delivered_at);
                const deliveryMinutes =
                  deliveredAt && createdAt?.isValid()
                    ? Math.max(0, deliveredAt.diff(createdAt, "minute"))
                    : null;
                const deliveryDuration =
                  deliveryMinutes === null
                    ? ""
                    : deliveryMinutes < 60
                      ? `${deliveryMinutes} min`
                      : `${Math.floor(deliveryMinutes / 60)}h ${deliveryMinutes % 60}m`;
                const isDelivered =
                  order.status === "delivered" || order.status === "closed";
                const isPaid =
                  order.status === "paid" || order.status === "delivered" || order.status === "closed";
                const isVoided = order.status === "void";
                const canVoid =
                  order.status === "open" || order.status === "sent";
                const actionTooltip =
                  isPaid && !isDelivered ? "Marcar entrega" : "Marcar pago";
                return (
                  <TableRow
                    key={order.id}
                    className="border-[#eee] dark:border-dark-3"
                  >
                    <TableCell className="min-w-[200px] xl:pl-7.5">
                      <h5 className="text-dark dark:text-white">
                        Pedido #{order.id}
                      </h5>
                      <p className="mt-[3px] text-body-sm font-medium text-dark-6 dark:text-dark-6">
                        Total: {formatMoney(order.total)}
                      </p>
                      {order.status === "closed" ? (
                        <p className="text-body-color mt-[2px] text-xs dark:text-dark-6">
                          Factura electrónica:{" "}
                          {order.electronic_invoice_status === "issued"
                            ? `Emitida${order.electronic_invoice_number ? ` (#${order.electronic_invoice_number})` : ""}`
                            : order.electronic_invoice_status === "failed"
                              ? "Fallida"
                              : "Pendiente"}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="min-w-[170px]">
                      <p className="text-dark dark:text-white">
                        {createdAt?.isValid()
                          ? createdAt.format("DD/MM/YYYY HH:mm")
                          : "Fecha no disponible"}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-[170px]">
                      <p className="text-dark dark:text-white">
                        {deliveredAt?.isValid()
                          ? deliveredAt.format("DD/MM/YYYY HH:mm")
                          : "—"}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      <p className="text-dark dark:text-white">
                        {deliveryDuration || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      <div
                        className={`max-w-fit rounded-full px-3.5 py-1 text-sm font-medium ${status.className}`}
                      >
                        {status.label}
                      </div>
                    </TableCell>
                    <TableCell className="xl:pr-7.5">
                      <div className="flex items-center justify-end gap-x-3.5">
                        <Tooltip label="Ver PDF">
                          <button
                            type="button"
                            onClick={() => handlePreviewPdf(order)}
                            className="hover:text-primary"
                          >
                            <span className="sr-only">Ver PDF</span>
                            <PreviewIcon />
                          </button>
                        </Tooltip>
                        <Tooltip label={actionTooltip}>
                          <button
                            type="button"
                            onClick={() => {
                              if (isVoided) return;
                              if (order.status === "closed") return;
                              if (isPaid && !isDelivered) {
                                void handleMarkOrderDelivered(order.id);
                              } else {
                                openPaymentModal(order);
                              }
                            }}
                            disabled={isVoided}
                            className={
                              "flex h-9 w-9 items-center justify-center rounded-lg border text-primary " +
                              (isVoided
                                ? "cursor-not-allowed border-gray-300 text-gray-400"
                                : "border-primary/70 hover:border-primary hover:bg-primary/10")
                            }
                          >
                            <span className="sr-only">{actionTooltip}</span>
                            {order.status === "closed" ? (
                              <FaRegTrashAlt />
                            ) : isPaid && !isDelivered ? (
                              <CheckIcon />
                            ) : (
                              <HiOutlineCash />
                            )}
                          </button>
                        </Tooltip>
                        {canVoid ? (
                          <Tooltip label="Anular pedido">
                            <button
                              type="button"
                              onClick={() => handleMarkOrderVoided(order.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-red/70 text-red hover:border-red hover:bg-red/10"
                            >
                              <span className="sr-only">Anular pedido</span>
                              <RiProhibited2Line />
                            </button>
                          </Tooltip>
                        ) : null}
                        <Tooltip label="Descargar PDF">
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(order)}
                            className="hover:text-primary"
                          >
                            <span className="sr-only">Descargar PDF</span>
                            <DownloadIcon />
                          </button>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {isAdministrator ? (
        <div className="mt-6 rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div>
              <h2 className="text-lg font-semibold text-dark dark:text-white">
                Historial de pedidos finalizados
              </h2>
              <p className="text-body-color text-sm dark:text-dark-6">
                Pedidos pagados o anulados.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearFinishedOrders}
              disabled={
                finishedOrders.length === 0 || clearFinishedStatus === "loading"
              }
              className={
                "ml-auto rounded-lg border px-3 py-2 text-sm font-semibold " +
                (finishedOrders.length === 0 ||
                clearFinishedStatus === "loading"
                  ? "cursor-not-allowed border-gray-200 text-gray-400"
                  : "border-red/60 text-red hover:border-red hover:bg-red/10")
              }
            >
              {clearFinishedStatus === "loading"
                ? "Limpiando..."
                : "Limpiar historial"}
            </button>
          </div>

          {finishedOrders.length === 0 ? (
            <p className="text-sm text-dark-6 dark:text-dark-6">
              Sin historial aún.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-none bg-[#F7F9FC] dark:bg-dark-2 [&>th]:py-4 [&>th]:text-base [&>th]:text-dark [&>th]:dark:text-white">
                  <TableHead className="min-w-[180px] xl:pl-7.5">
                    Nombre del pedido
                  </TableHead>
                  <TableHead className="min-w-[160px]">Creado</TableHead>
                  <TableHead className="min-w-[160px]">Finalizado</TableHead>
                  <TableHead className="min-w-[140px]">
                    Tiempo entrega
                  </TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right xl:pr-7.5">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finishedOrders.map((order) => {
                  const status = orderStatusMeta(order.status);
                  const createdAt = toColombiaTime(order.opened_at);
                  const deliveredAt = toColombiaTime(order.delivered_at);
                  const closedAt = toColombiaTime(order.closed_at ?? null);
                  const finalAt = closedAt?.isValid() ? closedAt : deliveredAt;
                  const deliveryMinutes =
                    finalAt && createdAt?.isValid()
                      ? Math.max(0, finalAt.diff(createdAt, "minute"))
                      : null;
                  const deliveryDuration =
                    deliveryMinutes === null
                      ? ""
                      : deliveryMinutes < 60
                        ? `${deliveryMinutes} min`
                        : `${Math.floor(deliveryMinutes / 60)}h ${deliveryMinutes % 60}m`;
                  return (
                    <TableRow
                      key={order.id}
                      className="border-[#eee] dark:border-dark-3"
                    >
                      <TableCell className="min-w-[200px] xl:pl-7.5">
                        <h5 className="text-dark dark:text-white">
                          Pedido #{order.id}
                        </h5>
                        <p className="mt-[3px] text-body-sm font-medium text-dark-6 dark:text-dark-6">
                          Total: {formatMoney(order.total)}
                        </p>
                        {order.status === "closed" ? (
                          <p className="text-body-color mt-[2px] text-xs dark:text-dark-6">
                            Factura electrónica:{" "}
                            {order.electronic_invoice_status === "issued"
                              ? `Emitida${order.electronic_invoice_number ? ` (#${order.electronic_invoice_number})` : ""}`
                              : order.electronic_invoice_status === "failed"
                                ? "Fallida"
                                : "Pendiente"}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="min-w-[170px]">
                        <p className="text-dark dark:text-white">
                          {createdAt?.isValid()
                            ? createdAt.format("DD/MM/YYYY HH:mm")
                            : "Fecha no disponible"}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-[170px]">
                        <p className="text-dark dark:text-white">
                          {finalAt?.isValid()
                            ? finalAt.format("DD/MM/YYYY HH:mm")
                            : "—"}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <p className="text-dark dark:text-white">
                          {deliveryDuration || "—"}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <div
                          className={`max-w-fit rounded-full px-3.5 py-1 text-sm font-medium ${status.className}`}
                        >
                          {status.label}
                        </div>
                      </TableCell>
                      <TableCell className="xl:pr-7.5">
                        <div className="flex items-center justify-end gap-x-3.5">
                          <Tooltip label="Ver PDF">
                            <button
                              type="button"
                              onClick={() => handlePreviewPdf(order)}
                              className="hover:text-primary"
                            >
                              <span className="sr-only">Ver PDF</span>
                              <PreviewIcon />
                            </button>
                          </Tooltip>
                          <Tooltip label="Descargar PDF">
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(order)}
                              className="hover:text-primary"
                            >
                              <span className="sr-only">Descargar PDF</span>
                              <DownloadIcon />
                            </button>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      ) : null}

      {paymentModalOpen && paymentOrder ? (
        <div
          className="fixed inset-0 z-99 flex animate-[fadeIn_160ms_ease-out_forwards] items-center justify-center bg-black/60 p-4 opacity-0"
          role="dialog"
          aria-modal="true"
          onClick={closePaymentModal}
        >
          <div
            className="w-full max-w-lg animate-[fadeIn_200ms_ease-out_60ms_forwards] rounded-2xl border border-stroke bg-white p-5 opacity-0 shadow-2xl dark:border-dark-3 dark:bg-gray-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-dark dark:text-white">
                  Registrar pago
                </h3>
                <p className="text-body-color text-sm dark:text-dark-6">
                  Pedido #{paymentOrder.id}
                </p>
              </div>
              <button
                type="button"
                onClick={closePaymentModal}
                className="rounded-lg border border-stroke px-3 py-1.5 text-sm font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-dark dark:text-white">
                <input
                  type="checkbox"
                  checked={applyConsumptionTax}
                  onChange={(e) => setApplyConsumptionTax(e.target.checked)}
                  className="h-4 w-4"
                />
                Aplicar impuesto al consumo (INC 8%)
              </label>
              <p className="text-body-color mt-1 text-xs dark:text-dark-6">
                Si no lo marcas, el pago se registra sin INC.
              </p>

              {paymentPreview ? (
                <div className="mt-3 space-y-1 rounded-md border border-primary/20 bg-white/70 p-2 text-xs text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span>{formatMoney(paymentPreview.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>INC</span>
                    <span>{formatMoney(paymentPreview.incTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Servicio</span>
                    <span>{formatMoney(paymentPreview.serviceTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total a cobrar</span>
                    <span>{formatMoney(paymentPreview.total)}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-dark dark:text-white">
                Medio de pago
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {([
                  ["cash", "Efectivo"],
                  ["card", "Datáfono"],
                  ["transfer", "Transferencia"],
                ] as Array<[PaymentMethod, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(value);
                      setPaymentStatus({ kind: "idle" });
                    }}
                    className={
                      "rounded-lg border px-3 py-3 text-sm font-semibold transition " +
                      (paymentMethod === value
                        ? "border-primary bg-primary text-white"
                        : "border-stroke text-dark hover:border-primary/50 hover:bg-primary/5 dark:border-dark-3 dark:text-white")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {paymentPreview && paymentMethod === "cash" ? (
              <div className="mt-4 rounded-xl border border-green-light/40 bg-green-light/5 p-4 dark:border-green-light/20 dark:bg-green-light/10">
                <div>
                  <label className="min-w-[190px] flex-1">
                    <span className="mb-1 block text-sm font-semibold text-dark dark:text-white">
                      Efectivo recibido
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      inputMode="numeric"
                      value={receivedAmountInput}
                      onChange={(event) => {
                        setReceivedAmountInput(event.target.value);
                        if (paymentStatus.kind === "error") {
                          setPaymentStatus({ kind: "idle" });
                        }
                      }}
                      placeholder="Ej. 50000"
                      className="w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-base font-semibold text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                    />
                  </label>
                </div>

                <div
                  className={
                    "mt-3 flex items-center justify-between rounded-lg px-3 py-2.5 " +
                    (!Number.isFinite(receivedAmount)
                      ? "bg-white/70 text-body-color dark:bg-dark-2"
                      : paymentChange !== null && paymentChange < 0
                        ? "bg-red-light-5 text-red dark:bg-red-light/10 dark:text-red-light"
                        : "bg-green-light/15 text-green-dark dark:bg-green-light/15 dark:text-green-light")
                  }
                >
                  <span className="text-sm font-medium">
                    {!Number.isFinite(receivedAmount)
                      ? "Ingresa el dinero recibido"
                      : paymentChange !== null && paymentChange < 0
                        ? "Falta por recibir"
                        : "Devuelve al cliente"}
                  </span>
                  <span className="text-lg font-bold">
                    {!Number.isFinite(receivedAmount)
                      ? formatMoney(0)
                      : paymentChange !== null && paymentChange < 0
                        ? formatMoney(Math.abs(paymentChange))
                        : formatMoney(paymentChange ?? 0)}
                  </span>
                </div>
              </div>
            ) : null}

            {paymentStep === "choice" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={handleOccasionalPayment}
                  disabled={!canCompletePayment || paymentStatus.kind === "loading"}
                  className="rounded-lg border border-stroke px-3 py-3 text-sm font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                >
                  Cliente ocasional
                </button>
                <button
                  type="button"
                  onClick={handleStartLoyaltyRegistration}
                  disabled={paymentStatus.kind === "loading"}
                  className="rounded-lg bg-primary px-3 py-3 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Cliente nuevo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentStep("existing");
                    setPaymentStatus({ kind: "idle" });
                    setCustomerSearchInput("");
                    loadCustomers();
                  }}
                  className="rounded-lg border border-primary/40 px-3 py-3 text-sm font-semibold text-primary hover:border-primary hover:bg-primary/10"
                >
                  Cliente existente
                </button>
              </div>
            ) : null}

            {paymentStep === "new" ? (
              <div className="mt-4 space-y-3">
                <div className="flex flex-col items-center rounded-lg border border-primary/25 bg-primary/5 p-4 text-center">
                  {loyaltyQrDataUrl ? (
                    <img
                      src={loyaltyQrDataUrl}
                      alt="QR para registrar cliente"
                      className="h-64 w-64 rounded-md bg-white p-2"
                    />
                  ) : (
                    <div className="flex h-64 w-64 items-center justify-center rounded-md bg-white text-sm text-body-color">
                      Generando QR...
                    </div>
                  )}
                  <p className="mt-3 text-sm font-semibold text-dark dark:text-white">
                    El cliente debe escanear este QR
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-body-color dark:text-dark-6">
                    En su telefono ingresara nombre, telefono y fecha de cumpleaños. El registro se reflejara aqui automaticamente.
                  </p>
                  {loyaltyRegistration?.status === "completed" ? (
                    <p className="mt-3 rounded-md bg-green-light/15 px-3 py-2 text-sm font-semibold text-green-dark dark:text-green-light">
                      Cliente registrado: {loyaltyRegistration.customer_name || "listo"}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentStep("choice");
                      setPaymentStatus({ kind: "idle" });
                    }}
                    className="rounded-lg border border-stroke px-4 py-2 text-sm font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={handleNewCustomerPayment}
                    disabled={
                      paymentStatus.kind === "loading" ||
                      loyaltyRegistration?.status !== "completed" ||
                      !canCompletePayment
                    }
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    {paymentStatus.kind === "loading" ? "Guardando..." : "Guardar pago"}
                  </button>
                </div>
              </div>
            ) : null}

            {paymentStep === "existing" ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-body-color mb-1 block text-xs font-medium dark:text-dark-6">
                      Buscar cliente
                    </label>
                    <input
                      value={customerSearchInput}
                      onChange={(e) => setCustomerSearchInput(e.target.value)}
                      className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                      placeholder="Buscar por nombre o cédula"
                      disabled={loadingCustomers}
                    />
                    <p className="text-body-color mt-1 text-[11px] dark:text-dark-6">
                      {loadingCustomers
                        ? "Cargando clientes..."
                        : `${filteredCustomerList.length} cliente(s) encontrado(s)`}
                    </p>
                  </div>
                  <div>
                    <label className="text-body-color mb-1 block text-xs font-medium dark:text-dark-6">
                      Selecciona cliente
                    </label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                      disabled={loadingCustomers}
                    >
                      <option value="">Seleccionar cliente</option>
                      {filteredCustomerList.map((customer) => (
                        <option key={customer.id} value={String(customer.id)}>
                          {customer.name} · {customer.identity_document}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentStep("choice");
                      setPaymentStatus({ kind: "idle" });
                    }}
                    className="rounded-lg border border-stroke px-4 py-2 text-sm font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={handleExistingCustomerPayment}
                    disabled={paymentStatus.kind === "loading" || !canCompletePayment}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    {paymentStatus.kind === "loading"
                      ? "Guardando..."
                      : "Guardar pago"}
                  </button>
                </div>
              </div>
            ) : null}

            {paymentStatus.kind === "error" ? (
              <div className="mt-3 rounded-md border border-red-light bg-red-light-5 px-3 py-2 text-sm text-red dark:border-red-light/40 dark:bg-red-light-5/10 dark:text-red-light">
                {paymentStatus.message}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedTableId ? (
        <section className="order-first" aria-label="Toma de pedidos">
          <div className="grid w-full grid-cols-1 gap-4 rounded-2xl border border-stroke bg-gray-2 p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark md:grid-cols-[2fr_1fr]">
            <div className="pr-0 md:pr-2">
              <GuidedOrderBuilder
                onAddConfigured={addConfiguredToCart}
                editDraft={guidedEditDraft}
              />
            </div>

            <aside className="flex flex-col rounded-2xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-dark-2">
              <h4 className="text-base font-semibold text-dark dark:text-white">
                Pedido
              </h4>

              <div className="mt-3 space-y-3">
                {cartItems.length === 0 ? (
                  <p className="text-sm text-dark-6 dark:text-dark-6">
                    Agrega un producto para iniciar el pedido.
                  </p>
                ) : (
                  cartItems.map((ci) => (
                    <div
                      key={ci.menu_item_id}
                      className="rounded-xl border border-stroke bg-gray-1 p-3 text-sm text-dark transition dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold">Producto personalizado</div>
                        <div className="text-primary">
                          {formatMoney(ci.unit_price)}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <label className="flex items-center gap-1">
                          Cant.
                          <input
                            type="number"
                            min={1}
                            value={ci.quantity}
                            onChange={(e) =>
                              updateCart(ci.menu_item_id, (curr) => ({
                                ...curr,
                                quantity: Math.max(
                                  1,
                                  Number(e.target.value) || 1,
                                ),
                              }))
                            }
                            className="w-16 rounded border border-stroke bg-transparent px-2 py-1 text-xs dark:border-dark-3"
                          />
                        </label>
                        <label className="flex items-center gap-1">
                          INC (al pagar)
                          <input
                            type="number"
                            min={0}
                            max={0}
                            step="0.01"
                            value={0}
                            readOnly
                            className="w-20 rounded border border-stroke bg-transparent px-2 py-1 text-xs dark:border-dark-3"
                          />
                        </label>
                        <label className="flex items-center gap-1">
                          Descuento
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step="0.01"
                            value={ci.discount_rate ?? ""}
                            onChange={(e) =>
                              updateCart(ci.menu_item_id, (curr) => ({
                                ...curr,
                                discount_rate:
                                  e.target.value === ""
                                    ? null
                                    : Math.min(
                                        1,
                                        Math.max(
                                          0,
                                          Number(e.target.value) || 0,
                                        ),
                                      ),
                              }))
                            }
                            className="w-24 rounded border border-stroke bg-transparent px-2 py-1 text-xs dark:border-dark-3"
                          />
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={ci.courtesy}
                            onChange={(e) =>
                              updateCart(ci.menu_item_id, (curr) => ({
                                ...curr,
                                courtesy: e.target.checked,
                              }))
                            }
                            className="h-4 w-4"
                          />
                          Cortesía
                        </label>
                      </div>
                      <div className="text-body-color mt-2 text-xs dark:text-dark-6">
                        Total línea:{" "}
                        {formatMoney(
                          ci.courtesy
                            ? 0
                            : Math.max(
                                ci.unit_price * ci.quantity -
                                  ci.unit_price *
                                    ci.quantity *
                                    (ci.discount_rate ?? 0),
                                0,
                              ) *
                                (1 + (ci.tax_rate ?? 0)),
                        )}
                      </div>
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const menuItem = menuItems.find((item) => item.id === ci.menu_item_id);
                            setGuidedEditDraft({
                              cartItemId: ci.menu_item_id,
                              name: menuItem?.name ?? "Producto personalizado",
                              menuItemName: menuItem?.name ?? "Açaí personalizado",
                              price: ci.unit_price,
                              note: ci.note ?? "",
                            });
                          }}
                          title="Editar en Arma tu pedido"
                          aria-label="Editar en Arma tu pedido"
                          className="rounded-lg border border-primary/30 px-2 py-1.5 text-sm text-primary transition hover:bg-primary/5 dark:border-dark-3"
                        >
                          <FaRegEdit />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCart((prev) => {
                              const clone = { ...prev };
                              delete clone[ci.menu_item_id];
                              return clone;
                            });
                            setGuidedEditDraft((current) => current?.cartItemId === ci.menu_item_id ? null : current);
                          }}
                          title="Eliminar producto"
                          aria-label="Eliminar producto"
                          className="rounded-lg border border-red/30 bg-red/5 px-2 py-1.5 text-sm text-red transition hover:bg-red/10"
                        >
                          <FaRegTrashAlt />
                        </button>
                      </div>
                      <div className="mt-2">
                        <textarea
                          value={ci.note ?? ""}
                          onChange={(e) =>
                            updateCart(ci.menu_item_id, (curr) => ({
                              ...curr,
                              note: e.target.value || null,
                            }))
                          }
                          placeholder="Notas para preparación"
                          rows={2}
                          className="w-full resize-none rounded border border-stroke bg-transparent px-3 py-2 text-xs text-dark outline-none dark:border-dark-3 dark:text-white"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 space-y-1 text-sm text-dark dark:text-white">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{formatMoney(cartTotals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>INC</span>
                  <span>{formatMoney(cartTotals.tax)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Descuentos</span>
                  <span>{formatMoney(cartTotals.discount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cortesías</span>
                  <span>{formatMoney(cartTotals.courtesy)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(cartTotals.total)}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCreateOrder}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Enviar comanda
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCart({});
                    setGuidedEditDraft(null);
                  }}
                  className="rounded-lg border border-stroke px-4 py-2 text-sm font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                >
                  Limpiar
                </button>
                {submitStatus.kind === "error" && (
                  <span className="text-sm font-medium text-red">
                    {submitStatus.message}
                  </span>
                )}
                {submitStatus.kind === "success" && (
                  <span className="text-sm font-medium text-green">
                    {submitStatus.message}
                  </span>
                )}
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <div className="text-body-color order-first rounded-2xl border border-stroke bg-white p-6 text-sm shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:text-dark-6">
          Preparando el punto de venta…
        </div>
      )}

      <ViewOrderModal order={viewOrder} onClose={() => setViewOrder(null)} />
    </div>
  );
}
