import { NextResponse } from "next/server";

export async function PUT(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const authorization = request.headers.get("authorization");
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ message: "Datos inválidos." }, { status: 400 });

  const base = (process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/pos/orders/${encodeURIComponent(orderId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ message: payload?.detail ?? "No se pudo actualizar el pedido." }, { status: response.status });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ message: "No se pudo conectar con el servidor para actualizar el pedido." }, { status: 502 });
  }
}
