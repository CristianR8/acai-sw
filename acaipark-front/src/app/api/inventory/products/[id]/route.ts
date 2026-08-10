import { NextResponse } from "next/server";

type InventoryProductUpdateBody = {
  name?: string;
  sku?: string | null;
  kind?: "ingredient" | "material" | "product";
  unit?: string | null;
  is_active?: boolean;
  on_hand?: string | number;
  total_cost?: string | number;
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

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorToJson(error: unknown) {
  if (error instanceof Error) {
    const anyError = error as any;
    return {
      name: error.name,
      message: error.message,
      code: anyError?.code,
      errno: anyError?.errno,
      syscall: anyError?.syscall,
      address: anyError?.address,
      port: anyError?.port,
      cause: anyError?.cause,
    };
  }
  return { message: String(error) };
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = params.id;

  const body = (await request.json().catch(() => null)) as
    | InventoryProductUpdateBody
    | null;

  if (!body) {
    return NextResponse.json(
      { message: "Body inválido (JSON requerido)" },
      { status: 400 },
    );
  }

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, `/inventory/products/${id}`);

  const payloadToSend: Record<string, unknown> = {};
  if (body.name !== undefined) payloadToSend.name = body.name;
  if (body.sku !== undefined) payloadToSend.sku = body.sku;
  if (body.kind !== undefined) payloadToSend.kind = body.kind;
  if (body.unit !== undefined) payloadToSend.unit = body.unit;
  if (body.is_active !== undefined) payloadToSend.is_active = body.is_active;
  if (body.on_hand !== undefined) payloadToSend.on_hand = body.on_hand;
  if (body.total_cost !== undefined) payloadToSend.total_cost = body.total_cost;

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
          "No se pudo conectar con el backend para editar el producto. Verifica que Uvicorn esté corriendo y que `BACKEND_URL` sea accesible desde el servidor de Next.js.",
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
      "No se pudo editar el producto";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = params.id;

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, `/inventory/products/${id}`);

  let response: Response;
  try {
    response = await fetch(url, { method: "DELETE" });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para eliminar el producto. Verifica que Uvicorn esté corriendo y que `BACKEND_URL` sea accesible desde el servidor de Next.js.",
        backendUrl: backendBaseUrl,
        triedUrl: url,
        error: errorToJson(error),
      },
      { status: 502 },
    );
  }

  if (response.status === 204) return new NextResponse(null, { status: 204 });

  const payload = await safeJson(response);
  if (!response.ok) {
    const message =
      (typeof (payload as any)?.detail === "string" && (payload as any).detail) ||
      (typeof (payload as any)?.message === "string" && (payload as any).message) ||
      "No se pudo eliminar el producto";
    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  return new NextResponse(null, { status: 204 });
}

