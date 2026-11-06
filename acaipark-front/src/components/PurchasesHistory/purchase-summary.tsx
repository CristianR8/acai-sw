"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "@/components/DateRangeFilter";
import {
  summarizePurchaseSpending,
  type SpendingPurchase,
} from "@/lib/purchase-spending";

const money = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

export default function PurchaseSummary({
  range,
  reloadToken,
}: {
  range: DateRange;
  reloadToken: number;
}) {
  const [summary, setSummary] = useState<ReturnType<
    typeof summarizePurchaseSpending
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setSummary(null);
    setError(null);
    async function load() {
      try {
        const params = new URLSearchParams({
          from_date: range.from,
          to_date: range.to,
        });
        const response = await fetch(`/api/inventory/purchases?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json();
        if (!response.ok || !Array.isArray(payload)) throw new Error();
        if (!controller.signal.aborted)
          setSummary(summarizePurchaseSpending(payload as SpendingPurchase[]));
      } catch {
        if (!controller.signal.aborted)
          setError(
            "No se pudieron cargar las compras del período seleccionado.",
          );
      }
    }
    void load();
    return () => controller.abort();
  }, [range.from, range.to, reloadToken, retryToken]);

  const total = summary?.total ?? 0;
  const maximum = summary
    ? Math.max(0, ...summary.suppliers.map((row) => row.total))
    : 0;

  return (
    <div className="mt-6 space-y-6">
      <section
        className="rounded-[10px] bg-gradient-to-br from-primary to-[#163c62] p-6 text-white shadow-1"
        aria-label="Compras del período"
      >
        <p className="text-sm font-medium text-white/75">Compras del período</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">
              {error ? "No disponible" : summary ? money(total) : "Cargando..."}
            </h2>
            <p className="mt-1 text-sm text-white/80">
              Corresponde al rango seleccionado; las compras anuladas no se
              incluyen.
            </p>
          </div>
          {summary ? (
            <div className="rounded-lg bg-white/15 px-4 py-3 text-sm">
              {summary.count} {summary.count === 1 ? "compra" : "compras"}
            </div>
          ) : null}
        </div>
      </section>
      <section
        className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card"
        aria-label="Compras por proveedor"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-dark dark:text-white">
              Compras por proveedor
            </h2>
            <p className="text-body mt-1 text-sm">
              Del {range.from} al {range.to}. Ordenados de mayor a menor monto
              comprado; las compras anuladas no se incluyen.
            </p>
          </div>
          {summary && !error ? (
            <p className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              Total compras: {money(total)}
            </p>
          ) : null}
        </div>
        {error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 text-sm text-red"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setRetryToken((value) => value + 1)}
              className="rounded-md border border-stroke px-3 py-2 text-dark dark:border-dark-3 dark:text-white"
            >
              Reintentar
            </button>
          </div>
        ) : summary === null ? (
          <p role="status" className="text-body text-sm">
            Cargando compras...
          </p>
        ) : (
          <>
            {total === 0 ? (
              <p className="text-body mb-4 text-sm">
                No hay compras registradas en este período.
              </p>
            ) : null}
            <ul
              className="space-y-4"
              aria-label="Comparación del monto comprado por proveedor"
            >
              {summary.suppliers.map((row) => (
                <li key={row.id}>
                  <div className="mb-1.5 flex items-start justify-between gap-4 text-sm">
                    <span className="min-w-0 font-medium text-dark dark:text-white">
                      {row.name}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-dark dark:text-white">
                      {money(row.total)}
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-5 overflow-hidden rounded-md bg-gray-2 dark:bg-dark-2"
                  >
                    <div
                      className="h-full rounded-md bg-primary transition-[width] duration-300"
                      style={{
                        width: `${maximum > 0 ? (Math.max(0, row.total) / maximum) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
