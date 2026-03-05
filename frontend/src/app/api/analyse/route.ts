import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeNarrative = searchParams.get("includeNarrative") ?? "false";

  const body = await req.text();

  const backendRes = await fetch(
    `${BACKEND_URL}/api/analyse?includeNarrative=${includeNarrative}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }
  );

  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}