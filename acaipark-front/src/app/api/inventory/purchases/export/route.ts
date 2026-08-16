import { NextResponse } from "next/server";

export async function GET() {
  const base = (process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/inventory/exports/purchases.xlsx`);
    if (!response.ok) return NextResponse.json({ message: "No se pudo generar el Excel." }, { status: response.status });
    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": "attachment; filename=historial-compras.xlsx",
      },
    });
  } catch {
    return NextResponse.json({ message: "No se pudo conectar con el backend." }, { status: 502 });
  }
}
