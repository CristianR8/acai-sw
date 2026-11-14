import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const backend = (process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  try {
    const response = await fetch(`${backend}/sales/${id}/payment-method`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: request.headers.get("authorization") ?? "" },
      body: await request.text(),
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ message: "No se pudo guardar la corrección." }, { status: 502 });
  }
}
