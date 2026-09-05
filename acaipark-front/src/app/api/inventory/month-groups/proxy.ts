import { NextResponse } from "next/server";

export async function forwardMonthGroups(request: Request, suffix = "") {
  const base =
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000";
  try {
    const response = await fetch(
      `${base.replace(/\/$/, "")}/inventory/month-groups${suffix}`,
      {
        method: request.method,
        headers: {
          "content-type": "application/json",
          ...(request.headers.get("authorization")
            ? { authorization: request.headers.get("authorization")! }
            : {}),
        },
        body: request.method === "GET" ? undefined : await request.text(),
        cache: "no-store",
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok)
      return NextResponse.json(
        {
          message:
            typeof payload?.detail === "string"
              ? payload.detail
              : "No se pudo guardar el grupo. Revisa el mes y los productos seleccionados.",
        },
        { status: response.status },
      );
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "No se pudo conectar con el servidor de inventario." },
      { status: 502 },
    );
  }
}
