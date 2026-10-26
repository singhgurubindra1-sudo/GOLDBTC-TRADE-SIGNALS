import type { Candle, Interval } from "../types";
import { getSymbol, type SymbolSpec } from "../symbols";

/**
 * Candle feeds, tried in order so the dashboard keeps working when one source is down:
 *   crypto : Binance -> Yahoo
 *   others : Yahoo -> Twelve Data (if TWELVE_DATA_API_KEY is set) -> Stooq (daily only)
 *
 * Nothing here needs an API key to work. All requests run server-side, so the browser
 * never hits a CORS wall.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type CandleResult = {
  candles: Candle[];
  provider: string;
  stale: boolean;
  fetchedAt: number;
  warnings: string[];
};

const TTL_MS: Record<Interval, number> = {
  "5m": 45_000,
  "15m": 60_000,
  "1h": 120_000,
  "4h": 240_000,
  "1d": 600_000,
};

type CacheEntry = { data: CandleResult; expires: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(symbol: string, interval: Interval) {
  return `${symbol}:${interval}`;
}

async function getJson(url: string, timeoutMs = 12_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

async function getText(url: string, timeoutMs = 12_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Yahoo has no 4h bar, so 4h is built from 1h candles. */
const YAHOO_INTERVAL: Record<Interval, { interval: string; range: string }> = {
  "5m": { interval: "5m", range: "5d" },
  "15m": { interval: "15m", range: "1mo" },
  "1h": { interval: "60m", range: "6mo" },
  // 4h bars are built from 1h candles, so this needs ~4x the history for a 200 EMA
  // (200 x 4h = 800 hourly candles, about 33 trading days).
  "4h": { interval: "60m", range: "6mo" },
  "1d": { interval: "1d", range: "2y" },
};

async function fromYahoo(spec: SymbolSpec, interval: Interval): Promise<Candle[]> {
  const cfg = YAHOO_INTERVAL[interval];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    spec.yahoo,
  )}?interval=${cfg.interval}&range=${cfg.range}&includePrePost=false`;
  const json = (await getJson(url)) as {
    chart?: { result?: { timestamp?: number[]; indicators?: { quote?: Record<string, number[]>[] } }[]; error?: unknown };
  };
  const result = json.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result?.timestamp || !quote) throw new Error("Yahoo returned no candles");
  const out: Candle[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    if ([o, h, l, c].some((v) => v == null || Number.isNaN(v))) continue;
    out.push({
      time: result.timestamp[i] * 1000,
      open: o as number,
      high: h as number,
      low: l as number,
      close: c as number,
      volume: quote.volume?.[i] ?? 0,
    });
  }
  return interval === "4h" ? aggregate(out, 4) : out;
}

const BINANCE_INTERVAL: Record<Interval, string> = {
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

async function fromBinance(spec: SymbolSpec, interval: Interval): Promise<Candle[]> {
  if (!spec.binance) throw new Error("no binance symbol");
  const url = `https://api.binance.com/api/v3/klines?symbol=${spec.binance}&interval=${BINANCE_INTERVAL[interval]}&limit=500`;
  const rows = (await getJson(url)) as (string | number)[][];
  return rows.map((r) => ({
    time: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  }));
}

const TWELVE_INTERVAL: Record<Interval, string> = {
  "5m": "5min",
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
};

async function fromTwelveData(spec: SymbolSpec, interval: Interval): Promise<Candle[]> {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new Error("TWELVE_DATA_API_KEY not set");
  const sym =
    spec.kind === "crypto"
      ? "BTC/USD"
      : spec.kind === "index"
        ? "DXY"
        : `${spec.key.slice(0, 3)}/${spec.key.slice(3)}`;
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
    sym,
  )}&interval=${TWELVE_INTERVAL[interval]}&outputsize=500&apikey=${key}`;
  const json = (await getJson(url)) as {
    values?: { datetime: string; open: string; high: string; low: string; close: string; volume?: string }[];
    message?: string;
  };
  if (!json.values) throw new Error(json.message || "Twelve Data returned no candles");
  return json.values
    .map((v) => ({
      time: new Date(`${v.datetime.replace(" ", "T")}Z`).getTime(),
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: Number(v.volume ?? 0),
    }))
    .sort((a, b) => a.time - b.time);
}

/** Daily only; used as a last resort so the daily bias never goes blank. */
async function fromStooq(spec: SymbolSpec): Promise<Candle[]> {
  if (!spec.stooq) throw new Error("no stooq symbol");
  const csv = await getText(`https://stooq.com/q/d/l/?s=${spec.stooq}&i=d`);
  const lines = csv.trim().split("\n").slice(1);
  const out: Candle[] = [];
  for (const line of lines) {
    const [date, o, h, l, c, v] = line.split(",");
    if (!date || !c) continue;
    out.push({
      time: new Date(`${date}T00:00:00Z`).getTime(),
      open: Number(o),
      high: Number(h),
      low: Number(l),
      close: Number(c),
      volume: Number(v ?? 0),
    });
  }
  if (!out.length) throw new Error("Stooq returned no rows");
  return out;
}

/** Merge n consecutive candles into one (used to build 4h bars from 1h bars). */
export function aggregate(candles: Candle[], factor: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += factor) {
    const chunk = candles.slice(i, i + factor);
    if (!chunk.length) continue;
    out.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map((c) => c.high)),
      low: Math.min(...chunk.map((c) => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((a, c) => a + c.volume, 0),
    });
  }
  return out;
}

export async function fetchCandles(
  symbolKey: string,
  interval: Interval,
  opts: { force?: boolean } = {},
): Promise<CandleResult> {
  const spec = getSymbol(symbolKey);
  if (!spec) throw new Error(`Unknown symbol ${symbolKey}`);
  const key = cacheKey(spec.key, interval);
  const hit = cache.get(key);
  const now = Date.now();
  if (!opts.force && hit && hit.expires > now) return hit.data;

  const chain: { name: string; run: () => Promise<Candle[]> }[] =
    spec.kind === "crypto"
      ? [
          { name: "binance", run: () => fromBinance(spec, interval) },
          { name: "yahoo", run: () => fromYahoo(spec, interval) },
        ]
      : [
          { name: "yahoo", run: () => fromYahoo(spec, interval) },
          { name: "twelvedata", run: () => fromTwelveData(spec, interval) },
          ...(interval === "1d" ? [{ name: "stooq", run: () => fromStooq(spec) }] : []),
        ];

  const warnings: string[] = [];
  for (const step of chain) {
    try {
      const candles = await step.run();
      if (candles.length < 30) throw new Error(`${step.name} returned only ${candles.length} candles`);
      const result: CandleResult = {
        candles,
        provider: step.name,
        stale: false,
        fetchedAt: now,
        warnings,
      };
      cache.set(key, { data: result, expires: now + TTL_MS[interval] });
      return result;
    } catch (err) {
      warnings.push(`${step.name}: ${(err as Error).message}`);
    }
  }

  // Everything failed. Serve the last good candles rather than breaking the page.
  if (hit) {
    const stale: CandleResult = { ...hit.data, stale: true, warnings };
    return stale;
  }
  throw new Error(`No candle feed reachable for ${spec.key} ${interval}. Tried: ${warnings.join(" | ")}`);
}

export async function fetchQuote(symbolKey: string): Promise<{ price: number; changePct: number }> {
  const daily = await fetchCandles(symbolKey, "1d");
  const candles = daily.candles;
  const lastCandle = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? lastCandle;
  return {
    price: lastCandle.close,
    changePct: prev.close ? ((lastCandle.close - prev.close) / prev.close) * 100 : 0,
  };
}
