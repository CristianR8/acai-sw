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

export async function GET(request: Request) {
  try {
    const response = await fetch(`${backendUrl("/expenses/payments")}${new URL(request.url).search}`, {
      cache: "no-store",
    });
    return NextResponse.json(await payload(response), { status: response.status });
  } catch {
    return NextResponse.json({ message: "No se pudo conectar con el backend." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const response = await fetch(backendUrl("/expenses/payments"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    });
    return NextResponse.json(await payload(response), { status: response.status });
  } catch {
    return NextResponse.json({ message: "No se pudo conectar con el backend." }, { status: 502 });
  }
}
