import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PurchaseReport from "@/components/PurchaseReport";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Informe de compras" };

export default function PurchaseReportPage() {
  return (
    <>
      <Breadcrumb pageName="Informe de compras" />
      <PurchaseReport />
    </>
  );
}
