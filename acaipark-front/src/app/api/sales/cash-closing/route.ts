import { NextResponse } from "next/server";
const backend = () => (process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
export async function GET(request: Request) { const response = await fetch(`${backend()}/sales/cash-closing${new URL(request.url).search}`, { cache: "no-store" }); return NextResponse.json(await response.json(), { status: response.status }); }
export async function PUT(request: Request) { const response = await fetch(`${backend()}/sales/cash-closing${new URL(request.url).search}`, { method: "PUT", headers: { "content-type": "application/json" }, body: await request.text() }); return NextResponse.json(await response.json(), { status: response.status }); }
