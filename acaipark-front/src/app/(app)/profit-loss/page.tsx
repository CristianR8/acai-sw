import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import ProfitLoss from "@/components/ProfitLoss";

export const metadata: Metadata = { title: "Pérdidas y ganancias" };

export default function ProfitLossPage() {
  return (
    <>
      <Breadcrumb pageName="Pérdidas y ganancias" />
      <ProfitLoss />
    </>
  );
}
