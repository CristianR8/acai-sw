import { NextResponse } from "next/server";

import { errorToJson, getBackendBaseUrl, safeJson, toAbsoluteUrl } from "../../../../personnel/_utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token?: string }> },
) {
  const { token } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    phone?: string;
    birth_date?: string;
  } | null;
  if (!token || !body?.name || !body.phone || !body.birth_date) {
    return NextResponse.json({ message: "Nombre, telefono y fecha de cumpleaños son requeridos" }, { status: 400 });
  }

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(
    backendBaseUrl,
    `/loyalty/registration-sessions/${encodeURIComponent(token)}/complete`,
  );
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: body.name.trim(),
        phone: body.phone.trim(),
        birth_date: body.birth_date,
      }),
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      return NextResponse.json(
        { message: (payload as any)?.detail || "No se pudo guardar el cliente" },
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
