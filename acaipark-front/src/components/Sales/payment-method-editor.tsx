"use client";

import { useState } from "react";
import { readAuth } from "@/lib/auth/storage";

export default function PaymentMethodEditor({ saleId, method, onSaved }: { saleId: number; method?: string | null; onSaved: () => void }) {
  const [selected, setSelected] = useState(method === "card" ? "dataphone" : method ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const auth = readAuth();
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/sales/${saleId}/payment-method`, {
        method: "PATCH", headers: { "content-type": "application/json", authorization: `${auth?.tokenType || "Bearer"} ${auth?.accessToken || ""}` },
        body: JSON.stringify({ payment_method: selected, previous_payment_method: method ?? null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload?.detail === "string" ? payload.detail : payload?.message || "No se pudo guardar la corrección.");
      onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo guardar la corrección."); }
    finally { setSaving(false); }
  }
  const changed = selected && selected !== (method === "card" ? "dataphone" : method ?? "");
  return <div className="min-w-44 space-y-2">
    <select aria-label={`Medio de pago de venta #${saleId}`} value={selected} disabled={saving} onChange={(event) => setSelected(event.target.value)} className="w-full rounded border bg-transparent p-2"><option value="" disabled>Sin registrar</option><option value="cash">Efectivo</option><option value="dataphone">Datáfono</option><option value="transfer">Transferencia</option></select>
    {changed ? <button onClick={save} disabled={saving} className="rounded bg-primary px-3 py-1 text-sm text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar cambio"}</button> : null}
    {error ? <p role="alert" className="text-xs text-red">{error}</p> : null}
  </div>;
}
