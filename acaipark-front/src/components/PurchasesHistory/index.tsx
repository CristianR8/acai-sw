"use client";

import { useEffect, useState } from "react";
import { FaRegTrashAlt } from "react-icons/fa";

type Purchase = { id: number; supplier_name?: string | null; purchased_at?: string | null; received_at?: string | null; created_at: string; total_cost: number | string; items: Array<{ id: number; product_name?: string | null }> };
type Supplier = { id: number; name: string };
type Product = { id: number; name: string; kind: "ingredient" | "material"; unit?: string | null };
type PurchaseRow = { mode: "existing" | "new"; productId: string; productName: string; kind: "ingredient" | "material"; unit: string; supplierId: string; quantity: string; totalCost: string };

const UNIT_OPTIONS = [{ value: "gramos", label: "GR" }, { value: "mililitros", label: "ML" }, { value: "unidades", label: "Unidad" }];

function money(value: unknown) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function date(value: string | null | undefined) { return value ? new Date(value).toLocaleDateString("es-CO") : "-"; }

function localDateInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function emptyRow(): PurchaseRow {
  return { mode: "existing", productId: "", productName: "", kind: "ingredient", unit: "gramos", supplierId: "", quantity: "", totalCost: "" };
}

export default function PurchasesHistory() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [fullHistory, setFullHistory] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState(localDateInputValue());
  const [rows, setRows] = useState<PurchaseRow[]>([emptyRow()]);
  const [useSameSupplier, setUseSameSupplier] = useState(true);
  const [sharedSupplierId, setSharedSupplierId] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ history: fullHistory ? "all" : "recent" });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/inventory/purchases?${params}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      setPurchases(response.ok && Array.isArray(payload) ? payload : []);
      setLoading(false);
    }, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [fullHistory, search, reloadToken]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/inventory/suppliers", { cache: "no-store" }).then((response) => response.json()).then((data) => setSuppliers(Array.isArray(data) ? data : [])).catch(() => setSuppliers([])),
      fetch("/api/inventory/products?purchased_only=true", { cache: "no-store" }).then((response) => response.json()).then((data) => setProducts(Array.isArray(data) ? data : [])).catch(() => setProducts([])),
    ]);
  }, [reloadToken]);

  function resetForm() {
    setPurchaseDate(localDateInputValue());
    setRows([emptyRow()]);
    setUseSameSupplier(true);
    setSharedSupplierId("");
    setFormMessage(null);
  }

  function updateRow(index: number, field: keyof PurchaseRow, value: string) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  function selectSharedSupplier(value: string) {
    setSharedSupplierId(value);
    if (useSameSupplier) setRows((current) => current.map((row) => ({ ...row, supplierId: value })));
  }

  function changeSharedSupplierEnabled(enabled: boolean) {
    setUseSameSupplier(enabled);
    if (enabled) setRows((current) => current.map((row) => ({ ...row, supplierId: sharedSupplierId })));
  }

  function addRow() { setRows((current) => [...current, { ...emptyRow(), supplierId: useSameSupplier ? sharedSupplierId : "" }]); }
  function removeRow(index: number) { setRows((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index)); }

  async function registerPurchase() {
    if (!purchaseDate) { setFormMessage("Selecciona la fecha de compra."); return; }
    const items: Array<Record<string, unknown>> = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const quantity = Number(row.quantity.replace(",", "."));
      const total = Number(row.totalCost.replace(/\D/g, ""));
      const supplierId = useSameSupplier ? sharedSupplierId : row.supplierId;
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(total) || total <= 0) { setFormMessage(`Completa cantidad y costo total en la fila ${index + 1}.`); return; }
      if (row.mode === "existing") {
        if (!row.productId) { setFormMessage(`Selecciona un producto en la fila ${index + 1}.`); return; }
        items.push({ product_id: Number(row.productId), supplier_id: supplierId ? Number(supplierId) : null, quantity, unit_cost: Math.round(total / quantity) });
      } else {
        if (!row.productName.trim() || (row.kind === "ingredient" && !row.unit)) { setFormMessage(`Completa el producto y la unidad en la fila ${index + 1}.`); return; }
        items.push({ product_name: row.productName.trim(), product_kind: row.kind, unit: row.kind === "ingredient" ? row.unit : undefined, supplier_id: supplierId ? Number(supplierId) : null, quantity, unit_cost: Math.round(total / quantity) });
      }
    }
    setSaving(true);
    setFormMessage(null);
    try {
      const response = await fetch("/api/inventory/purchases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ supplier_id: useSameSupplier && sharedSupplierId ? Number(sharedSupplierId) : null, purchased_at: `${purchaseDate}T12:00:00`, items }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setFormMessage(payload?.message ?? "No se pudo registrar la compra."); return; }
      setShowForm(false);
      resetForm();
      setFullHistory(false);
      setReloadToken((value) => value + 1);
    } catch {
      setFormMessage("No se pudo registrar la compra.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-semibold text-dark dark:text-white">Historial de compras</h2><p className="mt-1 text-sm text-body">{fullHistory ? "Historial completo de compras." : "Mostrando los últimos 10 registros."}</p></div>
        <button type="button" onClick={() => { setShowForm((value) => !value); setFormMessage(null); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">Registrar compra</button>
      </div>

      {showForm ? (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 dark:bg-primary/10">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="min-w-[180px] flex-1 text-sm font-medium text-dark dark:text-white">Fecha de compra<input type="date" value={purchaseDate} max={localDateInputValue()} onChange={(event) => setPurchaseDate(event.target.value)} className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white" /></label>
            <label className="min-w-[220px] flex-1 text-sm font-medium text-dark dark:text-white">Proveedor para todos los productos<select value={sharedSupplierId} onChange={(event) => selectSharedSupplier(event.target.value)} disabled={!useSameSupplier} className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-dark disabled:bg-gray-1 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:disabled:bg-dark-3"><option value="">Sin proveedor</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            <label className="flex items-center gap-2 pb-2 text-sm font-medium text-dark dark:text-white"><input type="checkbox" checked={useSameSupplier} onChange={(event) => changeSharedSupplierEnabled(event.target.checked)} />Usar el mismo proveedor en todas las filas</label>
          </div>
          <div className="mb-2 text-sm font-semibold text-dark dark:text-white">Productos comprados</div>
          <p className="mb-3 text-xs text-body">Agrega todos los productos de una misma compra. El costo unitario se calcula automáticamente.</p>
          <div className="space-y-3">
            {rows.map((row, index) => {
              const total = Number(row.totalCost.replace(/\D/g, ""));
              const quantity = Number(row.quantity.replace(",", "."));
              const unitCost = quantity > 0 && total > 0 ? Math.round(total / quantity) : 0;
              return (
                <div key={index} className="rounded-lg border border-stroke bg-white p-3 dark:border-dark-3 dark:bg-dark-2">
                  <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[0.72fr_1.55fr_0.82fr_0.82fr_1fr_0.76fr_0.92fr_0.92fr_auto]">
                    <label className="text-xs font-medium text-body">Producto<select value={row.mode} onChange={(event) => updateRow(index, "mode", event.target.value)} className="mt-1 w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark dark:border-dark-3 dark:bg-gray-dark dark:text-white"><option value="existing">Existente</option><option value="new">Nuevo</option></select></label>
                    <label className="text-xs font-medium text-body">Nombre{row.mode === "existing" ? <select value={row.productId} onChange={(event) => { const product = products.find((item) => String(item.id) === event.target.value); updateRow(index, "productId", event.target.value); if (product) { updateRow(index, "kind", product.kind); updateRow(index, "unit", product.unit ?? ""); } }} className="mt-1 w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark dark:border-dark-3 dark:bg-gray-dark dark:text-white"><option value="">Selecciona producto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select> : <input value={row.productName} onChange={(event) => updateRow(index, "productName", event.target.value)} placeholder="Nombre del producto" className="mt-1 w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark dark:border-dark-3 dark:bg-gray-dark dark:text-white" />}</label>
                    <label className="text-xs font-medium text-body">Tipo{row.mode === "new" ? <select value={row.kind} onChange={(event) => updateRow(index, "kind", event.target.value)} className="mt-1 w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark dark:border-dark-3 dark:bg-gray-dark dark:text-white"><option value="ingredient">Ingrediente</option><option value="material">Insumo</option></select> : <div className="mt-1 rounded-md border border-stroke px-2 py-2 text-sm text-dark dark:border-dark-3 dark:text-white">{row.kind === "ingredient" ? "Ingrediente" : "Insumo"}</div>}</label>
                    <label className="text-xs font-medium text-body">Unidad{row.mode === "new" && row.kind === "ingredient" ? <select value={row.unit} onChange={(event) => updateRow(index, "unit", event.target.value)} className="mt-1 w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark dark:border-dark-3 dark:bg-gray-dark dark:text-white">{UNIT_OPTIONS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select> : <div className="mt-1 rounded-md border border-stroke px-2 py-2 text-sm text-dark dark:border-dark-3 dark:text-white">{row.unit || "-"}</div>}</label>
                    <label className="text-xs font-medium text-body">Proveedor<select value={useSameSupplier ? sharedSupplierId : row.supplierId} onChange={(event) => useSameSupplier ? selectSharedSupplier(event.target.value) : updateRow(index, "supplierId", event.target.value)} className="mt-1 w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark disabled:bg-gray-1 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:disabled:bg-dark-3" disabled={useSameSupplier}><option value="">Sin proveedor</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                    <label className="text-xs font-medium text-body">Cantidad<input value={row.quantity} inputMode="decimal" onChange={(event) => updateRow(index, "quantity", event.target.value)} className="mt-1 w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark dark:border-dark-3 dark:bg-gray-dark dark:text-white" /></label>
                    <label className="text-xs font-medium text-body">Costo total<input value={row.totalCost} inputMode="numeric" onChange={(event) => updateRow(index, "totalCost", event.target.value.replace(/\D/g, ""))} placeholder="0" className="mt-1 w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark dark:border-dark-3 dark:bg-gray-dark dark:text-white" /></label>
                    <div className="text-xs font-medium text-body">Costo unitario<div className="mt-1 rounded-md border border-stroke px-2 py-2 text-sm font-semibold text-dark dark:border-dark-3 dark:text-white">{money(unitCost)}</div></div>
                    <button type="button" onClick={() => removeRow(index)} disabled={rows.length === 1} className="flex h-10 w-10 items-center justify-center rounded-md border border-red/50 text-red hover:bg-red/10 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Eliminar producto ${index + 1}`} title="Eliminar producto"><FaRegTrashAlt /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={addRow} className="mt-3 rounded-md border border-stroke px-3 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white">+ Agregar producto</button>
          {formMessage ? <p className="mt-3 text-sm font-medium text-red">{formMessage}</p> : null}
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark dark:border-dark-3 dark:text-white">Cancelar</button><button type="button" disabled={saving} onClick={() => void registerPurchase()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">{saving ? "Guardando..." : "Registrar compra"}</button></div>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-3"><button onClick={() => { setFullHistory((value) => !value); setSearch(""); }} className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white">{fullHistory ? "Ver últimos registros" : "Ver historial completo"}</button>{fullHistory ? <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por proveedor, producto o número" className="min-w-[260px] flex-1 rounded-md border border-stroke px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white" /> : null}</div>
      {loading ? <p className="text-sm text-body">Cargando compras...</p> : purchases.length === 0 ? <p className="text-sm text-body">No hay registros que coincidan.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] table-auto"><thead><tr className="border-b border-stroke text-left text-xs uppercase text-dark-6 dark:border-dark-3"><th className="px-3 py-3">Compra</th><th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Proveedor</th><th className="px-3 py-3">Productos</th><th className="px-3 py-3 text-right">Monto gastado</th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id} className="border-b border-stroke dark:border-dark-3"><td className="px-3 py-3 font-medium text-dark dark:text-white">#{purchase.id}</td><td className="px-3 py-3 text-sm text-body">{date(purchase.purchased_at ?? purchase.received_at ?? purchase.created_at)}</td><td className="px-3 py-3 text-sm text-body">{purchase.supplier_name ?? "Sin proveedor"}</td><td className="px-3 py-3 text-sm text-body">{purchase.items.map((item) => item.product_name || `#${item.id}`).join(", ")}</td><td className="px-3 py-3 text-right font-semibold text-dark dark:text-white">{money(purchase.total_cost)}</td></tr>)}</tbody></table></div>}
    </div>
  );
}
