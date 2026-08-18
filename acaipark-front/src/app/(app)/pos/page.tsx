import type { Metadata } from "next";
import PosScreen from "./pos-screen";

export const metadata: Metadata = {
  title: "POS",
};

export default function PosPage() {
  return <PosScreen />;
}

