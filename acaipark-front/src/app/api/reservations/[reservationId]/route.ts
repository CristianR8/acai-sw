import { NextResponse } from "next/server";

import {
  errorToJson,
  getBackendBaseUrl,
  safeJson,
  toAbsoluteUrl,
} from "@/app/api/personnel/_utils";

type ReservationUpdateBody = {
  name?: string;
  phone?: string;
  reservation_date?: string;
  reservation_time?: string;
  party_size?: number | string;
};

function parseReservationId(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ reservationId: string }> },
) {
  const params = await context.params;
  const reservationId = parseReservationId(params.reservationId);
  if (!reservationId) {
    return NextResponse.json({ message: "ID de reserva inválido" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as ReservationUpdateBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { message: "Body inválido (JSON requerido)" },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = {};

  if ("name" in body && body.name !== undefined) {
    const value = String(body.name).trim();
    if (!value) return NextResponse.json({ message: "Nombre inválido" }, { status: 400 });
    payload.name = value;
  }
  if ("phone" in body && body.phone !== undefined) {
    const value = String(body.phone).trim();
    if (!value) return NextResponse.json({ message: "Teléfono inválido" }, { status: 400 });
    payload.phone = value;
  }
  if ("reservation_date" in body && body.reservation_date !== undefined) {
    const value = String(body.reservation_date).trim();
    if (!value) return NextResponse.json({ message: "Fecha inválida" }, { status: 400 });
    payload.reservation_date = value;
  }
  if ("reservation_time" in body && body.reservation_time !== undefined) {
    const value = String(body.reservation_time).trim();
    if (!value) return NextResponse.json({ message: "Hora inválida" }, { status: 400 });
    payload.reservation_time = value;
  }
  if ("party_size" in body && body.party_size !== undefined) {
    const parsed =
      typeof body.party_size === "string"
        ? Number(body.party_size)
        : body.party_size;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json({ message: "Cantidad de personas inválida" }, { status: 400 });
    }
    payload.party_size = parsed;
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json(
      { message: "No hay campos para actualizar" },
      { status: 400 },
    );
  }

  const backendBaseUrl = getBackendBaseUrl();
  const backendUrl = toAbsoluteUrl(backendBaseUrl, `/reservations/${reservationId}`);

  let response: Response;
  try {
    response = await fetch(backendUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para actualizar la reserva. Verifica que Uvicorn esté corriendo.",
        backendUrl: backendBaseUrl,
        triedUrl: backendUrl,
        error: errorToJson(error),
      },
      { status: 502 },
    );
  }

  const responsePayload = await safeJson(response);
  if (!response.ok) {
    const message =
      (typeof (responsePayload as any)?.detail === "string" &&
        (responsePayload as any).detail) ||
      (typeof (responsePayload as any)?.message === "string" &&
        (responsePayload as any).message) ||
      "No se pudo actualizar la reserva";

    return NextResponse.json(
      {
        message,
        error: responsePayload,
        backendUrl: backendBaseUrl,
        triedUrl: backendUrl,
      },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(responsePayload);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ reservationId: string }> },
) {
  const params = await context.params;
  const reservationId = parseReservationId(params.reservationId);
  if (!reservationId) {
    return NextResponse.json({ message: "ID de reserva inválido" }, { status: 400 });
  }

  const backendBaseUrl = getBackendBaseUrl();
  const backendUrl = toAbsoluteUrl(backendBaseUrl, `/reservations/${reservationId}`);

  let response: Response;
  try {
    response = await fetch(backendUrl, { method: "DELETE" });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para eliminar la reserva. Verifica que Uvicorn esté corriendo.",
        backendUrl: backendBaseUrl,
        triedUrl: backendUrl,
        error: errorToJson(error),
      },
      { status: 502 },
    );
  }

  if (!response.ok && response.status !== 204) {
    const responsePayload = await safeJson(response);
    const message =
      (typeof (responsePayload as any)?.detail === "string" &&
        (responsePayload as any).detail) ||
      (typeof (responsePayload as any)?.message === "string" &&
        (responsePayload as any).message) ||
      "No se pudo eliminar la reserva";

    return NextResponse.json(
      {
        message,
        error: responsePayload,
        backendUrl: backendBaseUrl,
        triedUrl: backendUrl,
      },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
