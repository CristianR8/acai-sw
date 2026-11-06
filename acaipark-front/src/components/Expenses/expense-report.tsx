"use client";

import MonthFilter, {
  currentMonth,
  monthLastDay,
} from "@/components/MonthFilter";
import DateRangeFilter, {
  currentMonthRange,
} from "@/components/DateRangeFilter";
import ExpenseSpendingChart from "./expense-spending-chart";
import ExpenseForm from "./expense-form";
import {
  EXPENSE_TYPE_LABELS,
  money,
  numericAmount,
  type ExpensePayment,
} from "./shared";
import { useEffect, useState } from "react";
import { FaRegEdit } from "react-icons/fa";

export default function ExpenseReport() {
  const [payments, setPayments] = useState<ExpensePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<ExpensePayment | null>(
    null,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const [month, setMonth] = useState(currentMonth);
  const [range, setRange] = useState(currentMonthRange);

  useEffect(() => {
    const controller = new AbortController();
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
          setMessage(
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
  }, [range, reloadToken]);

  const activePayments = payments.filter(
    (payment) => payment.status !== "void",
  );
  const totalForPeriod = activePayments.reduce(
    (sum, payment) => sum + numericAmount(payment.amount),
    0,
  );

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
      if (editingPayment?.id === payment.id) setEditingPayment(null);
      setReloadToken((value) => value + 1);
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
      {editingPayment ? (
        <ExpenseForm
          key={editingPayment.id}
          payment={editingPayment}
          onCancel={() => setEditingPayment(null)}
          onSaved={() => {
            setEditingPayment(null);
            setReloadToken((value) => value + 1);
            setMessage("Gasto actualizado correctamente.");
          }}
        />
      ) : null}
      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-dark dark:text-white">
              Historial de gastos
            </h2>
            <p className="text-body mt-1 text-sm">
              Gastos del rango seleccionado; los anulados no suman en los
              totales.
            </p>
          </div>
          <MonthFilter
            value={month}
            onChange={(value) => {
              setMonth(value);
              setRange({ from: `${value}-01`, to: monthLastDay(value) });
            }}
          >
            <DateRangeFilter
              value={range}
              onChange={setRange}
              onClear={() => {
                const value = currentMonth();
                setMonth(value);
                setRange(currentMonthRange());
              }}
            />
          </MonthFilter>
        </div>
        {loading ? (
          <p className="text-body text-sm">Cargando registros...</p>
        ) : payments.length === 0 ? (
          <p className="text-body rounded-lg border border-dashed border-stroke p-5 text-sm dark:border-dark-3">
            No hay gastos registrados en el rango seleccionado.
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
                {payments.map((payment) => {
                  const isVoid = payment.status === "void";
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
                            <button
                              type="button"
                              onClick={() => setEditingPayment(payment)}
                              title={`Editar ${payment.name}`}
                              aria-label={`Editar ${payment.name}`}
                              className="rounded-md border border-primary/40 p-1.5 text-primary transition hover:bg-primary/10"
                            >
                              <FaRegEdit aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => voidPayment(payment)}
                              className="rounded-md border border-red/40 px-2.5 py-1 text-xs font-semibold text-red transition hover:bg-red/10"
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

      <section className="rounded-[10px] bg-gradient-to-br from-primary to-[#163c62] p-6 text-white shadow-1">
        <p className="text-sm font-medium text-white/75">Gastos del período</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">{money(totalForPeriod)}</h2>
            <p className="mt-1 text-sm text-white/80">
              Corresponde al rango seleccionado e incluye solo gastos ingresados
              manualmente.
            </p>
          </div>
          <div className="rounded-lg bg-white/15 px-4 py-3 text-sm">
            {activePayments.length}{" "}
            {activePayments.length === 1 ? "registro" : "registros"}
          </div>
        </div>
      </section>

      <ExpenseSpendingChart range={range} reloadToken={reloadToken} />
    </div>
  );
}
