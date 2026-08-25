"use client";
import { EmailIcon, PasswordIcon } from "@/assets/icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import InputGroup from "../FormElements/InputGroup";
import { storeAuth } from "@/lib/auth/storage";

export default function SigninWithPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState({
    email: process.env.NEXT_PUBLIC_DEMO_USER_MAIL || "",
    password: process.env.NEXT_PUBLIC_DEMO_USER_PASS || "",
  });

  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({
      ...data,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Password managers and browser autofill do not always dispatch React's
    // change event. Read the visible form values so the first submit cannot
    // send stale empty state and clear an autofilled form.
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json().catch(() => null)) as {
        accessToken?: string;
        tokenType?: string;
        role?: "administrator" | "cashier";
        message?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.message ?? "Credenciales inválidas");
        return;
      }

      if (!payload?.accessToken) {
        setError("Login exitoso, pero el servidor no devolvió un token.");
        return;
      }

      storeAuth(
        {
          accessToken: payload.accessToken,
          tokenType: payload.tokenType ?? "Bearer",
          role: payload.role,
        },
        false,
      );

      const next = searchParams.get("next");
      router.push(
        next && next.startsWith("/")
          ? next
          : payload.role === "cashier"
            ? "/pos"
            : "/dashboard",
      );
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <InputGroup
        type="email"
        label="Correo electrónico"
        className="mb-4 [&_input]:py-[15px] [&_input]:text-white [&_input]:placeholder:text-white/60"
        placeholder="Ingresa tu correo electrónico"
        name="email"
        handleChange={handleChange}
        value={data.email}
        required
        icon={<EmailIcon />}
      />

      <InputGroup
        type="password"
        label="Contraseña"
        className="mb-5 [&_input]:py-[15px] [&_input]:text-white [&_input]:placeholder:text-white/60"
        placeholder="Ingresa tu contraseña"
        name="password"
        handleChange={handleChange}
        value={data.password}
        required
        icon={<PasswordIcon />}
      />

      <div className="mb-6 flex items-center justify-between gap-2 py-2 font-medium text-gray">
        <Link
          href="/auth/forgot-password"
          className="hover:text-primary dark:text-white dark:hover:text-primary"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      <div className="mb-4.5">
        {error && (
          <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={!hydrated || loading}
          aria-busy={loading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Iniciar sesión
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
          )}
        </button>
      </div>
    </form>
  );
}
