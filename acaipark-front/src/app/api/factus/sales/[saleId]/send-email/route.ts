import { NextResponse } from "next/server";

import {
  errorToJson,
  getBackendBaseUrl,
  safeJson,
  toAbsoluteUrl,
} from "@/app/api/personnel/_utils";

type SendEmailBody = {
  email?: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ saleId?: string }> },
) {
  const { saleId } = await params;
  if (!saleId) {
    return NextResponse.json({ message: "ID de venta requerido" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as SendEmailBody | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ message: "Email requerido" }, { status: 400 });
  }

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, `/factus/sales/${saleId}/send-email`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para enviar correo de factura. Verifica que Uvicorn este corriendo.",
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
      "No se pudo enviar el correo";
    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload);
}
