import { NextResponse } from "next/server";

type LoginRequestBody = {
  email?: string;
  username?: string;
  password?: string;
};

type NormalizedLoginResponse = {
  accessToken: string;
  tokenType: string;
  role?: "administrator" | "cashier";
  raw?: unknown;
};

function getBackendBaseUrl() {
  return (
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  );
}

function getLoginPaths() {
  const configured =
    process.env.BACKEND_LOGIN_PATHS ??
    process.env.NEXT_PUBLIC_BACKEND_LOGIN_PATHS ??
    "/auth/login,/auth/jwt/login,/token";

  return configured
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
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

function normalizeToken(payload: any): NormalizedLoginResponse | null {
  const accessToken =
    payload?.access_token ?? payload?.accessToken ?? payload?.token ?? null;
  if (!accessToken || typeof accessToken !== "string") return null;

  const tokenType =
    payload?.token_type ?? payload?.tokenType ?? payload?.type ?? "Bearer";

  return {
    accessToken,
    tokenType: typeof tokenType === "string" ? tokenType : "Bearer",
    role:
      payload?.role === "cashier" || payload?.role === "administrator"
        ? payload.role
        : undefined,
    raw: payload,
  };
}

async function attemptLogin(
  url: string,
  identifier: string,
  password: string,
): Promise<
  | { ok: true; data: NormalizedLoginResponse }
  | { ok: false; error: any; status: number }
> {
  const attempts: Array<{ init: RequestInit }> = [
    {
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: identifier, password }),
      },
    },
    {
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: identifier, password }),
      },
    },
    {
      init: {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: identifier,
          password,
        }).toString(),
      },
    },
    {
      init: {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: identifier, password }).toString(),
      },
    },
  ];

  let lastError: any = null;
  let lastStatus = 0;

  for (const { init } of attempts) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      return {
        ok: false,
        status: 502,
        error: {
          message:
            "No se pudo conectar con el backend para iniciar sesión. Verifica que Uvicorn esté corriendo y que `BACKEND_URL` sea accesible desde el servidor de Next.js.",
          triedUrl: url,
          error: errorToJson(error),
        },
      };
    }

    lastStatus = response.status;
    const payload = await safeJson(response);

    if (response.ok) {
      const normalized = normalizeToken(payload);
      if (!normalized) {
        return {
          ok: false,
          status: 502,
          error: { message: "Respuesta de login sin token", payload },
        };
      }
      return { ok: true, data: normalized };
    }

    lastError =
      payload ??
      (await response.text().catch(() => null)) ??
      ({ message: "Login failed" } as const);

    if (response.status !== 404 && response.status !== 405) {
      break;
    }
  }

  return { ok: false, status: lastStatus || 500, error: lastError };
}

export async function POST(request: Request) {
  const body = (await request
    .json()
    .catch(() => null)) as LoginRequestBody | null;
  if (!body) {
    return NextResponse.json(
      { message: "Body inválido (JSON requerido)" },
      { status: 400 },
    );
  }

  const identifier = (body.email ?? body.username ?? "").trim();
  const password = body.password ?? "";

  if (!identifier || !password) {
    return NextResponse.json(
      { message: "Email/usuario y contraseña son requeridos" },
      { status: 400 },
    );
  }

  const baseUrl = getBackendBaseUrl();
  const paths = getLoginPaths();

  let lastFailure: { status: number; error: any } | null = null;

  for (const path of paths) {
    const url = toAbsoluteUrl(baseUrl, path);
    const result = await attemptLogin(url, identifier, password);
    if (result.ok) return NextResponse.json(result.data);
    lastFailure = { status: result.status, error: result.error };
  }

  return NextResponse.json(
    {
      message: "El usuario o la contraseña son incorrectos",
      backendBaseUrl: baseUrl,
      triedPaths: paths,
      error: lastFailure?.error ?? null,
    },
    { status: lastFailure?.status ?? 401 },
  );
}
