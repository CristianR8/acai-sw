import type { DateRange } from "@/components/DateRangeFilter";

export type ExpenseCatalogEntry = {
  id: number;
  name: string;
  is_active: boolean;
};
export type ExpenseSpendingPayment = {
  fixed_expense_id: number;
  name: string;
  payment_date: string;
  amount: number | string;
  status: string;
};
export type ExpenseSpending = { id: number; name: string; total: number };

export function summarizeExpenseSpending(
  catalog: ExpenseCatalogEntry[],
  payments: ExpenseSpendingPayment[],
  range: DateRange,
): ExpenseSpending[] {
  const groups = new Map<number, ExpenseSpending>();
  for (const expense of catalog) {
    if (expense.is_active)
      groups.set(expense.id, { id: expense.id, name: expense.name, total: 0 });
  }
  for (const payment of payments) {
    if (
      payment.status !== "manual" ||
      payment.payment_date < range.from ||
      payment.payment_date > range.to
    )
      continue;
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount)) continue;
    const group = groups.get(payment.fixed_expense_id) ?? {
      id: payment.fixed_expense_id,
      name: payment.name,
      total: 0,
    };
    group.total += amount;
    groups.set(group.id, group);
  }
  return [...groups.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"),
  );
}
