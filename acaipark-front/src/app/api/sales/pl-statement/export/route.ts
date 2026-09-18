import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month");
  if (!month) return NextResponse.json({ message: "El mes es requerido (formato YYYY-MM)" }, { status: 400 });

  const backend = (process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${backend}/sales/pl-statement.xlsx?month=${encodeURIComponent(month)}`, { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json(await response.json().catch(() => ({ message: "No se pudo generar el Estado de Pérdidas y Ganancias" })), { status: response.status });
  }
  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": response.headers.get("content-disposition") ?? `attachment; filename=estado-pyg-${month}.xlsx`,
    },
  });
}