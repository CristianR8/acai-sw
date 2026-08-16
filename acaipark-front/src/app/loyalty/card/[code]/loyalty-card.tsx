"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { FaGift, FaStar } from "react-icons/fa";

type LoyaltyCardData = {
  name: string;
  loyalty_code: string;
  loyalty_stamps: number;
  loyalty_rewards: number;
};

export default function LoyaltyCard({ code }: { code: string }) {
  const [card, setCard] = useState<LoyaltyCardData | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    localStorage.setItem("acai-loyalty-card", code);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    fetch(`/api/loyalty/cards/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message || "No se pudo cargar tu tarjeta.");
        setCard(payload as LoyaltyCardData);
      })
      .catch((error: Error) => setMessage(error.message));
  }, [code]);

  const stamps = Math.max(0, Math.min(card?.loyalty_stamps || 0, 10));

  return (
    <main className="min-h-screen bg-[#0c2823] px-4 py-8 text-white sm:py-12">
      <section className="mx-auto w-full max-w-md">
        <div className="rounded-[2rem] border border-[#c8ad61]/60 bg-gradient-to-br from-[#1a5045] via-[#123b34] to-[#0a241f] p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#f5d67b]">Acai Park</p>
              <h1 className="mt-2 text-2xl font-semibold">Mi tarjeta de fidelización</h1>
            </div>
            <Image
              src="/images/logo/LogoAP.jpg"
              alt="Acai Park"
              width={60}
              height={60}
              className="h-15 w-15 rounded-full border-2 border-[#f5d67b] object-cover"
            />
          </div>

          {card ? (
            <>
              <p className="mt-8 text-lg font-medium">{card.name}</p>
              <div className="mt-5 rounded-2xl bg-white/10 p-4">
                <div className="flex items-center justify-between text-sm text-[#e9f3ef]">
                  <span className="inline-flex items-center gap-2"><FaStar className="text-[#f5d67b]" /> Sellos</span>
                  <strong>{stamps}/10</strong>
                </div>
                <div className="mt-3 grid grid-cols-10 gap-1.5" aria-label={`${stamps} de 10 sellos`}>
                  {Array.from({ length: 10 }, (_, index) => (
                    <span
                      key={index}
                      className={`flex aspect-square items-center justify-center rounded-full border text-[9px] ${index < stamps ? "border-[#f5d67b] bg-[#f5d67b] text-[#123b34]" : "border-white/35 text-white/30"}`}
                    >
                      <FaStar />
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#f5d67b] px-4 py-3 text-[#153d35]">
                <FaGift className="text-xl" />
                <span className="text-sm font-semibold">Recompensas disponibles: {card.loyalty_rewards}</span>
              </div>
            </>
          ) : (
            <p className="mt-8 rounded-xl bg-white/10 p-4 text-sm text-white/90">{message || "Cargando tu tarjeta..."}</p>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-[#c3d8d2]">
          Guarda este acceso en la pantalla principal de tu teléfono para tener la tarjeta siempre disponible.
        </p>
      </section>
    </main>
  );
}
