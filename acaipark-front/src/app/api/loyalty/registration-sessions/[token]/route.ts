import { NextResponse } from "next/server";

import { errorToJson, getBackendBaseUrl, safeJson, toAbsoluteUrl } from "../../../personnel/_utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token?: string }> },
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ message: "Token requerido" }, { status: 400 });

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, `/loyalty/registration-sessions/${encodeURIComponent(token)}`);
  try {
    const response = await fetch(url, { cache: "no-store" });
    const payload = await safeJson(response);
    if (!response.ok) {
      return NextResponse.json(
        { message: (payload as any)?.detail || "Registro no encontrado" },
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
