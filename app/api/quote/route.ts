import { NextResponse } from "next/server";
import { fetchSpot } from "@/lib/providers/marketData";
import { SYMBOLS } from "@/lib/symbols";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Fast price tick for the headline quote, polled far more often than the full engine. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = (url.searchParams.get("symbols") ?? "XAUUSD,BTCUSD")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SYMBOLS.some((x) => x.key === s));

  const quotes: Record<string, { price: number; at: number; provider: string }> = {};
  const errors: string[] = [];
  await Promise.all(
    requested.map(async (sym) => {
      try {
        quotes[sym] = await fetchSpot(sym);
      } catch (err) {
        errors.push(`${sym}: ${(err as Error).message}`);
      }
    }),
  );

  return NextResponse.json(
    { quotes, errors, at: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
