import { NextResponse } from "next/server";

type MenuItemCreateBody = {
  name?: string;
  category?: string;
  price?: string | number;
  description?: string | null;
  ingredients?: MenuItemIngredient[] | string[] | null;
};

type MenuItemIngredient = {
  name: string;
  unit: string;
  weight: string | number;
  price: string | number;
  total: string | number;
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

export async function GET() {
  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, "/menu/items");

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para cargar el menú. Verifica que Uvicorn esté corriendo y que `BACKEND_URL` sea accesible desde el servidor de Next.js.",
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
      "No se pudo cargar el menú";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | MenuItemCreateBody
    | null;

  if (!body) {
    return NextResponse.json(
      { message: "Body inválido (JSON requerido)" },
      { status: 400 },
    );
  }

  const name = (body.name ?? "").trim();
  const category = (body.category ?? "").trim();
  const price = body.price;

  if (!name || !category || price === undefined || price === null || price === "") {
    return NextResponse.json(
      { message: "Nombre, categoría y precio son requeridos" },
      { status: 400 },
    );
  }

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, "/menu/items");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        category,
        price,
        description: body.description ?? null,
        ingredients: body.ingredients ?? null,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para crear el item. Verifica que Uvicorn esté corriendo y que `BACKEND_URL` sea accesible desde el servidor de Next.js.",
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
      "No se pudo crear el item";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload, { status: 201 });
}
