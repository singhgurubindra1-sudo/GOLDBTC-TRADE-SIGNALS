import { NextResponse } from "next/server";
import { buildDashboard } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = url.searchParams.get("symbols");
  try {
    const payload = await buildDashboard(symbols ? symbols.split(",") : undefined);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Signal engine failed",
        detail: (err as Error).message,
        hint: "The server needs outbound access to query1.finance.yahoo.com (prices) and nfs.faireconomy.media (ForexFactory calendar).",
      },
      { status: 502 },
    );
  }
}
