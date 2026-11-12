"use client";

import { FormEvent, useId, useRef, useState } from "react";
import type { FixedExpense } from "./shared";

export default function ExpenseTypeForm({
  disabled,
  onCreated,
}: {
  disabled: boolean;
  onCreated: (expense: FixedExpense) => void;
}) {
  const formId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setName("");
    setError(null);
    toggleRef.current?.focus();
  }

  async function createExpenseType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || disabled) return;
    if (!name.trim()) {
      setError("Ingresa el nombre del gasto.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/expenses/fixed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          typeof payload?.detail === "string"
            ? payload.detail
            : typeof payload?.message === "string"
              ? payload.message
              : "No se pudo crear el tipo de gasto. Revisa el nombre.",
        );
        return;
      }
      if (!payload || typeof payload.id !== "number") {
        setError(
          "No se pudo confirmar la creación del tipo de gasto. Recarga la página para comprobarlo.",
        );
        return;
      }
      onCreated(payload);
      close();
    } catch {
      setError(
        "No se pudo crear el tipo de gasto. Revisa tu conexión e inténtalo nuevamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-5">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={formId}
        disabled={disabled || saving}
        onClick={() => (open ? close() : setOpen(true))}
        className="rounded-md border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {open ? "Cerrar nuevo tipo de gasto" : "+ Agregar tipo de gasto"}
      </button>
      {open ? (
        <form
          id={formId}
          onSubmit={createExpenseType}
          className="mt-3 rounded-md border border-stroke p-4 dark:border-dark-3"
        >
          <h3 className="font-semibold text-dark dark:text-white">
            Nuevo tipo de gasto
          </h3>
          <p className="text-body mt-1 text-sm">
            Al guardarlo, aparecerá en el selector de Registrar gasto.
          </p>
          {error ? (
            <p
              role="alert"
              className="mt-3 text-sm text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          ) : null}
          <fieldset
            disabled={saving || disabled}
            className="mt-4 grid gap-4 md:grid-cols-2"
          >
            <label className="block text-sm font-medium text-dark dark:text-white">
              Nombre del gasto
              <input
                autoFocus
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Mantenimiento de equipos"
                className="mt-2 w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-dark-3"
              />
            </label>
            <div className="flex gap-2 md:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar tipo de gasto"}
              </button>
              <button
                type="button"
                onClick={close}
                className="text-body rounded-md border border-stroke px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-100 dark:border-dark-3 dark:hover:bg-dark-2"
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      ) : null}
    </div>
  );
}
