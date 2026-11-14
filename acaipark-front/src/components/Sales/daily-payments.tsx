"use client";

import { useEffect, useState } from "react";
import { money } from "@/components/Expenses/shared";
import { businessToday } from "@/components/PurchasesHistory/payments";

type Summary = { cash_total: string | number; dataphone_total: string | number; transfer_total: string | number; total: string | number };

export default function DailyPayments({ reloadToken, onSelectDay }: { reloadToken: number; onSelectDay: (day: string) => void }) {
  const [day, setDay] = useState(businessToday);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(false);
    fetch(`/api/sales/summary/daily-payment-methods?day=${day}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((payload) => { if (!controller.signal.aborted) setData(payload); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [day, reloadToken, retry]);
  return <section className="mb-6 rounded-xl border bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-xl font-bold">Ventas del día por medio de pago</h2><p className="text-sm text-body">Totales de ventas activas en horario de Bogotá.</p></div>
      <div className="flex flex-wrap items-end gap-2"><label className="text-sm">Día<input type="date" value={day} onChange={(event) => { if (event.target.value) setDay(event.target.value); }} className="ml-2 rounded border bg-transparent p-2" /></label><button onClick={() => onSelectDay(day)} className="rounded bg-primary px-3 py-2 text-sm text-white">Ver ventas de este día</button><button onClick={() => setRetry((value) => value + 1)} className="rounded border px-3 py-2 text-sm">Actualizar totales</button></div>
    </div>
    {error ? <p role="alert" className="text-red">No se pudieron cargar los totales. Intenta actualizar.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([["Efectivo", "cash_total"], ["Datáfono", "dataphone_total"], ["Transferencia", "transfer_total"], ["Total ventas", "total"]] as const).map(([label, key]) => <div key={key} className="rounded border p-4"><p className="text-sm text-body">{label}</p><p className="mt-1 text-2xl font-bold">{data ? money(data[key]) : "Cargando..."}</p></div>)}</div>}
  </section>;
}
