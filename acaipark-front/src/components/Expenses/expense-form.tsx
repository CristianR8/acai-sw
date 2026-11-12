"use client";

import { FormEvent, useEffect, useState } from "react";
import ExpenseTypeForm from "./expense-type-form";
import {
  localToday,
  numericAmount,
  type FixedExpense,
  type ExpensePayment,
} from "./shared";

export default function ExpenseForm({
  payment,
  onSaved,
  onCancel,
}: {
  payment?: ExpensePayment;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const editingPaymentId = payment?.id;
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [expenseId, setExpenseId] = useState(
    payment ? String(payment.fixed_expense_id) : "",
  );
  const [paymentDate, setPaymentDate] = useState(
    payment?.payment_date ?? localToday(),
  );
  const [amountInput, setAmountInput] = useState(
    payment ? String(numericAmount(payment.amount)) : "",
  );
  const [concept, setConcept] = useState(payment?.concept ?? "");
  const [expenseType, setExpenseType] = useState(payment?.expense_type ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/expenses/fixed", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload))
          throw new Error("No se pudieron cargar los tipos de gasto.");
        if (!controller.signal.aborted) setExpenses(payload);
      } catch {
        if (!controller.signal.aborted)
          setMessage("No se pudieron cargar los tipos de gasto.");
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
  const isCashierPayroll = selectedExpense?.name === "Nómina de cajero";

  function resetForm() {
    setExpenseId("");
    setPaymentDate(localToday());
    setAmountInput("");
    setConcept("");
    setExpenseType("");
  }

  async function registerPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amountInput.replace(/\D/g, ""));
    if (!expenseId || value <= 0) {
      setMessage("Selecciona un tipo de gasto e ingresa un monto válido.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        editingPaymentId
          ? `/api/expenses/payments/${editingPaymentId}`
          : "/api/expenses/payments",
        {
          method: editingPaymentId ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fixed_expense_id: Number(expenseId),
            payment_date: paymentDate,
            amount: value,
            concept: concept.trim() || null,
            expense_type: expenseType || null,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(
          payload?.detail ??
            payload?.message ??
            `No se pudo ${editingPaymentId ? "actualizar" : "registrar"} el gasto.`,
        );
        return;
      }
      if (!editingPaymentId) resetForm();
      setMessage(
        editingPaymentId
          ? "Gasto actualizado correctamente."
          : "Gasto registrado correctamente.",
      );
      onSaved?.();
    } catch {
      setMessage(
        "No se pudo guardar el gasto. Revisa tu conexión e inténtalo nuevamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-dark dark:text-white">
          {editingPaymentId ? "Editar gasto" : "Registrar gasto"}
        </h2>
        <p className="text-body mt-1 text-sm">
          Elige el tipo de gasto y agrega el concepto, la fecha y el valor real
          del pago.
        </p>
      </div>
      {loading ? (
        <p className="text-body mb-4 text-sm">Cargando tipos de gasto...</p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {message}
        </p>
      ) : null}
      <ExpenseTypeForm
        disabled={loading || saving}
        onCreated={(expense) => {
          setExpenses((current) =>
            [...current.filter((item) => item.id !== expense.id), expense].sort(
              (a, b) =>
                a.category.localeCompare(b.category, "es") ||
                a.name.localeCompare(b.name, "es"),
            ),
          );
          setExpenseId(String(expense.id));
          setMessage("Tipo de gasto creado. Ya puedes registrar el pago.");
        }}
      />
      <form
        onSubmit={registerPayment}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-2 xl:items-end"
      >
        <label className="block text-sm font-medium text-dark dark:text-white">
          Tipo de gasto
          <select
            value={expenseId}
            onChange={(event) => setExpenseId(event.target.value)}
            required
            className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
          >
            <option value="">Selecciona un gasto</option>
            {expenses
              .filter((expense) => expense.is_active)
              .map((expense) => (
                <option key={expense.id} value={expense.id}>
                  {expense.name} · {expense.category}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-dark dark:text-white">
          {isCashierPayroll ? "Nombre del cajero/a" : "Concepto"}
          <input
            type="text"
            value={concept}
            onChange={(event) => setConcept(event.target.value)}
            placeholder={
              isCashierPayroll
                ? "Nombre del cajero/a"
                : "Describe el concepto del gasto"
            }
            className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
          />
        </label>
        <label className="block text-sm font-medium text-dark dark:text-white">
          Clasificación
          <select
            value={expenseType}
            onChange={(event) => setExpenseType(event.target.value)}
            className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
          >
            <option value="">Sin clasificar</option>
            <option value="operacional_variable">Operacional variable</option>
            <option value="operacional_fijo">Operacional fijo</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-dark dark:text-white">
          Fecha de pago
          <input
            type="date"
            value={paymentDate}
            max={localToday()}
            onChange={(event) => setPaymentDate(event.target.value)}
            required
            className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
          />
        </label>
        <label className="block text-sm font-medium text-dark dark:text-white">
          Monto pagado
          <input
            value={amountInput}
            inputMode="numeric"
            placeholder="$ 0"
            onChange={(event) =>
              setAmountInput(event.target.value.replace(/\D/g, ""))
            }
            required
            className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
          />
        </label>
        <div className="flex gap-2">
          <button
            disabled={saving || loading}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Guardando..."
              : editingPaymentId
                ? "Guardar cambios"
                : "Registrar gasto"}
          </button>
          {editingPaymentId ? (
            <button
              type="button"
              onClick={onCancel}
              className="text-body rounded-md border border-stroke px-5 py-2.5 text-sm font-semibold transition hover:bg-gray-100 dark:border-dark-3 dark:hover:bg-dark-2"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
