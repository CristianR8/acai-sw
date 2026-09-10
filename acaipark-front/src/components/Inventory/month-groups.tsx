"use client";

import { useEffect, useMemo, useState } from "react";

type Product = { id: number; name: string };
type Registration = Product & {
  purchase_id: number;
  purchased_at: string | null;
  quantity: string;
  unit: string | null;
  category: string | null;
  supplier_name: string | null;
  unit_cost: string;
  line_total: string;
};
type MonthGroup = { id: number; year: number; month: number; name: string; purchase_item_ids: number[] };
type Props = {
  products: Product[];
  kind: "ingredient" | "material";
  searchTerm: string;
  productsLoading: boolean;
  onSelect: (ids: number[] | null) => void;
};

const monthKey = (group: MonthGroup) => `${group.year}-${String(group.month).padStart(2, "0")}`;

export default function InventoryMonthGroups({ kind, searchTerm, productsLoading, onSelect }: Props) {
  const [targetMonth, setTargetMonth] = useState<string | null>(null);
  const [targetItemId, setTargetItemId] = useState(0);
  const [entries, setEntries] = useState<Registration[]>([]);
  const [groups, setGroups] = useState<MonthGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { onSelect(null); }, [onSelect]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTargetMonth(params.get("month"));
    setTargetItemId(Number(params.get("purchaseItem")));
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setMessage(null);
      try {
        const [groupsResponse, entriesResponse] = await Promise.all([
          fetch("/api/inventory/month-groups", { cache: "no-store" }),
          fetch(`/api/inventory/month-groups/purchase-items?kind=${kind}`, { cache: "no-store" }),
        ]);
        const groupsPayload = await groupsResponse.json().catch(() => null);
        const entriesPayload = await entriesResponse.json().catch(() => null);
        if (!groupsResponse.ok || !Array.isArray(groupsPayload)) throw new Error(groupsPayload?.message || "No se pudieron cargar los meses.");
        if (!entriesResponse.ok || !Array.isArray(entriesPayload)) throw new Error(entriesPayload?.message || "No se pudieron cargar las compras.");
        if (!active) return;
        setGroups(groupsPayload);
        setEntries(entriesPayload);
        const target = groupsPayload.find((group: MonthGroup) => monthKey(group) === targetMonth);
        setSelectedGroupId(target?.id ?? null);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "No se pudo cargar el inventario por mes.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [kind, targetMonth]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const visibleEntries = useMemo(() => {
    if (!selectedGroup) return [];
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("es");
    return entries.filter((entry) => selectedGroup.purchase_item_ids.includes(entry.id) && entry.name.toLocaleLowerCase("es").includes(normalizedSearch));
  }, [entries, searchTerm, selectedGroup]);
  const money = (value: string) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value));
  const quantity = (value: string) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 4 }).format(Number(value));
  const date = (value: string | null) => value ? new Date(value).toLocaleDateString("es-CO") : "—";

  return <section className="mb-5 space-y-4">
    <div><h3 className="text-lg font-semibold text-dark dark:text-white">Inventario por mes</h3><p className="text-body text-sm">Las compras se agrupan automáticamente según su fecha de compra.</p></div>
    {message && <p role="alert" className="rounded-lg bg-red/10 p-3 text-sm text-red">{message}</p>}
    {loading || productsLoading ? <p className="text-body text-sm">Cargando inventario por mes…</p> : !selectedGroup ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => { const count = entries.filter((entry) => group.purchase_item_ids.includes(entry.id)).length; return <button type="button" key={group.id} onClick={() => setSelectedGroupId(group.id)} className="rounded-xl border border-stroke p-5 text-left transition hover:border-primary hover:bg-primary/5 dark:border-dark-3"><p className="text-lg font-semibold text-dark dark:text-white">{group.name}</p><p className="text-body mt-2 text-sm">{count} {count === 1 ? "registro de compra" : "registros de compra"}</p><p className="mt-4 text-sm font-semibold text-primary">Ver inventario →</p></button>; })}
      {groups.length === 0 && <p className="text-body text-sm">Aún no hay compras registradas.</p>}
    </div> : <>
      <div className="flex flex-wrap items-center gap-4 border-b border-stroke pb-3 dark:border-dark-3"><button type="button" onClick={() => setSelectedGroupId(null)} className="text-sm font-semibold text-primary">← Volver a los meses</button><h4 className="font-semibold text-dark dark:text-white">{selectedGroup.name}</h4></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-gray-2 text-dark dark:bg-dark-2 dark:text-white"><tr>{["Producto", "Categoría", "Proveedor", "Compra", "Fecha", "Cantidad", "Costo unitario", "Total compra"].map((label) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{visibleEntries.length === 0 ? <tr><td colSpan={8} className="text-body p-5">No hay compras en este mes para esta búsqueda.</td></tr> : visibleEntries.map((entry) => <tr id={`purchase-item-${entry.id}`} key={entry.id} className={`border-b border-stroke text-dark dark:border-dark-3 dark:text-white ${entry.id === targetItemId ? "bg-primary/10" : ""}`}><td className="px-3 py-3 font-medium">{entry.name}</td><td className="px-3 py-3">{entry.category || "—"}</td><td className="px-3 py-3">{entry.supplier_name || "—"}</td><td className="px-3 py-3">#{entry.purchase_id}</td><td className="px-3 py-3">{date(entry.purchased_at)}</td><td className="px-3 py-3">{quantity(entry.quantity)} {entry.unit}</td><td className="px-3 py-3">{money(entry.unit_cost)}</td><td className="px-3 py-3">{money(entry.line_total)}</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
