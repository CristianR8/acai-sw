export type FixedExpense = {
  id: number;
  name: string;
  category: string;
  is_active: boolean;
};

export type ExpensePayment = {
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

export function numericAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function money(value: unknown) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(numericAmount(value));
}

export function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  operacional_variable: "Operacional variable",
  operacional_fijo: "Operacional fijo",
};
