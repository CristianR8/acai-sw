import { NextResponse } from "next/server";

import { errorToJson, getBackendBaseUrl, safeJson, toAbsoluteUrl } from "../_utils";

type CustomerCreateBody = {
  name?: string;
  identity_document?: string;
  phone?: string | null;
  gender?: string;
  is_active?: boolean;
};

export async function GET(request: Request) {
  const backendBaseUrl = getBackendBaseUrl();
  const requestUrl = new URL(request.url);
  const backendUrl = new URL(toAbsoluteUrl(backendBaseUrl, "/personnel/customers"));

  const active = requestUrl.searchParams.get("active");
  if (active) backendUrl.searchParams.set("active", active);

  let response: Response;
  try {
    response = await fetch(backendUrl.toString(), { cache: "no-store" });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para cargar clientes. Verifica que Uvicorn esté corriendo y que `BACKEND_URL` sea accesible desde el servidor de Next.js.",
        backendUrl: backendBaseUrl,
        triedUrl: backendUrl.toString(),
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
      "No se pudo cargar clientes";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: backendUrl.toString() },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CustomerCreateBody | null;

  if (!body) {
    return NextResponse.json({ message: "Body inválido (JSON requerido)" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const identityDocument = (body.identity_document ?? "").trim();
  if (!name || !identityDocument) {
    return NextResponse.json(
      { message: "Nombre y documento son requeridos" },
      { status: 400 },
    );
  }

  const phone = body.phone === undefined || body.phone === null ? null : String(body.phone).trim();
  const gender = (body.gender ?? "male").trim() || "male";

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, "/personnel/customers");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        identity_document: identityDocument,
        phone: phone ? phone : null,
        gender,
        is_active: body.is_active ?? true,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para crear el cliente. Verifica que Uvicorn esté corriendo y que `BACKEND_URL` sea accesible desde el servidor de Next.js.",
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
      "No se pudo crear el cliente";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload, { status: 201 });
}
