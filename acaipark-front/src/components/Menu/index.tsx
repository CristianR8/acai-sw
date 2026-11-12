"use client";

import { useEffect, useMemo, useState } from "react";
import { GrDocumentText } from "react-icons/gr";
import { RiDeleteBinLine, RiEdit2Line } from "react-icons/ri";
import { Tooltip } from "@/components/ui/tooltip";
import { SearchIcon } from "@/assets/icons";

type MenuItem = {
  id: number;
  name: string;
  price: string | number;
  description?: string | null;
  ingredients?: MenuIngredient[] | string[] | null;
};

type MenuIngredient = {
  name: string;
  unit: string;
  weight: string | number;
  price: string | number;
  total?: string | number;
};

type RecipeIngredientDraft = {
  name: string;
  unit: string;
  weight: string;
  price: string;
};

type InventoryProduct = {
  id: number;
  name: string;
  unit: string | null;
  source: "ingredient" | "recipe";
};

function formatCopPrice(value: string | number) {
  const raw = String(value);
  const normalized = raw.replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  const asNumber = Number.parseFloat(normalized.replace(/,/g, "."));
  if (!Number.isFinite(asNumber)) return `$${raw}`;

  const formatted = new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(asNumber);

  return `$${formatted}`;
}

function normalizeCopIntegerInput(value: string | number) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const cleaned = raw.replace(/\s/g, "").replace(/[^\d.,-]/g, "");

  const looksLikeThousandsSep = (s: string, sep: "." | ",") => {
    const parts = s.split(sep);
    if (parts.length <= 1) return false;
    if (!parts.every((p) => /^\d+$/.test(p))) return false;
    return (
      [1, 2, 3].includes(parts[0]!.length) &&
      parts.slice(1).every((p) => p.length === 3)
    );
  };

  let normalized = cleaned;
  if (cleaned.includes(".") && cleaned.includes(",")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(".")) {
    normalized = looksLikeThousandsSep(cleaned, ".")
      ? cleaned.replace(/\./g, "")
      : cleaned;
  } else if (cleaned.includes(",")) {
    normalized = looksLikeThousandsSep(cleaned, ",")
      ? cleaned.replace(/,/g, "")
      : cleaned.replace(/,/g, ".");
  }

  const asNumber = Number.parseFloat(normalized);
  if (!Number.isFinite(asNumber)) return "";
  return String(Math.trunc(asNumber));
}

function parseDecimalInput(value: string | number) {
  let raw = String(value ?? "").trim();
  if (!raw) return 0;

  raw = raw.replace(/\s/g, "");

  const looksLikeThousandsSep = (input: string, sep: "." | ",") => {
    const parts = input.split(sep);
    if (parts.length <= 1) return false;
    if (!parts.every((p) => /^\d+$/.test(p))) return false;
    return (
      [1, 2, 3].includes(parts[0]!.length) &&
      parts.slice(1).every((p) => p.length === 3)
    );
  };

  if (raw.includes(".") && raw.includes(",")) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
      raw = raw.replace(/\./g, "").replace(/,/g, ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (raw.includes(".")) {
    if (looksLikeThousandsSep(raw, ".")) raw = raw.replace(/\./g, "");
  } else if (raw.includes(",")) {
    raw = looksLikeThousandsSep(raw, ",")
      ? raw.replace(/,/g, "")
      : raw.replace(/,/g, ".");
  }

  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUnitAbbr(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower === "mililitros" || raw.toUpperCase() === "ML") return "ML";
  if (lower === "gramos" || raw.toUpperCase() === "GR") return "GR";
  if (lower === "unidades" || raw.toUpperCase() === "UND") return "Unidad";
  return raw.toUpperCase();
}

function isMenuIngredient(value: unknown): value is MenuIngredient {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "unit" in value &&
    "weight" in value &&
    "price" in value
  );
}

function getIngredientNames(ingredients: MenuItem["ingredients"]) {
  if (!Array.isArray(ingredients)) return [];
  return ingredients
    .map((item) => (isMenuIngredient(item) ? item.name : String(item ?? "")))
    .map((name) => name.trim())
    .filter(Boolean);
}

function normalizeRecipeDraft(ingredients: MenuItem["ingredients"]) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return [{ name: "", unit: "", weight: "", price: "" }];
  }
  if (ingredients.every((item) => !isMenuIngredient(item))) {
    return ingredients.map((item) => ({
      name: String(item ?? "").trim(),
      unit: "",
      weight: "",
      price: "",
    }));
  }
  return (ingredients as MenuIngredient[]).map((item) => ({
    name: item.name ?? "",
    unit: item.unit ?? "",
    weight: item.weight !== undefined ? String(item.weight) : "",
    price: item.price !== undefined ? String(item.price) : "",
  }));
}

export default function Menu({ items }: { items: MenuItem[] }) {
  const [localItems, setLocalItems] = useState<MenuItem[]>(items);

  const [showCreate, setShowCreate] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [submitStatus, setSubmitStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [deletingIds, setDeletingIds] = useState<Set<number>>(() => new Set());
  const [recipeModalItem, setRecipeModalItem] = useState<MenuItem | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<RecipeIngredientDraft[]>([]);
  const [recipeStatus, setRecipeStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [inventoryProducts, setInventoryProducts] = useState<
    InventoryProduct[]
  >([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  useEffect(() => {
    if (!showCreate) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowCreate(false);
        cancelEdit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showCreate]);

  useEffect(() => {
    if (!recipeModalItem) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeRecipeModal();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [recipeModalItem]);

  useEffect(() => {
    if (!recipeModalItem && !showCreate) return;
    setInventoryLoading(true);
    setInventoryError(null);
    Promise.all([
      fetch("/api/inventory/products?kind=ingredient", {
        cache: "no-store",
      }).then((res) => res.json().catch(() => null)),
      fetch("/api/inventory/recipes", { cache: "no-store" }).then((res) =>
        res.json().catch(() => null),
      ),
    ])
      .then(([productsPayload, recipesPayload]) => {
        if (!Array.isArray(productsPayload) || !Array.isArray(recipesPayload)) {
          throw new Error("No se pudo cargar inventario.");
        }

        const ingredients = productsPayload
          .map((item: any) => ({
            id: Number(item?.id),
            name: String(item?.name ?? ""),
            unit: item?.unit ? String(item.unit) : null,
            source: "ingredient" as const,
          }))
          .filter((item) => Number.isFinite(item.id) && item.name);

        const recipes = recipesPayload
          .map((item: any) => ({
            id: Number(item?.id),
            name: String(item?.name ?? ""),
            unit: item?.unit ? String(item.unit) : null,
            source: "recipe" as const,
          }))
          .filter((item) => Number.isFinite(item.id) && item.name);

        const merged = new Map<string, InventoryProduct>();
        for (const item of [...ingredients, ...recipes]) {
          const key = item.name.toLowerCase();
          if (!merged.has(key)) merged.set(key, item);
        }

        setInventoryProducts(
          [...merged.values()].sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo cargar inventario.";
        setInventoryError(message);
        setInventoryProducts([]);
      })
      .finally(() => setInventoryLoading(false));
  }, [recipeModalItem, showCreate]);

  useEffect(() => {
    if (!inventoryProducts.length) return;
    setRecipeDraft((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (row.unit) return row;
        if (!row.name) return row;
        const match = inventoryProducts.find(
          (item) => item.name.toLowerCase() === row.name.toLowerCase(),
        );
        if (match?.unit) {
          changed = true;
          return { ...row, unit: match.unit };
        }
        return row;
      });
      return changed ? next : prev;
    });
  }, [inventoryProducts]);

  const recipeTotals = useMemo(() => {
    return recipeDraft.reduce(
      (acc, row) => {
        const weight = parseDecimalInput(row.weight);
        const price = parseDecimalInput(row.price);
        acc.gramaje += weight;
        acc.costo += weight * price;
        return acc;
      },
      { gramaje: 0, costo: 0 },
    );
  }, [recipeDraft]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("es");
    return query
      ? localItems.filter((item) =>
          item.name.toLocaleLowerCase("es").includes(query),
        )
      : localItems;
  }, [localItems, searchQuery]);

  function startCreate() {
    setShowCreate(true);
    setFormMode("create");
    setEditingId(null);
    setEditingItem(null);
    setRecipeDraft([{ name: "", unit: "", weight: "", price: "" }]);
    setSubmitStatus({ kind: "idle" });
    setNameInput("");
    setPriceInput("");
    setDescriptionInput("");
  }

  function startEdit(item: MenuItem) {
    setShowCreate(true);
    setFormMode("edit");
    setEditingId(item.id);
    setEditingItem(item);
    setRecipeDraft(normalizeRecipeDraft(item.ingredients));
    setSubmitStatus({ kind: "idle" });
    setNameInput(item.name ?? "");
    setPriceInput(normalizeCopIntegerInput(item.price ?? ""));
    setDescriptionInput(item.description ?? "");
  }

  function cancelEdit() {
    setFormMode("create");
    setEditingId(null);
    setEditingItem(null);
    setSubmitStatus({ kind: "idle" });
    setNameInput("");
    setPriceInput("");
    setDescriptionInput("");
    setRecipeDraft([]);
  }

  function openRecipeModal(item: MenuItem) {
    setRecipeModalItem(item);
    setRecipeDraft(normalizeRecipeDraft(item.ingredients));
    setRecipeStatus({ kind: "idle" });
  }

  function closeRecipeModal() {
    setRecipeModalItem(null);
    setRecipeDraft([]);
    setRecipeStatus({ kind: "idle" });
  }

  function updateRecipeRow(
    index: number,
    field: keyof RecipeIngredientDraft,
    value: string,
  ) {
    setRecipeDraft((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function selectInventoryItem(index: number, name: string) {
    const selected = inventoryProducts.find((item) => item.name === name);
    setRecipeDraft((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              name,
              unit: selected?.unit ?? row.unit ?? "",
            }
          : row,
      ),
    );
  }

  function addRecipeRow() {
    setRecipeDraft((prev) => [
      ...prev,
      { name: "", unit: "", weight: "", price: "" },
    ]);
  }

  function removeRecipeRow(index: number) {
    setRecipeDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function buildRecipeIngredients(draft: RecipeIngredientDraft[]) {
    const cleaned = draft
      .map((row) => ({
        name: row.name.trim(),
        unit: row.unit ? row.unit.trim().toUpperCase() : "",
        weight: parseDecimalInput(row.weight),
        price: parseDecimalInput(row.price),
      }))
      .filter((row) => row.name || row.weight || row.price);

    if (cleaned.length === 0) {
      return { ok: true as const, ingredients: null };
    }

    const invalidRow = cleaned.find(
      (row) => !row.name || row.weight <= 0 || row.price < 0,
    );
    if (invalidRow) {
      return {
        ok: false as const,
        error: "Completa ingrediente, peso y precio para cada fila.",
      };
    }

    return {
      ok: true as const,
      ingredients: cleaned.map((row) => ({
        name: row.name,
        unit: row.unit || undefined,
        weight: row.weight,
        price: row.price,
        total: Number((row.weight * row.price).toFixed(2)),
      })),
    };
  }

  async function handleSaveRecipe() {
    if (!recipeModalItem) return;

    const cleaned = recipeDraft
      .map((row) => ({
        name: row.name.trim(),
        unit: row.unit.trim().toUpperCase(),
        weight: parseDecimalInput(row.weight),
        price: parseDecimalInput(row.price),
      }))
      .filter((row) => row.name || row.weight || row.price);

    if (cleaned.length === 0) {
      setRecipeStatus({
        kind: "error",
        message: "Agrega al menos un ingrediente.",
      });
      return;
    }

    const invalidRow = cleaned.find(
      (row) => !row.name || !row.unit || row.weight <= 0 || row.price < 0,
    );
    if (invalidRow) {
      setRecipeStatus({
        kind: "error",
        message: "Completa ingrediente, peso y precio para cada fila.",
      });
      return;
    }

    const ingredients = cleaned.map((row) => ({
      name: row.name,
      unit: row.unit,
      weight: row.weight,
      price: row.price,
      total: Number((row.weight * row.price).toFixed(2)),
    }));

    setRecipeStatus({ kind: "loading" });

    const price = normalizeCopIntegerInput(recipeModalItem.price ?? "");
    try {
      const response = await fetch(`/api/menu/items/${recipeModalItem.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: recipeModalItem.name,
          price: Number(price),
          description: recipeModalItem.description ?? null,
          ingredients,
        }),
      });

      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        setRecipeStatus({
          kind: "error",
          message:
            (typeof payload?.message === "string" && payload.message) ||
            "No se pudo guardar la receta.",
        });
        return;
      }

      const updated = payload as MenuItem;
      setLocalItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      setRecipeStatus({ kind: "success", message: "Receta guardada." });
      setRecipeModalItem(updated);
      closeRecipeModal();
    } catch {
      setRecipeStatus({
        kind: "error",
        message: "Error guardando la receta (revisa conexión al backend).",
      });
    }
  }

  async function handleCreateItem() {
    setSubmitStatus({ kind: "loading" });

    const name = nameInput.trim();
    const price = normalizeCopIntegerInput(priceInput);
    const description = descriptionInput.trim();

    const recipeResult = buildRecipeIngredients(recipeDraft);
    if (!recipeResult.ok) {
      setSubmitStatus({ kind: "error", message: recipeResult.error });
      return;
    }

    if (!name || !price) {
      setSubmitStatus({
        kind: "error",
        message: "Nombre y precio son requeridos.",
      });
      return;
    }

    try {
      const response = await fetch("/api/menu/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          price: Number(price),
          description: description ? description : null,
          ingredients: recipeResult.ingredients,
        }),
      });

      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        setSubmitStatus({
          kind: "error",
          message:
            (typeof payload?.message === "string" && payload.message) ||
            "No se pudo crear el item.",
        });
        return;
      }

      const created = payload as MenuItem;
      setLocalItems((prev) => [created, ...prev]);

      setSubmitStatus({ kind: "success", message: "Item creado." });
      setNameInput("");
      setPriceInput("");
      setDescriptionInput("");
      setShowCreate(false);
      cancelEdit();
    } catch {
      setSubmitStatus({
        kind: "error",
        message: "Error creando el item (revisa conexión al backend).",
      });
    }
  }

  async function handleUpdateItem() {
    if (!editingId) return;
    setSubmitStatus({ kind: "loading" });

    const name = nameInput.trim();
    const price = normalizeCopIntegerInput(priceInput);
    const description = descriptionInput.trim();
    const recipeResult = buildRecipeIngredients(recipeDraft);
    if (!recipeResult.ok) {
      setSubmitStatus({ kind: "error", message: recipeResult.error });
      return;
    }

    if (!name || !price) {
      setSubmitStatus({
        kind: "error",
        message: "Nombre y precio son requeridos.",
      });
      return;
    }

    try {
      const response = await fetch(`/api/menu/items/${editingId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          price: Number(price),
          description: description ? description : null,
          ingredients: recipeResult.ingredients,
        }),
      });

      const payload = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        setSubmitStatus({
          kind: "error",
          message:
            (typeof payload?.message === "string" && payload.message) ||
            "No se pudo editar el item.",
        });
        return;
      }

      const updated = payload as MenuItem;

      setLocalItems((prev) =>
        prev.map((i) => (i.id === editingId ? updated : i)),
      );

      setSubmitStatus({ kind: "success", message: "Item actualizado." });
      setShowCreate(false);
      cancelEdit();
    } catch {
      setSubmitStatus({
        kind: "error",
        message: "Error editando el item (revisa conexión al backend).",
      });
    }
  }

  async function handleDeleteItem(itemId: number) {
    const item = localItems.find((i) => i.id === itemId);
    if (!item) return;

    const ok = window.confirm(`Eliminar "${item.name}"?`);
    if (!ok) return;

    setDeletingIds((prev) => new Set(prev).add(itemId));
    try {
      const response = await fetch(`/api/menu/items/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as any;
        const message =
          (typeof payload?.message === "string" && payload.message) ||
          "No se pudo eliminar el item.";
        window.alert(message);
        return;
      }

      setLocalItems((prev) => prev.filter((item) => item.id !== itemId));
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  return (
    <div className="rounded-2xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (showCreate) {
              setShowCreate(false);
              cancelEdit();
            } else {
              startCreate();
            }
          }}
          className="flex items-center rounded-xl bg-tertiary px-4 py-2 text-sm font-semibold text-dark transition hover:bg-tertiary/60"
        >
          {showCreate ? "Cerrar" : "Agregar producto"}
        </button>
        <div className="relative ml-auto w-full max-w-xs">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar productos por nombre..."
            className="w-full rounded-md border-2 border-primary/40 bg-white py-2 pl-11 pr-3 text-sm text-dark shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-dark-3 dark:bg-gray-dark dark:text-white"
          />
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
        </div>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 opacity-0 animate-[fadeIn_160ms_ease-out_forwards]"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setShowCreate(false);
            cancelEdit();
          }}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl border border-stroke bg-white p-5 shadow-2xl opacity-0 animate-[fadeIn_200ms_ease-out_60ms_forwards] dark:border-dark-3 dark:bg-gray-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-base font-semibold text-dark dark:text-white">
                {formMode === "edit" ? "Editar item" : "Crear producto"}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    cancelEdit();
                  }}
                  className="rounded-xl border border-stroke bg-gray-1 px-3 py-2 text-sm font-semibold text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:bg-white/5 dark:text-white"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                  Nombre
                </label>
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Nombre del item"
                  className="w-full rounded-xl border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                  Precio
                </label>
                <input
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="Ej: 18000"
                  inputMode="decimal"
                  className="w-full rounded-xl border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                Descripción (opcional)
              </label>
              <textarea
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white"
              />
            </div>

            <div className="mt-4">
              <div className="mb-2 text-sm font-semibold text-dark dark:text-white">
                Receta (opcional)
              </div>
              <div className="overflow-auto rounded-xl border border-stroke dark:border-dark-3">
                <table className="w-full text-sm">
                  <thead className="bg-gray-1 text-left text-xs font-semibold uppercase tracking-wide text-dark dark:bg-white/5 dark:text-white">
                    <tr>
                      <th className="px-3 py-2">Ingrediente</th>
                      <th className="px-3 py-2">Peso</th>
                      <th className="px-3 py-2">Precio</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipeDraft.map((row, index) => {
                      const weight = parseDecimalInput(row.weight);
                      const price = parseDecimalInput(row.price);
                      const total = weight * price;
                      return (
                        <tr
                          key={`${row.name}-${index}`}
                          className="border-t border-stroke dark:border-dark-3"
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <select
                                value={row.name}
                                onChange={(e) =>
                                  selectInventoryItem(index, e.target.value)
                                }
                                className="w-full rounded-lg border border-stroke bg-transparent px-2 py-1 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white"
                              >
                                <option value="">Selecciona ingrediente</option>
                                {inventoryProducts.map((item) => (
                                  <option
                                    key={`${item.source}-${item.id}`}
                                    value={item.name}
                                  >
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                              <span className="shrink-0 text-xs font-medium text-dark-6 dark:text-dark-6">
                                {row.unit
                                  ? row.unit
                                      .replace(/mililitros/i, "ML")
                                      .replace(/gramos/i, "GR")
                                      .replace(/unidades/i, "Unidad")
                                  : "-"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.weight}
                              onChange={(e) =>
                                updateRecipeRow(index, "weight", e.target.value)
                              }
                              placeholder="0"
                              inputMode="decimal"
                              className="w-full rounded-lg border border-stroke bg-transparent px-2 py-1 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.price}
                              onChange={(e) =>
                                updateRecipeRow(index, "price", e.target.value)
                              }
                              placeholder="0"
                              inputMode="decimal"
                              className="w-full rounded-lg border border-stroke bg-transparent px-2 py-1 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white"
                            />
                          </td>
                          <td className="px-3 py-2 font-semibold text-dark dark:text-white">
                            {formatCopPrice(total)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeRecipeRow(index)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stroke bg-white text-red transition hover:bg-red hover:text-white dark:border-dark-3 dark:bg-dark-2"
                              aria-label={`Eliminar ingrediente ${row.name || index + 1}`}
                            >
                              <RiDeleteBinLine
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {inventoryLoading ? (
                <p className="mt-2 text-sm text-dark-6 dark:text-dark-6">
                  Cargando inventario...
                </p>
              ) : inventoryError ? (
                <p className="mt-2 text-sm text-red">{inventoryError}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-dark dark:text-white">
                <button
                  type="button"
                  onClick={addRecipeRow}
                  className="rounded-xl border border-stroke bg-white px-3 py-2 text-sm font-semibold text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                >
                  Agregar ingrediente
                </button>
                <div className="flex flex-wrap gap-4">
                  <span>
                    Gramaje total:{" "}
                    {new Intl.NumberFormat("es-CO", {
                      maximumFractionDigits: 2,
                    }).format(recipeTotals.gramaje)}
                  </span>
                  <span>
                    Total receta: {formatCopPrice(recipeTotals.costo)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={
                  formMode === "edit" ? handleUpdateItem : handleCreateItem
                }
                disabled={submitStatus.kind === "loading"}
                className={
                  "rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition " +
                  (submitStatus.kind === "loading"
                    ? "cursor-not-allowed opacity-60"
                    : "hover:bg-primary/90")
                }
              >
                {submitStatus.kind === "loading"
                  ? formMode === "edit"
                    ? "Guardando..."
                    : "Creando..."
                  : formMode === "edit"
                    ? "Guardar cambios"
                    : "Crear item"}
              </button>

              {submitStatus.kind === "error" && (
                <p className="text-sm font-medium text-red">
                  {submitStatus.message}
                </p>
              )}
              {submitStatus.kind === "success" && (
                <p className="text-sm font-medium text-green">
                  {submitStatus.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {recipeModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 opacity-0 animate-[fadeIn_160ms_ease-out_forwards]"
          role="dialog"
          aria-modal="true"
          onClick={closeRecipeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl border border-stroke bg-white p-5 shadow-2xl opacity-0 animate-[fadeIn_200ms_ease-out_60ms_forwards] dark:border-dark-3 dark:bg-gray-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-base font-semibold text-dark dark:text-white">
                Receta - {recipeModalItem.name}
              </div>
              <button
                type="button"
                onClick={closeRecipeModal}
                className="rounded-xl border border-stroke bg-gray-1 px-3 py-2 text-sm font-semibold text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:bg-white/5 dark:text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="overflow-auto rounded-xl border border-stroke dark:border-dark-3">
              <table className="w-full text-sm">
                <thead className="bg-gray-1 text-left text-xs font-semibold uppercase tracking-wide text-dark dark:bg-white/5 dark:text-white">
                  <tr>
                    <th className="px-3 py-2">Ingrediente</th>
                    <th className="px-3 py-2">Peso</th>
                    <th className="px-3 py-2">Precio</th>
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recipeDraft.map((row, index) => {
                    const weight = parseDecimalInput(row.weight);
                    const price = parseDecimalInput(row.price);
                    const total = weight * price;
                    return (
                      <tr
                        key={`${row.name}-${index}`}
                        className="border-t border-stroke dark:border-dark-3"
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-dark dark:text-white">
                              {row.name || "-"}
                            </span>
                            <span className="shrink-0 text-xs font-medium text-dark-6 dark:text-dark-6">
                              {formatUnitAbbr(row.unit) || "-"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-sm text-dark dark:text-white">
                            {row.weight || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-sm text-dark dark:text-white">
                            {row.price || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-dark dark:text-white">
                          {formatCopPrice(total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {inventoryLoading ? (
              <p className="mt-3 text-sm text-dark-6 dark:text-dark-6">
                Cargando inventario...
              </p>
            ) : inventoryError ? (
              <p className="mt-3 text-sm text-red">{inventoryError}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-dark dark:text-white">
              <div className="flex flex-wrap gap-4">
                <span>
                  Gramaje total:{" "}
                  {new Intl.NumberFormat("es-CO", {
                    maximumFractionDigits: 2,
                  }).format(recipeTotals.gramaje)}
                </span>
                <span>Total receta: {formatCopPrice(recipeTotals.costo)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <p className="text-body text-dark-6 dark:text-dark-6">
          {searchQuery.trim()
            ? "No hay resultados para esta búsqueda."
            : "Aún no hay items en esta sección."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-stroke bg-white p-4 dark:border-dark-3 dark:bg-dark-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-lg font-semibold text-dark dark:text-white">
                    {item.name}
                  </h4>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="rounded-lg bg-tertiary/20 px-3 py-1 text-sm font-semibold text-dark dark:bg-white/10 dark:text-white">
                    {formatCopPrice(item.price)}
                  </div>
                  <Tooltip label={`Receta ${item.name}`}>
                    <button
                      type="button"
                      onClick={() => openRecipeModal(item)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stroke bg-white text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:hover:bg-white/10"
                      aria-label={`Receta ${item.name}`}
                    >
                      <span className="sr-only">{`Receta ${item.name}`}</span>
                      <GrDocumentText className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </Tooltip>
                  <Tooltip label={`Editar ${item.name}`}>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stroke bg-white text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:hover:bg-white/10"
                      aria-label={`Editar ${item.name}`}
                    >
                      <span className="sr-only">{`Editar ${item.name}`}</span>
                      <RiEdit2Line className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </Tooltip>
                  <Tooltip label={`Eliminar ${item.name}`}>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={deletingIds.has(item.id)}
                      className={
                        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stroke bg-white text-red transition hover:bg-red hover:text-white dark:border-dark-3 dark:bg-dark-2 " +
                        (deletingIds.has(item.id)
                          ? "cursor-not-allowed opacity-60"
                          : "")
                      }
                      aria-label={`Eliminar ${item.name}`}
                    >
                      <span className="sr-only">{`Eliminar ${item.name}`}</span>
                      <RiDeleteBinLine className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
              </div>

              {(item.description ||
                (item.ingredients && item.ingredients.length > 0)) && (
                <div className="mt-3 space-y-2">
                  {item.description && (
                    <p className="text-body text-dark-6 dark:text-dark-6">
                      {item.description}
                    </p>
                  )}
                  {item.ingredients && item.ingredients.length > 0 && (
                    <p className="text-body-sm text-dark-6 dark:text-dark-6">
                      <span className="font-medium text-dark dark:text-white">
                        Ingredientes:
                      </span>{" "}
                      {getIngredientNames(item.ingredients).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
