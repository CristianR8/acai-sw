import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import CashClosing from "@/components/CashClosing";
export const metadata: Metadata = { title: "Cierre de caja" };
export default function CashClosingPage() { return <><Breadcrumb pageName="Cierre de caja" /><CashClosing /></>; }
