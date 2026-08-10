import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Link from "next/link";
import { Fragment } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Informe de compras",
};

function getBackendBaseUrl() {
  return (
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  );
}

type PurchaseItem = {
  id: number;
  product_id: number;
  product_name: string | null;
  quantity: string;
  unit_cost: string;
  line_total: string;
};

type Purchase = {
  id: number;
  supplier_id: number | null;
  supplier_name: string | null;
  purchased_at: string | null;
  received_at: string | null;
  total_cost: string;
  created_at: string;
  items: PurchaseItem[];
};

function formatCop(value: unknown) {
  const asNumber = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(asNumber)) return String(value ?? "");
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(asNumber);
}

function formatQty(value: unknown) {
  const asNumber = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(asNumber)) return String(value ?? "");
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(asNumber));
}

async function getPurchases() {
  const baseUrl = getBackendBaseUrl().replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/inventory/purchases`, { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudo cargar el informe de compras");
  return (await response.json()) as Purchase[];
}

export default async function InventoryPurchasesPage() {
  const purchases = await getPurchases().catch(() => []);

  return (
    <>
      <Breadcrumb pageName="Informe de compras" />

      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-dark dark:text-white">
            Compras registradas
          </h2>
          <Link
            href="/inventory"
            className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          >
            Volver a inventario
          </Link>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-dark-2">
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">
                  ID
                </th>
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">
                  Proveedor
                </th>
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">
                  Fecha de compra
                </th>
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">
                  Items
                </th>
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-sm text-body-color dark:text-dark-6"
                  >
                    No hay compras registradas.
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <Fragment key={p.id}>
                    <tr className="border-b border-stroke dark:border-dark-3">
                      <td className="px-4 py-3 text-sm text-dark dark:text-white">
                        {p.id}
                      </td>
                      <td className="px-4 py-3 text-sm text-body-color dark:text-dark-6">
                        {p.supplier_name ?? "Sin proveedor"}
                      </td>
                      <td className="px-4 py-3 text-sm text-body-color dark:text-dark-6">
                        {p.purchased_at || p.received_at || p.created_at
                          ? new Date(
                              p.purchased_at ?? p.received_at ?? p.created_at,
                            ).toLocaleDateString("es-CO")
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-body-color dark:text-dark-6">
                        {p.items?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-body-color dark:text-dark-6">
                        {formatCop(p.total_cost)}
                      </td>
                    </tr>
                    <tr className="border-b border-stroke dark:border-dark-3">
                      <td colSpan={5} className="px-4 pb-4 pt-2">
                        <div className="rounded-md border border-stroke bg-white p-3 text-sm dark:border-dark-3 dark:bg-dark-2">
                          <div className="mb-2 text-xs font-semibold uppercase text-dark-6 dark:text-dark-6">
                            Items comprados
                          </div>
                          {p.items?.length ? (
                            <div className="max-w-full overflow-x-auto">
                              <table className="w-full table-auto text-sm">
                                <thead>
                                  <tr className="text-left text-xs uppercase text-dark-6 dark:text-dark-6">
                                    <th className="px-2 py-1">Producto</th>
                                    <th className="px-2 py-1">Cantidad</th>
                                    <th className="px-2 py-1">Costo unitario</th>
                                    <th className="px-2 py-1">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.items.map((item) => (
                                    <tr key={item.id}>
                                      <td className="px-2 py-1 text-dark dark:text-white">
                                        {item.product_name?.trim()
                                          ? item.product_name
                                          : `#${item.product_id}`}
                                      </td>
                                      <td className="px-2 py-1 text-body-color dark:text-dark-6">
                                        {formatQty(item.quantity)}
                                      </td>
                                      <td className="px-2 py-1 text-body-color dark:text-dark-6">
                                        {formatCop(item.unit_cost)}
                                      </td>
                                      <td className="px-2 py-1 text-body-color dark:text-dark-6">
                                        {formatCop(item.line_total)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-body-color dark:text-dark-6">
                              Sin items registrados.
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
