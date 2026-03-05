import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeNarrative = searchParams.get("includeNarrative") ?? "false";

    const body = await req.json();

    // quick validation (prevents confusing backend 400s)
    const poNumberOk = typeof body?.poNumber === "string" && body.poNumber.trim().length > 0;
    const itemsOk = Array.isArray(body?.items) && body.items.length > 0;

    if (!poNumberOk || !itemsOk) {
      return NextResponse.json(
        {
          error: "Invalid PO data (from proxy)",
          hint: "Expected { poNumber: string, items: non-empty array }",
          received: {
            poNumberType: typeof body?.poNumber,
            itemsIsArray: Array.isArray(body?.items),
            itemCount: Array.isArray(body?.items) ? body.items.length : 0,
            topKeys: body ? Object.keys(body) : [],
          },
        },
        { status: 400 }
      );
    }

    const backendRes = await fetch(
      `${BACKEND_URL}/api/analyse?includeNarrative=${includeNarrative}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error("Proxy error:", err);
    return NextResponse.json(
      { error: "Proxy error", detail: String(err) },
      { status: 500 }
    );
  }
}