export type SpendingPurchase = {
  supplier_id?: number | null;
  supplier_name?: string | null;
  status?: string;
  total_cost: number | string;
  items: Array<{
    supplier_id?: number | null;
    supplier_name?: string | null;
    line_total: number | string;
  }>;
};

export type SupplierSpending = { id: string; name: string; total: number };

function amount(value: number | string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function summarizePurchaseSpending(purchases: SpendingPurchase[]) {
  const groups = new Map<string, SupplierSpending>();
  let total = 0;
  let count = 0;
  function add(
    supplierId: number | null | undefined,
    name: string | null | undefined,
    value: number,
  ) {
    const id = supplierId != null ? `supplier-${supplierId}` : "unassigned";
    const group = groups.get(id) ?? {
      id,
      name:
        name?.trim() ||
        (supplierId != null ? `Proveedor #${supplierId}` : "Sin proveedor"),
      total: 0,
    };
    group.total += value;
    groups.set(id, group);
  }
  for (const purchase of purchases) {
    if (purchase.status === "void") continue;
    total += amount(purchase.total_cost);
    count += 1;
    if (purchase.items.length === 0) {
      add(
        purchase.supplier_id,
        purchase.supplier_name,
        amount(purchase.total_cost),
      );
      continue;
    }
    for (const item of purchase.items) {
      const supplierId = item.supplier_id ?? purchase.supplier_id;
      const name =
        item.supplier_name ??
        (supplierId === purchase.supplier_id ? purchase.supplier_name : null);
      add(supplierId, name, amount(item.line_total));
    }
  }
  return {
    total,
    count,
    suppliers: [...groups.values()].sort(
      (a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"),
    ),
  };
}
