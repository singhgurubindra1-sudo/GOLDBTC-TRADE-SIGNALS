import { aggregate } from "./candles";
import { assembleReport, type SymbolReport } from "./report";
import type { Candle, Interval, NewsEvent } from "./types";

/**
 * Browser-side fallback feed.
 *
 * When the host running this app cannot reach the price APIs (an egress-filtered
 * container, a corporate network), the server returns no report. Rather than showing an
 * empty desk, the browser fetches candles itself from endpoints that send permissive CORS
 * headers, and runs the exact same signal engine locally.
 *
 * Coverage note: Binance has no FX feed, so this fallback covers gold and crypto only.
 * Gold uses PAXG (Paxos Gold) with XAUT (Tether Gold) as backup - both are redeemable
 * one-ounce gold tokens that track spot XAU/USD closely but not perfectly, and they trade
 * 24/7. Every report built this way is labelled, because a proxy is not the thing itself.
 */

const BINANCE_HOSTS = [
  "https://api.binance.com",
  "https://data-api.binance.vision",
  "https://api-gcp.binance.com",
];

const BINANCE_INTERVAL: Record<Interval, string> = {
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

export type ClientFeedSpec = {
  symbol: string;
  /** Binance tickers tried in order. */
  tickers: string[];
  proxyNote?: string;
};

export const CLIENT_FEEDS: ClientFeedSpec[] = [
  {
    symbol: "XAUUSD",
    tickers: ["PAXGUSDT", "XAUTUSDT"],
    proxyNote:
      "Browser fallback feed: candles are PAXG/USDT (a one-ounce gold token), not broker XAU/USD. It tracks spot closely but can differ by a few dollars, and it trades at weekends when gold does not. Levels are indicative - confirm on your MT5 chart.",
  },
  { symbol: "BTCUSD", tickers: ["BTCUSDT"] },
];

async function binanceKlines(ticker: string, interval: Interval, limit = 500): Promise<Candle[]> {
  let lastErr: Error | null = null;
  for (const host of BINANCE_HOSTS) {
    try {
      const res = await fetch(
        `${host}/api/v3/klines?symbol=${ticker}&interval=${BINANCE_INTERVAL[interval]}&limit=${limit}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json()) as (string | number)[][];
      return rows.map((r) => ({
        time: Number(r[0]),
        open: Number(r[1]),
        high: Number(r[2]),
        low: Number(r[3]),
        close: Number(r[4]),
        volume: Number(r[5]),
      }));
    } catch (err) {
      lastErr = err as Error;
    }
  }
  throw lastErr ?? new Error("no Binance host reachable");
}

/** Latest traded price, for the ticker between candle closes. */
export async function clientSpot(symbol: string): Promise<{ price: number; at: number; source: string } | null> {
  const spec = CLIENT_FEEDS.find((f) => f.symbol === symbol);
  if (!spec) return null;
  for (const ticker of spec.tickers) {
    for (const host of BINANCE_HOSTS) {
      try {
        const res = await fetch(`${host}/api/v3/ticker/price?symbol=${ticker}`, { cache: "no-store" });
        if (!res.ok) continue;
        const json = (await res.json()) as { price?: string };
        const price = Number(json.price);
        if (Number.isFinite(price) && price > 0) {
          return { price, at: Date.now(), source: `${ticker} (browser)` };
        }
      } catch {
        // try the next host
      }
    }
  }
  return null;
}

/** Build a full report for one symbol entirely in the browser. */
export async function buildClientReport(
  symbol: string,
  events: NewsEvent[],
  now = new Date(),
): Promise<SymbolReport | null> {
  const spec = CLIENT_FEEDS.find((f) => f.symbol === symbol);
  if (!spec) return null;

  for (const ticker of spec.tickers) {
    try {
      // One 5m pull plus a 1h pull covers every timeframe the engine needs: 15m is
      // aggregated from 5m, 4h and 1d from 1h.
      const [m5, h1] = await Promise.all([
        binanceKlines(ticker, "5m", 1000),
        binanceKlines(ticker, "1h", 1000),
      ]);
      const candles: Partial<Record<Interval, Candle[]>> = {
        "5m": m5,
        "15m": aggregate(m5, 3),
        "1h": h1,
        "4h": aggregate(h1, 4),
        "1d": aggregate(h1, 24),
      };
      return assembleReport({
        symbol,
        candles,
        events,
        now,
        providers: {
          "5m": `${ticker} browser`,
          "15m": `${ticker} browser (from 5m)`,
          "1h": `${ticker} browser`,
          "4h": `${ticker} browser (from 1h)`,
          "1d": `${ticker} browser (from 1h)`,
        },
        clientSide: true,
        proxyNote: spec.proxyNote,
      });
    } catch {
      // try the next ticker
    }
  }
  return null;
}

/** Last-resort calendar fetch straight from the browser. */
export async function clientCalendar(): Promise<NewsEvent[] | null> {
  try {
    const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", { cache: "no-store" });
    if (!res.ok) return null;
    const raw = (await res.json()) as {
      title: string;
      country: string;
      date: string;
      impact: string;
      forecast: string;
      previous: string;
    }[];
    const { pairsForCurrency } = await import("./symbols");
    return raw.map((r) => {
      const parsed = r.date ? new Date(r.date) : null;
      const currency = (r.country || "").toUpperCase();
      return {
        id: `${currency}-${r.title}-${r.date}`.replace(/\s+/g, "-").toLowerCase(),
        title: r.title,
        country: currency,
        currency,
        impact: (["High", "Medium", "Low", "Holiday"].includes(r.impact) ? r.impact : "Low") as NewsEvent["impact"],
        time: parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : null,
        forecast: r.forecast || "-",
        previous: r.previous || "-",
        affects: pairsForCurrency(currency),
        goldRelevance: currency === "USD" && r.impact === "High" ? "DIRECT" : currency === "USD" ? "INDIRECT" : "LOW",
        note:
          currency === "USD" && r.impact === "High"
            ? "High-impact USD release: spreads widen and stops slip. No new entries 30 min either side."
            : "Browser-fetched calendar entry.",
      } satisfies NewsEvent;
    });
  } catch {
    return null;
  }
}
