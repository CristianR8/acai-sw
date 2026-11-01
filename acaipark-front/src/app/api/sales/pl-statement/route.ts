import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month");
  if (!month)
    return NextResponse.json(
      { message: "El mes es requerido (formato YYYY-MM)" },
      { status: 400 },
    );
  const backend = (
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
  try {
    const response = await fetch(
      `${backend}/sales/pl-statement?month=${encodeURIComponent(month)}`,
      { cache: "no-store" },
    );
    const payload: unknown = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "No se pudo cargar el estado de pérdidas y ganancias" },
      { status: 502 },
    );
  }
}
