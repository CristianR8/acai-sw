"use client";

import { useEffect } from "react";

export default function SavedLoyaltyCardPage() {
  useEffect(() => {
    const code = localStorage.getItem("acai-loyalty-card");
    if (code) window.location.replace(`/loyalty/card/${encodeURIComponent(code)}`);
  }, []);

  return <main className="grid min-h-screen place-items-center bg-[#0c2823] p-6 text-center text-white">No hay una tarjeta guardada en este dispositivo.</main>;
}
