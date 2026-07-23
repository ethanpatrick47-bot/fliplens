import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const ready = Boolean(process.env.OPENAI_API_KEY);
  return NextResponse.json(
    {
      service: "fliplens",
      status: ready ? "ok" : "degraded",
      analysis: ready ? "ready" : "not-configured",
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
