"use client";

import { currentMonthRange } from "@/components/DateRangeFilter";
import PeriodFilter from "@/components/PeriodFilter";
import ExpensePaymentEditRow from "./expense-payment-edit-row";
import { EXPENSE_TYPE_LABELS, money, type ExpensePayment } from "./shared";
import { useEffect, useRef, useState } from "react";
import { FaRegEdit } from "react-icons/fa";
import { defaultExpenseFilters, filterExpenses, groupExpenses, type ExpenseFilters } from "@/lib/expense-analysis";

export default function ExpenseHistory({
  reloadToken = 0,
}: {
  reloadToken?: number;
}) {
  const [payments, setPayments] = useState<ExpensePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [editingPayment, setEditingPayment] = useState<ExpensePayment | null>(
    null,
  );
  const [filters, setFilters] = useState(defaultExpenseFilters);
  const [groupBy, setGroupBy] = useState<"category" | "name">("category");
  const [range, setRange] = useState(currentMonthRange);
  const activeRange = useRef(range);
  const [savedPaymentId, setSavedPaymentId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    activeRange.current = range;
    setEditingPayment(null);
    setSavedPaymentId(null);
    setMessage(null);
    setLoadError(null);
    setLoading(true);
    setPayments([]);
    async function load() {
      try {
        const params = new URLSearchParams({
          from_date: range.from,
          to_date: range.to,
        });
        const response = await fetch(`/api/expenses/payments?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(payload))
          throw new Error(
            payload?.detail ?? "No se pudieron cargar los gastos.",
          );
        if (!controller.signal.aborted) setPayments(payload);
      } catch (error) {
        if (!controller.signal.aborted)
          setLoadError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los gastos.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [range, reloadToken, retryToken]);

  const visiblePayments = filterExpenses(payments, filters);
  const groups = groupExpenses(visiblePayments, groupBy);
  const filteredTotal = groups.reduce((sum, group) => sum + group.amount, 0);
  function changeFilter(key: keyof ExpenseFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setEditingPayment(null);
  }

  async function voidPayment(payment: ExpensePayment) {
    if (
      !window.confirm(
        `¿Anular el gasto "${payment.name}" de ${money(payment.amount)}?`,
      )
    )
      return;
    try {
      const response = await fetch(
        `/api/expenses/payments/${payment.id}/void`,
        { method: "POST" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(
          payload?.detail ?? payload?.message ?? "No se pudo anular el gasto.",
        );
        return;
      }
      setPayments((current) =>
        current.map((item) =>
          item.id === payment.id ? { ...item, status: "void" } : item,
        ),
      );
      setMessage("Gasto anulado correctamente.");
    } catch {
      setMessage(
        "No se pudo anular el gasto. Revisa tu conexión e inténtalo nuevamente.",
      );
    }
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p
          role="status"
          className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary"
        >
          {message}
        </p>
      ) : null}
      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-dark dark:text-white">
              Historial de gastos
            </h2>
            <p className="text-body mt-1 text-sm">
              Gastos del rango seleccionado, incluidos los anulados.
            </p>
          </div>
        </div>
        <PeriodFilter value={range} onChange={setRange} />
        <label className="mb-5 block text-sm font-medium text-dark dark:text-white">
          Buscar por nombre, categoría o concepto
          <input
            type="search"
            value={filters.search}
            onChange={(event) => {
              changeFilter("search", event.target.value);
              setEditingPayment(null);
            }}
            placeholder="Ej. Arriendo, luz, mantenimiento..."
            className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-dark-3"
          />
        </label>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm">Categoría<select value={filters.category} onChange={(event) => changeFilter("category", event.target.value)} className="mt-1 w-full rounded border bg-transparent p-2"><option value="">Todas</option>{[...new Set(payments.map((payment) => payment.category))].sort().map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="text-sm">Tipo de gasto<select value={filters.name} onChange={(event) => changeFilter("name", event.target.value)} className="mt-1 w-full rounded border bg-transparent p-2"><option value="">Todos</option>{[...new Set(payments.map((payment) => payment.name))].sort().map((name) => <option key={name}>{name}</option>)}</select></label>
          <label className="text-sm">Clasificación<select value={filters.classification} onChange={(event) => changeFilter("classification", event.target.value)} className="mt-1 w-full rounded border bg-transparent p-2"><option value="">Todas</option>{Object.entries(EXPENSE_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="unclassified">Sin clasificar</option></select></label>
          <label className="text-sm">Estado<select value={filters.status} onChange={(event) => changeFilter("status", event.target.value)} className="mt-1 w-full rounded border bg-transparent p-2"><option value="">Todos</option><option value="manual">Registrados</option><option value="void">Anulados</option></select></label>
          <label className="text-sm">Ordenar por<select value={filters.sort} onChange={(event) => changeFilter("sort", event.target.value)} className="mt-1 w-full rounded border bg-transparent p-2"><option value="date_desc">Más recientes</option><option value="date_asc">Más antiguos</option><option value="amount_desc">Mayor gasto</option><option value="amount_asc">Menor gasto</option><option value="name">Nombre</option></select></label>
        </div>
        <button type="button" onClick={() => { setFilters(defaultExpenseFilters); setEditingPayment(null); }} className="mb-4 rounded border px-3 py-2 text-sm">Limpiar filtros de análisis</button>
        {!loading && !loadError ? <div className="mb-6 rounded-lg bg-primary/5 p-4">
          <p className="font-semibold">{visiblePayments.length} registros · Total filtrado: {money(filteredTotal)}</p>
          <p className="mt-1 text-xs text-body">Los anulados no suman. Rubros ordenados de mayor a menor; selecciona uno para ver sus registros.</p>
          <label className="my-3 block text-sm">Agrupar por<select value={groupBy} onChange={(event) => setGroupBy(event.target.value as "category" | "name")} className="ml-2 rounded border bg-transparent p-2"><option value="category">Categoría</option><option value="name">Tipo de gasto</option></select></label>
          <div className="flex flex-wrap gap-2">{groups.map((group) => <button type="button" key={group.name} onClick={() => changeFilter(groupBy, group.name)} className="rounded border bg-white px-3 py-2 text-left text-sm dark:bg-dark-2"><b>{group.name}: {money(group.amount)}</b><span className="block text-xs">{group.count} registros</span></button>)}</div>
        </div> : null}
        {loadError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 text-sm text-red"
          >
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => setRetryToken((value) => value + 1)}
              className="rounded-md border border-stroke px-3 py-2 text-dark dark:border-dark-3 dark:text-white"
            >
              Reintentar
            </button>
          </div>
        ) : loading ? (
          <p className="text-body text-sm">Cargando registros...</p>
        ) : visiblePayments.length === 0 ? (
          <p className="text-body rounded-lg border border-dashed border-stroke p-5 text-sm dark:border-dark-3">
            {payments.length === 0
              ? "No hay gastos registrados en el rango seleccionado."
              : "No hay gastos que coincidan con estos filtros en el rango seleccionado."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="text-body border-b border-stroke text-xs uppercase dark:border-dark-3">
                <tr>
                  <th className="px-3 py-3 font-semibold">Fecha</th>
                  <th className="px-3 py-3 font-semibold">Tipo de gasto</th>
                  <th className="px-3 py-3 font-semibold">Concepto</th>
                  <th className="px-3 py-3 font-semibold">Categoría</th>
                  <th className="px-3 py-3 font-semibold">Clasificación</th>
                  <th className="px-3 py-3 font-semibold">Registro</th>
                  <th className="px-3 py-3 text-right font-semibold">
                    Monto pagado
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.map((payment) => {
                  const isVoid = payment.status === "void";
                  if (editingPayment?.id === payment.id) {
                    return (
                      <ExpensePaymentEditRow
                        key={payment.id}
                        payment={payment}
                        onCancel={() => setEditingPayment(null)}
                        onSaved={(updated) => {
                          setPayments((current) =>
                            current
                              .map((item) =>
                                item.id === updated.id ? updated : item,
                              )
                              .filter(
                                (item) =>
                                  item.id !== updated.id ||
                                  (item.payment_date >=
                                    activeRange.current.from &&
                                    item.payment_date <=
                                      activeRange.current.to),
                              )
                              .sort(
                                (a, b) =>
                                  b.payment_date.localeCompare(
                                    a.payment_date,
                                  ) || b.id - a.id,
                              ),
                          );
                          setEditingPayment((current) =>
                            current?.id === updated.id ? null : current,
                          );
                          setSavedPaymentId(updated.id);
                        }}
                      />
                    );
                  }
                  return (
                    <tr
                      key={payment.id}
                      className={`border-b last:border-0 ${isVoid ? "border-stroke bg-gray-100/60 dark:border-dark-3 dark:bg-dark-2" : "border-green-100 bg-green-50/70 dark:border-green-900/40 dark:bg-green-900/10"}`}
                    >
                      <td
                        className={`px-3 py-4 ${isVoid ? "text-body" : "text-dark dark:text-white"}`}
                      >
                        {new Date(
                          `${payment.payment_date}T12:00:00`,
                        ).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td
                        className={`px-3 py-4 font-medium ${isVoid ? "text-body" : "text-dark dark:text-white"}`}
                      >
                        {payment.name}
                      </td>
                      <td className="text-body max-w-xs break-words px-3 py-4">
                        {payment.concept || "—"}
                      </td>
                      <td className="text-body px-3 py-4">
                        {payment.category}
                      </td>
                      <td className="text-body px-3 py-4">
                        {payment.expense_type
                          ? EXPENSE_TYPE_LABELS[payment.expense_type] ||
                            payment.expense_type
                          : "—"}
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isVoid ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"}`}
                        >
                          {isVoid ? "Anulado" : "Registrado"}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-4 text-right font-semibold ${isVoid ? "text-body line-through" : "text-green-700 dark:text-green-300"}`}
                      >
                        {money(payment.amount)}
                      </td>
                      <td className="px-3 py-4 text-right">
                        {!isVoid ? (
                          <div className="flex justify-end gap-2">
                            {savedPaymentId === payment.id ? (
                              <span
                                role="status"
                                className="self-center text-xs text-green-700 dark:text-green-300"
                              >
                                Guardado
                              </span>
                            ) : null}
                            <button
                              type="button"
                              disabled={editingPayment !== null}
                              onClick={() => {
                                setMessage(null);
                                setSavedPaymentId(null);
                                setEditingPayment(payment);
                              }}
                              title={`Editar ${payment.name}`}
                              aria-label={`Editar ${payment.name}`}
                              className="rounded-md border border-primary/40 p-1.5 text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <FaRegEdit aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={editingPayment !== null}
                              onClick={() => voidPayment(payment)}
                              className="rounded-md border border-red/40 px-2.5 py-1 text-xs font-semibold text-red transition hover:bg-red/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Anular
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
