import { NextResponse } from "next/server";

function getBackendBaseUrl() {
  return (
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  );
}

function toAbsoluteUrl(baseUrl: string, pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = baseUrl.replace(/\/$/, "");
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorToJson(error: unknown) {
  if (error instanceof Error) {
    const anyError = error as any;
    return {
      name: error.name,
      message: error.message,
      code: anyError?.code,
      errno: anyError?.errno,
      syscall: anyError?.syscall,
      address: anyError?.address,
      port: anyError?.port,
      cause: anyError?.cause,
    };
  }
  return { message: String(error) };
}

export async function GET(request: Request) {
  const backendBaseUrl = getBackendBaseUrl();
  const requestUrl = new URL(request.url);
  const period = requestUrl.searchParams.get("period");
  const baseUrl = toAbsoluteUrl(backendBaseUrl, "/sales/summary/adjustments/monthly");
  const url = period ? `${baseUrl}?period=${encodeURIComponent(period)}` : baseUrl;

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para cargar cortesias/descuentos por mes. Verifica que Uvicorn esté corriendo y que `BACKEND_URL` sea accesible desde el servidor de Next.js.",
        backendUrl: backendBaseUrl,
        triedUrl: url,
        error: errorToJson(error),
      },
      { status: 502 },
    );
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    const message =
      (typeof (payload as any)?.detail === "string" && (payload as any).detail) ||
      (typeof (payload as any)?.message === "string" && (payload as any).message) ||
      "No se pudo cargar cortesias/descuentos por mes";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload);
}
