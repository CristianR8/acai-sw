"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import {
  EXPENSE_TYPE_LABELS,
  localToday,
  numericAmount,
  type ExpensePayment,
  type FixedExpense,
} from "./shared";

export default function ExpensePaymentEditRow({
  payment,
  onSaved,
  onCancel,
}: {
  payment: ExpensePayment;
  onSaved: (payment: ExpensePayment) => void;
  onCancel: () => void;
}) {
  const formId = useId();
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [expenseId, setExpenseId] = useState(String(payment.fixed_expense_id));
  const [paymentDate, setPaymentDate] = useState(payment.payment_date);
  const [concept, setConcept] = useState(payment.concept ?? "");
  const [expenseType, setExpenseType] = useState(payment.expense_type ?? "");
  const [amount, setAmount] = useState(String(numericAmount(payment.amount)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/expenses/fixed", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload)) throw new Error();
        if (!controller.signal.aborted) setExpenses(payload);
      } catch {
        if (!controller.signal.aborted) {
          setOptionsError(true);
          setError(
            "No se pudieron cargar los tipos de gasto. Cancela y vuelve a intentar.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const selectedExpense = expenses.find(
    (expense) => expense.id === Number(expenseId),
  );
  const inputClass =
    "w-full rounded-md border border-stroke bg-white px-2 py-2 text-sm text-dark outline-none focus:border-primary disabled:opacity-60 dark:border-dark-3 dark:bg-gray-dark dark:text-white";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading || optionsError) return;
    const value = Number(amount);
    if (
      !expenseId ||
      !Number.isFinite(value) ||
      value <= 0 ||
      !paymentDate ||
      paymentDate > localToday()
    ) {
      setError(
        "Selecciona el gasto, una fecha válida y un monto mayor a cero.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/expenses/payments/${payment.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fixed_expense_id: Number(expenseId),
          payment_date: paymentDate,
          concept: concept.trim() || null,
          expense_type: expenseType || null,
          amount: value,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.id !== payment.id) {
        setError(
          typeof payload?.detail === "string"
            ? payload.detail
            : typeof payload?.message === "string"
              ? payload.message
              : "No se pudo actualizar el gasto. Revisa los datos e inténtalo nuevamente.",
        );
        return;
      }
      onSaved(payload);
    } catch {
      setError(
        "No se pudo guardar el gasto. Revisa tu conexión e inténtalo nuevamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr
      className="border-b border-primary/30 bg-primary/5 align-top dark:bg-primary/10"
      aria-label={`Editando ${payment.name}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !saving) {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <td className="px-3 py-4">
        <input
          aria-label="Fecha de pago"
          form={formId}
          type="date"
          required
          max={localToday()}
          value={paymentDate}
          onChange={(event) => setPaymentDate(event.target.value)}
          disabled={saving}
          className={`${inputClass} min-w-[140px]`}
        />
      </td>
      <td className="px-3 py-4">
        <select
          aria-label="Tipo de gasto"
          form={formId}
          required
          value={expenseId}
          onChange={(event) => setExpenseId(event.target.value)}
          disabled={saving || loading || optionsError}
          className={`${inputClass} min-w-[160px]`}
        >
          {!expenses.some(
            (expense) => expense.id === payment.fixed_expense_id,
          ) ? (
            <option value={payment.fixed_expense_id}>{payment.name}</option>
          ) : null}
          {expenses
            .filter(
              (expense) =>
                expense.is_active || expense.id === payment.fixed_expense_id,
            )
            .map((expense) => (
              <option key={expense.id} value={expense.id}>
                {expense.name}
              </option>
            ))}
        </select>
      </td>
      <td className="px-3 py-4">
        <input
          aria-label={
            selectedExpense?.name === "Nómina de cajero"
              ? "Nombre del cajero/a"
              : "Concepto"
          }
          form={formId}
          value={concept}
          onChange={(event) => setConcept(event.target.value)}
          disabled={saving}
          className={`${inputClass} min-w-[140px]`}
        />
      </td>
      <td className="text-body px-3 py-4">
        {selectedExpense?.category ?? payment.category}
      </td>
      <td className="px-3 py-4">
        <select
          aria-label="Clasificación"
          form={formId}
          value={expenseType}
          onChange={(event) => setExpenseType(event.target.value)}
          disabled={saving}
          className={`${inputClass} min-w-[150px]`}
        >
          <option value="">Sin clasificar</option>
          {Object.entries(EXPENSE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-4">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          Editando
        </span>
      </td>
      <td className="px-3 py-4">
        <input
          aria-label="Monto pagado"
          form={formId}
          type="number"
          inputMode="decimal"
          required
          min="0.0001"
          step="0.0001"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={saving}
          className={`${inputClass} min-w-[120px] text-right`}
        />
      </td>
      <td className="px-3 py-4">
        <form
          id={formId}
          onSubmit={save}
          className="flex min-w-[170px] flex-wrap justify-end gap-2"
        >
          <button
            type="submit"
            disabled={saving || loading || optionsError}
            className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md border border-stroke px-3 py-2 text-xs font-semibold text-dark disabled:opacity-50 dark:border-dark-3 dark:text-white"
          >
            Cancelar
          </button>
          {loading ? (
            <p role="status" className="text-body w-full text-xs">
              Cargando tipos de gasto...
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="w-full text-xs text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          ) : null}
        </form>
      </td>
    </tr>
  );
}
