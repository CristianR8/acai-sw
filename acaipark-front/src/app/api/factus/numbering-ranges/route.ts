import { NextResponse } from "next/server";

import {
  errorToJson,
  getBackendBaseUrl,
  safeJson,
  toAbsoluteUrl,
} from "@/app/api/personnel/_utils";

export async function GET() {
  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, "/factus/numbering-ranges");

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para consultar rangos de Factus. Verifica que Uvicorn esté corriendo.",
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
      "No se pudieron consultar los rangos de Factus";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload);
}

