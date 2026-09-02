import { NextResponse } from "next/server";

function getBackendBaseUrl() {
  return process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
}

export async function GET(request: Request) {
  const day = new URL(request.url).searchParams.get("day");
  if (!day) return NextResponse.json({ message: "La fecha es requerida" }, { status: 400 });

  const backend = getBackendBaseUrl().replace(/\/$/, "");
  const url = `${backend}/sales/summary/daily-payment-methods?day=${encodeURIComponent(day)}`;
  try {
    const response = await fetch(url, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(payload ?? { message: "No se pudo cargar el resumen diario" }, { status: response.status });
    }
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ message: "No se pudo conectar con el backend" }, { status: 502 });
  }
}
