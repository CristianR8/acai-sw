import { NextResponse } from "next/server";

function backendUrl(path: string) {
  const base = (
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
  return `${base}${path}`;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const { id } = await params;
  if (!body) return NextResponse.json({ message: "Datos inválidos." }, { status: 400 });
  try {
    const response = await fetch(backendUrl(`/expenses/fixed/${id}`), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ message: "No se pudo conectar con el backend." }, { status: 502 });
  }
}
