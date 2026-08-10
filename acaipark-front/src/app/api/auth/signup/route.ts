import { NextResponse } from "next/server";

type SignupRequestBody = {
  email?: string;
  password?: string;
  role?: "administrator" | "cashier";
};

type BackendUserOut = {
  id: number;
  email: string;
};

function getBackendBaseUrl() {
  return (
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  );
}

function getSignupPath() {
  return (
    process.env.BACKEND_SIGNUP_PATH ??
    process.env.NEXT_PUBLIC_BACKEND_SIGNUP_PATH ??
    "/auth/signup"
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

export async function POST(request: Request) {
  const body = (await request
    .json()
    .catch(() => null)) as SignupRequestBody | null;
  if (!body) {
    return NextResponse.json(
      { message: "Body inválido (JSON requerido)" },
      { status: 400 },
    );
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const role = body.role === "cashier" ? "cashier" : "administrator";

  if (!email || !password) {
    return NextResponse.json(
      { message: "Email y contraseña son requeridos" },
      { status: 400 },
    );
  }

  const baseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(baseUrl, getSignupPath());

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para registrar. Verifica que Uvicorn esté corriendo y que `BACKEND_URL` sea accesible desde el servidor de Next.js.",
        backendUrl: baseUrl,
        triedUrl: url,
        error: errorToJson(error),
      },
      { status: 502 },
    );
  }

  const payload = await safeJson(response);

  if (!response.ok) {
    const message =
      (typeof (payload as any)?.detail === "string" &&
        (payload as any).detail) ||
      (typeof (payload as any)?.message === "string" &&
        (payload as any).message) ||
      "No se pudo registrar el usuario";

    return NextResponse.json(
      { message, error: payload, backendUrl: baseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload as BackendUserOut);
}
