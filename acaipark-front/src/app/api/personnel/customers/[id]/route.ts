import { NextResponse } from "next/server";

import { errorToJson, getBackendBaseUrl, safeJson, toAbsoluteUrl } from "../../_utils";

type CustomerUpdateBody = {
  name?: string;
  identity_document?: string;
  phone?: string | null;
  gender?: string;
  is_active?: boolean;
};

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = params.id;

  const body = (await request.json().catch(() => null)) as CustomerUpdateBody | null;

  if (!body) {
    return NextResponse.json({ message: "Body inválido (JSON requerido)" }, { status: 400 });
  }

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, `/personnel/customers/${id}`);

  const payloadToSend: Record<string, unknown> = {};
  if (body.name !== undefined) payloadToSend.name = body.name;
  if (body.identity_document !== undefined) {
    payloadToSend.identity_document = body.identity_document;
  }
  if (body.phone !== undefined) payloadToSend.phone = body.phone;
  if (body.gender !== undefined) payloadToSend.gender = body.gender;
  if (body.is_active !== undefined) payloadToSend.is_active = body.is_active;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payloadToSend),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para editar el cliente. Verifica que Uvicorn esté corriendo y que `BACKEND_URL` sea accesible desde el servidor de Next.js.",
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
      "No se pudo editar el cliente";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload);
}
