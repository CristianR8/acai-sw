import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      message:
        "El registro público está deshabilitado en la aplicación administrativa.",
    },
    { status: 403 },
  );
}
