"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type RegistrationStatus = {
  status: "pending" | "completed" | "expired";
  customer_name?: string | null;
  loyalty_code?: string | null;
};

export default function LoyaltyRegistrationForm({ token }: { token: string }) {
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [loyaltyCardUrl, setLoyaltyCardUrl] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/loyalty/registration-sessions/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message || "Este enlace no es valido.");
        if (active) setStatus(payload as RegistrationStatus);
      })
      .catch((error: Error) => {
        if (active) {
          setState("error");
          setMessage(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");
    try {
      const response = await fetch(`/api/loyalty/registration-sessions/${encodeURIComponent(token)}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone, birth_date: birthDate }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "No se pudo guardar la informacion.");
      const registration = payload as RegistrationStatus;
      setStatus(registration);
      if (registration.loyalty_code) {
        localStorage.setItem("acai-loyalty-card", registration.loyalty_code);
        setLoyaltyCardUrl(`/loyalty/card/${encodeURIComponent(registration.loyalty_code)}`);
      }
      setState("success");
      setMessage("Tu tarjeta digital ya está guardada en este teléfono.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la informacion.");
    }
  }

  const blocked = !status || status.status !== "pending" || state === "loading";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#102c27] px-4 py-8 text-dark sm:py-12">
      <Image
        src="/acai-images/bg-3.jpeg"
        alt="Interior de Acai Park"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[#062c28]/65" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-2xl border border-white/30 bg-white/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
          <div className="mb-6 text-center">
            <Image
              src="/images/logo/LogoAP.jpg"
              alt="Acai Park"
              width={112}
              height={112}
              priority
              className="mx-auto h-20 w-20 rounded-full object-cover shadow-md"
            />
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-[#146b5c]">Acai Park</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#143c35]">Crea tu tarjeta de fidelizacion</h1>
            <p className="mt-2 text-sm text-[#52635f]">
              Registra tus datos para acumular sellos en cada compra.
            </p>
          </div>

          {status?.status === "completed" || state === "success" ? (
            <div className="rounded-lg border border-[#8cc9a8] bg-[#effaf2] px-4 py-5 text-center text-sm text-[#1d6840]">
              <p className="font-semibold">Registro completado</p>
              <p className="mt-1">{message || `Bienvenido${status?.customer_name ? `, ${status.customer_name}` : ""}.`}</p>
              {loyaltyCardUrl ? (
                <Link
                  href={loyaltyCardUrl}
                  className="mt-4 inline-flex rounded-md bg-[#146b5c] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0e574a]"
                >
                  Ver mi tarjeta digital
                </Link>
              ) : null}
            </div>
          ) : status?.status === "expired" ? (
            <div className="rounded-lg border border-[#e7a4a4] bg-[#fff3f3] px-4 py-5 text-center text-sm text-[#a13b3b]">
              Este QR ya expiro. Solicita uno nuevo en caja.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <label className="block text-sm font-medium text-[#25463f]">
                Nombre completo
                <input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-md border border-[#c8d8d2] bg-white px-3 py-2.5 outline-none transition focus:border-[#146b5c] focus:ring-2 focus:ring-[#146b5c]/15" />
              </label>
              <label className="block text-sm font-medium text-[#25463f]">
                Telefono
                <input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-md border border-[#c8d8d2] bg-white px-3 py-2.5 outline-none transition focus:border-[#146b5c] focus:ring-2 focus:ring-[#146b5c]/15" />
              </label>
              <label className="block text-sm font-medium text-[#25463f]">
                Fecha de cumpleaños
                <input required type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className="mt-1 w-full rounded-md border border-[#c8d8d2] bg-white px-3 py-2.5 outline-none transition focus:border-[#146b5c] focus:ring-2 focus:ring-[#146b5c]/15" />
              </label>
              <button disabled={blocked} className="w-full rounded-md bg-[#146b5c] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0e574a] disabled:opacity-60">
                {state === "loading" ? "Guardando..." : "Guardar mis datos"}
              </button>
              {state === "error" ? <p className="text-sm text-[#b23b3b]">{message}</p> : null}
            </form>
          )}
          <p className="mt-6 text-center text-[11px] text-[#70817c]">Tu informacion se usara para administrar tu tarjeta de fidelizacion.</p>
        </section>
      </div>
    </main>
  );
}
