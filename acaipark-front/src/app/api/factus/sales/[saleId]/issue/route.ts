import { NextResponse } from "next/server";

import {
  errorToJson,
  getBackendBaseUrl,
  safeJson,
  toAbsoluteUrl,
} from "@/app/api/personnel/_utils";

type FactusIssueBody = {
  customer_id?: number | null;
  customer_name?: string;
  customer_identity_document?: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  numbering_range_id?: number | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ saleId?: string }> },
) {
  const { saleId } = await params;
  if (!saleId) {
    return NextResponse.json({ message: "ID de venta requerido" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as FactusIssueBody | null;
  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, `/factus/sales/${saleId}/issue`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para emitir factura con Factus. Verifica que Uvicorn esté corriendo.",
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
      "No se pudo emitir la factura en Factus";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload);
}

