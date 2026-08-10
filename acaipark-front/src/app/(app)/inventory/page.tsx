import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Inventory from "@/components/Inventory";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inventario",
};

function getBackendBaseUrl() {
  return (
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  );
}

export default async function InventoryPage() {
  const baseUrl = getBackendBaseUrl().replace(/\/$/, "");

  return (
    <>
      <Breadcrumb pageName="Inventario" />
      <Inventory backendBaseUrl={baseUrl} />
    </>
  );
}
