import { NextResponse } from "next/server";

function url(path: string) { return `${(process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "")}${path}`; }

export async function GET(request: Request) {
  try {
    const response = await fetch(`${url("/expenses/calendar")}${new URL(request.url).search}`, { cache: "no-store" });
    return NextResponse.json(await response.json().catch(() => null), { status: response.status });
  } catch { return NextResponse.json({ message: "No se pudo conectar con el backend." }, { status: 502 }); }
}
