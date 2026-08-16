"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type FixedExpense = {
  id: number;
  name: string;
  category: string;
  is_active: boolean;
};

type ExpensePayment = {
  id: number;
  fixed_expense_id: number;
  name: string;
  category: string;
  payment_date: string;
  amount: number | string;
};

function numericAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(numericAmount(value));
}

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [payments, setPayments] = useState<ExpensePayment[]>([]);
  const [expenseId, setExpenseId] = useState("");
  const [paymentDate, setPaymentDate] = useState(localToday);
  const [amountInput, setAmountInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [expensesResponse, paymentsResponse] = await Promise.all([
      fetch("/api/expenses/fixed", { cache: "no-store" }),
      fetch("/api/expenses/payments", { cache: "no-store" }),
    ]);
    const [expensesPayload, paymentsPayload] = await Promise.all([
      expensesResponse.json().catch(() => null),
      paymentsResponse.json().catch(() => null),
    ]);
    setExpenses(expensesResponse.ok && Array.isArray(expensesPayload) ? expensesPayload : []);
    setPayments(paymentsResponse.ok && Array.isArray(paymentsPayload) ? paymentsPayload : []);
    if (!expensesResponse.ok || !paymentsResponse.ok) {
      setMessage(expensesPayload?.detail ?? paymentsPayload?.detail ?? "No se pudieron cargar los gastos.");
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const totalThisMonth = useMemo(
    () => payments.reduce((sum, payment) => sum + numericAmount(payment.amount), 0),
    [payments],
  );

  async function registerPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amountInput.replace(/\D/g, ""));
    if (!expenseId || value <= 0) {
      setMessage("Selecciona un concepto e ingresa un monto válido.");
      return;
    }

    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/expenses/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fixed_expense_id: Number(expenseId),
        payment_date: paymentDate,
        amount: value,
      }),
    });
    const payload = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setMessage(payload?.detail ?? payload?.message ?? "No se pudo registrar el gasto.");
      return;
    }

    setPayments((current) => [payload, ...current]);
    setAmountInput("");
    setMessage("Gasto registrado correctamente.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[10px] bg-gradient-to-br from-primary to-[#163c62] p-6 text-white shadow-1">
        <p className="text-sm font-medium text-white/75">Gastos registrados este mes</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">{money(totalThisMonth)}</h2>
            <p className="mt-1 text-sm text-white/80">Solo incluye gastos ingresados manualmente.</p>
          </div>
          <div className="rounded-lg bg-white/15 px-4 py-3 text-sm">
            {payments.length} {payments.length === 1 ? "registro" : "registros"}
          </div>
        </div>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-dark dark:text-white">Registrar gasto</h2>
          <p className="mt-1 text-sm text-body">Elige uno de los conceptos definidos y registra la fecha y el valor real del pago.</p>
        </div>
        {message ? <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p> : null}
        <form onSubmit={registerPayment} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.5fr_0.8fr_0.8fr_auto] xl:items-end">
          <label className="block text-sm font-medium text-dark dark:text-white">Concepto
            <select value={expenseId} onChange={(event) => setExpenseId(event.target.value)} required className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white">
              <option value="">Selecciona un gasto</option>
              {expenses.filter((expense) => expense.is_active).map((expense) => <option key={expense.id} value={expense.id}>{expense.name} · {expense.category}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-dark dark:text-white">Fecha de pago
            <input type="date" value={paymentDate} max={localToday()} onChange={(event) => setPaymentDate(event.target.value)} required className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white" />
          </label>
          <label className="block text-sm font-medium text-dark dark:text-white">Monto pagado
            <input value={amountInput} inputMode="numeric" placeholder="$ 0" onChange={(event) => setAmountInput(event.target.value.replace(/\D/g, ""))} required className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white" />
          </label>
          <button disabled={saving} className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "Registrando..." : "Registrar gasto"}
          </button>
        </form>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-dark dark:text-white">Conceptos disponibles</h2>
          <p className="mt-1 text-sm text-body">Los conceptos se mantienen definidos; no se crean nuevos al registrar un pago.</p>
        </div>
        {loading ? <p className="text-sm text-body">Cargando conceptos...</p> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {expenses.filter((expense) => expense.is_active).map((expense) => (
              <button key={expense.id} type="button" onClick={() => setExpenseId(String(expense.id))} className={`rounded-lg border p-4 text-left transition ${Number(expenseId) === expense.id ? "border-primary bg-primary/5" : "border-stroke hover:border-primary/50 dark:border-dark-3"}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{expense.category}</p>
                <p className="mt-1 font-semibold text-dark dark:text-white">{expense.name}</p>
                <p className="mt-3 text-sm font-medium text-primary">Seleccionar</p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-dark dark:text-white">Registro del mes</h2>
          <p className="mt-1 text-sm text-body">Valores y fechas reales de los gastos registrados.</p>
        </div>
        {loading ? <p className="text-sm text-body">Cargando registros...</p> : payments.length === 0 ? <p className="rounded-lg border border-dashed border-stroke p-5 text-sm text-body dark:border-dark-3">Aún no hay gastos registrados este mes.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-stroke text-xs uppercase text-body dark:border-dark-3"><tr><th className="px-3 py-3 font-semibold">Fecha</th><th className="px-3 py-3 font-semibold">Concepto</th><th className="px-3 py-3 font-semibold">Categoría</th><th className="px-3 py-3 font-semibold">Registro</th><th className="px-3 py-3 text-right font-semibold">Monto pagado</th></tr></thead>
              <tbody>{payments.map((payment) => <tr key={payment.id} className="border-b border-green-100 bg-green-50/70 last:border-0 dark:border-green-900/40 dark:bg-green-900/10"><td className="px-3 py-4 text-dark dark:text-white">{new Date(`${payment.payment_date}T12:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}</td><td className="px-3 py-4 font-medium text-dark dark:text-white">{payment.name}</td><td className="px-3 py-4 text-body">{payment.category}</td><td className="px-3 py-4"><span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">Registrado</span></td><td className="px-3 py-4 text-right font-semibold text-green-700 dark:text-green-300">{money(payment.amount)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
