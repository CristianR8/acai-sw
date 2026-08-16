import type { Metadata } from "next";

import LoyaltyCard from "./loyalty-card";

export const metadata: Metadata = {
  title: "Mi tarjeta de fidelización | Acai Park",
};

export default async function LoyaltyCardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <LoyaltyCard code={code} />;
}
