import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const day = new URL(request.url).searchParams.get("day");
  if (!day) return NextResponse.json({ message: "La fecha es requerida" }, { status: 400 });

  const backend = (process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${backend}/sales/summary/daily-payment-methods.xlsx?day=${encodeURIComponent(day)}`, { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json(await response.json().catch(() => ({ message: "No se pudo generar el Excel" })), { status: response.status });
  }
  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": response.headers.get("content-disposition") ?? `attachment; filename=cierre-caja-${day}.xlsx`,
    },
  });
}
