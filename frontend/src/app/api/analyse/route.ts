import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeNarrative = searchParams.get("includeNarrative") ?? "false";

    // Parse the body as JSON first, then re-stringify for forwarding
    const body = await req.json();

    const backendRes = await fetch(
      `${BACKEND_URL}/api/analyse?includeNarrative=${includeNarrative}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(body),
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