"use client";

import { useState } from "react";
import { money } from "@/components/Expenses/shared";

export const PAYMENT_METHODS: Record<string, string> = {
  cash: "Efectivo", credit: "Crédito", transfer: "Transferencia", cash_drawer: "Efectivo caja",
};
export const PAYMENT_STATUSES: Record<string, string> = {
  unclassified: "Sin clasificar", paid: "Pagada", partial: "Abono", credit: "Crédito",
};
export type PurchasePayment = { id: number; payment_date: string; payment_method: string; amount: string | number; is_initial: boolean };
export type PurchasePaymentInfo = {
  id: number; payment_method?: string | null; paid_amount: string | number; balance: string | number;
  payment_status: string; payments: PurchasePayment[]; status?: string; purchased_at?: string | null;
};
export const businessToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

export default function PurchasePayments({ purchase, onSaved }: { purchase: PurchasePaymentInfo; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash_drawer");
  const [day, setDay] = useState(businessToday);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/inventory/purchases/${purchase.id}/payments`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ payment_date: day, payment_method: method, amount: Number(amount) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload?.detail === "string" ? payload.detail : payload?.message || "Revisa el monto y la fecha del abono.");
      onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo guardar el abono."); }
    finally { setSaving(false); }
  }
  return <details className="min-w-52 text-sm">
    <summary className="cursor-pointer text-primary">{PAYMENT_METHODS[purchase.payment_method ?? ""] ?? "Sin clasificar"} · {PAYMENT_STATUSES[purchase.payment_status] ?? "Sin clasificar"}</summary>
    <div className="mt-2 space-y-2 rounded border p-3">
      <p>Pagado: <b>{money(purchase.paid_amount)}</b></p>
      <p>Saldo: <b>{purchase.payment_status === "unclassified" ? "Por clasificar" : money(purchase.balance)}</b></p>
      {purchase.payments?.map((payment) => <p key={payment.id}>{payment.payment_date} · {payment.is_initial ? "Inicial" : "Abono"} · {PAYMENT_METHODS[payment.payment_method]}: {money(payment.amount)}</p>)}
      {purchase.status !== "void" && purchase.payment_status !== "unclassified" && Number(purchase.balance) > 0 ? <form onSubmit={save} className="space-y-2">
        <h4 className="font-semibold">Registrar abono</h4>
        <label className="block">Fecha de pago<input required type="date" min={purchase.purchased_at?.slice(0, 10)} max={businessToday()} value={day} onChange={(event) => setDay(event.target.value)} className="block w-full rounded border bg-transparent p-2" /></label>
        <label className="block">Medio de pago<select value={method} onChange={(event) => setMethod(event.target.value)} className="block w-full rounded border bg-transparent p-2">{Object.entries(PAYMENT_METHODS).filter(([key]) => key !== "credit").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="block">Monto del abono<input required type="number" min="0.01" max={Number(purchase.balance)} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="block w-full rounded border bg-transparent p-2" /></label>
        {method === "cash_drawer" ? <p className="text-xs">Se descontará de la caja en la fecha de pago.</p> : null}
        {error ? <p role="alert" className="text-red">{error}</p> : null}
        <button disabled={saving} className="rounded bg-primary px-3 py-2 text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar abono"}</button>
      </form> : null}
    </div>
  </details>;
}
