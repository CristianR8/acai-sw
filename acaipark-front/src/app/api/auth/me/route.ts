import { NextResponse } from "next/server";

type UpdateBody = {
  name?: string;
  profilePhotoUrl?: string;
};

function getBackendBaseUrl() {
  return (
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  );
}

function toAbsoluteUrl(baseUrl: string, pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = baseUrl.replace(/\/$/, "");
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

function getAuthHeader(request: Request): string | null {
  const raw = request.headers.get("authorization") ?? "";
  return raw.trim() || null;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const authorization = getAuthHeader(request);
  if (!authorization) {
    return NextResponse.json({ message: "Token requerido" }, { status: 401 });
  }

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, "/auth/me");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { authorization },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "No se pudo conectar con el backend", triedUrl: url },
      { status: 502 },
    );
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    return NextResponse.json(
      payload ?? { message: "No se pudo cargar el perfil" },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload);
}

export async function PUT(request: Request) {
  const authorization = getAuthHeader(request);
  if (!authorization) {
    return NextResponse.json({ message: "Token requerido" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as UpdateBody | null;
  if (!body) {
    return NextResponse.json(
      { message: "Body inválido (JSON requerido)" },
      { status: 400 },
    );
  }

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, "/auth/me");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: {
        authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: body.name,
        profile_photo_url: body.profilePhotoUrl,
      }),
    });
  } catch {
    return NextResponse.json(
      { message: "No se pudo conectar con el backend", triedUrl: url },
      { status: 502 },
    );
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    return NextResponse.json(
      payload ?? { message: "No se pudo actualizar el perfil" },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload);
}
