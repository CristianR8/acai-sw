import { NextResponse } from "next/server";

export async function POST(_: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const base = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/pos/orders/${encodeURIComponent(orderId)}/return-to-cart`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ message: payload?.detail ?? "No se pudo recuperar el pedido." }, { status: response.status });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ message: "No se pudo conectar con el servidor para recuperar el pedido." }, { status: 502 });
  }
}
