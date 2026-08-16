import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.LOYALTY_PUBLIC_URL?.trim().replace(/\/$/, "") || "";
  return NextResponse.json({ url });
}
