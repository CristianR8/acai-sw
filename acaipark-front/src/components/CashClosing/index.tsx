"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const BILL_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000];

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
  expected_cash: number;
  denomination_counts: Record<string, number>;
  physical_cash: number;
  difference: number;
};

export default function CashClosing() {
  const [day, setDay] = useState(today);
  const [data, setData] = useState<Close | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/sales/cash-closing?day=${day}`, {
      cache: "no-store",
    });
    if (response.ok) setData(await response.json());
  }, [day]);

  useEffect(() => {
    void load();
  }, [load]);

  const physical = useMemo(
    () =>
      BILL_DENOMINATIONS.reduce(
        (sum, denomination) =>
          sum + denomination * Number(data?.denomination_counts[String(denomination)] || 0),
        0,
      ) + Number(data?.denomination_counts.coins || 0),
    [data],
  );

  function updateCount(key: string, value: string) {
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
      if (response.ok) setData(await response.json());
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

  const paymentCards = [
    ["Efectivo", data?.cash_total],
    ["Datáfono", data?.dataphone_total],
    ["Transferencia", data?.transfer_total],
    ["Total ventas", data?.total],
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-bold text-dark dark:text-white">Cierre de caja</h2>
          <div className="flex flex-wrap items-end gap-2">
            <button onClick={() => moveDay(-1)} className="rounded-lg border px-3 py-2">Día anterior</button>
            <label className="text-sm">Día<input type="date" value={day} onChange={(event) => setDay(event.target.value)} className="ml-2 rounded border p-2" /></label>
            <button onClick={() => moveDay(1)} className="rounded-lg border px-3 py-2">Día siguiente</button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-6 dark:border-emerald-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">Efectivo recibido</h3>
            <p className="text-sm text-body">Los billetes seleccionados al cobrar se agregan automáticamente. Puedes corregir el conteo de este día.</p>
          </div>
          <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 font-medium text-white disabled:opacity-60">
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
          <label className="rounded-lg border bg-white p-3 text-sm dark:border-dark-3 dark:bg-gray-dark">
            <span className="font-semibold">Monedas</span>
            <span className="mt-1 block text-xs text-body">Valor total</span>
            <input type="number" min="0" step="50" value={data?.denomination_counts.coins ?? 0} onChange={(event) => updateCount("coins", event.target.value)} className="mt-1 w-full rounded border p-2" />
          </label>
        </div>
        <p className="mt-4 text-lg font-bold">Efectivo real contado: {money(physical)}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {paymentCards.map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border bg-white p-5 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
            <p className="text-sm text-body">{label}</p>
            <p className="mt-2 text-2xl font-bold">{money(value)}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="text-xl font-bold">Gastos y salidas de caja</h3>
        <p className="mt-3">Total gastos: <b>{money(data?.expenses_total)}</b></p>
        <h3 className="mt-6 text-xl font-bold">Conciliación final de caja</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <p>Base inicial<br /><b>{money(data?.opening_total)}</b></p>
          <p>Efectivo esperado<br /><b>{money(data?.expected_cash)}</b></p>
          <p>Efectivo real<br /><b>{money(physical)}</b></p>
          <p>Diferencia<br /><b>{money(physical - Number(data?.expected_cash || 0))}</b></p>
        </div>
        <h3 className="mt-6 text-xl font-bold">Observaciones</h3>
        <p className="mt-2 text-sm text-body">El efectivo esperado usa únicamente ventas pagadas en efectivo y gastos registrados.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={`/api/sales/summary/daily-payment-methods/export?day=${day}`} className="rounded-lg bg-primary px-4 py-2 text-white">Descargar Excel</a>
          <a href={`/api/sales/cash-closing/pdf?day=${day}`} className="rounded-lg border px-4 py-2">Descargar PDF</a>
        </div>
      </section>
    </div>
  );
}
