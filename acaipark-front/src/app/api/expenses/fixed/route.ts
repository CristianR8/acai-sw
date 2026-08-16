import { NextResponse } from "next/server";

function backendUrl(path: string) {
  const base = (
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
  return `${base}${path}`;
}

async function payload(response: Response) {
  return response.json().catch(() => null);
}

export async function GET() {
  try {
    const response = await fetch(backendUrl("/expenses/fixed"), { cache: "no-store" });
    const body = await payload(response);
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json({ message: "No se pudo conectar con el backend." }, { status: 502 });
  }
}
