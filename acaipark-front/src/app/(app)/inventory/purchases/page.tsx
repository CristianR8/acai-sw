import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PurchasesHistory from "@/components/PurchasesHistory";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Compras" };

export default function PurchasesPage() {
  return <><Breadcrumb pageName="Compras" /><PurchasesHistory /></>;
}
