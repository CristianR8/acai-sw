import { NextResponse } from "next/server";

function baseUrl() { return (process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, ""); }

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const response = await fetch(`${baseUrl()}/inventory/purchases/${id}`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: await request.text(),
    });
    return NextResponse.json(await response.json().catch(() => null), { status: response.status });
  } catch { return NextResponse.json({ message: "No se pudo conectar con el backend." }, { status: 502 }); }
}
