import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import PosScreen from "./pos-screen";

export const metadata: Metadata = {
  title: "POS",
};

export default function PosPage() {
  return (
    <>
      <Breadcrumb pageName="Toma de pedidos" />
      <PosScreen />
    </>
  );
}

