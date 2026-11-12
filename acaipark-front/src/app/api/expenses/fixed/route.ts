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
    const response = await fetch(backendUrl("/expenses/fixed"), {
      cache: "no-store",
    });
    const body = await payload(response);
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "No se pudo conectar con el backend." },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ message: "Datos inválidos." }, { status: 400 });
  }
  try {
    const response = await fetch(backendUrl("/expenses/fixed"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await payload(response), {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { message: "No se pudo conectar con el backend." },
      { status: 502 },
    );
  }
}
