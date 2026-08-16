import { NextResponse } from "next/server";

import { errorToJson, getBackendBaseUrl, safeJson, toAbsoluteUrl } from "../../personnel/_utils";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { order_id?: number } | null;
  if (!body?.order_id) {
    return NextResponse.json({ message: "ID de pedido requerido" }, { status: 400 });
  }

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, "/loyalty/registration-sessions");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: body.order_id }),
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      return NextResponse.json(
        { message: (payload as any)?.detail || "No se pudo crear el QR de registro" },
        { status: response.status },
      );
    }
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { message: "No se pudo conectar con el backend", error: errorToJson(error) },
      { status: 502 },
    );
  }
}
