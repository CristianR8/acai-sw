"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Product = { id: number; name: string };
type Registration = Product & {
  purchase_id: number;
  product_id: number;
  purchased_at: string | null;
  quantity: string;
  unit: string | null;
  category: string | null;
  supplier_name: string | null;
  presentation: string | null;
  cost: string | null;
  grams_per_ice_cream: string | null;
  topping_cost: string | null;
  unit_cost: string;
  line_total: string;
};
type MonthGroup = {
  id: number;
  year: number;
  month: number;
  name: string;
  purchase_item_ids: number[];
};
type Props = {
  products: Product[];
  kind: "ingredient" | "material";
  searchTerm: string;
  productsLoading: boolean;
  onSelect: (ids: number[] | null) => void;
};
const inputClass =
  "w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white";
const monthKey = (group: MonthGroup) =>
  `${group.year}-${String(group.month).padStart(2, "0")}`;

export default function InventoryMonthGroups({
  products: catalogProducts,
  kind,
  searchTerm,
  productsLoading,
  onSelect,
}: Props) {
  const [products, setProducts] = useState<Registration[]>([]);
  const [groups, setGroups] = useState<MonthGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<
    number | "ungrouped" | "catalog" | null
  >(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [chosen, setChosen] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadGroups() {
    setLoading(true);
    setMessage(null);
    try {
      const [response, entriesResponse] = await Promise.all([
        fetch("/api/inventory/month-groups", { cache: "no-store" }),
        fetch(`/api/inventory/month-groups/purchase-items?kind=${kind}`, {
          cache: "no-store",
        }),
      ]);
      const entries = await entriesResponse.json().catch(() => null);
      if (!entriesResponse.ok || !Array.isArray(entries))
        throw new Error(
          entries?.message || "No se pudieron cargar los registros de compras.",
        );
      setProducts(entries);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload))
        throw new Error(
          payload?.message || "No se pudieron cargar los grupos.",
        );
      setGroups(payload);
      setReady(true);
    } catch (error) {
      setReady(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los grupos.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGroups();
  }, []);

  const assignedIds = useMemo(
    () => new Set(groups.flatMap((group) => group.purchase_item_ids)),
    [groups],
  );
  const ungrouped = useMemo(
    () => products.filter((product) => !assignedIds.has(product.id)),
    [products, assignedIds],
  );
  const existing = groups.find((group) => monthKey(group) === month);
  const visibleOptions = products.filter((product) =>
    product.name
      .toLocaleLowerCase("es")
      .includes(search.toLocaleLowerCase("es")),
  );
  const selectedGroup = groups.find((group) => group.id === selected);

  useEffect(() => {
    onSelect(
      selected === "catalog"
        ? catalogProducts.map((product) => product.id)
        : null,
    );
  }, [selected, catalogProducts, onSelect]);

  const visibleEntries = (
    selected === "ungrouped"
      ? ungrouped
      : products.filter((product) =>
          selectedGroup?.purchase_item_ids.includes(product.id),
        )
  ).filter((product) =>
    product.name
      .toLocaleLowerCase("es")
      .includes(searchTerm.toLocaleLowerCase("es")),
  );
  const money = (value: string | null) =>
    value == null
      ? "—"
      : new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        }).format(Number(value));
  const quantity = (value: string) =>
    new Intl.NumberFormat("es-CO", { maximumFractionDigits: 4 }).format(
      Number(value),
    );
  const date = (value: string | null) =>
    value ? new Date(value).toLocaleDateString("es-CO") : "—";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !ready || !chosen.length) return;
    setSaving(true);
    setMessage(null);
    try {
      const [year, monthNumber] = month.split("-").map(Number);
      const response = await fetch(
        existing
          ? `/api/inventory/month-groups/${existing.id}/products`
          : "/api/inventory/month-groups",
        {
          method: existing ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            year,
            month: monthNumber,
            purchase_item_ids: chosen,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        // Refresh after a concurrent creation so the next attempt uses that group.
        if (response.status === 409) await loadGroups();
        throw new Error(
          payload?.message || "No se pudo agrupar el inventario.",
        );
      }
      const saved = payload as MonthGroup;
      setGroups((current) =>
        [
          ...current
            .filter((group) => group.id !== saved.id)
            .map((group) => ({
              ...group,
              purchase_item_ids: group.purchase_item_ids.filter(
                (id) => !saved.purchase_item_ids.includes(id),
              ),
            })),
          saved,
        ].sort((a, b) => monthKey(b).localeCompare(monthKey(a))),
      );
      setSelected(saved.id);
      setChosen([]);
      setShowForm(false);
      setMessage(`Compras agrupadas en ${saved.name}.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo agrupar el inventario.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-dark dark:text-white">
            Inventario por mes
          </h3>
          <p className="text-body text-sm">
            Abre un mes para consultar sus productos. Un producto puede estar en
            varios meses si tiene compras distintas.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || productsLoading}
          onClick={() => setSelected("catalog")}
          className="text-sm font-semibold text-primary"
        >
          Ver catálogo y existencias
        </button>
        <button
          type="button"
          disabled={!ready || productsLoading || saving}
          onClick={() => {
            setShowForm(true);
            setMessage(null);
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Agrupa inventario por mes
        </button>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-lg bg-primary/10 p-3 text-sm text-primary"
        >
          {message}
        </p>
      )}
      {!ready && !loading && (
        <button
          type="button"
          onClick={() => void loadGroups()}
          className="text-sm font-semibold text-primary"
        >
          Reintentar carga de grupos
        </button>
      )}
      {showForm && (
        <form
          onSubmit={save}
          className="space-y-4 rounded-xl border border-primary/30 p-4"
        >
          <label className="block max-w-xs text-sm font-medium text-dark dark:text-white">
            Mes y año
            <input
              type="month"
              min="1900-01"
              max="2100-12"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              required
              disabled={saving}
              className={`${inputClass} mt-2`}
            />
          </label>
          <p className="text-body text-sm">
            {existing
              ? `Ya existe ${existing.name}. Las compras se agregarán a ese grupo.`
              : "Se creará un único grupo para el mes seleccionado."}{" "}
            Cada compra de un producto pertenece a un solo mes; al reasignarla
            se mueve completa al seleccionado.
          </p>
          <label className="block text-sm font-medium text-dark dark:text-white">
            Buscar productos
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="Nombre del producto"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-body">
              {chosen.length} registros seleccionados
            </span>
            <button
              type="button"
              disabled={saving || productsLoading}
              onClick={() =>
                setChosen((current) =>
                  Array.from(
                    new Set([
                      ...current,
                      ...visibleOptions.map((product) => product.id),
                    ]),
                  ),
                )
              }
              className="font-semibold text-primary"
            >
              Seleccionar resultados
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setChosen([])}
              className="text-body"
            >
              Quitar selección
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-stroke dark:border-dark-3">
            {visibleOptions.length === 0 && (
              <p className="text-body p-4 text-sm">
                No hay registros de compras para seleccionar.
              </p>
            )}
            {visibleOptions.map((product) => (
              <label
                key={product.id}
                className="flex cursor-pointer items-center gap-3 border-b border-stroke p-3 last:border-0 dark:border-dark-3"
              >
                <input
                  type="checkbox"
                  disabled={saving}
                  checked={chosen.includes(product.id)}
                  onChange={(event) =>
                    setChosen((current) =>
                      event.target.checked
                        ? [...current, product.id]
                        : current.filter((id) => id !== product.id),
                    )
                  }
                  className="size-4 accent-primary"
                />
                <span className="flex-1 text-sm text-dark dark:text-white">
                  {product.name}
                  <span className="text-body mt-1 block text-xs">
                    Compra #{product.purchase_id} · {date(product.purchased_at)}{" "}
                    · {quantity(product.quantity)} {product.unit} ·{" "}
                    {money(product.line_total)}
                  </span>
                </span>
                <span className="text-body text-xs">
                  {groups.find((group) =>
                    group.purchase_item_ids.includes(product.id),
                  )?.name ?? "Sin agrupar"}
                </span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-stroke px-4 py-2 text-sm text-dark dark:border-dark-3 dark:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                saving || productsLoading || !chosen.length || !month || !ready
              }
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving
                ? "Guardando…"
                : existing
                  ? "Agregar al mes"
                  : "Crear grupo y asignar"}
            </button>
          </div>
        </form>
      )}
      {loading || productsLoading ? (
        <p className="text-body text-sm">Cargando inventario por mes…</p>
      ) : ready && selected === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const count = products.filter((product) =>
              group.purchase_item_ids.includes(product.id),
            ).length;
            return (
              <button
                type="button"
                key={group.id}
                onClick={() => setSelected(group.id)}
                className="rounded-xl border border-stroke p-5 text-left transition hover:border-primary hover:bg-primary/5 dark:border-dark-3"
              >
                <p className="text-lg font-semibold text-dark dark:text-white">
                  {group.name}
                </p>
                <p className="text-body mt-2 text-sm">
                  {count}{" "}
                  {count === 1 ? "registro de compra" : "registros de compra"}
                </p>
                <p className="mt-4 text-sm font-semibold text-primary">
                  Ver inventario →
                </p>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelected("ungrouped")}
            className="rounded-xl border border-dashed border-stroke p-5 text-left hover:border-primary dark:border-dark-3"
          >
            <p className="text-lg font-semibold text-dark dark:text-white">
              Sin agrupar
            </p>
            <p className="text-body mt-2 text-sm">
              {ungrouped.length}{" "}
              {ungrouped.length === 1
                ? "registro de compra"
                : "registros de compra"}
            </p>
            <p className="mt-4 text-sm font-semibold text-primary">
              Ver inventario →
            </p>
          </button>
        </div>
      ) : ready && selected !== null ? (
        <div className="flex flex-wrap items-center gap-4 border-b border-stroke pb-3 dark:border-dark-3">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-sm font-semibold text-primary"
          >
            ← Volver a los meses
          </button>
          <h4 className="font-semibold text-dark dark:text-white">
            {selected === "catalog"
              ? "Catálogo y existencias"
              : selected === "ungrouped"
                ? "Sin agrupar"
                : selectedGroup?.name}
          </h4>
        </div>
      ) : null}
      {ready && !loading && selected !== null && selected !== "catalog" && (
        <div className="overflow-x-auto">
          <p className="text-body mb-3 text-sm">
            Cantidades y valores registrados en compras. Consulta el catálogo
            para ver las existencias actuales.
          </p>
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-gray-2 text-dark dark:bg-dark-2 dark:text-white">
              <tr>
                {[
                  "Producto",
                  "Categoría",
                  "Marca / Proveedor",
                  "Costo",
                  "Presentación",
                  "Gramos en helado",
                  "Costo por topping",
                  "Compra",
                  "Fecha de compra",
                  "Cantidad comprada",
                  "Costo unitario",
                  "Total compra",
                ].map((label) => (
                  <th key={label} className="px-3 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleEntries.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-body p-5">
                    No hay registros de compras en este grupo para esta sección
                    o búsqueda.
                  </td>
                </tr>
              ) : (
                visibleEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-stroke text-dark dark:border-dark-3 dark:text-white"
                  >
                    <td className="px-3 py-3 font-medium">{entry.name}</td>
                    <td className="px-3 py-3">{entry.category || "—"}</td>
                    <td className="px-3 py-3">{entry.supplier_name || "—"}</td>
                    <td className="px-3 py-3">{money(entry.cost)}</td>
                    <td className="px-3 py-3">{entry.presentation || "—"}</td>
                    <td className="px-3 py-3">
                      {entry.grams_per_ice_cream == null
                        ? "—"
                        : `${quantity(entry.grams_per_ice_cream)} GR`}
                    </td>
                    <td className="px-3 py-3">{money(entry.topping_cost)}</td>
                    <td className="px-3 py-3">#{entry.purchase_id}</td>
                    <td className="px-3 py-3">{date(entry.purchased_at)}</td>
                    <td className="px-3 py-3">
                      {quantity(entry.quantity)} {entry.unit}
                    </td>
                    <td className="px-3 py-3">{money(entry.unit_cost)}</td>
                    <td className="px-3 py-3">{money(entry.line_total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
