"use client";
import { EmailIcon, PasswordIcon } from "@/assets/icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState } from "react";
import InputGroup from "../FormElements/InputGroup";
import { storeAuth } from "@/lib/auth/storage";

type RegisterResponse = {
  id: number;
  email: string;
};

type LoginResponse = {
  accessToken: string;
  tokenType: string;
  role?: "administrator" | "cashier";
};

export default function SignupWithPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    role: "administrator" as "administrator" | "cashier",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({
      ...data,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError(null);
    setSuccess(null);

    if (data.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (data.password !== data.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          role: data.role,
        }),
      });

      const signupPayload = (await signupRes.json().catch(() => null)) as
        | (RegisterResponse & { message?: string })
        | { message?: string }
        | null;

      if (!signupRes.ok) {
        setError(signupPayload?.message ?? "No se pudo registrar el usuario");
        return;
      }

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      const loginPayload = (await loginRes.json().catch(() => null)) as
        | (Partial<LoginResponse> & { message?: string })
        | null;

      if (!loginRes.ok || !loginPayload?.accessToken) {
        setSuccess(
          "Cuenta creada. Ahora puedes iniciar sesión con tus credenciales.",
        );
        router.push("/auth/sign-in");
        return;
      }

      storeAuth(
        {
          accessToken: loginPayload.accessToken,
          tokenType: loginPayload.tokenType ?? "Bearer",
          role: loginPayload.role ?? data.role,
        },
        false,
      );

      const next = searchParams.get("next");
      router.push(
        next && next.startsWith("/")
          ? next
          : data.role === "cashier"
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
        icon={<EmailIcon />}
      />

      <InputGroup
        type="password"
        label="Contraseña"
        className="mb-4 [&_input]:py-[15px] [&_input]:text-white [&_input]:placeholder:text-white/60"
        placeholder="Crea una contraseña"
        name="password"
        handleChange={handleChange}
        value={data.password}
        icon={<PasswordIcon />}
      />

      <label className="mb-5 block text-sm font-medium text-white">
        Tipo de usuario
        <select
          name="role"
          value={data.role}
          onChange={(event) =>
            setData((current) => ({
              ...current,
              role: event.target.value as "administrator" | "cashier",
            }))
          }
          className="mt-2 w-full rounded-lg border border-white/25 bg-white/10 px-4 py-[15px] text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 [&_option]:bg-white [&_option]:text-dark"
        >
          <option value="administrator">Administrador</option>
          <option value="cashier">Cajero</option>
        </select>
      </label>

      <InputGroup
        type="password"
        label="Confirmar contraseña"
        className="mb-5 [&_input]:py-[15px] [&_input]:text-white [&_input]:placeholder:text-white/60"
        placeholder="Repite tu contraseña"
        name="confirmPassword"
        handleChange={handleChange}
        value={data.confirmPassword}
        icon={<PasswordIcon />}
      />

      <div className="mb-6 flex items-center justify-between gap-2 py-2 font-medium text-gray">
        <Link
          href="/auth/sign-in"
          className="hover:text-primary dark:text-white dark:hover:text-gray"
        >
          Ya tengo una cuenta
        </Link>
      </div>

      <div className="mb-4.5">
        {(error || success) && (
          <div
            className={`mb-3 rounded-lg border px-4 py-3 text-sm ${
              error
                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
                : "border-green-300 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200"
            }`}
          >
            {error ?? success}
          </div>
        )}

        <button
          type="submit"
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90"
          disabled={loading}
        >
          Crear cuenta
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
          )}
        </button>
      </div>
    </form>
  );
}
