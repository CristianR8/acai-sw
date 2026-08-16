import { NextResponse } from "next/server";

import { errorToJson, getBackendBaseUrl, safeJson, toAbsoluteUrl } from "../../../personnel/_utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code?: string }> },
) {
  const { code } = await params;
  if (!code) return NextResponse.json({ message: "Codigo de tarjeta requerido" }, { status: 400 });

  try {
    const response = await fetch(
      toAbsoluteUrl(getBackendBaseUrl(), `/loyalty/cards/${encodeURIComponent(code)}`),
      { cache: "no-store" },
    );
    const payload = await safeJson(response);
    if (!response.ok) {
      return NextResponse.json(
        { message: (payload as any)?.detail || "Tarjeta de fidelizacion no encontrada" },
        { status: response.status },
      );
    }
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { message: "No se pudo conectar con el backend", error: errorToJson(error) },
      { status: 502 },
    );
  }
}
