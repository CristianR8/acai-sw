import { NextResponse } from "next/server";

import {
  errorToJson,
  getBackendBaseUrl,
  safeJson,
  toAbsoluteUrl,
} from "@/app/api/personnel/_utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ saleId?: string }> },
) {
  const { saleId } = await params;
  if (!saleId) {
    return NextResponse.json({ message: "ID de venta requerido" }, { status: 400 });
  }

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, `/factus/sales/${saleId}/document`);

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para descargar la factura. Verifica que Uvicorn este corriendo.",
        backendUrl: backendBaseUrl,
        triedUrl: url,
        error: errorToJson(error),
      },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const payload = await safeJson(response);
    const message =
      (typeof (payload as any)?.detail === "string" && (payload as any).detail) ||
      (typeof (payload as any)?.message === "string" && (payload as any).message) ||
      "No se pudo descargar la factura";
    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  const body = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "application/pdf";
  const contentDisposition =
    response.headers.get("content-disposition") || `attachment; filename="factura-${saleId}.pdf"`;

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-disposition": contentDisposition,
      "cache-control": "no-store",
    },
  });
}
