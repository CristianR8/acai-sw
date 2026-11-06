import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import ExpenseReport from "@/components/Expenses/expense-report";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Informe de gastos" };

export default function ExpenseReportPage() {
  return (
    <>
      <Breadcrumb pageName="Informe de gastos" />
      <ExpenseReport />
    </>
  );
}
