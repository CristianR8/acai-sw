import type { ExpensePayment } from "@/components/Expenses/shared";

export type ExpenseFilters = {
  search: string; category: string; name: string; classification: string;
  status: string; sort: string;
};
export const defaultExpenseFilters: ExpenseFilters = {
  search: "", category: "", name: "", classification: "", status: "", sort: "date_desc",
};
export function normalizeExpenseText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}
export function filterExpenses(payments: ExpensePayment[], filters: ExpenseFilters) {
  const search = normalizeExpenseText(filters.search.trim());
  return payments.filter((payment) =>
    normalizeExpenseText(`${payment.name} ${payment.category} ${payment.concept ?? ""}`).includes(search) &&
    (!filters.category || payment.category === filters.category) &&
    (!filters.name || payment.name === filters.name) &&
    (!filters.classification || (payment.expense_type || "unclassified") === filters.classification) &&
    (!filters.status || (payment.status === "void" ? "void" : "manual") === filters.status)
  ).sort((a, b) => {
    const amount = Number(a.amount) - Number(b.amount);
    if (filters.sort === "amount_desc") return -amount || b.id - a.id;
    if (filters.sort === "amount_asc") return amount || a.id - b.id;
    if (filters.sort === "name") return a.name.localeCompare(b.name, "es") || b.id - a.id;
    const date = a.payment_date.localeCompare(b.payment_date) || a.id - b.id;
    return filters.sort === "date_asc" ? date : -date;
  });
}
export function groupExpenses(payments: ExpensePayment[], by: "category" | "name") {
  const totals = new Map<string, { name: string; amount: number; count: number }>();
  for (const payment of payments) {
    if (payment.status === "void") continue;
    const name = payment[by];
    const group = totals.get(name) ?? { name, amount: 0, count: 0 };
    group.amount += Number(payment.amount);
    group.count++;
    totals.set(name, group);
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "es"));
}
