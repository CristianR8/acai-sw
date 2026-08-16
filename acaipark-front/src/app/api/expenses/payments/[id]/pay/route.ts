import { NextResponse } from "next/server";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = (process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/expenses/payments/${id}/pay`, { method: "POST" });
    return NextResponse.json(await response.json().catch(() => null), { status: response.status });
  } catch { return NextResponse.json({ message: "No se pudo conectar con el backend." }, { status: 502 }); }
}
