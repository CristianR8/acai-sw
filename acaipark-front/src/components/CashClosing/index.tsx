"use client";

import { useEffect, useMemo, useState } from "react";

const BILL_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000];
const COIN_DENOMINATIONS = [1000, 500, 200, 100, 50];

const money = (value: unknown) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

type Close = {
  cash_total: number;
  transfer_total: number;
  dataphone_total: number;
  total: number;
  opening_total: number;
  expenses_total: number;
  purchases_total: number;
  outflows: Array<{ reference: string; name: string; concept: string; amount: number | string }>;
  sales_count: number;
  products: Array<{ name: string; quantity: number | string; total: number | string }>;
  expected_cash: number;
  denomination_counts: Record<string, number>;
  physical_cash: number;
  difference: number;
};

export default function CashClosing() {
  const [day, setDay] = useState(today);
  const [data, setData] = useState<Close | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(null); setMessage(null); setDirty(false);
    fetch(`/api/sales/cash-closing?day=${day}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((payload) => { if (!controller.signal.aborted) setData(payload); })
      .catch(() => { if (!controller.signal.aborted) setError("No se pudo cargar el cierre de caja."); });
    return () => controller.abort();
  }, [day, retry]);

  const physical = useMemo(
    () =>
      [...BILL_DENOMINATIONS, ...COIN_DENOMINATIONS].reduce(
        (sum, denomination) =>
          sum + denomination * Number(data?.denomination_counts[String(denomination)] || 0),
        0,
      ),
    [data],
  );

  function updateCount(key: string, value: string) {
    setDirty(true); setMessage(null);
    setData((current) =>
      current
        ? {
            ...current,
            denomination_counts: {
              ...current.denomination_counts,
              [key]: Math.max(0, Math.trunc(Number(value) || 0)),
            },
          }
        : current,
    );
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/sales/cash-closing?day=${day}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ denomination_counts: data.denomination_counts }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload?.detail === "string" ? payload.detail : "No se pudo guardar el conteo.");
      setData(payload); setDirty(false); setError(null); setMessage("Conteo guardado. Puedes descargar el cierre actualizado.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar el conteo.");
    } finally {
      setSaving(false);
    }
  }

  function moveDay(amount: number) {
    setDay(
      new Date(new Date(`${day}T12:00:00`).getTime() + amount * 86400000)
        .toLocaleDateString("en-CA"),
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-bold text-dark dark:text-white">Cierre de caja</h2>
          <div className="flex flex-wrap items-end gap-2">
            <button disabled={saving} onClick={() => moveDay(-1)} className="rounded-lg border px-3 py-2">Día anterior</button>
            <label className="text-sm">Día<input disabled={saving} type="date" value={day} onChange={(event) => { if (event.target.value) setDay(event.target.value); }} className="ml-2 rounded border p-2" /></label>
            <button disabled={saving} onClick={() => moveDay(1)} className="rounded-lg border px-3 py-2">Día siguiente</button>
            <button disabled={saving} onClick={() => setRetry((value) => value + 1)} className="rounded-lg border px-3 py-2">Actualizar cierre</button>
          </div>
        </div>
      </section>
      {error ? <p role="alert" className="text-red">{error}</p> : null}
      {message ? <p role="status" className="text-primary">{message}</p> : null}
      {!data ? <p>{error ? "Usa Actualizar cierre para reintentar." : "Cargando cierre..."}</p> : <>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-6 dark:border-emerald-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">Efectivo recibido</h3>
            <p className="text-sm text-body">Los billetes y monedas seleccionados al cobrar se agregan automáticamente. Puedes corregir el conteo de este día.</p>
          </div>
          <button onClick={save} disabled={saving || !data} className="rounded-lg bg-primary px-4 py-2 font-medium text-white disabled:opacity-60">
            {saving ? "Guardando..." : "Guardar conteo"}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BILL_DENOMINATIONS.map((denomination) => (
            <label key={denomination} className="rounded-lg border bg-white p-3 text-sm dark:border-dark-3 dark:bg-gray-dark">
              <span className="font-semibold">Billete de {money(denomination)}</span>
              <span className="mt-1 block text-xs text-body">Cantidad</span>
              <input type="number" min="0" step="1" value={data?.denomination_counts[String(denomination)] ?? 0} onChange={(event) => updateCount(String(denomination), event.target.value)} className="mt-1 w-full rounded border p-2" />
            </label>
          ))}
          {COIN_DENOMINATIONS.map((denomination) => (
            <label key={denomination} className="rounded-lg border bg-white p-3 text-sm dark:border-dark-3 dark:bg-gray-dark">
              <span className="font-semibold">Moneda de {money(denomination)}</span>
              <span className="mt-1 block text-xs text-body">Cantidad</span>
              <input type="number" min="0" step="1" value={data?.denomination_counts[String(denomination)] ?? 0} onChange={(event) => updateCount(String(denomination), event.target.value)} className="mt-1 w-full rounded border p-2" />
            </label>
          ))}
        </div>
        <p className="mt-4 text-lg font-bold">Efectivo real contado: {money(physical)}</p>
      </section>

      <section className="rounded-xl border bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="text-xl font-bold">Gastos y salidas de caja</h3>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Referencia</th><th className="p-2">Gasto / proveedor</th><th className="p-2">Concepto</th><th className="p-2 text-right">Monto</th></tr></thead><tbody>{data.outflows.map((item) => <tr key={item.reference} className="border-t"><td className="p-2">{item.reference}</td><td className="p-2">{item.name}</td><td className="p-2">{item.concept}</td><td className="p-2 text-right">{money(item.amount)}</td></tr>)}</tbody></table></div>
        {!data.outflows.length ? <p className="mt-3 text-sm text-body">Sin gastos ni compras de caja para esta fecha.</p> : null}
        <p className="mt-3 font-semibold">Total salidas: {money(Number(data.expenses_total) + Number(data.purchases_total))}</p>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="text-xl font-bold">Conciliación final de caja</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <p>Base inicial<br /><b>{money(data?.opening_total)}</b></p>
          <p>Ventas en efectivo<br /><b>{money(data?.cash_total)}</b></p>
          <p>Gastos<br /><b>{money(data?.expenses_total)}</b></p>
          <p>Compras y abonos de caja<br /><b>{money(data?.purchases_total)}</b></p>
          <p>Efectivo esperado<br /><b>{money(data?.expected_cash)}</b></p>
          <p>Efectivo real<br /><b>{money(physical)}</b></p>
          <p>Diferencia<br /><b>{money(physical - Number(data?.expected_cash || 0))}</b></p>
        </div>
        <h3 className="mt-6 text-xl font-bold">Observaciones</h3>
        <p className="mt-2 text-sm text-body">Efectivo esperado = base inicial + ventas en efectivo − gastos − compras y abonos pagados con efectivo caja. El detalle de efectivo, datáfono y transferencia está en <a href="/sales" className="text-primary underline">Ventas</a>.</p>
        {dirty ? <p className="mt-3 text-sm text-primary">Guarda el conteo antes de descargar el cierre.</p> : <div className="mt-5 flex flex-wrap gap-3">
          <a href={`/api/sales/summary/daily-payment-methods/export?day=${day}`} className="rounded-lg bg-primary px-4 py-2 text-white">Descargar Excel</a>
          <a href={`/api/sales/cash-closing/pdf?day=${day}`} className="rounded-lg border px-4 py-2">Descargar PDF</a>
        </div>}
      </section>
      <section className="rounded-xl border bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="text-xl font-bold">Resumen de ventas del día</h3>
        <p className="mt-2">Se registraron <b>{data.sales_count} ventas</b> por <b>{money(data.total)}</b>.</p>
        <p className="mt-1 text-sm text-body">{data.products.length ? data.products.map((product) => `${Number(product.quantity).toLocaleString("es-CO")} ${product.name}`).join(" · ") : "Sin productos vendidos."}</p>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Producto</th><th className="p-2 text-right">Cantidad</th><th className="p-2 text-right">Total</th></tr></thead><tbody>{data.products.map((product) => <tr key={product.name} className="border-t"><td className="p-2">{product.name}</td><td className="p-2 text-right">{Number(product.quantity).toLocaleString("es-CO")}</td><td className="p-2 text-right">{money(product.total)}</td></tr>)}</tbody></table></div>
      </section>
      </>}
    </div>
  );
}
