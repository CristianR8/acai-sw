"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { SearchIcon } from "@/assets/icons";

type InventoryKind = "ingredient" | "material" | "recipe";

type InventoryProduct = {
  id: number;
  name: string;
  sku?: string | null;
  kind: string;
  unit?: string | null;
  on_hand: string;
  average_cost: string;
  last_cost: string;
  is_active: boolean;
  created_at: string;
};

type RecipeItem = {
  id: number;
  menu_item_id: number;
  name: string;
  yield_quantity: string;
  unit?: string | null;
  created_at: string;
  ingredients: Array<{
    name: string;
    unit: string | null;
    quantity: string;
  }>;
};

type Supplier = {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
};

type PurchaseItemRow = {
  mode: "existing" | "new";
  product_id: string;
  product_name: string;
  unit: string;
  supplier_id: string;
  quantity: string;
  total_cost: string;
};
const UNIT_OPTIONS = [
  { value: "mililitros", label: "ML" },
  { value: "gramos", label: "GR" },
  { value: "unidades", label: "Unidad" },
];

const RECIPE_UNIT_OPTIONS = [
  { value: "", label: "Sin unidad" },
  { value: "GR", label: "GR" },
  { value: "ML", label: "ML" },
  { value: "UND", label: "Unidad" },
];

// El catálogo refleja los productos e insumos registrados mediante compras.
const INVENTORY_CATALOG_VISIBLE = true;

function safeNumber(value: unknown) {
  const asNumber =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(asNumber) ? asNumber : null;
}

function formatQty(value: unknown) {
  const asNumber = safeNumber(value);
  if (asNumber === null) return String(value ?? "");
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  }).format(asNumber);
}

function formatQtyPlain(value: unknown) {
  const asNumber = safeNumber(value);
  if (asNumber === null) return String(value ?? "");
  return String(Math.round(asNumber));
}

function normalizeIntegerInput(value: string | number | null | undefined) {
  const asNumber = safeNumber(value);
  if (asNumber === null) return "";
  return String(Math.round(asNumber));
}

function formatCop(value: unknown) {
  const asNumber = safeNumber(value);
  if (asNumber === null) return String(value ?? "");
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(asNumber);
}

function formatCopInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const asNumber = Number(digits);
  if (!Number.isFinite(asNumber)) return "";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(asNumber);
}

function computeUnitCost(quantity: unknown, totalCost: unknown) {
  const qty = safeNumber(quantity);
  const total = safeNumber(totalCost);
  if (qty === null || total === null || qty <= 0) return 0;
  return Math.round(total / qty);
}

function normalizeMoneyInput(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function localDateInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function normalizeRecipeIngredientName(value: string) {
  return normalizeSearchText(value);
}

function defaultRecipeUnitForName(name: string) {
  if (normalizeRecipeIngredientName(name) === "salsa tartara") return "ML";
  return "";
}

function normalizeUnitValue(value: string | null | undefined) {
  const raw = (value ?? "").trim().toUpperCase();
  if (raw === "ML" || raw === "MILILITROS") return "mililitros";
  if (raw === "GR" || raw === "GRAMOS") return "gramos";
  if (raw === "UND" || raw === "UNIDADES") return "unidades";
  return value ?? "";
}

function formatUnitAbbr(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  const unit = raw.toLowerCase();
  if (unit === "mililitros") return "ML";
  if (unit === "gramos") return "GR";
  if (unit === "unidades") return "Unidad";
  if (raw.toUpperCase() === "ML") return "ML";
  if (raw.toUpperCase() === "GR") return "GR";
  if (raw.toUpperCase() === "UND") return "Unidad";
  return raw ? raw.toUpperCase() : "";
}

export default function Inventory({
  backendBaseUrl,
}: {
  backendBaseUrl: string;
}) {
  const [tab, setTab] = useState<InventoryKind>("ingredient");
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [showRecipeCreate, setShowRecipeCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [recipeNameInput, setRecipeNameInput] = useState("");
  const [recipeYieldInput, setRecipeYieldInput] = useState("1");
  const [recipeUnitInput, setRecipeUnitInput] = useState("");
  const [recipeIngredients, setRecipeIngredients] = useState<
    Array<{ name: string; unit: string; quantity: string }>
  >([{ name: "", unit: "", quantity: "" }]);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [unitInput, setUnitInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [totalCostInput, setTotalCostInput] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemRow[]>([
    {
      mode: "existing",
      product_id: "",
      product_name: "",
      unit: "gramos",
      supplier_id: "",
      quantity: "",
      total_cost: "",
    },
  ]);
  const [purchaseDate, setPurchaseDate] = useState(() =>
    localDateInputValue(),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [submitStatus, setSubmitStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [deletingIds, setDeletingIds] = useState<Set<number>>(() => new Set());

  const exportInventoryUrl = useMemo(() => {
    const base = backendBaseUrl.replace(/\/$/, "");
    return `${base}/inventory/exports/inventory.xlsx`;
  }, [backendBaseUrl]);

  async function loadProducts(kind: InventoryKind) {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/inventory/products?kind=${encodeURIComponent(kind)}&purchased_only=true`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        throw new Error(
          (typeof payload?.message === "string" && payload.message) ||
            "No se pudo cargar inventario",
        );
      }
      setProducts(
        Array.isArray(payload) ? (payload as InventoryProduct[]) : [],
      );
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecipes() {
    setLoading(true);
    try {
      const response = await fetch("/api/inventory/recipes", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        throw new Error(
          (typeof payload?.message === "string" && payload.message) ||
            "No se pudo cargar recetas",
        );
      }
      setRecipes(Array.isArray(payload) ? (payload as RecipeItem[]) : []);
    } catch {
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSuppliers() {
    try {
      const response = await fetch("/api/inventory/suppliers", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        throw new Error(
          (typeof payload?.message === "string" && payload.message) ||
            "No se pudo cargar proveedores",
        );
      }
      setSuppliers(Array.isArray(payload) ? (payload as Supplier[]) : []);
    } catch {
      setSuppliers([]);
    }
  }

  useEffect(() => {
    if (tab === "recipe") {
      loadRecipes();
    } else {
      loadProducts(tab);
    }
  }, [tab]);

  useEffect(() => {
    if (tab !== "recipe") {
      loadSuppliers();
    }
  }, [tab]);

  useEffect(() => {
    setShowCreate(false);
    setShowEdit(false);
    setShowRecipeCreate(false);
    setEditingId(null);
    setSubmitStatus({ kind: "idle" });
    resetPurchaseForm();
  }, [tab]);

  const viewTitle =
    tab === "ingredient"
      ? "Inventario de ingredientes"
      : tab === "material"
        ? "Inventario de insumos"
        : "Inventario de recetas";
  const viewHint =
    tab === "ingredient"
      ? "Ingredientes y productos usados en recetas."
      : tab === "material"
        ? "Vasos, platos, copas y materiales."
        : "Recetas registradas en el sistema.";

  const lowStockIds = useMemo(() => {
    return new Set<number>();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    if (!term) return products;
    return products.filter((product) =>
      normalizeSearchText(String(product.name ?? "")).includes(term),
    );
  }, [products, searchTerm]);

  const filteredRecipes = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    if (!term) return recipes;
    return recipes.filter((recipe) =>
      normalizeSearchText(String(recipe.name ?? "")).includes(term),
    );
  }, [recipes, searchTerm]);

  function resetForm() {
    setNameInput("");
    setUnitInput("");
    setQuantityInput("");
    setTotalCostInput("");
    setRecipeNameInput("");
    setRecipeYieldInput("1");
    setRecipeUnitInput("");
    setRecipeIngredients([{ name: "", unit: "", quantity: "" }]);
    setEditingRecipeId(null);
  }

  function resetPurchaseForm() {
    const defaultUnit = tab === "ingredient" ? "gramos" : "";
    setPurchaseDate(localDateInputValue());
    setPurchaseItems([
      {
        mode: "existing",
        product_id: "",
        product_name: "",
        unit: defaultUnit,
        supplier_id: "",
        quantity: "",
        total_cost: "",
      },
    ]);
  }

  function openCreate() {
    setSubmitStatus({ kind: "idle" });
    setShowEdit(false);
    setShowRecipeCreate(false);
    setEditingId(null);
    resetForm();
    resetPurchaseForm();
    setShowCreate(true);
  }

  function openRecipeCreate() {
    setSubmitStatus({ kind: "idle" });
    setShowEdit(false);
    setShowCreate(false);
    setEditingId(null);
    setEditingRecipeId(null);
    resetForm();
    setShowRecipeCreate(true);
  }

  function openEdit(product: InventoryProduct) {
    setSubmitStatus({ kind: "idle" });
    setShowCreate(false);
    setShowRecipeCreate(false);
    setShowEdit(true);
    setEditingId(product.id);
    setNameInput(product.name ?? "");
    setUnitInput(product.unit ?? "");
    setQuantityInput(formatQty(product.on_hand ?? ""));
    const avg = safeNumber(product.average_cost);
    const qty = safeNumber(product.on_hand);
    const approxTotal = avg !== null && qty !== null ? avg * qty : null;
    setTotalCostInput(
      approxTotal !== null ? String(Math.round(approxTotal)) : "",
    );
  }

  function addRecipeIngredientRow() {
    setRecipeIngredients((prev) => [
      ...prev,
      { name: "", unit: "", quantity: "" },
    ]);
  }

  function updateRecipeIngredient(
    index: number,
    field: "name" | "unit" | "quantity",
    value: string,
  ) {
    setRecipeIngredients((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function removeRecipeIngredientRow(index: number) {
    setRecipeIngredients((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  }

  function addPurchaseRow() {
    const defaultUnit = tab === "ingredient" ? "gramos" : "";
    setPurchaseItems((prev) => [
      ...prev,
      {
        mode: "existing",
        product_id: "",
        product_name: "",
        unit: defaultUnit,
        supplier_id: "",
        quantity: "",
        total_cost: "",
      },
    ]);
  }

  function updatePurchaseRow(
    index: number,
    field: keyof PurchaseItemRow,
    value: string,
  ) {
    setPurchaseItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function removePurchaseRow(index: number) {
    setPurchaseItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  }

  function openRecipeEdit(recipe: RecipeItem) {
    setSubmitStatus({ kind: "idle" });
    setShowCreate(false);
    setShowEdit(false);
    setShowRecipeCreate(false);
    setEditingRecipeId(recipe.id);
    setRecipeNameInput(recipe.name ?? "");
    setRecipeYieldInput(normalizeIntegerInput(recipe.yield_quantity ?? "1"));
    setRecipeUnitInput(formatUnitAbbr(recipe.unit) || "");
    if (recipe.ingredients?.length) {
      setRecipeIngredients(
        recipe.ingredients.map((item) => ({
          name: item.name ?? "",
          unit:
            formatUnitAbbr(item.unit) ||
            defaultRecipeUnitForName(item.name ?? ""),
          quantity: normalizeIntegerInput(item.quantity ?? ""),
        })),
      );
    } else {
      setRecipeIngredients([{ name: "", unit: "", quantity: "" }]);
    }
  }

  function cancelRecipeEdit() {
    setEditingRecipeId(null);
    setSubmitStatus({ kind: "idle" });
    resetForm();
  }

  async function handleCreatePurchase() {
    setSubmitStatus({ kind: "loading" });

    if (!purchaseDate) {
      setSubmitStatus({ kind: "error", message: "La fecha de compra es requerida." });
      return;
    }

    if (!purchaseItems.length) {
      setSubmitStatus({
        kind: "error",
        message: "Debes agregar al menos un producto.",
      });
      return;
    }

    const itemsPayload: Array<{
      product_id?: number;
      product_name?: string;
      product_kind?: "ingredient" | "material";
      unit?: string;
      supplier_id?: number | null;
      quantity: string;
      unit_cost: string;
    }> = [];

    for (let index = 0; index < purchaseItems.length; index += 1) {
      const row = purchaseItems[index];
      if (row.mode === "existing") {
        const productId = Number(row.product_id);
        if (!Number.isFinite(productId) || productId <= 0) {
          setSubmitStatus({
            kind: "error",
            message: `Selecciona un producto en la fila ${index + 1}.`,
          });
          return;
        }
      } else {
        const productName = row.product_name.trim();
        if (!productName) {
          setSubmitStatus({
            kind: "error",
            message: `Nombre requerido en la fila ${index + 1}.`,
          });
          return;
        }
        if (tab === "ingredient") {
          const unit = row.unit.trim();
          if (!unit) {
            setSubmitStatus({
              kind: "error",
              message: `Unidad requerida en la fila ${index + 1}.`,
            });
            return;
          }
        }
      }

      const supplierIdRaw = row.supplier_id.trim();
      let supplierId: number | null = null;
      if (supplierIdRaw !== "") {
        const parsedSupplierId = Number(supplierIdRaw);
        if (!Number.isFinite(parsedSupplierId) || parsedSupplierId <= 0) {
          setSubmitStatus({
            kind: "error",
            message: `Proveedor invalido en la fila ${index + 1}.`,
          });
          return;
        }
        supplierId = parsedSupplierId;
      }

      const quantity = row.quantity.trim();
      const totalCostRaw = row.total_cost.trim();
      const quantityValue = safeNumber(quantity);
      const totalCostValue = safeNumber(totalCostRaw);

      if (!quantity || quantityValue === null || quantityValue <= 0) {
        setSubmitStatus({
          kind: "error",
          message: `Cantidad invalida en la fila ${index + 1}.`,
        });
        return;
      }

      if (!totalCostRaw || totalCostValue === null || totalCostValue <= 0) {
        setSubmitStatus({
          kind: "error",
          message: `Costo total invalido en la fila ${index + 1}.`,
        });
        return;
      }

      const unitCost = computeUnitCost(quantityValue, totalCostValue);
      if (unitCost <= 0) {
        setSubmitStatus({
          kind: "error",
          message: `Costo unitario invalido en la fila ${index + 1}.`,
        });
        return;
      }

      if (row.mode === "existing") {
        itemsPayload.push({
          product_id: Number(row.product_id),
          supplier_id: supplierId,
          quantity,
          unit_cost: String(unitCost),
        });
      } else {
        itemsPayload.push({
          product_name: row.product_name.trim(),
          product_kind: tab === "ingredient" ? "ingredient" : "material",
          unit: tab === "ingredient" ? row.unit.trim() : undefined,
          supplier_id: supplierId,
          quantity,
          unit_cost: String(unitCost),
        });
      }
    }

    try {
      const response = await fetch("/api/inventory/purchases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purchased_at: `${purchaseDate}T12:00:00`,
          items: itemsPayload,
        }),
      });

      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        setSubmitStatus({
          kind: "error",
          message:
            (typeof payload?.message === "string" && payload.message) ||
            "No se pudo registrar la compra.",
        });
        return;
      }

      setSubmitStatus({ kind: "success", message: "Compra registrada." });
      resetPurchaseForm();
      loadProducts(tab);
    } catch {
      setSubmitStatus({
        kind: "error",
        message: "Error registrando la compra (revisa conexion al backend).",
      });
    }
  }

  async function handleCreateRecipe() {
    setSubmitStatus({ kind: "loading" });

    const name = recipeNameInput.trim();
    if (!name) {
      setSubmitStatus({ kind: "error", message: "Nombre es requerido." });
      return;
    }

    const yieldQty = normalizeIntegerInput(recipeYieldInput);
    if (!yieldQty) {
      setSubmitStatus({ kind: "error", message: "Rinde es requerido." });
      return;
    }

    const cleanedIngredients = recipeIngredients
      .map((item) => {
        const name = item.name.trim();
        const unitRaw = item.unit.trim().toUpperCase();
        const unit = unitRaw || defaultRecipeUnitForName(name);
        return {
          name,
          unit: unit || undefined,
          quantity: normalizeIntegerInput(item.quantity),
        };
      })
      .filter((item) => item.name || item.quantity);

    for (const item of cleanedIngredients) {
      if (!item.name || !item.quantity) {
        setSubmitStatus({
          kind: "error",
          message: "Cada ingrediente debe tener nombre y cantidad.",
        });
        return;
      }
    }

    try {
      const endpoint = editingRecipeId
        ? `/api/inventory/recipes/${editingRecipeId}`
        : "/api/inventory/recipes";
      const method = editingRecipeId ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          yield_quantity: yieldQty,
          unit: recipeUnitInput.trim().toUpperCase() || null,
          ingredients: cleanedIngredients,
        }),
      });

      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        setSubmitStatus({
          kind: "error",
          message:
            (typeof payload?.message === "string" && payload.message) ||
            "No se pudo guardar la receta.",
        });
        return;
      }

      const created = payload as RecipeItem;
      setRecipes((prev) =>
        editingRecipeId
          ? prev.map((item) => (item.id === created.id ? created : item))
          : [created, ...prev],
      );
      setSubmitStatus({
        kind: "success",
        message: editingRecipeId ? "Receta actualizada." : "Receta creada.",
      });
      resetForm();
      setShowRecipeCreate(false);
    } catch {
      setSubmitStatus({
        kind: "error",
        message: "Error guardando la receta (revisa conexión al backend).",
      });
    }
  }

  async function handleUpdateProduct() {
    if (!editingId) return;
    setSubmitStatus({ kind: "loading" });

    const name = nameInput.trim();
    if (!name) {
      setSubmitStatus({ kind: "error", message: "Nombre es requerido." });
      return;
    }

    const quantity = quantityInput.trim();
    const totalCost = normalizeMoneyInput(totalCostInput);
    if (!quantity || !totalCost) {
      setSubmitStatus({
        kind: "error",
        message: "Cantidad y costo total son requeridos.",
      });
      return;
    }

    const unit = tab === "ingredient" ? unitInput.trim() : "";
    if (tab === "ingredient" && !unit) {
      setSubmitStatus({
        kind: "error",
        message: "La unidad es requerida para Ingredientes.",
      });
      return;
    }
    if (
      tab === "ingredient" &&
      !UNIT_OPTIONS.some((option) => option.value === unit)
    ) {
      setSubmitStatus({
        kind: "error",
        message: "La unidad debe ser: mililitros, gramos o unidades.",
      });
      return;
    }

    try {
      const response = await fetch(`/api/inventory/products/${editingId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          unit: tab === "ingredient" ? unit : null,
          on_hand: quantity,
          total_cost: totalCost,
        }),
      });

      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        setSubmitStatus({
          kind: "error",
          message:
            (typeof payload?.message === "string" && payload.message) ||
            "No se pudo editar el producto.",
        });
        return;
      }

      const updated = payload as InventoryProduct;
      setProducts((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
      setSubmitStatus({ kind: "success", message: "Producto actualizado." });
      setShowEdit(false);
      setEditingId(null);
      resetForm();
    } catch {
      setSubmitStatus({
        kind: "error",
        message: "Error editando el producto (revisa conexión al backend).",
      });
    }
  }

  async function handleDeleteProduct(id: number) {
    if (deletingIds.has(id)) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const response = await fetch(`/api/inventory/products/${id}`, {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 204) {
        const payload = (await response.json().catch(() => null)) as any;
        throw new Error(
          (typeof payload?.message === "string" && payload.message) || "Error",
        );
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // ignore (could add toast later)
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleDeleteRecipe(id: number) {
    if (!window.confirm("¿Eliminar esta receta?")) return;
    try {
      const response = await fetch(`/api/inventory/recipes/${id}`, {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 204) {
        const payload = (await response.json().catch(() => null)) as any;
        throw new Error(
          (typeof payload?.message === "string" && payload.message) || "Error",
        );
      }
      setRecipes((prev) => prev.filter((item) => item.id !== id));
    } catch {
      // ignore (could add toast later)
    }
  }

  if (!INVENTORY_CATALOG_VISIBLE) {
    return (
      <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="text-xl font-semibold text-dark dark:text-white">
          Inventario
        </h2>
        <p className="text-body-color mt-2 text-sm dark:text-dark-6">
          No hay productos registrados en el inventario actual.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-dark dark:text-white">
            {viewTitle}
          </h2>
          <p className="text-body-color text-sm dark:text-dark-6">{viewHint}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tab !== "recipe" ? (
            <>
              <a
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                href={exportInventoryUrl}
              >
                Descargar Excel
              </a>
            </>
          ) : null}
          {tab === "recipe" ? (
            <button
              type="button"
              onClick={openRecipeCreate}
              className="rounded-md bg-dark px-4 py-2 text-sm font-medium text-white hover:bg-dark/90 dark:bg-white dark:text-dark dark:hover:bg-white/90"
            >
              Agregar receta
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("ingredient")}
          className={
            tab === "ingredient"
              ? "rounded-md bg-primary px-3 py-2 text-sm font-medium text-white"
              : "rounded-md border border-stroke px-3 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          }
        >
          Ingredientes
        </button>
        <button
          type="button"
          onClick={() => setTab("material")}
          className={
            tab === "material"
              ? "rounded-md bg-primary px-3 py-2 text-sm font-medium text-white"
              : "rounded-md border border-stroke px-3 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          }
        >
          Insumos
        </button>
        <div className="relative ml-auto w-full max-w-xs">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar items..."
            className="w-full rounded-md border-2 border-primary/40 bg-white py-2 pl-11 pr-3 text-sm text-dark shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-dark-3 dark:bg-gray-dark dark:text-white"
          />
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
        </div>
      </div>

      {showCreate ? (
        <div className="mb-6 rounded-md border border-stroke bg-gray-1 p-4 dark:border-dark-3 dark:bg-dark-2">
          <div className="mb-4 grid grid-cols-1 gap-3 md:max-w-sm">
            <label className="flex flex-col gap-1 text-sm font-medium text-dark dark:text-white">
              Fecha de compra
              <input
                type="date"
                value={purchaseDate}
                max={localDateInputValue()}
                onChange={(event) => setPurchaseDate(event.target.value)}
                className="rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              />
            </label>
          </div>
          <div className="mt-4">
            <div className="mb-2 text-sm font-semibold text-dark dark:text-white">
              Productos comprados
            </div>
            <div className="text-body-color mb-2 text-xs dark:text-dark-6">
              El costo unitario se calcula automaticamente desde el costo total
              y la cantidad.
            </div>
            <div className="mb-2 grid grid-cols-1 gap-2 text-xs font-semibold uppercase text-dark-6 md:grid-cols-[0.8fr_1.6fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr_auto]">
              <div>Tipo</div>
              <div>Nombre producto</div>
              <div>Unidad</div>
              <div>Proveedor</div>
              <div>Cantidad</div>
              <div>Costo total</div>
              <div>Costo unitario</div>
              <div />
            </div>
            <div className="space-y-2">
              {purchaseItems.map((item, index) => {
                const unitCost = computeUnitCost(
                  item.quantity,
                  item.total_cost,
                );
                return (
                  <div
                    key={`purchase-item-${index}`}
                    className="grid grid-cols-1 gap-2 md:grid-cols-[0.8fr_1.6fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr_auto]"
                  >
                    <select
                      value={item.mode}
                      onChange={(e) => {
                        const nextMode = e.target.value as "existing" | "new";
                        updatePurchaseRow(index, "mode", nextMode);
                        if (
                          nextMode === "new" &&
                          tab === "ingredient" &&
                          !item.unit
                        ) {
                          updatePurchaseRow(index, "unit", "gramos");
                        }
                      }}
                      className="w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                    >
                      <option value="existing">Existente</option>
                      <option value="new">Nuevo</option>
                    </select>
                    {item.mode === "existing" ? (
                      <select
                        value={item.product_id}
                        onChange={(e) => {
                          const value = e.target.value;
                          updatePurchaseRow(index, "product_id", value);
                          const selected = products.find(
                            (product) => String(product.id) === value,
                          );
                          if (selected?.unit) {
                            updatePurchaseRow(
                              index,
                              "unit",
                              normalizeUnitValue(selected.unit),
                            );
                          }
                        }}
                        className="w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                      >
                        <option value="">Selecciona producto</option>
                        {products.map((product) => (
                          <option key={product.id} value={String(product.id)}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={item.product_name}
                        onChange={(e) =>
                          updatePurchaseRow(
                            index,
                            "product_name",
                            e.target.value,
                          )
                        }
                        className="w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                        placeholder="Nombre del producto"
                      />
                    )}
                    <select
                      value={item.unit}
                      onChange={(e) =>
                        updatePurchaseRow(index, "unit", e.target.value)
                      }
                      disabled={
                        tab !== "ingredient" || item.mode === "existing"
                      }
                      className="w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark outline-none focus:border-primary disabled:bg-gray-1 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:disabled:bg-dark-2"
                    >
                      {tab !== "ingredient" ? (
                        <option value="">Sin unidad</option>
                      ) : (
                        UNIT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))
                      )}
                    </select>
                    <select
                      value={item.supplier_id}
                      onChange={(e) =>
                        updatePurchaseRow(index, "supplier_id", e.target.value)
                      }
                      className="w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                    >
                      <option value="">Sin proveedor</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={String(supplier.id)}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={item.quantity}
                      onChange={(e) =>
                        updatePurchaseRow(index, "quantity", e.target.value)
                      }
                      className="w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                      inputMode="decimal"
                      placeholder="Cantidad"
                    />
                    <input
                      value={formatCopInput(item.total_cost)}
                      onChange={(e) =>
                        updatePurchaseRow(
                          index,
                          "total_cost",
                          normalizeMoneyInput(e.target.value),
                        )
                      }
                      className="w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                      inputMode="numeric"
                      placeholder="Costo total"
                    />
                    <div className="flex items-center rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                      {formatCop(unitCost)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePurchaseRow(index)}
                      className="inline-flex items-center justify-center rounded-md border border-stroke px-2 py-2 text-sm font-medium text-red hover:bg-red/10 dark:border-dark-3"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addPurchaseRow}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-stroke px-3 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7.25 2.5a.75.75 0 011.5 0V7h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0V8.5H2.5a.75.75 0 010-1.5h4.75V2.5z" />
              </svg>
              Agregar producto
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              {submitStatus.kind === "error" ? (
                <span className="text-red">{submitStatus.message}</span>
              ) : submitStatus.kind === "success" ? (
                <span className="text-green">{submitStatus.message}</span>
              ) : null}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setSubmitStatus({ kind: "idle" });
                }}
                className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitStatus.kind === "loading"}
                onClick={handleCreatePurchase}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {submitStatus.kind === "loading"
                  ? "Guardando..."
                  : "Registrar compra"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showRecipeCreate && !editingRecipeId ? (
        <div className="mb-6 rounded-md border border-stroke bg-gray-1 p-4 dark:border-dark-3 dark:bg-dark-2">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-dark dark:text-white">
                Rinde
              </label>
              <input
                value={recipeYieldInput}
                onChange={(e) => setRecipeYieldInput(e.target.value)}
                className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                inputMode="decimal"
                placeholder="Ej: 1"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-dark dark:text-white">
                Unidad
              </label>
              <select
                value={recipeUnitInput}
                onChange={(e) => setRecipeUnitInput(e.target.value)}
                className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              >
                {RECIPE_UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 md:col-span-3">
              <label className="text-sm font-medium text-dark dark:text-white">
                Nombre de receta
              </label>
              <input
                value={recipeNameInput}
                onChange={(e) => setRecipeNameInput(e.target.value)}
                className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                placeholder="Ej: Hamburguesa clásica"
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-sm font-semibold text-dark dark:text-white">
              Ingredientes
            </div>
            <div className="space-y-2">
              {recipeIngredients.map((item, index) => (
                <div
                  key={`recipe-ingredient-${index}`}
                  className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_1fr_auto]"
                >
                  <input
                    value={item.name}
                    onChange={(e) =>
                      updateRecipeIngredient(index, "name", e.target.value)
                    }
                    className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                    placeholder="Ingrediente"
                  />
                  <input
                    value={item.quantity}
                    onChange={(e) =>
                      updateRecipeIngredient(index, "quantity", e.target.value)
                    }
                    className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                    inputMode="decimal"
                    placeholder="Cantidad"
                  />
                  <select
                    value={item.unit}
                    onChange={(e) =>
                      updateRecipeIngredient(index, "unit", e.target.value)
                    }
                    className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                  >
                    {RECIPE_UNIT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeRecipeIngredientRow(index)}
                    className="inline-flex items-center justify-center rounded-md border border-stroke px-2 py-2 text-sm font-medium text-red hover:bg-red/10 dark:border-dark-3"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRecipeIngredientRow}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-stroke px-3 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7.25 2.5a.75.75 0 011.5 0V7h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0V8.5H2.5a.75.75 0 010-1.5h4.75V2.5z" />
              </svg>
              Agregar ingrediente
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              {submitStatus.kind === "error" ? (
                <span className="text-red">{submitStatus.message}</span>
              ) : submitStatus.kind === "success" ? (
                <span className="text-green">{submitStatus.message}</span>
              ) : null}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRecipeCreate(false);
                  setSubmitStatus({ kind: "idle" });
                }}
                className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitStatus.kind === "loading"}
                onClick={handleCreateRecipe}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {submitStatus.kind === "loading"
                  ? "Creando..."
                  : "Crear receta"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-w-full overflow-x-auto pb-12">
        {tab === "recipe" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {loading ? (
              <div className="text-body-color rounded-xl border border-stroke bg-white p-4 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6">
                Cargando...
              </div>
            ) : filteredRecipes.length === 0 ? (
              <div className="text-body-color rounded-xl border border-stroke bg-white p-4 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6">
                No hay recetas registradas.
              </div>
            ) : (
              filteredRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-stroke bg-gradient-to-br from-gray-1 to-gray-3 p-4 shadow-sm shadow-secondary transition hover:border-secondary hover:shadow-lg dark:border-dark-3 dark:bg-gradient-to-br dark:from-dark-2 dark:to-[#0b1320] dark:shadow-secondary dark:hover:border-secondary dark:hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-dark dark:text-white">
                        {recipe.name}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-secondary">
                        Rinde {formatQtyPlain(recipe.yield_quantity)}
                        {recipe.unit ? ` ${formatUnitAbbr(recipe.unit)}` : ""}
                      </div>
                    </div>
                    <div className="rounded-full bg-white px-2 py-1 text-xs font-medium text-dark-6 shadow-sm dark:bg-dark-3/70 dark:text-dark-6">
                      {recipe.created_at
                        ? new Date(recipe.created_at).toLocaleDateString(
                            "es-CO",
                          )
                        : "-"}
                    </div>
                  </div>

                  <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-dark-6 dark:text-dark-6">
                    Ingredientes
                  </div>

                  <div className="mt-2 space-y-2 text-sm text-dark dark:text-white">
                    {recipe.ingredients?.length ? (
                      recipe.ingredients.map((ingredient, index) => (
                        <div
                          key={`${recipe.id}-ing-${index}`}
                          className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-2 py-1 dark:bg-dark-3/70"
                        >
                          <span className="font-semibold text-dark dark:text-white">
                            {ingredient.name}
                          </span>
                          <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-semibold text-secondary">
                            {formatQtyPlain(ingredient.quantity)}{" "}
                            {formatUnitAbbr(ingredient.unit)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-dark-6 dark:text-dark-6">
                        Sin ingredientes definidos.
                      </div>
                    )}
                  </div>

                  {editingRecipeId === recipe.id ? (
                    <div className="mt-4 rounded-xl border border-stroke bg-white/80 p-3 dark:border-dark-3 dark:bg-dark-3/40">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold uppercase text-dark-6 dark:text-dark-6">
                            Rinde
                          </label>
                          <input
                            value={recipeYieldInput}
                            onChange={(e) =>
                              setRecipeYieldInput(e.target.value)
                            }
                            className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                            inputMode="decimal"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold uppercase text-dark-6 dark:text-dark-6">
                            Unidad
                          </label>
                          <select
                            value={recipeUnitInput}
                            onChange={(e) => setRecipeUnitInput(e.target.value)}
                            className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                          >
                            {RECIPE_UNIT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 md:col-span-3">
                          <label className="text-xs font-semibold uppercase text-dark-6 dark:text-dark-6">
                            Nombre
                          </label>
                          <input
                            value={recipeNameInput}
                            onChange={(e) => setRecipeNameInput(e.target.value)}
                            className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {recipeIngredients.map((item, index) => (
                          <div
                            key={`recipe-ingredient-edit-${index}`}
                            className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_1fr_auto]"
                          >
                            <input
                              value={item.name}
                              onChange={(e) =>
                                updateRecipeIngredient(
                                  index,
                                  "name",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                              placeholder="Ingrediente"
                            />
                            <input
                              value={item.quantity}
                              onChange={(e) =>
                                updateRecipeIngredient(
                                  index,
                                  "quantity",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                              inputMode="decimal"
                              placeholder="Cantidad"
                            />
                            <select
                              value={item.unit}
                              onChange={(e) =>
                                updateRecipeIngredient(
                                  index,
                                  "unit",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                            >
                              {RECIPE_UNIT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeRecipeIngredientRow(index)}
                              className="inline-flex items-center justify-center rounded-md border border-stroke px-2 py-2 text-sm font-medium text-red hover:bg-red/10 dark:border-dark-3"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={addRecipeIngredientRow}
                          className="inline-flex items-center gap-2 rounded-md border border-stroke px-3 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M7.25 2.5a.75.75 0 011.5 0V7h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0V8.5H2.5a.75.75 0 010-1.5h4.75V2.5z" />
                          </svg>
                          Agregar ingrediente
                        </button>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={cancelRecipeEdit}
                            className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={submitStatus.kind === "loading"}
                            onClick={handleCreateRecipe}
                            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
                          >
                            {submitStatus.kind === "loading"
                              ? "Guardando..."
                              : "Guardar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-auto flex justify-center gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => openRecipeEdit(recipe)}
                      className="rounded-md border border-dark-3 border-stroke px-3 py-1.5 text-sm font-medium text-dark transition dark:border-dark-3 dark:text-white"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRecipe(recipe.id)}
                      className="rounded-md bg-red px-3 py-1.5 text-sm font-medium text-white hover:bg-red/90"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-dark-2">
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">
                  Producto
                </th>
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">
                  Unidad
                </th>
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">
                  Stock
                </th>
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">
                  Costo unit.
                </th>
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">
                  Costo total
                </th>
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-body-color px-4 py-6 text-sm dark:text-dark-6"
                  >
                    Cargando...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-body-color px-4 py-6 text-sm dark:text-dark-6"
                  >
                    No hay productos en esta sección.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <Fragment key={p.id}>
                    <tr className="border-b border-stroke dark:border-dark-3">
                      <td className="px-4 py-3 text-sm text-dark dark:text-white">
                        {p.name}
                      </td>
                      <td className="text-body-color px-4 py-3 text-sm dark:text-dark-6">
                        {formatUnitAbbr(p.unit)}
                      </td>
                      <td className="text-body-color px-4 py-3 text-sm dark:text-dark-6">
                        {formatQty(p.on_hand)}
                      </td>
                      <td className="text-body-color px-4 py-3 text-sm dark:text-dark-6">
                        {formatCop(p.average_cost)}
                      </td>
                      <td className="text-body-color px-4 py-3 text-sm dark:text-dark-6">
                        {(() => {
                          const qty = safeNumber(p.on_hand);
                          const unitCost = safeNumber(p.average_cost);
                          if (qty === null || unitCost === null) return "-";
                          return formatCop(qty * unitCost);
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="rounded-md border border-stroke px-3 py-1.5 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={deletingIds.has(p.id)}
                            onClick={() => handleDeleteProduct(p.id)}
                            className="rounded-md bg-red px-3 py-1.5 text-sm font-medium text-white hover:bg-red/90 disabled:opacity-60"
                          >
                            {deletingIds.has(p.id)
                              ? "Eliminando..."
                              : "Eliminar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {showEdit && editingId === p.id ? (
                      <tr className="border-b border-stroke dark:border-dark-3">
                        <td colSpan={6} className="px-4 pb-4 pt-2">
                          <div className="rounded-md border border-stroke bg-gray-1 p-4 dark:border-dark-3 dark:bg-dark-2">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                              <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-dark dark:text-white">
                                  Nombre
                                </label>
                                <input
                                  value={nameInput}
                                  onChange={(e) => setNameInput(e.target.value)}
                                  className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                                  placeholder={
                                    tab === "ingredient"
                                      ? "Ej: Queso mozzarella"
                                      : "Ej: Vaso desechable"
                                  }
                                />
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-dark dark:text-white">
                                  Cantidad
                                </label>
                                <input
                                  value={quantityInput}
                                  onChange={(e) =>
                                    setQuantityInput(e.target.value)
                                  }
                                  className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                                  inputMode="decimal"
                                  placeholder={
                                    tab === "ingredient" ? "Ej: 5" : "Ej: 100"
                                  }
                                />
                              </div>

                              {tab === "ingredient" ? (
                                <div className="flex flex-col gap-1">
                                  <label className="text-sm font-medium text-dark dark:text-white">
                                    Unidad
                                  </label>
                                  <select
                                    value={unitInput}
                                    onChange={(e) =>
                                      setUnitInput(e.target.value)
                                    }
                                    className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                                  >
                                    <option value="">Selecciona unidad</option>
                                    {UNIT_OPTIONS.map((option) => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div />
                              )}

                              <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-dark dark:text-white">
                                  Costo total
                                </label>
                                <input
                                  value={formatCopInput(totalCostInput)}
                                  onChange={(e) =>
                                    setTotalCostInput(
                                      normalizeMoneyInput(e.target.value),
                                    )
                                  }
                                  className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                                  inputMode="decimal"
                                  placeholder="Ej: 45000"
                                />
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm">
                                {submitStatus.kind === "error" ? (
                                  <span className="text-red">
                                    {submitStatus.message}
                                  </span>
                                ) : submitStatus.kind === "success" ? (
                                  <span className="text-green">
                                    {submitStatus.message}
                                  </span>
                                ) : null}
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowEdit(false);
                                    setEditingId(null);
                                    setSubmitStatus({ kind: "idle" });
                                  }}
                                  className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={submitStatus.kind === "loading"}
                                  onClick={handleUpdateProduct}
                                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
                                >
                                  {submitStatus.kind === "loading"
                                    ? "Guardando..."
                                    : "Guardar"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
