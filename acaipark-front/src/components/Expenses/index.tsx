"use client";

import MonthFilter, { currentMonth, monthLastDay } from "@/components/MonthFilter";
import DateRangeFilter, { currentMonthRange } from "@/components/DateRangeFilter";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FaRegEdit } from "react-icons/fa";

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
  concept: string | null;
  payment_date: string;
  amount: number | string;
  status?: string;
  expense_type?: string | null;
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

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  operacional_variable: "Operacional variable",
  operacional_fijo: "Operacional fijo",
};

export default function Expenses() {
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [payments, setPayments] = useState<ExpensePayment[]>([]);
  const [expenseId, setExpenseId] = useState("");
  const [paymentDate, setPaymentDate] = useState(localToday);
  const [amountInput, setAmountInput] = useState("");
  const [concept, setConcept] = useState("");
  const [expenseType, setExpenseType] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [range, setRange] = useState(currentMonthRange);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ from_date: range.from, to_date: range.to });
    void Promise.all([
      fetch("/api/expenses/fixed", { cache: "no-store", signal: controller.signal }),
      fetch(`/api/expenses/payments?${params}`, { cache: "no-store", signal: controller.signal }),
    ])
      .then(async ([expensesResponse, paymentsResponse]) => {
        const [expensesPayload, paymentsPayload] = await Promise.all([
          expensesResponse.json().catch(() => null),
          paymentsResponse.json().catch(() => null),
        ]);
        if (controller.signal.aborted) return;
        setExpenses(expensesResponse.ok && Array.isArray(expensesPayload) ? expensesPayload : []);
        setPayments(paymentsResponse.ok && Array.isArray(paymentsPayload) ? paymentsPayload : []);
        if (!expensesResponse.ok || !paymentsResponse.ok) {
          setMessage(expensesPayload?.detail ?? paymentsPayload?.detail ?? "No se pudieron cargar los gastos.");
        }
        setLoading(false);
      })
      .catch(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, [range]);

  const activePayments = payments.filter((payment) => payment.status !== "void");
  const totalThisMonth = useMemo(
    () => activePayments.reduce((sum, payment) => sum + numericAmount(payment.amount), 0),
    [activePayments],
  );
  const selectedExpense = expenses.find((expense) => expense.id === Number(expenseId));
  const isCashierPayroll = selectedExpense?.name === "Nómina de cajero";

  function cancelEdit() {
    setEditingPaymentId(null);
    setExpenseId("");
    setPaymentDate(localToday());
    setAmountInput("");
    setConcept("");
    setExpenseType("");
  }

  function startEdit(payment: ExpensePayment) {
    setEditingPaymentId(payment.id);
    setExpenseId(String(payment.fixed_expense_id));
    setPaymentDate(payment.payment_date);
    setAmountInput(String(numericAmount(payment.amount)));
    setConcept(payment.concept ?? "");
    setExpenseType(payment.expense_type ?? "");
    setMessage(null);
  }

  async function voidPayment(payment: ExpensePayment) {
    if (!window.confirm(`¿Anular la compra "${payment.name}" de ${money(payment.amount)}?`)) return;
    const response = await fetch(`/api/expenses/payments/${payment.id}/void`, {
      method: "POST",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(payload?.detail ?? payload?.message ?? "No se pudo anular la compra.");
      return;
    }
    setPayments((current) =>
      current.map((entry) => (entry.id === payment.id ? (payload as ExpensePayment) : entry)),
    );
    setMessage("Compra anulada correctamente.");
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
    const response = await fetch(editingPaymentId ? `/api/expenses/payments/${editingPaymentId}` : "/api/expenses/payments", {
      method: editingPaymentId ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fixed_expense_id: Number(expenseId),
        payment_date: paymentDate,
        amount: value,
        concept: concept.trim() || null,
        expense_type: expenseType || null,
      }),
    });
    const payload = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setMessage(payload?.detail ?? payload?.message ?? `No se pudo ${editingPaymentId ? "actualizar" : "registrar"} el gasto.`);
      return;
    }

    const [year, payMonth] = String(payload?.payment_date ?? paymentDate).split("-");
    const targetMonth = `${year}-${payMonth}`;
    setMonth(targetMonth);
    setRange({ from: `${targetMonth}-01`, to: monthLastDay(targetMonth) });
    cancelEdit();
    setMessage(editingPaymentId ? "Gasto actualizado correctamente." : "Gasto registrado correctamente.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-dark dark:text-white">Historial de gastos</h2>
            <p className="mt-1 text-sm text-body">Gastos del rango seleccionado; los anulados no suman en los totales.</p>
          </div>
          <MonthFilter value={month} onChange={(value) => { setMonth(value); setRange({ from: `${value}-01`, to: monthLastDay(value) }); }}>
            <DateRangeFilter value={range} onChange={setRange} onClear={() => { const value = currentMonth(); setMonth(value); setRange(currentMonthRange()); }} />
          </MonthFilter>
        </div>
        {loading ? <p className="text-sm text-body">Cargando registros...</p> : payments.length === 0 ? <p className="rounded-lg border border-dashed border-stroke p-5 text-sm text-body dark:border-dark-3">No hay gastos registrados en el rango seleccionado.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-stroke text-xs uppercase text-body dark:border-dark-3"><tr><th className="px-3 py-3 font-semibold">Fecha</th><th className="px-3 py-3 font-semibold">Tipo de gasto</th><th className="px-3 py-3 font-semibold">Concepto</th><th className="px-3 py-3 font-semibold">Categoría</th><th className="px-3 py-3 font-semibold">Clasificación</th><th className="px-3 py-3 font-semibold">Registro</th><th className="px-3 py-3 text-right font-semibold">Monto pagado</th><th className="px-3 py-3 text-right font-semibold">Acciones</th></tr></thead>
              <tbody>{payments.map((payment) => {
                const isVoid = payment.status === "void";
                return <tr key={payment.id} className={`border-b last:border-0 ${isVoid ? "border-stroke bg-gray-100/60 dark:border-dark-3 dark:bg-dark-2" : "border-green-100 bg-green-50/70 dark:border-green-900/40 dark:bg-green-900/10"}`}>
                  <td className={`px-3 py-4 ${isVoid ? "text-body" : "text-dark dark:text-white"}`}>{new Date(`${payment.payment_date}T12:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td className={`px-3 py-4 font-medium ${isVoid ? "text-body" : "text-dark dark:text-white"}`}>{payment.name}</td>
                  <td className="max-w-xs break-words px-3 py-4 text-body">{payment.concept || "—"}</td>
                  <td className="px-3 py-4 text-body">{payment.category}</td>
                  <td className="px-3 py-4 text-body">{payment.expense_type ? EXPENSE_TYPE_LABELS[payment.expense_type] || payment.expense_type : "—"}</td>
                  <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isVoid ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"}`}>{isVoid ? "Anulado" : "Registrado"}</span></td>
                  <td className={`px-3 py-4 text-right font-semibold ${isVoid ? "text-body line-through" : "text-green-700 dark:text-green-300"}`}>{money(payment.amount)}</td>
                  <td className="px-3 py-4 text-right">{!isVoid ? <div className="flex justify-end gap-2"><button type="button" onClick={() => startEdit(payment)} title={`Editar ${payment.name}`} aria-label={`Editar ${payment.name}`} className="rounded-md border border-primary/40 p-1.5 text-primary transition hover:bg-primary/10"><FaRegEdit aria-hidden="true" /></button><button type="button" onClick={() => voidPayment(payment)} className="rounded-md border border-red/40 px-2.5 py-1 text-xs font-semibold text-red transition hover:bg-red/10">Anular</button></div> : null}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[10px] bg-gradient-to-br from-primary to-[#163c62] p-6 text-white shadow-1">
        <p className="text-sm font-medium text-white/75">Gastos del período</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">{money(totalThisMonth)}</h2>
            <p className="mt-1 text-sm text-white/80">Corresponde al rango seleccionado e incluye solo gastos ingresados manualmente.</p>
          </div>
          <div className="rounded-lg bg-white/15 px-4 py-3 text-sm">
            {activePayments.length} {activePayments.length === 1 ? "registro" : "registros"}
          </div>
        </div>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-dark dark:text-white">{editingPaymentId ? "Editar gasto" : "Registrar gasto"}</h2>
          <p className="mt-1 text-sm text-body">Elige el tipo de gasto y agrega el concepto, la fecha y el valor real del pago.</p>
        </div>
        {message ? <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p> : null}
        <form onSubmit={registerPayment} className="grid gap-4 md:grid-cols-2 xl:grid-cols-2 xl:items-end">
          <label className="block text-sm font-medium text-dark dark:text-white">Tipo de gasto
            <select value={expenseId} onChange={(event) => setExpenseId(event.target.value)} required className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white">
              <option value="">Selecciona un gasto</option>
              {expenses.filter((expense) => expense.is_active).map((expense) => <option key={expense.id} value={expense.id}>{expense.name} · {expense.category}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-dark dark:text-white">{isCashierPayroll ? "Nombre del cajero/a" : "Concepto"}
            <input type="text" value={concept} onChange={(event) => setConcept(event.target.value)} placeholder={isCashierPayroll ? "Nombre del cajero/a" : "Describe el concepto del gasto"} className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white" />
          </label>
          <label className="block text-sm font-medium text-dark dark:text-white">Clasificación
            <select value={expenseType} onChange={(event) => setExpenseType(event.target.value)} className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white">
              <option value="">Sin clasificar</option>
              <option value="operacional_variable">Operacional variable</option>
              <option value="operacional_fijo">Operacional fijo</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-dark dark:text-white">Fecha de pago
            <input type="date" value={paymentDate} max={localToday()} onChange={(event) => setPaymentDate(event.target.value)} required className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white" />
          </label>
          <label className="block text-sm font-medium text-dark dark:text-white">Monto pagado
            <input value={amountInput} inputMode="numeric" placeholder="$ 0" onChange={(event) => setAmountInput(event.target.value.replace(/\D/g, ""))} required className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white" />
          </label>
          <div className="flex gap-2">
            <button disabled={saving} className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Guardando..." : editingPaymentId ? "Guardar cambios" : "Registrar gasto"}
            </button>
            {editingPaymentId ? <button type="button" onClick={cancelEdit} className="rounded-md border border-stroke px-5 py-2.5 text-sm font-semibold text-body transition hover:bg-gray-100 dark:border-dark-3 dark:hover:bg-dark-2">Cancelar</button> : null}
          </div>
        </form>
      </section>


    </div>
  );
}
