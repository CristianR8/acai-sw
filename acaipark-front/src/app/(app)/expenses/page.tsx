import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Expenses from "@/components/Expenses";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Registrar gasto" };

export default function ExpensesPage() {
  return <><Breadcrumb pageName="Registrar gasto" /><Expenses /></>;
}
