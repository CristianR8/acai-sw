import LoyaltyRegistrationForm from "./registration-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarjeta de fidelizacion | Acai Park",
  description: "Registra tus datos para participar en el programa de fidelizacion de Acai Park.",
};

export default async function LoyaltyRegisterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <LoyaltyRegistrationForm token={token} />;
}
