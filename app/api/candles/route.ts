import { NextResponse } from "next/server";
import { fetchCandles } from "@/lib/providers/marketData";
import type { Interval } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID: Interval[] = ["5m", "15m", "1h", "4h", "1d"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol") ?? "XAUUSD";
  const interval = (url.searchParams.get("interval") ?? "1h") as Interval;
  if (!VALID.includes(interval)) {
    return NextResponse.json({ error: `interval must be one of ${VALID.join(", ")}` }, { status: 400 });
  }
  try {
    const res = await fetchCandles(symbol, interval);
    return NextResponse.json(res, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: "Candle feed unreachable", detail: (err as Error).message }, { status: 502 });
  }
}
