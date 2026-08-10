import { NextResponse } from "next/server";

import { errorToJson, getBackendBaseUrl, safeJson, toAbsoluteUrl } from "../_utils";

type SupplierCreateBody = {
  name?: string;
  phone?: string | null;
  gender?: string;
  is_active?: boolean;
};

export async function GET(request: Request) {
  const backendBaseUrl = getBackendBaseUrl();
  const requestUrl = new URL(request.url);
  const backendUrl = new URL(toAbsoluteUrl(backendBaseUrl, "/personnel/suppliers"));

  const active = requestUrl.searchParams.get("active");
  if (active) backendUrl.searchParams.set("active", active);

  let response: Response;
  try {
    response = await fetch(backendUrl.toString(), { cache: "no-store" });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para cargar proveedores. Verifica que Uvicorn esté corriendo y que `BACKEND_URL` sea accesible desde el servidor de Next.js.",
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
      "No se pudo cargar proveedores";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: backendUrl.toString() },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SupplierCreateBody | null;

  if (!body) {
    return NextResponse.json({ message: "Body inválido (JSON requerido)" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ message: "Nombre es requerido" }, { status: 400 });
  }

  const phone = body.phone === undefined || body.phone === null ? null : String(body.phone).trim();
  const gender = (body.gender ?? "male").trim() || "male";

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, "/personnel/suppliers");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        phone: phone ? phone : null,
        gender,
        is_active: body.is_active ?? true,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para crear el proveedor. Verifica que Uvicorn esté corriendo y que `BACKEND_URL` sea accesible desde el servidor de Next.js.",
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
      "No se pudo crear el proveedor";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload, { status: 201 });
}
