import { NextResponse } from "next/server";

import {
  errorToJson,
  getBackendBaseUrl,
  safeJson,
  toAbsoluteUrl,
} from "@/app/api/personnel/_utils";

type ReservationCreateBody = {
  name?: string;
  phone?: string;
  reservation_date?: string;
  reservation_time?: string;
  party_size?: number | string;
};

export async function GET(request: Request) {
  const backendBaseUrl = getBackendBaseUrl();
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const backendUrl = toAbsoluteUrl(backendBaseUrl, "/reservations");
  const targetUrl = month ? `${backendUrl}?month=${encodeURIComponent(month)}` : backendUrl;

  let response: Response;
  try {
    response = await fetch(targetUrl, { cache: "no-store" });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para cargar reservas. Verifica que Uvicorn esté corriendo.",
        backendUrl: backendBaseUrl,
        triedUrl: targetUrl,
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
      "No se pudieron cargar las reservas";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: targetUrl },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | ReservationCreateBody
    | null;

  if (!body) {
    return NextResponse.json(
      { message: "Body inválido (JSON requerido)" },
      { status: 400 },
    );
  }

  const name = (body.name ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const reservation_date = (body.reservation_date ?? "").trim();
  const reservation_time = (body.reservation_time ?? "").trim();
  const party_size =
    typeof body.party_size === "string"
      ? Number(body.party_size)
      : body.party_size;

  if (!name || !phone || !reservation_date || !reservation_time || !party_size) {
    return NextResponse.json(
      { message: "Nombre, teléfono, fecha, hora y personas son requeridos" },
      { status: 400 },
    );
  }

  const backendBaseUrl = getBackendBaseUrl();
  const backendUrl = toAbsoluteUrl(backendBaseUrl, "/reservations");

  let response: Response;
  try {
    response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        reservation_date,
        reservation_time,
        party_size,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para guardar la reserva. Verifica que Uvicorn esté corriendo.",
        backendUrl: backendBaseUrl,
        triedUrl: backendUrl,
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
      "No se pudo guardar la reserva";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: backendUrl },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload, { status: 201 });
}
