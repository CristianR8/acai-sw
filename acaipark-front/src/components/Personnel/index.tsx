"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchIcon } from "@/assets/icons";
import { standardFormat } from "@/lib/format-number";

type TabKey = "customers" | "suppliers" | "waiters";

type Supplier = {
  id: number;
  name: string;
  phone?: string | null;
  gender?: string | null;
  is_active: boolean;
  created_at: string;
};

type Customer = {
  id: number;
  name: string;
  identity_document: string;
  phone?: string | null;
  gender?: string | null;
  is_active: boolean;
  created_at: string;
};

type Waiter = {
  id: number;
  name: string;
  gender?: string | null;
  is_active: boolean;
  created_at: string;
};

type Sale = {
  id: number;
  customer_id: number | null;
  waiter_id: number | null;
  total: number | string;
  created_at: string;
};

type Purchase = {
  id: number;
  supplier_id: number | null;
  purchased_at?: string | null;
  created_at: string;
  total_cost: number | string;
};

type DetailsEntry = {
  id: number;
  date: string;
  total: number;
};

type SubmitStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getCardBackground(
  tab: TabKey,
  gender: string | null | undefined,
) {
  const normalized = (gender ?? "male").toLowerCase();
  if (tab === "customers") {
    return normalized === "female" ? "/backgrounds/cliente.png" : "/backgrounds/cliente_2.png";
  }
  if (tab === "waiters") {
    return normalized === "female" ? "/backgrounds/waiter_2.png" : "/backgrounds/mesero.png";
  }
  return "/backgrounds/proveedor.png";
}

export default function Personnel() {
  const [tab, setTab] = useState<TabKey>("customers");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ kind: "idle" });

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsName, setDetailsName] = useState("");
  const [detailsEntries, setDetailsEntries] = useState<DetailsEntry[]>([]);
  const [detailsEmptyMessage, setDetailsEmptyMessage] = useState("");
  const [detailsTitle, setDetailsTitle] = useState("");

  const [nameInput, setNameInput] = useState("");
  const [documentInput, setDocumentInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [genderInput, setGenderInput] = useState("male");

  const [togglingIds, setTogglingIds] = useState<Set<number>>(() => new Set());

  const filteredSuppliers = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    if (!term) return suppliers;
    return suppliers.filter((supplier) =>
      normalizeSearchText(supplier.name ?? "").includes(term),
    );
  }, [suppliers, searchTerm]);

  const filteredCustomers = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    if (!term) return customers;
    return customers.filter((customer) =>
      normalizeSearchText(`${customer.name} ${customer.identity_document}`).includes(term),
    );
  }, [customers, searchTerm]);

  const filteredWaiters = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    if (!term) return waiters;
    return waiters.filter((waiter) =>
      normalizeSearchText(waiter.name ?? "").includes(term),
    );
  }, [waiters, searchTerm]);

  useEffect(() => {
    loadCurrentTab();
  }, [tab]);

  useEffect(() => {
    setShowForm(false);
    setFormMode("create");
    setEditingId(null);
    resetForm();
    setSubmitStatus({ kind: "idle" });
    closeDetails();
  }, [tab]);

  async function loadCurrentTab() {
    setLoading(true);
    const query = "?active=true";
    try {
      if (tab === "customers") {
        const response = await fetch(`/api/personnel/customers${query}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as any;
        if (!response.ok) {
          throw new Error(
            (typeof payload?.message === "string" && payload.message) ||
              "No se pudo cargar clientes",
          );
        }
        setCustomers(Array.isArray(payload) ? (payload as Customer[]) : []);
      } else if (tab === "suppliers") {
        const response = await fetch(`/api/personnel/suppliers${query}`, {
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
      } else {
        const response = await fetch(`/api/personnel/waiters${query}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as any;
        if (!response.ok) {
          throw new Error(
            (typeof payload?.message === "string" && payload.message) ||
              "No se pudo cargar meseros",
          );
        }
        setWaiters(Array.isArray(payload) ? (payload as Waiter[]) : []);
      }
    } catch {
      if (tab === "customers") setCustomers([]);
      if (tab === "suppliers") setSuppliers([]);
      if (tab === "waiters") setWaiters([]);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setNameInput("");
    setDocumentInput("");
    setPhoneInput("");
    setGenderInput("male");
  }

  function closeDetails() {
    setDetailsOpen(false);
    setDetailsLoading(false);
    setDetailsError(null);
    setDetailsName("");
    setDetailsEntries([]);
    setDetailsEmptyMessage("");
    setDetailsTitle("");
  }

  function openCreate() {
    resetForm();
    setFormMode("create");
    setEditingId(null);
    setSubmitStatus({ kind: "idle" });
    setShowForm(true);
  }

  function openEdit(target: Supplier | Customer | Waiter) {
    setFormMode("edit");
    setEditingId(target.id);
    setSubmitStatus({ kind: "idle" });
    setShowForm(true);
    setNameInput(target.name ?? "");

    if ("identity_document" in target) {
      setDocumentInput(target.identity_document ?? "");
    } else {
      setDocumentInput("");
    }

    if ("phone" in target) {
      setPhoneInput(target.phone ?? "");
    } else {
      setPhoneInput("");
    }
    setGenderInput(target.gender ?? "male");
  }

  function cancelForm() {
    setShowForm(false);
    setFormMode("create");
    setEditingId(null);
    resetForm();
    setSubmitStatus({ kind: "idle" });
  }

  function parseAmount(value: number | string | null | undefined) {
    const parsed = typeof value === "string" ? Number(value) : value ?? 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatAmount(value: number) {
    return standardFormat(value);
  }

  function formatDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }

  async function openDetails(target: Supplier | Customer | Waiter) {
    const isSupplier = tab === "suppliers";
    const title = isSupplier ? "Compras asociadas" : "Ventas asociadas";
    const emptyMessage =
      tab === "customers"
        ? "No hay ventas asociadas para este cliente."
        : tab === "waiters"
          ? "No hay ventas asociadas para este mesero."
          : "No hay compras asociadas para este proveedor.";

    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError(null);
    setDetailsEntries([]);
    setDetailsName(target.name ?? "");
    setDetailsEmptyMessage(emptyMessage);
    setDetailsTitle(title);

    try {
      if (isSupplier) {
        const response = await fetch("/api/inventory/purchases", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as Purchase[] | null;
        if (!response.ok) {
          throw new Error("No se pudieron cargar compras.");
        }
        const entries =
          Array.isArray(payload) && payload.length > 0
            ? payload
                .filter((purchase) => purchase.supplier_id === target.id)
                .map((purchase) => ({
                  id: purchase.id,
                  date: formatDate(purchase.purchased_at ?? purchase.created_at),
                  total: parseAmount(purchase.total_cost),
                }))
            : [];
        setDetailsEntries(entries);
      } else {
        const response = await fetch("/api/sales", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as Sale[] | null;
        if (!response.ok) {
          throw new Error("No se pudieron cargar ventas.");
        }
        const entries =
          Array.isArray(payload) && payload.length > 0
            ? payload
                .filter((sale) =>
                  tab === "customers"
                    ? sale.customer_id === target.id
                    : sale.waiter_id === target.id,
                )
                .map((sale) => ({
                  id: sale.id,
                  date: formatDate(sale.created_at),
                  total: parseAmount(sale.total),
                }))
            : [];
        setDetailsEntries(entries);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo cargar la informacion.";
      setDetailsError(message);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleSave() {
    setSubmitStatus({ kind: "loading" });

    const name = nameInput.trim();
    if (!name) {
      setSubmitStatus({ kind: "error", message: "Nombre es requerido." });
      return;
    }

    if (tab === "customers") {
      const identityDocument = documentInput.trim();
      if (!identityDocument) {
        setSubmitStatus({ kind: "error", message: "Documento es requerido." });
        return;
      }
    }

    const phone = phoneInput.trim();

    const endpoint =
      tab === "customers"
        ? "customers"
        : tab === "suppliers"
          ? "suppliers"
          : "waiters";

    const url =
      formMode === "create"
        ? `/api/personnel/${endpoint}`
        : `/api/personnel/${endpoint}/${editingId}`;

    const payload: Record<string, unknown> = { name };
    payload.gender = genderInput;

    if (tab === "customers") {
      payload.identity_document = documentInput.trim();
      payload.phone = phone ? phone : null;
    }

    if (tab === "suppliers") {
      payload.phone = phone ? phone : null;
    }

    if (formMode === "create") {
      payload.is_active = true;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: formMode === "create" ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setSubmitStatus({
        kind: "error",
        message: "No se pudo conectar con el backend. Verifica el servidor.",
      });
      return;
    }

    const responsePayload = (await response.json().catch(() => null)) as any;
    if (!response.ok) {
      setSubmitStatus({
        kind: "error",
        message:
          (typeof responsePayload?.message === "string" && responsePayload.message) ||
          "No se pudo guardar el registro.",
      });
      return;
    }

    setSubmitStatus({
      kind: "success",
      message:
        formMode === "create"
          ? "Registro creado correctamente."
          : "Cambios guardados correctamente.",
    });
    setShowForm(false);
    setFormMode("create");
    setEditingId(null);
    resetForm();
    await loadCurrentTab();
  }

  async function toggleActive(nextActive: boolean, targetId: number) {
    setTogglingIds((prev) => new Set(prev).add(targetId));

    const endpoint =
      tab === "customers"
        ? "customers"
        : tab === "suppliers"
          ? "suppliers"
          : "waiters";

    try {
      const response = await fetch(`/api/personnel/${endpoint}/${targetId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as any;
        throw new Error(
          (typeof payload?.message === "string" && payload.message) ||
            "No se pudo actualizar el estado",
        );
      }
      await loadCurrentTab();
    } catch {
      setSubmitStatus({
        kind: "error",
        message: "No se pudo actualizar el estado. Intenta nuevamente.",
      });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  }

  const currentSingular =
    tab === "customers" ? "Cliente" : tab === "suppliers" ? "Proveedor" : "Mesero";
  const detailsTotal = detailsEntries.reduce((sum, entry) => sum + entry.total, 0);

  return (
    <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-dark">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-dark dark:text-white">Modulo de personal</h2>
          <p className="text-sm text-body-color dark:text-dark-6">
            Gestiona clientes, proveedores y meseros desde un solo lugar.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-dark px-4 py-2 text-sm font-medium text-white hover:bg-dark/90 dark:bg-white dark:text-dark dark:hover:bg-white/90"
        >
          Agregar {currentSingular}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("customers")}
          className={
            tab === "customers"
              ? "rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-white"
              : "rounded-md border border-stroke px-2.5 py-1.5 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          }
        >
          Clientes
        </button>
        <button
          type="button"
          onClick={() => setTab("suppliers")}
          className={
            tab === "suppliers"
              ? "rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-white"
              : "rounded-md border border-stroke px-2.5 py-1.5 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          }
        >
          Proveedores
        </button>
        <button
          type="button"
          onClick={() => setTab("waiters")}
          className={
            tab === "waiters"
              ? "rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-white"
              : "rounded-md border border-stroke px-2.5 py-1.5 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          }
        >
          Meseros
        </button>

        <div className="ml-auto flex flex-wrap gap-2">
          <div className="relative w-full max-w-xs">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-md border-2 border-primary/40 bg-white py-2 pl-11 pr-3 text-sm text-dark shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
          </div>
        </div>
      </div>

      {showForm ? (
        <div className="mt-5 rounded-md border border-stroke bg-gray-1 p-4 dark:border-dark-3 dark:bg-dark-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-dark dark:text-white">
                {formMode === "create" ? "Nuevo" : "Editar"} {currentSingular}
              </h3>
              <p className="text-sm text-body-color dark:text-dark-6">
                Completa la informacion basica para este registro.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelForm}
                className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitStatus.kind === "loading"}
                onClick={handleSave}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {submitStatus.kind === "loading" ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>

          <div
            className={
              "mt-4 grid gap-3 " +
              (tab === "customers" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3")
            }
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-body-color dark:text-dark-6">
                Nombre
              </label>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={tab === "customers" ? "Nombre del cliente" : "Nombre"}
                className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              />
            </div>

            {tab === "customers" ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-body-color dark:text-dark-6">
                  Documento
                </label>
                <input
                  value={documentInput}
                  onChange={(e) => setDocumentInput(e.target.value)}
                  placeholder="Documento de identidad"
                  className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                />
              </div>
            ) : null}

            {tab !== "waiters" ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-body-color dark:text-dark-6">
                  Telefono
                </label>
                <input
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="Telefono"
                  className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                />
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-xs font-medium text-body-color dark:text-dark-6">
                Genero
              </label>
              <select
                value={genderInput}
                onChange={(e) => setGenderInput(e.target.value)}
                className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              >
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </select>
            </div>

          </div>

          {submitStatus.kind === "error" ? (
            <div className="mt-3 rounded-md border border-red-light bg-red-light-5 px-3 py-2 text-sm text-red dark:border-red-light/40 dark:bg-red-light-5/10 dark:text-red-light">
              {submitStatus.message}
            </div>
          ) : null}
          {submitStatus.kind === "success" ? (
            <div className="mt-3 rounded-md border border-green-light bg-green-light-7 px-3 py-2 text-sm text-green dark:border-green-light/40 dark:bg-green-light-7/10 dark:text-green-light">
              {submitStatus.message}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <div className="rounded-md border border-dashed border-stroke bg-gray-1 px-4 py-6 text-sm text-body-color dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6">
            Cargando...
          </div>
        ) : tab === "customers" ? (
          filteredCustomers.length === 0 ? (
            <div className="rounded-md border border-dashed border-stroke bg-gray-1 px-4 py-6 text-sm text-body-color dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6">
              No hay clientes registrados.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredCustomers.map((customer) => (
                <div
                  key={`customer-${customer.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetails(customer)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDetails(customer);
                    }
                  }}
                  className="group relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-2xl border border-stroke bg-gray-2 p-5 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-dark-3"
                  style={{
                    backgroundImage: `url('${getCardBackground("customers", customer.gender)}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-0 bg-black/60" />
                  <div className="relative z-10 space-y-2">
                    <h3 className="text-lg font-extrabold">{customer.name}</h3>
                    <p className="text-md text-white/85 font-semibold">
                      Documento: {customer.identity_document}
                    </p>
                    <p className="text-md text-white/85 font-semibold">Telefono: {customer.phone || "-"}</p>
                    <p
                      className={`text-sm font-semibold ${
                        customer.is_active ? "text-green-200" : "text-red-200"
                      }`}
                    >
                      {customer.is_active ? "Activo" : "Inactivo"}
                    </p>
                  </div>
                  <div className="relative z-10 mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(customer);
                      }}
                      className="rounded-md bg-white/90 px-3 py-2 text-sm font-semibold text-dark transition hover:bg-white"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={togglingIds.has(customer.id)}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleActive(!customer.is_active, customer.id);
                      }}
                      className={
                        customer.is_active
                          ? "rounded-md bg-red/90 px-3 py-2 text-sm font-semibold text-white hover:bg-red"
                          : "rounded-md bg-green/90 px-3 py-2 text-sm font-semibold text-white hover:bg-green"
                      }
                    >
                      {customer.is_active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === "suppliers" ? (
          filteredSuppliers.length === 0 ? (
            <div className="rounded-md border border-dashed border-stroke bg-gray-1 px-4 py-6 text-sm text-body-color dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6">
              No hay proveedores registrados.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={`supplier-${supplier.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetails(supplier)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDetails(supplier);
                    }
                  }}
                  className="group relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-2xl border border-stroke bg-gray-2 p-5 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-dark-3"
                  style={{
                    backgroundImage: `url('${getCardBackground("suppliers", supplier.gender)}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-0 bg-black/60" />
                  <div className="relative z-10 space-y-2">
                    <h3 className="text-lg font-extrabold">{supplier.name}</h3>
                    <p className="text-md font-semibold text-white/85">Telefono: {supplier.phone || "-"}</p>
                    <p
                      className={`text-sm font-semibold ${
                        supplier.is_active ? "text-green-200" : "text-red-200"
                      }`}
                    >
                      {supplier.is_active ? "Activo" : "Inactivo"}
                    </p>
                  </div>
                  <div className="relative z-10 mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(supplier);
                      }}
                      className="rounded-md bg-white/90 px-3 py-2 text-sm font-semibold text-dark transition hover:bg-white"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={togglingIds.has(supplier.id)}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleActive(!supplier.is_active, supplier.id);
                      }}
                      className={
                        supplier.is_active
                          ? "rounded-md bg-red/90 px-3 py-2 text-sm font-semibold text-white hover:bg-red"
                          : "rounded-md bg-green/90 px-3 py-2 text-sm font-semibold text-white hover:bg-green"
                      }
                    >
                      {supplier.is_active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredWaiters.length === 0 ? (
          <div className="rounded-md border border-dashed border-stroke bg-gray-1 px-4 py-6 text-sm text-body-color dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6">
            No hay meseros registrados.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredWaiters.map((waiter) => (
              <div
                key={`waiter-${waiter.id}`}
                role="button"
                tabIndex={0}
                onClick={() => openDetails(waiter)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openDetails(waiter);
                  }
                }}
                className="group relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-2xl border border-stroke bg-gray-2 p-5 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-dark-3"
                style={{
                  backgroundImage: `url('${getCardBackground("waiters", waiter.gender)}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute inset-0 bg-black/60" />
                <div className="relative z-10 space-y-2">
                  <h3 className="text-lg font-extrabold">{waiter.name}</h3>
                  <p
                    className={`text-sm font-semibold ${
                      waiter.is_active ? "text-green-200" : "text-red-200"
                    }`}
                  >
                    {waiter.is_active ? "Activo" : "Inactivo"}
                  </p>
                </div>
                <div className="relative z-10 mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEdit(waiter);
                    }}
                    className="rounded-md bg-white/90 px-3 py-2 text-sm font-semibold text-dark transition hover:bg-white"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={togglingIds.has(waiter.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleActive(!waiter.is_active, waiter.id);
                    }}
                    className={
                      waiter.is_active
                        ? "rounded-md bg-red/90 px-3 py-2 text-sm font-semibold text-white hover:bg-red"
                        : "rounded-md bg-green/90 px-3 py-2 text-sm font-semibold text-white hover:bg-green"
                    }
                  >
                    {waiter.is_active ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detailsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 opacity-0 animate-[fadeIn_160ms_ease-out_forwards]"
          role="dialog"
          aria-modal="true"
          onClick={closeDetails}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border border-stroke bg-white p-5 shadow-2xl opacity-0 animate-[fadeIn_200ms_ease-out_60ms_forwards] dark:border-dark-3 dark:bg-gray-dark"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-dark dark:text-white">
                  {detailsTitle} - {detailsName}
                </h3>
                <p className="text-sm text-body-color dark:text-dark-6">
                  Total: ${formatAmount(detailsTotal)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                className="rounded-xl border border-stroke bg-gray-1 px-3 py-2 text-sm font-semibold text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:bg-white/5 dark:text-white"
              >
                Cerrar
              </button>
            </div>

            {detailsLoading ? (
              <div className="rounded-md border border-dashed border-stroke bg-gray-1 px-4 py-6 text-sm text-body-color dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6">
                Cargando informacion...
              </div>
            ) : detailsError ? (
              <div className="rounded-md border border-red-light bg-red-light-5 px-4 py-3 text-sm text-red dark:border-red-light/40 dark:bg-red-light-5/10 dark:text-red-light">
                {detailsError}
              </div>
            ) : detailsEntries.length === 0 ? (
              <div className="rounded-md border border-dashed border-stroke bg-gray-1 px-4 py-6 text-sm text-body-color dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6">
                {detailsEmptyMessage}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-2 text-left dark:bg-dark-2">
                      <th className="px-4 py-3 text-xs font-semibold text-dark dark:text-white">
                        ID
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-dark dark:text-white">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-dark dark:text-white">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailsEntries.map((entry) => (
                      <tr
                        key={`details-${entry.id}`}
                        className="border-b border-stroke dark:border-dark-3"
                      >
                        <td className="px-4 py-3 text-sm text-dark dark:text-white">
                          #{entry.id}
                        </td>
                        <td className="px-4 py-3 text-sm text-body-color dark:text-dark-6">
                          {entry.date}
                        </td>
                        <td className="px-4 py-3 text-sm text-dark dark:text-white">
                          ${formatAmount(entry.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
